/**
 * ============================================================================
 * ARQUIVO: js/novo-processo.js
 * DESCRIÇÃO: Lógica da tela de Cadastro de Processos (novo-processo.html).
 * ATUALIZAÇÃO: Busca Inteligente (Local), Pre-fetching e Validação de Duplicidade.
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js
 * AUTOR: Sistema RPPS Jurídico
 * ============================================================================
 */

// Armazena a lista de clientes localmente para busca instantânea (sem delay)
let baseClientes = [];
let clienteSelecionado = null;

document.addEventListener('DOMContentLoaded', async function() {

    // 1. Proteção de Rota
    if (!Auth.protectRoute()) return;

    // 2. Inicialização da Interface
    Auth.updateUserInfoUI();
    inicializarLogout();
    
    // 3. Inicializa seletores de data (Flatpickr)
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#data_entrada", {
            dateFormat: "d/m/Y",
            defaultDate: "today",
            locale: "pt",
            allowInput: true
        });
    }

    // 4. Carregamento Silencioso de Clientes (Warm-up)
    // Busca do cache ou da rede sem travar a UI inicial
    await carregarBaseClientes();

    // 5. Configuração dos Eventos
    setupBuscaInteligente();
    setupFormulario();
});

/**
 * Busca a lista de clientes (Cache First) para permitir busca instantânea.
 */
async function carregarBaseClientes() {
    const spinner = document.getElementById('spinner-busca');
    if(spinner) spinner.classList.remove('hidden');

    try {
        // Usa a API com cache (isSilent=true para não mostrar loading full screen)
        // Se já foi carregado no Login, será instantâneo.
        API.clientes.listar((data, source) => {
            baseClientes = data || [];
            console.log(`[NovoProcesso] ${baseClientes.length} clientes carregados via ${source}.`);
            if(spinner) spinner.classList.add('hidden');
        }, true);
    } catch (e) {
        console.error("Erro ao carregar clientes:", e);
        if(spinner) spinner.classList.add('hidden');
    }
}

/**
 * Configura a lógica de digitação e seleção de cliente.
 */
function setupBuscaInteligente() {
    const inputBusca = document.getElementById('busca_inteligente');
    const listaResultados = document.getElementById('lista-resultados');
    const btnLimpar = document.getElementById('btn-limpar-cliente');

    // Evento de Digitação (Input)
    inputBusca.addEventListener('input', function(e) {
        const termo = Utils.normalizeText(e.target.value);
        
        if (termo.length < 2) {
            listaResultados.classList.add('hidden');
            return;
        }

        // Filtra localmente (Instantâneo)
        const resultados = baseClientes.filter(c => {
            const nome = Utils.normalizeText(c.nome_completo || '');
            const cpf = String(c.cpf || '').replace(/\D/g, '');
            const termoLimpo = termo.replace(/\D/g, ''); // Para comparar CPF

            // Busca por nome OU CPF
            return nome.includes(termo) || (termoLimpo.length > 2 && cpf.includes(termoLimpo));
        });

        renderizarResultados(resultados);
    });

    // Evento: Clicar fora fecha a lista
    document.addEventListener('click', function(e) {
        if (!inputBusca.contains(e.target) && !listaResultados.contains(e.target)) {
            listaResultados.classList.add('hidden');
        }
    });

    // Evento: Botão Limpar / Novo Cadastro
    btnLimpar.addEventListener('click', function() {
        resetarCamposCliente(true); // true = desbloquear para edição
    });
}

/**
 * Renderiza o dropdown de resultados da busca.
 */
function renderizarResultados(lista) {
    const container = document.getElementById('lista-resultados');
    container.innerHTML = '';

    if (lista.length === 0) {
        container.innerHTML = `
            <div class="p-4 text-center text-slate-500 text-sm">
                Nenhum cliente encontrado.
                <button id="btn-criar-rapido" class="block w-full mt-2 text-blue-600 font-bold hover:underline">
                    Preencher dados manualmente
                </button>
            </div>
        `;
        container.classList.remove('hidden');
        
        // Atalho para criar novo
        document.getElementById('btn-criar-rapido').addEventListener('click', () => {
            container.classList.add('hidden');
            resetarCamposCliente(true); // Desbloqueia
            document.getElementById('parte_nome').focus();
        });
        return;
    }

    // Limita a 5 resultados para não poluir
    const topResults = lista.slice(0, 5);

    topResults.forEach(cliente => {
        const div = document.createElement('div');
        div.className = "p-3 hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-center group";
        
        div.innerHTML = `
            <div>
                <p class="font-medium text-slate-700 group-hover:text-blue-700">${cliente.nome_completo}</p>
                <p class="text-xs text-slate-400">CPF: ${cliente.cpf || 'Não inf.'}</p>
            </div>
            <svg class="w-5 h-5 text-slate-300 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `;

        div.addEventListener('click', () => {
            selecionarCliente(cliente);
            container.classList.add('hidden');
        });

        container.appendChild(div);
    });

    container.classList.remove('hidden');
}

/**
 * Ação ao selecionar um cliente da lista.
 */
function selecionarCliente(cliente) {
    clienteSelecionado = cliente;

    // Preenche campos
    document.getElementById('cliente_id').value = cliente.id;
    document.getElementById('parte_nome').value = cliente.nome_completo;
    document.getElementById('cpf_cliente').value = cliente.cpf;
    document.getElementById('email_cliente').value = cliente.email;
    document.getElementById('telefone_cliente').value = cliente.telefone;

    // Bloqueia campos (Visual de "Confirmado")
    bloquearCampos(true);

    // Limpa busca visualmente
    document.getElementById('busca_inteligente').value = "";
    document.getElementById('btn-limpar-cliente').classList.remove('hidden');

    // Verifica se já tem processos (Alerta Inteligente)
    verificarProcessosExistentes(cliente);
}

