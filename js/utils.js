/**
 * ============================================================================
 * ARQUIVO: js/utils.js
 * DESCRIÇÃO: Biblioteca de funções utilitárias do Front-End.
 * ATUALIZAÇÃO: Restauração de addSyncButton, máscaras e formatações de status.
 * ============================================================================
 */

const Utils = {

    /**
     * Normaliza texto removendo acentos e deixando minúsculo.
     * CRUCIAL PARA A BUSCA FUNCIONAR.
     */
    normalizeText: function(text) {
        if (!text) return '';
        return String(text)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    },

    // --- CACHE INTELIGENTE ---
    Cache: {
        set: function(key, data, ttlInMinutes = 30) {
            const now = new Date();
            const item = { value: data, expiry: now.getTime() + (ttlInMinutes * 60 * 1000) };
            try { localStorage.setItem(key, JSON.stringify(item)); } catch (e) { console.warn("Cache cheio", e); }
        },
        get: function(key) {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;
            try {
                const item = JSON.parse(itemStr);
                if (new Date().getTime() > item.expiry) { localStorage.removeItem(key); return null; }
                return item.value;
            } catch (e) { return null; }
        },
        clear: function(keyPrefix) {
            if (!keyPrefix) { localStorage.clear(); return; }
            Object.keys(localStorage).forEach(key => { if (key.startsWith(keyPrefix)) localStorage.removeItem(key); });
        }
    },

    // --- INTERFACE (UI) ---

    /**
     * Adiciona um botão flutuante ou fixo para sincronizar dados (limpar cache).
     * Usado no Dashboard e Lista de Processos.
     */
    addSyncButton: function(callback) {
        // Remove botão anterior se existir para evitar duplicidade
        const existing = document.getElementById('fab-sync-btn');
        if (existing) existing.remove();

        const btn = document.createElement('button');
        btn.id = 'fab-sync-btn';
        btn.className = 'fixed bottom-20 right-4 md:bottom-8 md:right-8 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-all z-40 flex items-center justify-center group';
        btn.innerHTML = `
            <svg class="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span class="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 text-sm font-medium">Sincronizar</span>
        `;
        
        btn.onclick = function() {
            // Animação de rotação
            const icon = btn.querySelector('svg');
            icon.classList.add('animate-spin');
            
            // Limpa todo o cache relacionado a listas
            Utils.Cache.clear('listar');
            Utils.Cache.clear('getDashboard');
            
            // Feedback
            Utils.showToast("Sincronizando dados...", "info");
            
            // Executa a função de recarga da página
            if (typeof callback === 'function') {
                callback().then(() => {
                    setTimeout(() => icon.classList.remove('animate-spin'), 500);
                    Utils.showToast("Dados atualizados!", "success");
                });
            }
        };

        document.body.appendChild(btn);
    },

    showToast: function(message, type = 'info') {
        const existing = document.getElementById('toast-notification');
        if (existing) existing.remove();

        const colors = {
            success: 'bg-emerald-600',
            error: 'bg-red-600',
            warning: 'bg-amber-500',
            info: 'bg-slate-700'
        };

        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = `fixed top-5 right-5 ${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-xl z-50 transform transition-all duration-300 translate-y-[-20px] opacity-0 flex items-center`;
        
        let icon = '';
        if (type === 'success') icon = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        if (type === 'error') icon = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

        toast.innerHTML = `${icon}<span class="font-medium">${message}</span>`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-[-20px]');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showLoading: function(message = 'Carregando...', iconType = 'default') {
        const existing = document.getElementById('global-loader');
        if (existing) return;

        let svgIcon = '';
        if (iconType === 'database') {
            svgIcon = '<svg class="animate-bounce h-10 w-10 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>';
        } else {
            svgIcon = `<svg class="animate-spin h-10 w-10 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>`;
        }

        const loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'fixed inset-0 bg-slate-900/80 z-[60] flex flex-col items-center justify-center backdrop-blur-sm transition-opacity duration-300';
        loader.innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce-small">
                ${svgIcon}
                <span class="text-slate-700 font-semibold text-sm tracking-wide">${message}</span>
            </div>
        `;
        document.body.appendChild(loader);
    },

    hideLoading: function() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.add('opacity-0');
            setTimeout(() => loader.remove(), 300);
        }
    },

    navigateTo: function(page) {
        window.location.href = page;
    },

    // --- FORMATAÇÃO DE DADOS ---
    
    formatCPF: function(cpf) {
        if (!cpf) return '';
        const v = String(cpf).replace(/\D/g, '');
        if (v.length !== 11) return cpf;
        return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    },

    formatTelefone: function(tel) {
        if (!tel) return '';
        const v = String(tel).replace(/\D/g, '');
        if (v.length === 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        if (v.length === 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
        return tel;
    },

    formatDate: function(dateInput) {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return dateInput;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    },

    // --- HELPERS DE STATUS (Processos) ---

    getStatusClass: function(status) {
        if (!status) return 'bg-slate-100 text-slate-800 border-slate-200';
        const s = String(status).toUpperCase().trim();
        
        switch (s) {
            case 'EM ANDAMENTO': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'JULGADO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'ARQUIVADO': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'SOBRESTADO': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    },

    getStatusLabel: function(status) {
        const map = {
            'EM ANDAMENTO': 'Processo fluindo normalmente.',
            'JULGADO': 'Decisão final proferida.',
            'SOBRESTADO': 'Pausado aguardando decisão externa.',
            'ARQUIVADO': 'Processo finalizado e guardado.',
            'CANCELADO': 'Processo anulado ou desistência.'
        };
        return map[String(status).toUpperCase()] || 'Status do processo.';
    },

    // --- MÁSCARAS DE INPUT (UX) ---

    maskCPFInput: function(e) {
        let v = e.target.value.replace(/\D/g, '');
        v = v.substring(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        e.target.value = v;
    },

    maskPhoneInput: function(e) {
        let v = e.target.value.replace(/\D/g, '');
        v = v.substring(0, 11);
        if (v.length > 10) { // Celular 11 dígitos
            v = v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (v.length > 5) {
            v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        } else if (v.length > 2) {
            v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
        }
        e.target.value = v;
    }
};
