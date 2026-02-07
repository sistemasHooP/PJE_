/**
 * ============================================================================
 * ARQUIVO: js/clientes.js
 * DESCRIÇÃO: Lógica da gestão de clientes (clientes.html).
 * ATUALIZAÇÃO: Animação de "Loading" no botão Atualizar e Busca Instantânea.
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js
 * AUTOR: Sistema RPPS Jurídico
 * ============================================================================
 */

(function() {
    // Armazena clientes em memória para filtragem rápida
    let listaClientes = [];

    document.addEventListener('DOMContentLoaded', function() {
        
        // 1. Proteção de Rota
        if (!Auth.protectRoute()) return;

        // 2. Inicialização da Interface
        inicializarUsuario();
        inicializarLogout();

        // 3. Configuração dos Eventos
        setupEventos();

        // 4. Carga Inicial (Cache First)
        carregarClientes();
    });

    /**
     * Configura dados do usuário no menu lateral/topo
     */
    function inicializarUsuario() {
        const user = Auth.getUser();
        if (!user) return;

        const nome = user.nome || user.email || 'Usuário';
        const perfil = user.perfil || '';
        const iniciais = (nome || 'U').charAt(0).toUpperCase();

        const nameEl = document.getElementById('user-name-display');
        const profileEl = document.getElementById('user-profile-display');
        const initEl = document.getElementById('user-initials');

        if (nameEl) nameEl.textContent = nome;
        if (profileEl) profileEl.textContent = perfil;
        if (initEl) initEl.textContent = iniciais;
    }

    /**
     * Configura listeners de botões e inputs
     */
    function setupEventos() {
        // Botão Atualizar
        const btnAtualizar = document.getElementById('btn-atualizar-clientes');
        if (btnAtualizar) {
            btnAtualizar.addEventListener('click', function() {
                // Força atualização da rede (ignora cache)
                carregarClientes(true);
            });
        }

        // Campo de Busca
        const inputBusca = document.getElementById('busca-clientes');
        if (inputBusca) {
            inputBusca.addEventListener('input', function(e) {
                renderizarTabela(e.target.value);
            });
        }
    }

    /**
     * Busca clientes da API.
     * @param {boolean} forcarRede - Se true, ignora o cache local e busca do servidor.
     */
    function carregarClientes(forcarRede = false) {
        // Feedback Visual (Animação do Botão)
        const btn = document.getElementById('btn-atualizar-clientes');
        const icon = btn ? btn.querySelector('svg') : null;

        if (icon) icon.classList.add('animate-spin');
        if (btn) btn.disabled = true;

        // Se for forçado, limpa o cache antes
        if (forcarRede) {
            Utils.Cache.clear('listarClientes');
            Utils.showToast("Atualizando lista de clientes...", "info");
        }

        API.clientes.listar((dados, source) => {
            listaClientes = dados || [];
            
            // Renderiza
            renderizarTabela(document.getElementById('busca-clientes').value);

            // Remove animação
            if (icon) icon.classList.remove('animate-spin');
            if (btn) btn.disabled = false;

            if (forcarRede && source === 'network') {
                Utils.showToast("Lista atualizada com sucesso!", "success");
            }

        }, !forcarRede); // Se não for forçado, usa modo silencioso (sem loading full screen)
    }

    /**
     * Renderiza a tabela HTML com base na lista e no filtro de busca.
     * @param {string} termoBusca 
     */
    function renderizarTabela(termoBusca = '') {
        const tbody = document.querySelector('tbody');
        if (!tbody) return;

        // Normaliza busca
        const termo = Utils.normalizeText(termoBusca);
        const termoDigitos = termo.replace(/\D/g, ''); // Para buscar CPF sem formatação

        // Filtra
        const filtrados = listaClientes.filter(c => {
            if (!termo) return true;
            
            const nome = Utils.normalizeText(c.nome_completo || '');
            const cpf = String(c.cpf || '').replace(/\D/g, '');
            const email = Utils.normalizeText(c.email || '');

            return nome.includes(termo) || 
                   email.includes(termo) || 
                   (termoDigitos.length > 2 && cpf.includes(termoDigitos));
        });

        // HTML
        if (filtrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-slate-400">
                        <div class="flex flex-col items-center justify-center">
                            <svg class="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5-2.83M9 20H4v-2a3 3 0 015-2.83M9 20h6M9 20v-2a3 3 0 016 0v2M12 7a3 3 0 110 6 3 3 0 010-6z"></path>
                            </svg>
                            <p>Nenhum cliente encontrado.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtrados.map(c => `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="py-3 px-4">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mr-3">
                            ${(c.nome_completo || 'C').charAt(0).toUpperCase()}
                        </div>
                        <span class="font-medium text-slate-700">${escapeHtml(c.nome_completo)}</span>
                    </div>
                </td>
                <td class="py-3 px-4 text-slate-600 font-mono text-sm">${formatCPF(c.cpf)}</td>
                <td class="py-3 px-4 text-slate-600 text-sm">${escapeHtml(c.email)}</td>
                <td class="py-3 px-4 text-slate-600 text-sm">${formatTelefone(c.telefone)}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-bold ${getStatusClass(c.status)}">
                        ${escapeHtml(c.status || 'ATIVO')}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // --- Helpers de Formatação Visual ---

    function escapeHtml(text) {
        if (!text) return '-';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatCPF(cpf) {
        if (!cpf) return '-';
        const v = cpf.replace(/\D/g, '');
        if (v.length !== 11) return cpf;
        return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    function formatTelefone(tel) {
        if (!tel) return '-';
        const v = tel.replace(/\D/g, '');
        if (v.length === 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        if (v.length === 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
        return tel;
    }

    function getStatusClass(status) {
        const s = String(status || '').toUpperCase();
        if (s === 'ATIVO') return 'bg-emerald-100 text-emerald-700';
        if (s === 'INATIVO') return 'bg-slate-100 text-slate-600';
        if (s === 'BLOQUEADO') return 'bg-red-100 text-red-700';
        return 'bg-blue-100 text-blue-700';
    }

    function inicializarLogout() {
        const btn = document.getElementById('desktop-logout-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                if (confirm("Deseja realmente sair?")) Auth.logout();
            });
        }
    }

})();
