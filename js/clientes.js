/**
 * ============================================================================
 * ARQUIVO: js/clientes.js
 * DESCRIÇÃO: Tela de Clientes (performance + cache + animação + sincronização)
 * DEPENDÊNCIAS: js/config.js, js/utils.js, js/api.js, js/auth.js
 * ============================================================================
 */

(function () {
    "use strict";

    // ========================================================================
    // ESTADO
    // ========================================================================
    let clientes = [];
    let renderJobId = 0;
    let isFetching = false;

    // TTL maior para clientes (minutos) — reduz “lag” e chamadas repetidas
    const TTL_CLIENTES_MIN = 60;

    // Chave do cache (padrão do API.fetchWithCache: `${action}_${JSON.stringify(params)}`)
    function getClientesCacheKey() {
        return "listarClientes_" + JSON.stringify({});
    }

    // Sincronização entre abas / páginas
    const SYNC_CHANNEL = "rpps_juridico_sync";
    const STORAGE_SYNC_KEY = "rpps_clientes_last_update";

    let bc = null;

    // ========================================================================
    // INIT
    // ========================================================================
    document.addEventListener("DOMContentLoaded", function () {
        Auth.protectRoute();

        inicializarUsuario();
        bindEventos();
        iniciarListenersSync();

        // 1) Renderiza IMEDIATO do cache, se existir (sem “sensação de travado”)
        const tinhaCache = hidratarDoCache();

        // 2) Atualiza em background (sem travar a UI)
        carregarClientes({
            mostrarPlaceholderSeVazio: !tinhaCache,
            animarBotao: false,
            silent: true,
            toastErroSeSemCache: true,
            broadcastOnNetwork: true
        });
    });

    function inicializarUsuario() {
        const user = Auth.getUser();
        if (!user) return;

        const nome = user.nome || user.email || "Usuário";
        const perfil = user.perfil || "";
        const iniciais = (nome || "U").charAt(0).toUpperCase();

        const nameEl = document.getElementById("user-name-display");
        const profileEl = document.getElementById("user-profile-display");
        const initEl = document.getElementById("user-initials");

        if (nameEl) nameEl.textContent = nome;
        if (profileEl) profileEl.textContent = perfil;
        if (initEl) initEl.textContent = iniciais;
    }

    // ========================================================================
    // EVENTOS
    // ========================================================================
    function bindEventos() {
        const logout = document.getElementById("desktop-logout-btn");
        if (logout) {
            logout.addEventListener("click", function () {
                if (confirm("Sair do sistema?")) Auth.logout();
            });
        }

        const btnAtualizar = document.getElementById("btn-atualizar-clientes");
        if (btnAtualizar) {
            btnAtualizar.addEventListener("click", function () {
                // Força rede limpando cache do prefixo “listarClientes”
                Utils.Cache.clear("listarClientes");

                carregarClientes({
                    mostrarPlaceholderSeVazio: false,
                    animarBotao: true,
                    silent: true,
                    toastOk: true,
                    toastErroSeSemCache: true,
                    broadcastOnNetwork: true
                });
            });
        }

        const busca = document.getElementById("busca-clientes");
        if (busca) {
            busca.addEventListener("input", function () {
                renderClientes(this.value);
            });
        }

        // Máscara CPF
        const cpfEl = document.getElementById("cliente-cpf");
        if (cpfEl) {
            cpfEl.addEventListener("input", function (e) {
                let value = e.target.value.replace(/\D/g, "").substring(0, 11);
                if (value.length > 9) value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
                else if (value.length > 6) value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
                else if (value.length > 3) value = value.replace(/(\d{3})(\d{1,3})/, "$1.$2");
                e.target.value = value;
            });
        }

        // Máscara Telefone
        const telEl = document.getElementById("cliente-telefone");
        if (telEl) {
            telEl.addEventListener("input", function (e) {
                let value = e.target.value.replace(/\D/g, "").substring(0, 11);
                if (value.length > 6) value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
                else if (value.length > 2) value = value.replace(/(\d{2})(\d{0,5})/, "($1) $2");
                e.target.value = value;
            });
        }

        // Cadastro Cliente
        const form = document.getElementById("form-cliente");
        if (form) {
            form.addEventListener("submit", async function (e) {
                e.preventDefault();

                const btnSubmit = form.querySelector('button[type="submit"]');
                setBtnLoading(btnSubmit, true, "Cadastrando...");

                try {
                    const nome = (document.getElementById("cliente-nome").value || "").trim();
                    const cpfFormatado = (document.getElementById("cliente-cpf").value || "").trim();
                    const email = (document.getElementById("cliente-email").value || "").trim();
                    const telefoneFormatado = (document.getElementById("cliente-telefone").value || "").trim();

                    // Normaliza CPF como STRING de 11 dígitos (mantém zeros à esquerda)
                    const cpfLimpo = normalizarCPFFrontend(cpfFormatado);

                    if (!nome) throw new Error("Informe o nome do cliente.");
                    if (!cpfLimpo || cpfLimpo.length !== 11) throw new Error("CPF inválido.");
                    if (!email) throw new Error("Informe o e-mail do cliente.");

                    const payload = {
                        nome_completo: nome,
                        cpf: cpfLimpo, // envia limpo (11 dígitos) para evitar problemas com zero à esquerda
                        email: email,
                        telefone: normalizarTelefoneFrontend(telefoneFormatado),
                        status: "ATIVO"
                    };

                    // Cadastro (silencioso no overlay, usando só o loading do botão)
                    // OBS: action existe no seu Code.gs: cadastrarCliente
                    const criado = await API.call("cadastrarCliente", payload, "POST", true);

                    Utils.showToast("Cliente cadastrado com sucesso!", "success");
                    form.reset();

                    // Atualiza lista local + cache IMEDIATAMENTE (para refletir no Novo Processo também)
                    aplicarClienteCriadoNoCache(criado, payload);

                    // Re-render com termo atual
                    const termo = (document.getElementById("busca-clientes").value || "");
                    renderClientes(termo);

                    // Refresh em background para garantir 100% sincronizado (SEM broadcast para não gerar ping-pong)
                    carregarClientes({
                        mostrarPlaceholderSeVazio: false,
                        animarBotao: false,
                        silent: true,
                        toastErroSeSemCache: false,
                        broadcastOnNetwork: false
                    });

                } catch (err) {
                    Utils.showToast((err && err.message) ? err.message : "Erro ao cadastrar cliente.", "error");
                } finally {
                    setBtnLoading(btnSubmit, false);
                }
            });
        }
    }

    // ========================================================================
    // CARREGAMENTO / CACHE / SYNC
    // ========================================================================
    function hidratarDoCache() {
        try {
            const cacheKey = getClientesCacheKey();
            const cached = Utils.Cache.get(cacheKey);

            if (Array.isArray(cached) && cached.length) {
                clientes = cached;
                const termo = (document.getElementById("busca-clientes") && document.getElementById("busca-clientes").value) ? document.getElementById("busca-clientes").value : "";
                renderClientes(termo);
                return true;
            }
        } catch (e) {
            // ignora
        }
        return false;
    }

    async function carregarClientes(options) {
        const opts = Object.assign({
            mostrarPlaceholderSeVazio: true,
            animarBotao: true,
            silent: true,
            toastOk: false,
            toastErroSeSemCache: true,
            broadcastOnNetwork: true
        }, options || {});

        if (isFetching) return;
        isFetching = true;

        const tbody = document.getElementById("lista-clientes");
        const btnAtualizar = document.getElementById("btn-atualizar-clientes");

        // Placeholder só se ainda não temos nada pra mostrar
        if (opts.mostrarPlaceholderSeVazio && tbody && (!clientes || clientes.length === 0)) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">Carregando clientes...</td></tr>';
        }

        if (opts.animarBotao) {
            setBtnLoading(btnAtualizar, true, "Atualizando...");
        }

        try {
            await API.clientes.listar(function (resultado, source) {
                const data = Array.isArray(resultado) ? resultado : [];

                // Atualiza memória
                clientes = data;

                // Re-render local (rápido)
                const termo = (document.getElementById("busca-clientes") && document.getElementById("busca-clientes").value) ? document.getElementById("busca-clientes").value : "";
                renderClientes(termo);

                // Se veio da rede, reforça TTL e dispara sync (se permitido)
                if (source === "network") {
                    try {
                        Utils.Cache.set(getClientesCacheKey(), data, TTL_CLIENTES_MIN);
                    } catch (e) {}

                    if (opts.broadcastOnNetwork) {
                        broadcastClientesAtualizados();
                    }
                }
            }, opts.silent);

            if (opts.toastOk) {
                Utils.showToast("Lista de clientes atualizada!", "success");
            }
        } catch (e) {
            // Se não tem cache e falhou, mostra erro na tabela
            if ((!clientes || clientes.length === 0) && tbody) {
                tbody.innerHTML =
                    '<tr>' +
                    '  <td colspan="5" class="py-6 text-center text-red-500">' +
                    '    Falha ao carregar clientes. ' +
                    '    <button id="btn-tentar-novamente-clientes" class="ml-2 text-sm text-blue-600 hover:underline">Tentar novamente</button>' +
                    '  </td>' +
                    '</tr>';

                const retry = document.getElementById("btn-tentar-novamente-clientes");
                if (retry) {
                    retry.addEventListener("click", function () {
                        carregarClientes({
                            mostrarPlaceholderSeVazio: true,
                            animarBotao: true,
                            silent: true,
                            toastErroSeSemCache: true,
                            broadcastOnNetwork: true
                        });
                    });
                }

                if (opts.toastErroSeSemCache) {
                    Utils.showToast("Sem conexão. Não foi possível carregar clientes.", "error");
                }
            } else {
                // Se tem cache, mantém e só avisa discreto
                if (opts.toastErroSeSemCache) {
                    Utils.showToast("Sem conexão. Exibindo dados em cache.", "warning");
                }
            }
        } finally {
            if (opts.animarBotao) {
                setBtnLoading(btnAtualizar, false);
            }
            isFetching = false;
        }
    }

    function aplicarClienteCriadoNoCache(criado, payloadFallback) {
        // “criado” pode vir null, ou com dados parciais dependendo do backend
        const novo = Object.assign({}, payloadFallback, (criado && typeof criado === "object") ? criado : {});

        // Garante formato mínimo
        novo.nome_completo = String(novo.nome_completo || payloadFallback.nome_completo || "").trim();
        novo.cpf = normalizarCPFFrontend(novo.cpf || payloadFallback.cpf);
        novo.email = String(novo.email || payloadFallback.email || "").trim();
        novo.telefone = String(novo.telefone || payloadFallback.telefone || "").trim();
        novo.status = novo.status || "ATIVO";

        // Evita duplicar por ID ou CPF
        const novoId = String(novo.id || "");
        const novoCpf = String(novo.cpf || "");

        const jaExiste = (clientes || []).some(function (c) {
            const cid = String(c.id || "");
            const ccpf = normalizarCPFFrontend(c.cpf);
            return (novoId && cid && cid === novoId) || (novoCpf && ccpf && ccpf === novoCpf);
        });

        if (!jaExiste) {
            clientes.push(novo);

            // Ordena por nome (melhor UX)
            clientes.sort(function (a, b) {
                const an = String(a.nome_completo || "").toLowerCase();
                const bn = String(b.nome_completo || "").toLowerCase();
                return an.localeCompare(bn);
            });
        }

        // Atualiza cache com TTL maior (isso acelera “Novo Processo”)
        try {
            Utils.Cache.set(getClientesCacheKey(), clientes, TTL_CLIENTES_MIN);
        } catch (e) {}

        // Broadcast (para outras abas/páginas)
        broadcastClientesAtualizados();
    }

    function iniciarListenersSync() {
        // BroadcastChannel (outras abas)
        try {
            if ("BroadcastChannel" in window) {
                bc = new BroadcastChannel(SYNC_CHANNEL);
                bc.onmessage = function (ev) {
                    const msg = ev && ev.data ? ev.data : null;
                    if (!msg || msg.type !== "clientes_updated") return;

                    // Apenas hidrata do cache (instantâneo) + refresh silencioso SEM rebroadcast (evita ping-pong)
                    hidratarDoCache();
                    carregarClientes({
                        mostrarPlaceholderSeVazio: false,
                        animarBotao: false,
                        silent: true,
                        toastErroSeSemCache: false,
                        broadcastOnNetwork: false
                    });
                };
            }
        } catch (e) {
            bc = null;
        }

        // Storage event (outras abas)
        window.addEventListener("storage", function (e) {
            if (e.key !== STORAGE_SYNC_KEY) return;

            hidratarDoCache();
            carregarClientes({
                mostrarPlaceholderSeVazio: false,
                animarBotao: false,
                silent: true,
                toastErroSeSemCache: false,
                broadcastOnNetwork: false
            });
        });
    }

    function broadcastClientesAtualizados() {
        try {
            localStorage.setItem(STORAGE_SYNC_KEY, String(Date.now()));
        } catch (e) {}

        try {
            if (bc) {
                bc.postMessage({ type: "clientes_updated", ts: Date.now() });
            }
        } catch (e) {}
    }

    // ========================================================================
    // RENDER (COM CHUNK PARA NÃO TRAVAR COM LISTAS GRANDES)
    // ========================================================================
    function renderClientes(termo) {
        const tbody = document.getElementById("lista-clientes");
        if (!tbody) return;

        const t = String(termo || "").toLowerCase().trim();
        let filtrados = clientes || [];

        if (t) {
            const digits = t.replace(/\D/g, "");
            filtrados = filtrados.filter(function (c) {
                const nome = String(c.nome_completo || "").toLowerCase();
                const cpf = String(c.cpf || "").toLowerCase();
                const email = String(c.email || "").toLowerCase();
                const cpfDigits = cpf.replace(/\D/g, "");
                return (
                    nome.indexOf(t) !== -1 ||
                    cpf.indexOf(t) !== -1 ||
                    email.indexOf(t) !== -1 ||
                    (digits && cpfDigits.indexOf(digits) !== -1)
                );
            });
        }

        if (!filtrados || filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>';
            return;
        }

        // Cancela render anterior (se usuário digitou rápido)
        const jobId = ++renderJobId;

        // Render em chunks para evitar “lag” em listas grandes
        tbody.innerHTML = "";

        const CHUNK = 120;
        let idx = 0;

        function appendChunk() {
            if (jobId !== renderJobId) return; // cancelado

            const end = Math.min(idx + CHUNK, filtrados.length);
            let html = "";

            for (; idx < end; idx++) {
                const c = filtrados[idx];
                html += buildRow(c);
            }

            tbody.insertAdjacentHTML("beforeend", html);

            if (idx < filtrados.length) {
                requestAnimationFrame(appendChunk);
            }
        }

        requestAnimationFrame(appendChunk);
    }

    function buildRow(c) {
        const status = escapeHtml(c.status || "-");
        return (
            '<tr class="border-b border-slate-100">' +
            '<td class="py-2 text-slate-800 font-medium">' + escapeHtml(c.nome_completo || "-") + "</td>" +
            '<td class="py-2">' + escapeHtml(formatarCPFParaExibicao(c.cpf) || "-") + "</td>" +
            '<td class="py-2">' + escapeHtml(c.email || "-") + "</td>" +
            '<td class="py-2">' + escapeHtml(c.telefone || "-") + "</td>" +
            '<td class="py-2"><span class="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">' + status + "</span></td>" +
            "</tr>"
        );
    }

    // ========================================================================
    // UI HELPERS (usa CSS .btn-loading)
    // ========================================================================
    function setBtnLoading(btn, loading, loadingText) {
        if (!btn) return;

        if (loading) {
            if (btn.dataset.loading === "1") return;

            btn.dataset.loading = "1";
            btn.dataset.originalText = btn.textContent;
            btn.disabled = true;

            btn.classList.add("btn-loading");
            if (loadingText) btn.textContent = loadingText;

        } else {
            btn.dataset.loading = "0";
            btn.disabled = false;

            btn.classList.remove("btn-loading");
            if (btn.dataset.originalText != null) btn.textContent = btn.dataset.originalText;
        }
    }

    // ========================================================================
    // NORMALIZAÇÕES (evita bug de CPF começando com 0)
    // ========================================================================
    function normalizarCPFFrontend(valor) {
        const digits = String(valor || "").replace(/\D/g, "");
        if (!digits) return "";
        // Mantém CPF sempre como string 11 dígitos (padStart garante zeros à esquerda)
        return digits.substring(0, 11).padStart(11, "0");
    }

    function normalizarTelefoneFrontend(valor) {
        const digits = String(valor || "").replace(/\D/g, "");
        // Telefone pode ficar vazio
        return digits.substring(0, 11);
    }

    function formatarCPFParaExibicao(cpf) {
        const digits = String(cpf || "").replace(/\D/g, "");
        if (digits.length !== 11) return String(cpf || "");
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();
