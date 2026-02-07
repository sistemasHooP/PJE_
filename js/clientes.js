(function() {
    let clientes = [];

    // ========================================================================
    // [FIX BUG 3] CACHE DE CLIENTES
    // Constante para chave do cache (mesma usada no login.js para prefetch)
    // TTL de 10 minutos — após isso, força rede.
    // ========================================================================
    var CLIENTES_CACHE_KEY = 'rpps_clientes_cache';
    var CLIENTES_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

    function getClientesCache() {
        try {
            var raw = localStorage.getItem(CLIENTES_CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.data)) return null;
            // Verifica TTL
            if (Date.now() - (parsed.timestamp || 0) > CLIENTES_CACHE_TTL) {
                return null; // Cache expirado, mas não remove — será usado como stale
            }
            return parsed.data;
        } catch (e) {
            return null;
        }
    }

    function getClientesCacheStale() {
        // Retorna cache mesmo expirado (stale), para exibir algo enquanto rede carrega
        try {
            var raw = localStorage.getItem(CLIENTES_CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.data)) return null;
            return parsed.data;
        } catch (e) {
            return null;
        }
    }

    function setClientesCache(data) {
        try {
            localStorage.setItem(CLIENTES_CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[Clientes] Erro ao salvar cache:', e);
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        Auth.protectRoute();
        inicializarUsuario();
        bindEventos();
        carregarClientes();
    });

    function inicializarUsuario() {
        var user = Auth.getUser();
        if (!user) return;

        var nome = user.nome || user.email || 'Usuário';
        var perfil = user.perfil || '';
        var iniciais = (nome || 'U').charAt(0).toUpperCase();

        var nameEl = document.getElementById('user-name-display');
        var profileEl = document.getElementById('user-profile-display');
        var initEl = document.getElementById('user-initials');

        if (nameEl) nameEl.textContent = nome;
        if (profileEl) profileEl.textContent = perfil;
        if (initEl) initEl.textContent = iniciais;
    }

    function bindEventos() {
        var logout = document.getElementById('desktop-logout-btn');
        if (logout) {
            logout.addEventListener('click', function() {
                if (confirm('Sair do sistema?')) Auth.logout();
            });
        }

        document.getElementById('btn-atualizar-clientes').addEventListener('click', function() {
            // Forçar atualização: limpa cache e recarrega
            localStorage.removeItem(CLIENTES_CACHE_KEY);
            carregarClientes();
        });

        document.getElementById('busca-clientes').addEventListener('input', function() {
            renderClientes(this.value);
        });

        document.getElementById('cliente-cpf').addEventListener('input', function(e) {
            var value = e.target.value.replace(/\D/g, '').substring(0, 11);
            if (value.length > 9) value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            else if (value.length > 6) value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            else if (value.length > 3) value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            e.target.value = value;
        });

        document.getElementById('cliente-telefone').addEventListener('input', function(e) {
            var value = e.target.value.replace(/\D/g, '').substring(0, 11);
            if (value.length > 6) value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
            else if (value.length > 2) value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            e.target.value = value;
        });

        document.getElementById('form-cliente').addEventListener('submit', async function(e) {
            e.preventDefault();

            var payload = {
                nome_completo: document.getElementById('cliente-nome').value.trim(),
                cpf: document.getElementById('cliente-cpf').value,
                email: document.getElementById('cliente-email').value.trim(),
                telefone: document.getElementById('cliente-telefone').value
            };

            try {
                await API.clientes.cadastrar(payload);
                Utils.showToast('Cliente cadastrado com sucesso!', 'success');
                e.target.reset();
                // Limpa cache para forçar refresh
                localStorage.removeItem(CLIENTES_CACHE_KEY);
                carregarClientes();
            } catch (err) {
                Utils.showToast(err.message || 'Erro ao cadastrar cliente.', 'error');
            }
        });
    }

    // ========================================================================
    // [FIX BUG 3] CARREGAMENTO COM CACHE-FIRST (SWR)
    // 1. Mostra dados do cache IMEDIATAMENTE (se houver)
    // 2. Busca dados frescos na rede em background
    // 3. Atualiza a tabela quando a rede responder
    // ========================================================================
    async function carregarClientes() {
        var tbody = document.getElementById('lista-clientes');

        // PASSO 1: Tentar cache (inclui stale para máxima responsividade)
        var cached = getClientesCache() || getClientesCacheStale();
        if (cached && cached.length > 0) {
            console.log('[Clientes] Exibindo ' + cached.length + ' clientes do cache.');
            clientes = cached;
            renderClientes(document.getElementById('busca-clientes').value || '');
        } else {
            // Sem cache: mostra loading
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">Carregando clientes...</td></tr>';
        }

        // PASSO 2: Buscar dados frescos na rede (silencioso se já tem cache)
        try {
            var freshData = await API.clientes.listar();
            clientes = Array.isArray(freshData) ? freshData : [];

            // Salva no cache
            setClientesCache(clientes);

            // Atualiza tabela com dados frescos
            renderClientes(document.getElementById('busca-clientes').value || '');
            console.log('[Clientes] Tabela atualizada via rede: ' + clientes.length + ' clientes.');
        } catch (e) {
            // Se falhou E não tinha cache, mostra erro
            if (!cached || cached.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-red-500">Erro ao carregar clientes.</td></tr>';
            } else {
                console.warn('[Clientes] Rede falhou, mantendo dados do cache.');
            }
        }
    }

    function renderClientes(termo) {
        var tbody = document.getElementById('lista-clientes');
        var t = (termo || '').toLowerCase().trim();

        var filtrados = clientes;
        if (t) {
            var digits = t.replace(/\D/g, '');
            filtrados = clientes.filter(function(c) {
                var nome = String(c.nome_completo || '').toLowerCase();
                var cpf = String(c.cpf || '').toLowerCase();
                var email = String(c.email || '').toLowerCase();
                var cpfDigits = cpf.replace(/\D/g, '');
                return nome.includes(t) || cpf.includes(t) || email.includes(t) || (digits && cpfDigits.includes(digits));
            });
        }

        if (!filtrados || filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = filtrados.map(function(c) {
            return '<tr class="border-b border-slate-100">' +
                '<td class="py-2 text-slate-800 font-medium">' + escapeHtml(c.nome_completo || '-') + '</td>' +
                '<td class="py-2">' + escapeHtml(c.cpf || '-') + '</td>' +
                '<td class="py-2">' + escapeHtml(c.email || '-') + '</td>' +
                '<td class="py-2">' + escapeHtml(c.telefone || '-') + '</td>' +
                '<td class="py-2"><span class="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">' + escapeHtml(c.status || '-') + '</span></td>' +
                '</tr>';
        }).join('');
    }

    function escapeHtml(text) {
        return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
})();
