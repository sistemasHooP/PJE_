/**
 * ============================================================================
 * ARQUIVO: js/novo-processo.js
 * DESCRIÇÃO: Lógica de negócio da tela de Novo Processo (Wizard).
 * FUNCIONALIDADES: Busca inteligente, Gestão de Passos (Stepper), Validações.
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js
 * ============================================================================
 */

// =====================================================================
// VARIÁVEIS GLOBAIS DE ESTADO
// =====================================================================

let clienteSelecionado = null; // Guarda o objeto do cliente escolhido
let clienteVinculado = false;  // Flag para saber se o usuário escolheu um cliente
let listaClientesCache = [];   // Cópia local da base de clientes para busca rápida
let clientesById = {};         // Índice para busca O(1) por ID
let processosCache = [];       // Cache de processos para alerta de duplicidade

// =====================================================================
// INICIALIZAÇÃO E SETUP
// =====================================================================

document.addEventListener('DOMContentLoaded', async function() {
    // 1. Proteção de Rota (Segurança)
    if (!Auth.protectRoute()) return;

    // 2. Configurar Interface do Usuário (Nome, Avatar)
    setupUserUI();

    // 3. Inicializar Componentes Visuais
    setupDatePickers();
    setupMascaras();
    setupCampoOutros();

    // 4. Carregar Dados em Segundo Plano (Performance)
    // Dispara as requisições sem travar a tela
    await Promise.all([
        carregarClientesParaCache(),
        carregarProcessosParaCache()
    ]);

    // 5. Configurar Eventos (Cliques, Envios)
    setupEventListeners();
});

function setupUserUI() {
    Auth.updateUserInfoUI();
    const user = Auth.getUser();
    if (user && user.nome) {
        const el = document.getElementById('user-initials');
        if (el) el.textContent = user.nome.substring(0, 1).toUpperCase();
    }
}

function setupDatePickers() {
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#data_entrada", {
            locale: "pt",
            dateFormat: "d/m/Y",
            defaultDate: new Date(),
            allowInput: true
        });
    }
}

function setupCampoOutros() {
    const tipoSelect = document.getElementById('tipo');
    const divOutros = document.getElementById('div-tipo-outro');
    const inputOutros = document.getElementById('tipo_outro');

    if (tipoSelect && divOutros) {
        tipoSelect.addEventListener('change', function() {
            if (this.value === 'OUTROS') {
                divOutros.classList.remove('hidden');
                if (inputOutros) {
                    inputOutros.setAttribute('required', 'true');
                    inputOutros.focus();
                }
            } else {
                divOutros.classList.add('hidden');
                if (inputOutros) {
                    inputOutros.removeAttribute('required');
                    inputOutros.value = '';
                }
            }
        });
    }
}

function setupEventListeners() {
    // Logout
    const btnLogout = document.getElementById('desktop-logout-btn');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => { if (confirm('Sair do sistema?')) Auth.logout(); });
    }

    // Busca por CPF (Botão e Enter)
    const btnBuscarCPF = document.getElementById('btn-buscar-cpf');
    const inputCPF = document.getElementById('cpf-busca');
    
    if (btnBuscarCPF) btnBuscarCPF.addEventListener('click', buscarClientePorCPF);
    if (inputCPF) {
        inputCPF.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); buscarClientePorCPF(); }
        });
    }

    // Busca Rápida (Autocomplete)
    const inputRapido = document.getElementById('cliente-busca-rapida');
    const btnUsarRapido = document.getElementById('btn-usar-cliente-rapido');

    if (inputRapido) {
        inputRapido.addEventListener('input', renderizarSugestoes);
        inputRapido.addEventListener('focus', renderizarSugestoes);
        inputRapido.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); selecionarClienteRapido(); }
        });
        
        // Fechar sugestões ao clicar fora
        document.addEventListener('click', (e) => {
            const box = document.getElementById('clientes-sugestoes');
            const wrap = inputRapido.parentElement;
            if (box && wrap && !wrap.contains(e.target)) {
                box.classList.add('hidden');
            }
        });
    }

    if (btnUsarRapido) {
        btnUsarRapido.addEventListener('click', () => selecionarClienteRapido());
    }

    // Formulário Final
    const form = document.getElementById('form-processo');
    if (form) form.addEventListener('submit', salvarProcesso);
}

