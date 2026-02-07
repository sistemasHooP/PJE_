/**
 * ============================================================================
 * ARQUIVO: js/utils.js
 * DESCRIÇÃO: Biblioteca de funções utilitárias do Front-End.
 * ATUALIZAÇÃO: Correção da função normalizeText e melhorias de UI.
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

    // --- FORMATAÇÃO ---
    
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

    // --- UI HELPERS ---

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

    showLoading: function(message = 'Carregando...') {
        const existing = document.getElementById('global-loader');
        if (existing) return;

        const loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'fixed inset-0 bg-slate-900/80 z-[60] flex flex-col items-center justify-center backdrop-blur-sm transition-opacity duration-300';
        loader.innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce-small">
                <svg class="animate-spin h-10 w-10 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
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
    }
};