/**
 * Verifica se o cliente selecionado já possui processos ativos.
 */
async function verificarProcessosExistentes(cliente) {
    const alertBox = document.getElementById('alert-processos-existentes');
    const listaUl = document.getElementById('lista-processos-existentes');
    
    // Esconde inicialmente
    alertBox.classList.add('hidden');
    listaUl.innerHTML = '';

    try {
        // Busca processos (Cache First)
        // Nota: Idealmente teríamos uma rota API específica, mas filtrar localmente 
        // é muito rápido se a lista de processos já estiver em cache.
        API.processos.listar({}, (processos) => {
            if (!processos) return;

            // Filtra processos deste cliente (por ID ou CPF)
            const processosDoCliente = processos.filter(p => {
                const mesmoId = p.cliente_id && String(p.cliente_id) === String(cliente.id);
                const mesmoEmail = p.email_interessado && cliente.email && 
                                   p.email_interessado.toLowerCase() === cliente.email.toLowerCase();
                
                // Só queremos alertas de processos ATIVOS
                const ativo = p.status !== 'ARQUIVADO' && p.status !== 'CANCELADO';
                
                return (mesmoId || mesmoEmail) && ativo;
            });

            if (processosDoCliente.length > 0) {
                // Monta o alerta
                processosDoCliente.forEach(p => {
                    const li = document.createElement('li');
                    li.textContent = `${p.numero_processo} - ${p.tipo} (${p.status})`;
                    listaUl.appendChild(li);
                });
                
                // Mostra com animação
                alertBox.classList.remove('hidden');
                alertBox.classList.add('animate-fade-in');
            }
        }, true); // Silent mode

    } catch (e) {
        console.warn("Não foi possível verificar processos existentes.", e);
    }
}

/**
 * Reseta o formulário de cliente, permitindo cadastro manual ou nova busca.
 * @param {boolean} permitirEdicao - Se true, remove 'readonly' e estilos cinza.
 */
function resetarCamposCliente(permitirEdicao = false) {
    clienteSelecionado = null;
    
    // Limpa valores
    const campos = ['cliente_id', 'parte_nome', 'cpf_cliente', 'email_cliente', 'telefone_cliente'];
    campos.forEach(id => document.getElementById(id).value = '');

    // Esconde botão de limpar e alertas
    document.getElementById('btn-limpar-cliente').classList.add('hidden');
    document.getElementById('alert-processos-existentes').classList.add('hidden');

    // Controla estado de edição (Readonly vs Editável)
    bloquearCampos(!permitirEdicao);
}

/**
 * Aplica ou remove estilo de "Bloqueado/Readonly" nos inputs.
 */
function bloquearCampos(bloquear) {
    const inputs = document.querySelectorAll('#parte_nome, #cpf_cliente, #email_cliente, #telefone_cliente');
    
    inputs.forEach(input => {
        if (bloquear) {
            input.setAttribute('readonly', true);
            input.classList.add('bg-slate-100', 'cursor-not-allowed');
            input.classList.remove('bg-white');
        } else {
            input.removeAttribute('readonly');
            input.classList.remove('bg-slate-100', 'cursor-not-allowed');
            input.classList.add('bg-white');
        }
    });
}

/**
 * Envio do Formulário Principal
 */
function setupFormulario() {
    const form = document.getElementById('form-novo-processo');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Validações básicas
        const nome = document.getElementById('parte_nome').value.trim();
        const cpf = document.getElementById('cpf_cliente').value.trim();
        const numero = document.getElementById('numero_processo').value.trim();
        
        if (!nome || !cpf) {
            Utils.showToast("Por favor, selecione um cliente ou preencha os dados manualmente.", "warning");
            document.getElementById('busca_inteligente').focus();
            return;
        }

        const payload = {
            // Dados Cliente
            cliente_id: document.getElementById('cliente_id').value,
            parte_nome: nome,
            cpf_cliente: cpf,
            email_cliente: document.getElementById('email_cliente').value.trim(),
            telefone_cliente: document.getElementById('telefone_cliente').value.trim(),
            
            // Dados Processo
            numero_processo: numero,
            tipo: document.getElementById('tipo').value,
            data_entrada: document.getElementById('data_entrada').value, // Flatpickr já formata
            descricao: document.getElementById('descricao').value
        };

        try {
            // Chama API
            const resultado = await API.processos.criar(payload);

            // CRÍTICO: Limpa caches para forçar atualização nas outras telas
            Utils.Cache.clear('listarProcessos');
            Utils.Cache.clear('getDashboard');
            // Se cadastrou cliente novo (não tinha ID), limpa cache de clientes também
            if (!payload.cliente_id) {
                Utils.Cache.clear('listarClientes');
            }

            Utils.showToast("Processo criado com sucesso!", "success");

            // Feedback Visual de "Abrindo..."
            Utils.showLoading("Abrindo processo...");

            setTimeout(() => {
                if (resultado && resultado.id) {
                    Utils.navigateTo(`detalhe-processo.html?id=${resultado.id}`);
                } else {
                    Utils.navigateTo('processos.html');
                }
            }, 1000);

        } catch (error) {
            console.error("Erro ao criar:", error);
            Utils.hideLoading();

            if (error.message && error.message.includes("Já existe")) {
                Utils.showToast(error.message, "error");
                document.getElementById('numero_processo').classList.add('border-red-500');
            } else {
                Utils.showToast(error.message || "Erro ao criar processo.", "error");
            }
        }
    });
}

/**
 * Auxiliar para logout
 */
function inicializarLogout() {
    const btn = document.getElementById('desktop-logout-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (confirm("Deseja realmente sair?")) Auth.logout();
        });
    }
}
