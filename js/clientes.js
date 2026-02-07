(function() {
    let clientes = [];

    document.addEventListener('DOMContentLoaded', function() {
        Auth.protectRoute();
        inicializarUsuario();
        bindEventos();
        carregarClientes();
    });

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

    function bindEventos() {
        const logout = document.getElementById('desktop-logout-btn');
        if (logout) {
            logout.addEventListener('click', function() {
                if (confirm('Sair do sistema?')) Auth.logout();
            });
        }

        document.getElementById('btn-atualizar-clientes').addEventListener('click', carregarClientes);

        document.getElementById('busca-clientes').addEventListener('input', function() {
            renderClientes(this.value);
        });

        document.getElementById('cliente-cpf').addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '').substring(0, 11);
            if (value.length > 9) value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            else if (value.length > 6) value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            else if (value.length > 3) value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            e.target.value = value;
        });

        document.getElementById('cliente-telefone').addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '').substring(0, 11);
            if (value.length > 6) value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
            else if (value.length > 2) value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            e.target.value = value;
        });

        document.getElementById('form-cliente').addEventListener('submit', async function(e) {
            e.preventDefault();

            const payload = {
                nome_completo: document.getElementById('cliente-nome').value.trim(),
                cpf: document.getElementById('cliente-cpf').value,
                email: document.getElementById('cliente-email').value.trim(),
                telefone: document.getElementById('cliente-telefone').value
            };

            try {
                await API.clientes.cadastrar(payload);
                Utils.showToast('Cliente cadastrado com sucesso!', 'success');
                e.target.reset();
                carregarClientes();
            } catch (err) {
                Utils.showToast(err.message || 'Erro ao cadastrar cliente.', 'error');
            }
        });
    }

    async function carregarClientes() {
        const tbody = document.getElementById('lista-clientes');
        tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">Carregando clientes...</td></tr>';
        try {
            await API.clientes.listar(function(resultado) {
                clientes = Array.isArray(resultado) ? resultado : [];
                renderClientes(document.getElementById('busca-clientes').value || '');
            });
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-red-500">Erro ao carregar clientes.</td></tr>';
        }
    }

    function renderClientes(termo) {
        const tbody = document.getElementById('lista-clientes');
        const t = (termo || '').toLowerCase().trim();

        let filtrados = clientes;
        if (t) {
            const digits = t.replace(/\D/g, '');
            filtrados = clientes.filter(function(c) {
                const nome = String(c.nome_completo || '').toLowerCase();
                const cpf = String(c.cpf || '').toLowerCase();
                const email = String(c.email || '').toLowerCase();
                const cpfDigits = cpf.replace(/\D/g, '');
                return nome.includes(t) || cpf.includes(t) || email.includes(t) || (digits && cpfDigits.includes(digits));
            });
        }

        if (!filtrados || filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = filtrados.map(function(c) {
            return '<tr class="border-b border-slate-100">' +
                '<td class="py-2 text-slate-800 font-medium">' + escapeHtml(c.nome_completo || '-') + '</td>' +
                '<td class="py-2">' + escapeHtml(c.cpf || '-') + '</td>' +
                '<td class="py-2">' + escapeHtml(c.email || '-') + '</td>' +
                '<td class="py-2">' + escapeHtml(c.telefone || '-') + '</td>' +
                '<td class="py-2"><span class="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">' + escapeHtml(c.status || '-') + '</span></td>' +
                '</tr>';
        }).join('');
    }

    function escapeHtml(text) {
        return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
})();
