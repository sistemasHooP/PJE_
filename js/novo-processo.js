/**
 * ============================================================================
 * ARQUIVO: js/novo-processo.js
 * DESCRIÇÃO: Lógica de cadastro de novos processos.
 * ATUALIZAÇÃO: Loader Personalizado "Procurando no Banco de Dados".
 * ============================================================================
 */

// 1. CORREÇÃO GLOBAL IMEDIATA (CRÍTICO)
// Define a função escapeHtml na janela global para corrigir o erro do console.
// Se o HTML chamar isso, a função já existirá.
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

// --- FUNÇÕES DE INTERFACE (LOADER PERSONALIZADO) ---

function showCustomDbLoader() {
    // Remove se já existir
    const existing = document.getElementById('db-search-loader');
    if (existing) existing.remove();

    // Cria o overlay (fundo escuro transparente)
    const overlay = document.createElement('div');
    overlay.id = 'db-search-loader';
    overlay.className = 'fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm transition-opacity duration-300';
    
    // Conteúdo do Loader (Caixa branca centralizada)
    overlay.innerHTML = `
        <div class="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center justify-center transform scale-100 transition-transform duration-300 max-w-sm w-full mx-4 border border-slate-200">
            
            <!-- Ícone Personalizado (Banco de Dados + Lupa) -->
            <div class="relative w-20 h-20 mb-6">
                <!-- Base de Dados -->
                <svg class="w-20 h-20 text-blue-100" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 4.02 2 6.5S6.48 11 12 11s10-2.02 10-4.5S17.52 2 12 2zm0 18c-5.52 0-10-2.02-10-4.5v3C2 20.98 6.48 23 12 23s10-2.02 10-4.5v-3c0 2.48-4.48 4.5-10 4.5zM2 9v4.5c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5V9c0 2.48-4.48 4.5-10 4.5S2 11.48 2 9z"/>
                </svg>
                
                <!-- Lupa Animada (Pingando) -->
                <div class="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-2 animate-bounce shadow-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                </div>
            </div>

            <h3 class="text-xl font-bold text-slate-800 mb-2 text-center">Procurando dados...</h3>
            <p class="text-slate-500 text-sm text-center">Consultando cliente no Banco de Dados</p>
            
            <!-- Barra de Progresso Infinita -->
            <div class="w-full bg-slate-100 h-1.5 mt-6 rounded-full overflow-hidden">
                <div class="bg-blue-600 h-1.5 rounded-full w-1/2 animate-[shimmer_1s_infinite_linear]" style="position:relative; left:-50%;"></div>
            </div>
        </div>
        
        <style>
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(300%); }
            }
        </style>
    `;

    document.body.appendChild(overlay);
}

function hideCustomDbLoader() {
    const overlay = document.getElementById('db-search-loader');
    if (overlay) {
        // Efeito visual de saída
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 300);
    }
}


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

    // --- EVENTO DE SELEÇÃO COM LOADER PERSONALIZADO ---
    select.addEventListener('change', async function() {
        const clienteId = this.value;

        if (!clienteId) {
            limparCamposCliente();
            return;
        }

        // 1. MOSTRA A TELA DE BUSCA PERSONALIZADA
        showCustomDbLoader();
        
        // 2. DELAY FORÇADO (0.8 segundos)
        // Isso garante que a animação apareça e o usuário tenha tempo de ver "Procurando no banco..."
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            // 3. Busca na API
            const clienteCompleto = await API.clientes.buscarPorId(clienteId);

            if (clienteCompleto) {
                preencherCamposCliente(clienteCompleto);
                Utils.showToast("✅ Dados carregados com sucesso!", "success");
            } else {
                Utils.showToast("Cliente não encontrado.", "error");
                limparCamposCliente();
            }

        } catch (error) {
            console.error("Erro ao buscar cliente:", error);
            Utils.showToast("Erro ao comunicar com o servidor.", "error");
        } finally {
            // 4. REMOVE A TELA DE BUSCA
            hideCustomDbLoader();
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