// =====================================================================
// LÓGICA DE DADOS (CACHE E API)
// =====================================================================

async function carregarClientesParaCache() {
    try {
        // Usa 'silent=true' para não mostrar loading na tela
        // Tenta pegar do cache local primeiro (instantâneo)
        API.clientes.listar((dados, source) => {
            listaClientesCache = Array.isArray(dados) ? dados : [];
            
            // Cria índice por ID para acesso rápido
            clientesById = {};
            listaClientesCache.forEach(c => {
                if (c.id) clientesById[String(c.id)] = c;
            });

            // Se a lista veio do cache, já atualiza as sugestões visualmente
            if (source === 'cache') popularDatalist();
        }, true);
    } catch (e) {
        console.warn("Erro ao carregar clientes:", e);
    }
}

async function carregarProcessosParaCache() {
    try {
        // Carrega processos para verificar duplicidade depois
        API.processos.listar({}, (dados) => {
            processosCache = Array.isArray(dados) ? dados : [];
        }, true);
    } catch (e) {
        console.warn("Erro ao carregar cache de processos:", e);
    }
}

// =====================================================================
// BUSCA INTELIGENTE E AUTOCOMPLETE
// =====================================================================

function popularDatalist() {
    const datalist = document.getElementById('clientes-lista');
    if (!datalist) return;
    datalist.innerHTML = '';

    // Limita a 50 sugestões no datalist nativo para não pesar
    listaClientesCache.slice(0, 50).forEach(c => {
        const option = document.createElement('option');
        const text = `${c.nome_completo} | CPF: ${c.cpf}`;
        option.value = text;
        datalist.appendChild(option);
    });
}

function filtrarClientesLocal(termo) {
    const termoLimpo = Utils.normalizeText(termo);
    const termoDigitos = termoLimpo.replace(/\D/g, '');

    if (!termoLimpo) return listaClientesCache.slice(0, 5); // Retorna os 5 primeiros se vazio

    return listaClientesCache.filter(c => {
        const nome = Utils.normalizeText(c.nome_completo);
        const email = Utils.normalizeText(c.email);
        const cpf = String(c.cpf || '').replace(/\D/g, '');

        // Lógica de match: Nome OU Email OU (CPF se tiver dígitos suficientes)
        const matchTexto = nome.includes(termoLimpo) || email.includes(termoLimpo);
        const matchCPF = (termoDigitos.length >= 3) && cpf.includes(termoDigitos);

        return matchTexto || matchCPF;
    }).slice(0, 8); // Limita resultados
}

