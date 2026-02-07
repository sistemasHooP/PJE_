/**
 * ============================================================================
 * ARQUIVO: js/novo-processo.js
 * DESCRIÇÃO: Lógica de cadastro de novos processos.
 * ATUALIZAÇÃO: Feedback visual (Loader) ao selecionar cliente e autopreenchimento.
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {

    // 1. Proteção de Rota
    if (!Auth.protectRoute()) return;

    // 2. Atualizar UI do Usuário
    Auth.updateUserInfoUI();
    const user = Auth.getUser();
    if (user && user.nome) {
        const initials = user.nome.substring(0, 1).toUpperCase();
        const avatarEl = document.getElementById('user-initials');
        if (avatarEl) avatarEl.textContent = initials;
    }

    // 3. Configurar Logout Desktop
    const btnLogoutDesktop = document.getElementById('desktop-logout-btn');
    if (btnLogoutDesktop) {
        btnLogoutDesktop.addEventListener('click', function() {
            if (confirm('Deseja realmente sair do sistema?')) {
                Auth.logout();
            }
        });
    }

    // 4. Configurar Data Padrão (Hoje)
    const dataInput = document.getElementById('data_entrada');
    if (dataInput && !dataInput.value) {
        dataInput.valueAsDate = new Date();
    }

    // 5. Inicializar Funcionalidades
    setupMascaras();
    carregarClientesParaSelect();
    setupFormulario();
});

/**
 * Carrega a lista de clientes para o Dropdown (Select).
 * Usa Cache para ser rápido, mas permite buscar detalhes depois.
 */
function carregarClientesParaSelect() {
    const select = document.getElementById('select-cliente');
    if (!select) return; // Se não tiver o select na tela, ignora

    // Usa a API com Cache (SWR)
    API.clientes.listar((data, source) => {
        // Limpa opções antigas (mantendo a primeira "Selecione...")
        select.innerHTML = '<option value="">-- Selecione um Cliente Cadastrado --</option>';
        
        if (data && data.length > 0) {
            // Ordena alfabeticamente
            data.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

            data.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id; // ID do cliente
                option.textContent = `${cliente.nome_completo} (CPF: ${cliente.cpf})`;
                select.appendChild(option);
            });
        }
    }, true); // true = silencioso (não mostra loader global só pra carregar a lista)

    // --- AQUI ESTÁ A CORREÇÃO DO UX ---
    // Evento de mudança no Select
    select.addEventListener('change', async function() {
        const clienteId = this.value;
        
        if (!clienteId) {
            limparCamposCliente();
            return;
        }

        // MOSTRA O LOADER AGORA (Feedback Visual)
        Utils.showLoading("Buscando dados do cliente...");

        try {
            // Busca dados completos do cliente (pode demorar 2-3s)
            const clienteCompleto = await API.clientes.buscarPorId(clienteId);

            if (clienteCompleto) {
                preencherCamposCliente(clienteCompleto);
                Utils.showToast("Dados do cliente carregados.", "info");
            } else {
                Utils.showToast("Cliente não encontrado.", "error");
            }

        } catch (error) {
            console.error(error);
            Utils.showToast("Erro ao buscar detalhes do cliente.", "error");
        } finally {
            // ESCONDE O LOADER
            Utils.hideLoading();
        }
    });
}

function preencherCamposCliente(cliente) {
    setValue('parte_nome', cliente.nome_completo);
    setValue('cpf', cliente.cpf);
    setValue('email', cliente.email);
    setValue('telefone', cliente.telefone);
}

function limparCamposCliente() {
    setValue('parte_nome', '');
    setValue('cpf', '');
    setValue('email', '');
    setValue('telefone', '');
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

function setupMascaras() {
    // Máscara CPF
    const cpfInput = document.getElementById('cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '').substring(0, 11);
            if (value.length > 9) value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            else if (value.length > 6) value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            else if (value.length > 3) value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            e.target.value = value;
        });
    }

    // Máscara Telefone
    const telInput = document.getElementById('telefone');
    if (telInput) {
        telInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '').substring(0, 11);
            if (value.length > 6) value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
            else if (value.length > 2) value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            e.target.value = value;
        });
    }
}

function setupFormulario() {
    const form = document.querySelector('form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Dados do Formulário
        const dados = {
            numero_processo: document.getElementById('numero_processo').value,
            parte_nome: document.getElementById('parte_nome').value,
            cpf: document.getElementById('cpf').value,
            email: document.getElementById('email').value,
            telefone: document.getElementById('telefone').value,
            tipo: document.getElementById('tipo_acao').value,
            data_entrada: document.getElementById('data_entrada').value,
            data_prazo: document.getElementById('data_prazo').value || '',
            status: 'EM ANDAMENTO' // Status inicial padrão
        };

        // Validação Básica
        if (!dados.numero_processo || !dados.parte_nome || !dados.cpf) {
            Utils.showToast("Preencha os campos obrigatórios (*)", "warning");
            return;
        }

        try {
            Utils.showLoading("Criando processo e pastas...");

            // Chama API
            const resultado = await API.processos.criar(dados);

            // --- CRÍTICO: LIMPEZA DE CACHE ---
            // Força a atualização das listas quando o usuário voltar para elas
            Utils.Cache.clear('listarProcessos');
            Utils.Cache.clear('getDashboard');

            Utils.showToast("Processo criado com sucesso!", "success");

            // Redireciona para o detalhe
            setTimeout(() => {
                if (resultado && resultado.id) {
                    Utils.navigateTo(`detalhe-processo.html?id=${resultado.id}`);
                } else {
                    Utils.navigateTo('processos.html');
                }
            }, 1000);

        } catch (error) {
            console.error("Erro ao criar processo:", error);
            Utils.hideLoading(); // Garante que o loader saia se der erro
            
            if (error.message.includes("Já existe")) {
                Utils.showToast(error.message, "error");
                const campoNumero = document.getElementById('numero_processo');
                if(campoNumero) {
                    campoNumero.focus();
                    campoNumero.classList.add('border-red-500');
                    setTimeout(() => campoNumero.classList.remove('border-red-500'), 3000);
                }
            } else {
                Utils.showToast(error.message || "Erro ao criar processo.", "error");
            }
        }
    });
}
