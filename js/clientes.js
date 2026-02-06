/**
 * ARQUIVO: js/clientes.js
 * DESCRIÇÃO: Gestão de clientes no painel do advogado
 */

document.addEventListener('DOMContentLoaded', async function() {
    if (!Auth.protectRoute()) return;

    Auth.updateUserInfoUI();
    const user = Auth.getUser();
    if (user && user.nome) {
        const avatarEl = document.getElementById('user-initials');
        if (avatarEl) avatarEl.textContent = user.nome.substring(0, 1).toUpperCase();
    }

    const btnLogoutDesktop = document.getElementById('desktop-logout-btn');
    if (btnLogoutDesktop) {
        btnLogoutDesktop.addEventListener('click', function() {
            if (confirm('Deseja realmente sair do sistema?')) Auth.logout();
        });
    }

    const searchInput = document.getElementById('busca-cliente');
    let clientes = [];

    try {
        Utils.showLoading('Carregando clientes...');
        clientes = await API.clientes.listar();
        renderClientes(clientes);
    } catch (e) {
        Utils.showToast(e.message || 'Erro ao carregar clientes.', 'error');
    } finally {
        Utils.hideLoading();
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const termo = this.value.trim().toLowerCase();
            if (!termo) {
                renderClientes(clientes);
                return;
            }
            const filtrados = clientes.filter(c => {
                const nome = String(c.nome_completo || '').toLowerCase();
                const email = String(c.email || '').toLowerCase();
                const cpf = String(c.cpf || '');
                return nome.includes(termo) || email.includes(termo) || cpf.includes(termo);
            });
            renderClientes(filtrados);
        });
    }
});

function renderClientes(lista) {
    const tbody = document.getElementById('clientes-tbody');
    const empty = document.getElementById('clientes-empty');
    if (!tbody) return;

    if (!lista || !lista.length) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    tbody.innerHTML = lista.map(c => {
        const statusClass = c.status === 'ATIVO'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-700';

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(c.nome_completo || '-')}</td>
                <td class="px-4 py-3 text-slate-600">${escapeHtml(c.cpf_formatado || c.cpf || '-')}</td>
                <td class="px-4 py-3 text-slate-600">${escapeHtml(c.email || '-')}</td>
                <td class="px-4 py-3 text-slate-600">${escapeHtml(c.telefone || '-')}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClass}">${escapeHtml(c.status || '-')}</span></td>
            </tr>
        `;
    }).join('');
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