function renderizarSugestoes() {
    const input = document.getElementById('cliente-busca-rapida');
    const box = document.getElementById('clientes-sugestoes');
    if (!input || !box) return;

    const resultados = filtrarClientesLocal(input.value);

    if (resultados.length === 0) {
        box.innerHTML = `<div class="p-3 text-sm text-slate-500 italic">Nenhum cliente encontrado.</div>`;
    } else {
        box.innerHTML = resultados.map(c => `
            <div class="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                 onclick="escolherSugestao('${c.id}')">
                <div class="font-medium text-slate-700">${escapeHtml(c.nome_completo)}</div>
                <div class="text-xs text-slate-500 flex gap-2">
                    <span>CPF: ${escapeHtml(c.cpf)}</span>
                    ${c.email ? `<span>• ${escapeHtml(c.email)}</span>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    box.classList.remove('hidden');
}

// Chamada pelo onclick do HTML injetado acima
window.escolherSugestao = function(id) {
    const cliente = clientesById[id];
    if (cliente) {
        confirmarSelecaoCliente(cliente);
        // Limpa e esconde a busca
        const input = document.getElementById('cliente-busca-rapida');
        const box = document.getElementById('clientes-sugestoes');
        if (input) input.value = '';
        if (box) box.classList.add('hidden');
    }
};

function selecionarClienteRapido() {
    const input = document.getElementById('cliente-busca-rapida');
    const termo = input.value.trim();

    if (!termo) {
        Utils.showToast("Digite o nome ou CPF para buscar.", "warning");
        return;
    }

    // Tenta achar match exato ou único
    const resultados = filtrarClientesLocal(termo);

    if (resultados.length === 1) {
        confirmarSelecaoCliente(resultados[0]);
        input.value = '';
        document.getElementById('clientes-sugestoes').classList.add('hidden');
    } else if (resultados.length > 1) {
        Utils.showToast("Muitos resultados. Clique em uma das sugestões.", "info");
        renderizarSugestoes();
    } else {
        Utils.showToast("Cliente não encontrado. Tente buscar pelo CPF abaixo.", "warning");
        document.getElementById('cpf-busca').focus();
    }
}

// =====================================================================
// BUSCA ESPECÍFICA POR CPF
// =====================================================================

async function buscarClientePorCPF() {
    const input = document.getElementById('cpf-busca');
    const cpfRaw = input.value;
    const cpfLimpo = cpfRaw.replace(/\D/g, '');

    if (cpfLimpo.length !== 11) {
        Utils.showToast("Digite um CPF válido com 11 números.", "warning");
        input.focus();
        return;
    }

    const btn = document.getElementById('btn-buscar-cpf');
    if(btn) {
        btn.disabled = true;
        btn.classList.add('btn-loading');
    }

    try {
        // 1. Tenta Cache Local primeiro (Instantâneo)
        let cliente = listaClientesCache.find(c => String(c.cpf).replace(/\D/g, '') === cpfLimpo);

        // 2. Se não achou, tenta forçar atualização da lista do servidor
        // (Caso o cliente tenha sido cadastrado recentemente por outro advogado)
        if (!cliente) {
            console.log("CPF não encontrado no cache, buscando no servidor...");
            const listaAtualizada = await API.clientes.listar(null, true); // force network
            if (Array.isArray(listaAtualizada)) {
                cliente = listaAtualizada.find(c => String(c.cpf).replace(/\D/g, '') === cpfLimpo);
                // Atualiza cache global
                listaClientesCache = listaAtualizada;
            }
        }

        // 3. Resultado
        document.getElementById('cliente-encontrado').classList.add('hidden');
        document.getElementById('cliente-nao-encontrado').classList.add('hidden');

        if (cliente) {
            confirmarSelecaoCliente(cliente);
        } else {
            prepararNovoCadastro(cpfLimpo);
        }

    } catch (error) {
        console.error("Erro na busca por CPF:", error);
        Utils.showToast("Erro ao buscar cliente.", "error");
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.classList.remove('btn-loading');
        }
    }
}

// =====================================================================
// FLUXO DE SELEÇÃO E CADASTRO
// =====================================================================

function confirmarSelecaoCliente(cliente) {
    clienteSelecionado = cliente;
    
    // Preenche Card de Sucesso
    setText('cliente-nome', cliente.nome_completo);
    setText('cliente-email', cliente.email || 'Sem email');
    setText('cliente-cpf-display', `CPF: ${cliente.cpf}`);
    setText('cliente-iniciais', (cliente.nome_completo || 'C').charAt(0).toUpperCase());
    
    document.getElementById('cliente-id-selecionado').value = cliente.id;

    // UI Updates
    document.getElementById('cliente-encontrado').classList.remove('hidden');
    document.getElementById('cliente-nao-encontrado').classList.add('hidden');
    document.getElementById('opcao-pular').classList.add('hidden');

    // Validação Inteligente: Verifica processos ativos
    verificarDuplicidadeProcessos(cliente);

    Utils.showToast("Cliente selecionado com sucesso!", "success");
}

function verificarDuplicidadeProcessos(cliente) {
    const alerta = document.getElementById('alerta-processos-existentes');
    const contador = document.getElementById('qtd-processos-ativos');
    
    if (!alerta || !processosCache.length) return;

    // Filtra processos ATIVOS deste cliente
    const ativos = processosCache.filter(p => {
        const mesmoId = String(p.cliente_id) === String(cliente.id);
        const mesmoCPF = p.cpf_cliente && 
                         String(p.cpf_cliente).replace(/\D/g,'') === String(cliente.cpf).replace(/\D/g,'');
        
        // Status que não contam como "ativo"
        const statusIgnorados = ['ARQUIVADO', 'CANCELADO', 'JULGADO', 'BAIXADO'];
        const statusAtual = (p.status || '').toUpperCase();
        
        return (mesmoId || mesmoCPF) && !statusIgnorados.includes(statusAtual);
    });

    if (ativos.length > 0) {
        contador.textContent = ativos.length;
        alerta.classList.remove('hidden');
    } else {
        alerta.classList.add('hidden');
    }
}

function prepararNovoCadastro(cpf) {
    // Preenche o CPF automaticamente no formulário de cadastro
    const inputCPF = document.getElementById('novo-cliente-cpf');
    if (inputCPF) inputCPF.value = Utils.formatCPF(cpf);

    document.getElementById('cliente-nao-encontrado').classList.remove('hidden');
    document.getElementById('cliente-encontrado').classList.add('hidden');
    document.getElementById('opcao-pular').classList.add('hidden');

    // Foco no nome
    setTimeout(() => {
        const inputNome = document.getElementById('novo-cliente-nome');
        if (inputNome) inputNome.focus();
    }, 100);
}

function limparCliente() {
    clienteSelecionado = null;
    document.getElementById('cliente-encontrado').classList.add('hidden');
    document.getElementById('cliente-nao-encontrado').classList.add('hidden');
    document.getElementById('opcao-pular').classList.remove('hidden');
    
    // Limpa inputs
    const inputCPF = document.getElementById('cpf-busca');
    if (inputCPF) {
        inputCPF.value = '';
        inputCPF.focus();
    }
}

// =====================================================================
// CADASTRO RÁPIDO DE CLIENTE (DENTRO DO WIZARD)
// =====================================================================

async function cadastrarEAvancar() {
    const nome = getValue('novo-cliente-nome');
    const cpf = getValue('novo-cliente-cpf').replace(/\D/g, '');
    const email = getValue('novo-cliente-email');
    const telefone = getValue('novo-cliente-telefone');

    // Validações
    if (!nome) return Utils.showToast("Informe o nome completo.", "warning");
    if (cpf.length !== 11) return Utils.showToast("CPF incompleto.", "warning");
    if (!email || !email.includes('@')) return Utils.showToast("Email inválido.", "warning");

    const btn = document.getElementById('btn-cadastrar-cliente');
    if(btn) {
        btn.disabled = true;
        btn.classList.add('btn-loading');
    }

    try {
        const payload = { nome_completo: nome, cpf, email, telefone };
        
        // Chama API
        const novoCliente = await API.clientes.cadastrar(payload);
        
        // Adiciona à lista local para não precisar recarregar tudo
        listaClientesCache.push(novoCliente);
        clientesById[novoCliente.id] = novoCliente;

        // Seleciona e avança
        confirmarSelecaoCliente(novoCliente);
        setTimeout(() => avancarParaProcesso(), 500);

    } catch (error) {
        console.error("Erro no cadastro:", error);
        Utils.showToast(error.message || "Erro ao cadastrar cliente.", "error");
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.classList.remove('btn-loading');
        }
    }
}

