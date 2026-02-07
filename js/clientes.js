/**
 * ============================================================================
 * ARQUIVO: js/clientes.js
 * DESCRIÇÃO: Lógica da página de Clientes (clientes.html).
 * VERSÃO: 2.0 - Com Cache SWR para carregamento instantâneo.
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js
 * AUTOR: Desenvolvedor Sênior (Sistema RPPS)
 * ============================================================================
 */

// Cache local da lista de clientes para busca rápida
let clientesCache = [];

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Verificar autenticação
    Auth.requireAuth();

    // 2. Carregar dados do usuário na UI
    Auth.loadUserInfo();

    // 3. Configurar logout
    const logoutBtn = document.getElementById('desktop-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => Auth.logout());
    }

    // 4. Configurar formulário de cadastro
    const formCliente = document.getElementById('form-cliente');
    if (formCliente) {
        formCliente.addEventListener('submit', cadastrarCliente);
    }

    // 5. Configurar busca
    const buscaInput = document.getElementById('busca-clientes');
    if (buscaInput) {
        buscaInput.addEventListener('input', filtrarClientes);
    }

    // 6. Configurar botão atualizar
    const btnAtualizar = document.getElementById('btn-atualizar-clientes');
    if (btnAtualizar) {
        btnAtualizar.addEventListener('click', () => carregarClientes(true));
    }

    // 7. Aplicar máscaras
    aplicarMascaras();

    // 8. Carregar lista de clientes (com SWR)
    carregarClientes();
});

/**
 * Carrega a lista de clientes usando estratégia SWR.
 * - Se houver cache: exibe instantaneamente
 * - Busca rede em background
 * - Atualiza quando rede retornar
 * 
 * @param {boolean} forceRefresh - Se true, mostra loading e força busca na rede
 */
function carregarClientes(forceRefresh = false) {
    const tbody = document.getElementById('lista-clientes');
    
    // Se forçar refresh, mostra loading
    if (forceRefresh) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-slate-400">
                    <div class="flex items-center justify-center gap-2">
                        <svg class="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Atualizando lista...
                    </div>
                </td>
            </tr>
        `;
    }

    // Usa o novo método SWR com callback
    API.clientes.listar(
        // Callback chamado para cache E para rede
        (clientes, source) => {
            console.log(`[Clientes] Dados recebidos (${source}): ${Array.isArray(clientes) ? clientes.length : 0} clientes`);
            
            // Atualiza cache local
            clientesCache = Array.isArray(clientes) ? clientes : [];
            
            // Renderiza tabela
            renderizarTabela(clientesCache);
            
            // Se veio da rede e tinha forçado refresh, mostra feedback
            if (source === 'network' && forceRefresh) {
                Utils.showToast('Lista atualizada!', 'success');
            }
        },
        // forceSilent: true para não mostrar loading global
        !forceRefresh
    ).catch(err => {
        console.error('Erro ao carregar clientes:', err);
        
        // Se não tem cache, mostra erro
        if (clientesCache.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-6 text-center text-red-500">
                        Erro ao carregar clientes. 
                        <button onclick="carregarClientes(true)" class="text-blue-600 hover:underline ml-2">
                            Tentar novamente
                        </button>
                    </td>
                </tr>
            `;
        }
    });
}

/**
 * Renderiza a tabela de clientes.
 * @param {Array} clientes - Lista de clientes para exibir
 */
function renderizarTabela(clientes) {
    const tbody = document.getElementById('lista-clientes');
    
    if (!clientes || clientes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-slate-400">
                    Nenhum cliente cadastrado ainda.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = clientes.map(cliente => {
        // Formata CPF para exibição
        let cpfDisplay = String(cliente.cpf || '').replace(/\D/g, '').padStart(11, '0');
        cpfDisplay = cpfDisplay.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

        // Define badge de status
        const statusAtivo = cliente.status !== 'INATIVO';
        const statusBadge = statusAtivo 
            ? '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Ativo</span>'
            : '<span class="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">Inativo</span>';

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="py-3 font-medium text-slate-800">${cliente.nome_completo || '-'}</td>
                <td class="py-3 text-slate-600 font-mono text-sm">${cpfDisplay}</td>
                <td class="py-3 text-slate-600">${cliente.email || '-'}</td>
                <td class="py-3 text-slate-600">${formatarTelefone(cliente.telefone)}</td>
                <td class="py-3">${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Filtra clientes na tabela baseado no termo de busca.
 */
function filtrarClientes() {
    const termo = (document.getElementById('busca-clientes').value || '').toLowerCase().trim();
    
    if (!termo) {
        renderizarTabela(clientesCache);
        return;
    }

    const termoNumeros = termo.replace(/\D/g, '');

    const filtrados = clientesCache.filter(cliente => {
        const nome = String(cliente.nome_completo || '').toLowerCase();
        const email = String(cliente.email || '').toLowerCase();
        const cpf = String(cliente.cpf || '').replace(/\D/g, '');

        return nome.includes(termo) ||
               email.includes(termo) ||
               cpf.includes(termoNumeros) ||
               cpf.includes(termo);
    });

    renderizarTabela(filtrados);
}

/**
 * Cadastra um novo cliente.
 */
async function cadastrarCliente(e) {
    e.preventDefault();

    const nome = document.getElementById('cliente-nome').value.trim();
    const cpfRaw = document.getElementById('cliente-cpf').value.replace(/\D/g, '');
    const email = document.getElementById('cliente-email').value.trim().toLowerCase();
    const telefone = document.getElementById('cliente-telefone').value.replace(/\D/g, '');

    // Validações
    if (!nome) {
        Utils.showToast('Digite o nome do cliente.', 'warning');
        document.getElementById('cliente-nome').focus();
        return;
    }

    if (cpfRaw.length !== 11) {
        Utils.showToast('CPF deve ter 11 dígitos.', 'warning');
        document.getElementById('cliente-cpf').focus();
        return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Utils.showToast('Digite um email válido.', 'warning');
        document.getElementById('cliente-email').focus();
        return;
    }

    try {
        Utils.showLoading('Cadastrando cliente...');

        await API.clientes.cadastrar({
            nome_completo: nome,
            cpf: cpfRaw,
            email: email,
            telefone: telefone
        });

        Utils.hideLoading();
        Utils.showToast('Cliente cadastrado com sucesso!', 'success');

        // Limpa formulário
        document.getElementById('form-cliente').reset();

        // Recarrega lista (forçando refresh)
        carregarClientes(true);

    } catch (error) {
        Utils.hideLoading();
        console.error('Erro ao cadastrar cliente:', error);
        Utils.showToast(error.message || 'Erro ao cadastrar cliente.', 'error');
    }
}

/**
 * Aplica máscaras aos campos do formulário.
 */
function aplicarMascaras() {
    // Máscara CPF
    const cpfInput = document.getElementById('cliente-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.substring(0, 11);
            
            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }
            
            e.target.value = value;
        });
    }

    // Máscara Telefone
    const telefoneInput = document.getElementById('cliente-telefone');
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.substring(0, 11);
            
            if (value.length > 6) {
                value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
            } else if (value.length > 2) {
                value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            }
            
            e.target.value = value;
        });
    }
}

/**
 * Formata telefone para exibição.
 * @param {string} telefone - Telefone em formato numérico
 * @returns {string} - Telefone formatado ou '-'
 */
function formatarTelefone(telefone) {
    if (!telefone) return '-';
    
    const numeros = String(telefone).replace(/\D/g, '');
    
    if (numeros.length === 11) {
        return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (numeros.length === 10) {
        return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    
    return telefone;
}
