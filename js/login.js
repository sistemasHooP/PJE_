/**
 * ============================================================================
 * ARQUIVO: js/login.js
 * DESCRIÇÃO: Lógica da página de Login (index.html).
 * ATUALIZAÇÃO: Sistema de "Warm-up" + Hash de senha com CryptoJS
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js, CryptoJS (CDN)
 * AUTOR: Desenvolvedor Sênior (Sistema RPPS)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {

    // 1. Verificar se já está logado
    Auth.redirectIfAuthenticated();

    // --- WARM-UP (ACORDAR SERVIDOR) ---
    // Dispara um 'ping' silencioso assim que a tela carrega.
    // Isso tira o Google Apps Script do modo de suspensão enquanto o usuário digita a senha.
    console.log("Iniciando aquecimento do servidor...");
    API.call('ping', {}, 'POST', true).then(() => {
        console.log("Servidor pronto e aquecido.");
    }).catch(e => {
        console.log("Tentativa de aquecimento falhou (sem problemas, o login tentará novamente).");
    });

    // Referências aos elementos do DOM
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const togglePasswordBtn = document.getElementById('toggle-password');

    // 2. Manipulação do Botão "Ver Senha"
    if (togglePasswordBtn && senhaInput) {
        togglePasswordBtn.addEventListener('click', function() {
            const type = senhaInput.getAttribute('type') === 'password' ? 'text' : 'password';
            senhaInput.setAttribute('type', type);

            // Alterna o estilo do ícone
            this.classList.toggle('text-slate-600');
            this.classList.toggle('text-slate-400');
        });
    }

    // 3. Envio do Formulário de Login
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = emailInput.value.trim();
            const senha = senhaInput.value;

            if (!email || !senha) {
                Utils.showToast("Por favor, preencha todos os campos.", "warning");
                return;
            }

            // ✅ VERIFICA SE CRYPTOJS ESTÁ DISPONÍVEL
            if (typeof CryptoJS === 'undefined') {
                console.error('❌ CryptoJS não encontrado!');
                Utils.showToast("Erro: Biblioteca de segurança não carregada. Recarregue a página.", "error");
                return;
            }

            try {
                // 1. TELA DE SINCRONIZAÇÃO (Loader Principal Personalizado)
                Utils.showLoading("Sincronizando banco de dados...", "database");

                // ✅ HASH DA SENHA COM CRYPTOJS (SHA-256)
                console.log('🔐 [Login] Gerando hash da senha...');
                const senhaHash = CryptoJS.SHA256(senha).toString();
                console.log('✅ [Login] Hash gerado com sucesso');

                // 2. Autenticação (Modo Silencioso) - AGORA COM SENHA HASHEADA
                const response = await API.call('login', { 
                    email: email, 
                    senha: senhaHash  // ✅ ENVIA SENHA HASHEADA
                }, 'POST', true);

                // Se chegou aqui, login ok
                Auth.saveSession(response);

                console.log('✅ [Login] Autenticação bem-sucedida');

                // 3. PRELOAD REAL (Cache Warming)
                console.log('📥 [Login] Iniciando preload de dados...');
                
                await Promise.all([
                    new Promise(resolve => {
                        API.processos.dashboard((data, source) => {
                            if (source === 'network') {
                                console.log('✅ [Preload] Dashboard carregado');
                                resolve();
                            }
                        }, true).catch(resolve);
                    }),

                    new Promise(resolve => {
                        API.processos.listar({}, (data, source) => {
                            if (source === 'network') {
                                console.log('✅ [Preload] Processos carregados');
                                resolve();
                            }
                        }, true).catch(resolve);
                    }),

                    // Pré-carrega clientes para acelerar Novo Processo e aba Clientes
                    new Promise(resolve => {
                        API.clientes.listar((data, source) => {
                            if (source === 'network') {
                                console.log('✅ [Preload] Clientes carregados');
                                resolve();
                            }
                        }, true).catch(resolve);
                    })
                ]);

                console.log('✅ [Login] Preload concluído');

                // 4. Sucesso
                Utils.hideLoading();

                setTimeout(() => {
                    Utils.showToast(`Login realizado com sucesso!`, "success");

                    // Redireciona
                    setTimeout(() => {
                        Utils.navigateTo(CONFIG.PAGES.DASHBOARD);
                    }, 1000);
                }, 100);

            } catch (error) {
                console.error("❌ [Login] Falha no login:", error);
                Utils.hideLoading();

                emailInput.classList.add('border-red-500');
                senhaInput.classList.add('border-red-500');

                setTimeout(() => {
                    emailInput.classList.remove('border-red-500');
                    senhaInput.classList.remove('border-red-500');
                }, 2000);

                Utils.showToast(error.message || "Email ou senha incorretos.", "error");
                senhaInput.value = "";
                senhaInput.focus();
            }
        });
    }

    // ✅ LOG DE INICIALIZAÇÃO
    console.log('✅ [Login] Script inicializado com sucesso');
    console.log('✅ [Login] CryptoJS disponível:', typeof CryptoJS !== 'undefined');
});