// =====================================================================
// CONTROLE DO WIZARD (STEPPER)
// =====================================================================

function avancarParaProcesso() {
    clienteVinculado = true;
    updateStepper(2);

    // Copia dados do cliente para os campos do processo (Conveniência)
    if (clienteSelecionado) {
        document.getElementById('resumo-cliente').classList.remove('hidden');
        setText('resumo-cliente-nome', clienteSelecionado.nome_completo);
        
        // Auto-preenchimento
        setValue('parte_nome', clienteSelecionado.nome_completo);
        setValue('email_interessado', clienteSelecionado.email);
    }

    toggleSections('step1-content', 'step2-content');
}

function voltarParaCliente() {
    updateStepper(1);
    toggleSections('step2-content', 'step1-content');
}

function pularCadastroCliente() {
    clienteSelecionado = null;
    clienteVinculado = false;
    updateStepper(2);
    
    document.getElementById('resumo-cliente').classList.add('hidden');
    // Limpa campos que poderiam ter dados de cliente antigo
    setValue('parte_nome', '');
    setValue('email_interessado', '');
    
    toggleSections('step1-content', 'step2-content');
}

function updateStepper(step) {
    const s1 = document.getElementById('step1-indicator');
    const s2 = document.getElementById('step2-indicator');
    const bar = document.getElementById('progress-bar');

    if (step === 1) {
        s1.className = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold step-active";
        s1.textContent = "1";
        s2.className = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold step-pending";
        bar.style.width = "0%";
    } else {
        s1.className = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold step-complete";
        s1.innerHTML = "✓"; // Checkmark
        s2.className = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold step-active";
        bar.style.width = "100%";
    }
}

