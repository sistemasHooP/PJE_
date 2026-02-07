/**
 * ============================================================================
 * ARQUIVO: js/novo-processo.js
 * DESCRIÇÃO: Lógica de cadastro de novos processos.
 * ATUALIZAÇÃO: Correção de erro global e Feedback via Notificação (Toast).
 * ============================================================================
 */

// 1. CORREÇÃO GLOBAL IMEDIATA (Evita o erro "escapeHtml is not defined")
// Define a função no escopo global window para que o HTML consiga acessá-la.
window.escapeHtml = function(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

document.addEventListener('DOMContentLoaded', function() {

    // 2. Proteção de Rota
    if (!Auth.protectRoute()) return;

    // 3. Atualizar UI do Usuário
    Auth.updateUserInfoUI();
    const user = Auth.getUser();
    if (user && user.nome) {
        const initials = user.nome.substring(0, 1).toUpperCase();
        const avatarEl = document.getElementById('user-initials');
        if (avatarEl) avatarEl.textContent = initials;
    }

    // 4. Configurar Logout Desktop
    const btnLogoutDesktop = document.getElementById('desktop-logout-btn');
    if (btnLogoutDesktop) {
        btnLogoutDesktop.addEventListener('click', function() {
            if (confirm('Deseja realmente sair do sistema?')) {
                Auth.logout();
            }
        });
    }

    // 5. Configurar Data Padrão
    const dataInput = document.getElementById('data_entrada');
    if (dataInput && !dataInput.value) {
        dataInput.valueAsDate = new Date();
    }

    // 6. Inicializar Funcionalidades
    setupMascaras();
    carregarClientesParaSelect();
    setupFormulario();
});

/**
 * Carrega a lista de clientes para o Dropdown (Select).
 */
function carregarClientesParaSelect() {
    const select = document.getElementById('select-cliente');
    if (!select) return;

    // Carrega lista via API (Cache)
    API.clientes.listar((data, source) => {
        select.innerHTML = '<option value="">-- Selecione um Cliente Cadastrado --</option>';
        
        if (data && data.length > 0) {
            data.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

            data.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = `${cliente.nome_completo} (CPF: ${cliente.cpf})`;
                select.appendChild(option);
            });
        }
    }, true);

    // --- LÓGICA DE SELEÇÃO COM NOTIFICAÇÃO ---
    select.addEventListener('change', async function() {
        const clienteId = this.value;

        if (!clienteId) {
            limparCamposCliente();
            return;
        }

        // 1. Feedback Imediato: Notificação Amarela ("Aguarde...")
        // Usa o mesmo estilo visual da notificação de sucesso, mas indicando processamento.
        Utils.showToast("⏳ Buscando dados do cliente...", "warning");
        
        // Pequena pausa para garantir que a interface atualize antes de processar
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // 2. Busca na API
            const clienteCompleto = await API.clientes.buscarPorId(clienteId);

            if (clienteCompleto) {
                preencherCamposCliente(clienteCompleto);
                
                // 3. Feedback Final: Notificação Verde ("Sucesso")
                // Substitui a notificação de "Buscando"
                Utils.showToast("✅ Cliente carregado com sucesso!", "success");
            } else {
                Utils.showToast("Cliente não encontrado.", "error");
                limparCamposCliente();
            }

        } catch (error) {
            console.error("Erro ao buscar cliente:", error);
            Utils.showToast("Erro ao comunicar com o servidor.", "error");
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

        const dados = {
            numero_processo: document.getElementById('numero_processo').value,
            parte_nome: document.getElementById('parte_nome').value,
            cpf: document.getElementById('cpf').value,
            email: document.getElementById('email').value,
            telefone: document.getElementById('telefone').value,
            tipo: document.getElementById('tipo_acao').value,
            data_entrada: document.getElementById('data_entrada').value,
            data_prazo: document.getElementById('data_prazo').value || '',
            status: 'EM ANDAMENTO'
        };

        if (!dados.numero_processo || !dados.parte_nome || !dados.cpf) {
            Utils.showToast("Preencha os campos obrigatórios (*)", "warning");
            return;
        }

        try {
            Utils.showLoading("Criando processo e pastas...");

            const resultado = await API.processos.criar(dados);

            // Limpa Cache
            Utils.Cache.clear('listarProcessos');
            Utils.Cache.clear('getDashboard');

            Utils.showToast("Processo criado com sucesso!", "success");

            setTimeout(() => {
                if (resultado && resultado.id) {
                    Utils.navigateTo(`detalhe-processo.html?id=${resultado.id}`);
                } else {
                    Utils.navigateTo('processos.html');
                }
            }, 1000);

        } catch (error) {
            console.error("Erro ao criar processo:", error);
            Utils.hideLoading();
            
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
