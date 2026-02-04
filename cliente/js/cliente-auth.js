/**
 * ============================================================================
 * ARQUIVO: cliente/js/cliente-api.js
 * DESCRIÇÃO: Camada de comunicação com a API para o módulo Cliente
 * ============================================================================
 */

const ClienteAPI = {

    /**
     * Função genérica para enviar requisições à API.
     */
    call: async function(action, data = {}, showLoading = true) {
        if (showLoading) {
            ClienteUI.showLoading();
        }

        try {
            const token = sessionStorage.getItem(CONFIG_CLIENTE.STORAGE_KEYS.TOKEN);
            
            const payload = {
                action: action,
                token: token,
                origem: window.location.origin,
                ...data
            };

            const response = await fetch(CONFIG_CLIENTE.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload),
                redirect: 'follow'
            });

            if (!response.ok) {
                throw new Error(`Erro de rede: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'error') {
                // Sessão expirada
                if (result.message && (result.message.includes("Sessão expirada") || result.message.includes("Token"))) {
                    ClienteAuth.logout();
                    throw new Error("Sessão expirada. Faça login novamente.");
                }
                throw new Error(result.message);
            }

            return result.data;

        } catch (error) {
            console.error("API Error:", error);
            throw error;
        } finally {
            if (showLoading) {
                ClienteUI.hideLoading();
            }
        }
    },

    // ══════════════════════════════════════════════════════════════════════
    // AUTENTICAÇÃO
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Solicita código de acesso via CPF.
     */
    solicitarCodigo: function(cpf) {
        return this.call('solicitarCodigoCliente', { cpf: cpf });
    },

    /**
     * Valida o código digitado.
     */
    validarCodigo: function(cpf, codigo) {
        return this.call('validarCodigoCliente', { cpf: cpf, codigo: codigo });
    },

    // ══════════════════════════════════════════════════════════════════════
    // PROCESSOS
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Lista os processos do cliente logado.
     */
    getMeusProcessos: function() {
        return this.call('getMeusProcessos', {});
    },

    /**
     * Obtém detalhes de um processo específico.
     */
    getProcesso: function(idProcesso) {
        return this.call('getProcessoCliente', { id_processo: idProcesso });
    },

    // ══════════════════════════════════════════════════════════════════════
    // ARQUIVOS
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Baixa arquivo via proxy (para visualização).
     */
    downloadArquivo: function(fileUrl) {
        return this.call('downloadArquivo', { fileUrl: fileUrl });
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS DE UI
// ══════════════════════════════════════════════════════════════════════════════

const ClienteUI = {

    /**
     * Exibe tela de carregamento.
     */
    showLoading: function(message = "Carregando...") {
        let loader = document.getElementById('cliente-loader');
        
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'cliente-loader';
            loader.className = 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 bg-opacity-90 backdrop-blur-sm';
            
            loader.innerHTML = `
                <div class="flex flex-col items-center p-8">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mb-4"></div>
                    <p id="loader-message" class="text-white font-medium text-lg">${message}</p>
                </div>
            `;
            document.body.appendChild(loader);
        } else {
            const msgEl = document.getElementById('loader-message');
            if (msgEl) msgEl.textContent = message;
        }
        
        loader.classList.remove('hidden');
    },

    /**
     * Esconde tela de carregamento.
     */
    hideLoading: function() {
        const loader = document.getElementById('cliente-loader');
        if (loader) {
            loader.classList.add('hidden');
        }
    },

    /**
     * Exibe toast de notificação.
     */
    showToast: function(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4';
            document.body.appendChild(container);
        }

        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            warning: 'bg-amber-500',
            info: 'bg-blue-600'
        };

        const icons = {
            success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
            error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
            warning: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
            info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `flex items-center gap-3 w-full p-4 rounded-lg shadow-xl text-white transform transition-all duration-300 translate-x-full ${colors[type] || colors.info}`;
        toast.innerHTML = `
            ${icons[type] || icons.info}
            <span class="flex-1 font-medium">${message}</span>
        `;

        container.appendChild(toast);
        
        // Anima entrada
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full');
        });

        // Remove após 4 segundos
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    /**
     * Formata data para exibição.
     */
    formatDate: function(dateInput) {
        if (!dateInput) return '-';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return dateInput;
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    },

    /**
     * Retorna classe CSS baseada no status.
     */
    getStatusClass: function(status) {
        if (!status) return 'bg-slate-100 text-slate-800';
        switch (status.toUpperCase()) {
            case 'EM ANDAMENTO': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'JULGADO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'ARQUIVADO': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'SOBRESTADO': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-slate-100 text-slate-800';
        }
    },

    /**
     * Retorna descrição do status.
     */
    getStatusDescription: function(status) {
        const map = {
            'EM ANDAMENTO': 'Seu processo está sendo analisado.',
            'JULGADO': 'Decisão final foi proferida.',
            'SOBRESTADO': 'Aguardando decisão externa.',
            'ARQUIVADO': 'Processo finalizado.',
            'CANCELADO': 'Processo foi cancelado.'
        };
        return map[status?.toUpperCase()] || '';
    },

    /**
     * Navega para outra página.
     */
    navigateTo: function(page) {
        window.location.href = page;
    },

    /**
     * Escapa HTML para prevenir XSS.
     */
    escapeHtml: function(text) {
        if (!text) return '';
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
};