function toggleSections(hideId, showId) {
    document.getElementById(hideId).classList.add('hidden');
    document.getElementById(showId).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================================
// SALVAR PROCESSO (FINALIZAÇÃO)
// =====================================================================

async function salvarProcesso(e) {
    e.preventDefault();

    // Coleta dados
    const numero = getValue('numero_processo');
    const tipoSelect = getValue('tipo');
    const tipoOutro = getValue('tipo_outro');
    const parte = getValue('parte_nome');
    const data = getValue('data_entrada');
    const email = getValue('email_interessado');
    const desc = getValue('descricao');

    // Validação
    if (!numero) return Utils.showToast("Número do processo é obrigatório.", "warning");
    if (!parte) return Utils.showToast("Nome da parte interessada é obrigatório.", "warning");
    
    const tipoFinal = (tipoSelect === 'OUTROS') ? tipoOutro.toUpperCase() : tipoSelect;
    if (!tipoFinal) return Utils.showToast("Informe o tipo do processo.", "warning");

    Utils.showLoading("Criando pasta digital...", "database");

    try {
        const payload = {
            numero_processo: numero,
            tipo: tipoFinal,
            parte_nome: parte,
            data_entrada: data,
            email_interessado: email,
            descricao: desc
        };

        // Anexa cliente se houver
        if (clienteSelecionado) {
            payload.cliente_id = clienteSelecionado.id;
            payload.cpf_cliente = clienteSelecionado.cpf;
            // Garante consistência caso o usuário tenha alterado o nome da parte manualmente
            // Se o nome da parte for igual ao do cliente, confirmamos o vínculo nominal
            if (parte.toLowerCase() === clienteSelecionado.nome_completo.toLowerCase()) {
                payload.nome_cliente = clienteSelecionado.nome_completo;
            }
        }

        const res = await API.processos.criar(payload);

        // Limpa caches para forçar atualização nas outras telas
        Utils.Cache.clear('listarProcessos');
        Utils.Cache.clear('getDashboard');

        Utils.showToast("Processo criado com sucesso!", "success");
        Utils.showLoading("Redirecionando...");

        setTimeout(() => {
            if (res && res.id) {
                Utils.navigateTo(`detalhe-processo.html?id=${res.id}`);
            } else {
                Utils.navigateTo('processos.html');
            }
        }, 1500);

    } catch (error) {
        console.error("Erro ao salvar:", error);
        Utils.hideLoading();
        Utils.showToast(error.message || "Erro ao criar processo.", "error");
    }
}

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setupMascaras() {
    // Máscara CPF Input Principal
    const cpfBusca = document.getElementById('cpf-busca');
    if (cpfBusca) cpfBusca.addEventListener('input', Utils.maskCPFInput);

    // Máscara Telefone Cadastro
    const telInput = document.getElementById('novo-cliente-telefone');
    if (telInput) telInput.addEventListener('input', Utils.maskPhoneInput);
}
