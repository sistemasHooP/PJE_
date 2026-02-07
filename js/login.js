/**
 * ============================================================================
 * ARQUIVO: js/login.js
 * DESCRIÇÃO: Lógica da página de Login (index.html).
 * ATUALIZAÇÃO: Sistema de "Pre-fetching" (Baixa dados assim que loga).
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js
 * AUTOR: Sistema RPPS Jurídico
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {

    // 1. Verificar se já está logado
    // Se estiver, manda direto pro Dashboard sem perder tempo
    Auth.redirectIfAuthenticated();

    // --- WARM-UP (ACORDAR SERVIDOR) ---
    // Dispara um 'ping' silencioso assim que a tela carrega.
    // Isso tira o Google Apps Script do modo de suspensão enquanto o usuário digita a senha.
    console.log("[Login] Iniciando aquecimento do servidor...");
    API.call('ping', {}, 'POST', true).then(() => {
        console.log("[Login] Servidor pronto e aquecido.");
    }).catch(e => {
        console.log("[Login] Tentativa de aquecimento falhou (sem problemas, o login tentará novamente).");
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
            
            // Alterna ícone (olho aberto/fechado)
            const icon = this.querySelector('svg');
            if (type === 'text') {
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />';
            } else {
                icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />';
            }
        });
    }

    // 3. Submissão do Formulário
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = emailInput.value.trim();
            const senha = senhaInput.value;

            if (!email || !senha) {
                Utils.showToast("Preencha todos os campos.", "warning");
                return;
            }

            // UI Loading
            Utils.showLoading("Autenticando...");

            try {
                // Chama a API de Login
                const response = await API.call('login', { email, senha });

                // Se chegou aqui, login foi sucesso (API.call lança erro se falhar)
                const { token, user } = response;

                // Salva Token e Dados do Usuário
                sessionStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
                sessionStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(user));

                Utils.showToast("Login realizado com sucesso!", "success");
                
                // --- PRE-FETCHING (O PULO DO GATO) ---
                // Agora que temos o token, disparamos o carregamento das listas PESADAS
                // enquanto mostramos uma animação rápida para o usuário.
                // Isso garante que a tela "Novo Processo" e "Clientes" abram instantaneamente depois.
                
                Utils.showLoading("Preparando seu ambiente...");
                console.log("[Login] Iniciando pré-carregamento de dados...");

                // Usamos Promise.allSettled para não travar o login caso uma request falhe
                await Promise.allSettled([
                    // Busca Processos (Silent Mode = true)
                    new Promise(resolve => {
                        API.processos.listar({}, (data, source) => {
                            console.log(`[Login] Processos pré-carregados: ${data?.length || 0}`);
                            resolve();
                        }, true).catch(err => {
                            console.warn("[Login] Falha no pré-load de processos", err);
                            resolve(); // Resolve mesmo com erro para prosseguir
                        });
                    }),

                    // Busca Clientes (Silent Mode = true)
                    new Promise(resolve => {
                        API.clientes.listar((data, source) => {
                            console.log(`[Login] Clientes pré-carregados: ${data?.length || 0}`);
                            resolve();
                        }, true).catch(err => {
                            console.warn("[Login] Falha no pré-load de clientes", err);
                            resolve();
                        });
                    })
                ]);

                console.log("[Login] Pré-carregamento concluído. Redirecionando...");
                
                // Redireciona para o Dashboard
                setTimeout(() => {
                    Utils.navigateTo(CONFIG.PAGES.DASHBOARD);
                }, 500);

            } catch (error) {
                console.error("Falha no login:", error);
                Utils.hideLoading();

                // Feedback visual de erro nos campos
                emailInput.classList.add('border-red-500');
                senhaInput.classList.add('border-red-500');

                setTimeout(() => {
                    emailInput.classList.remove('border-red-500');
                    senhaInput.classList.remove('border-red-500');
                }, 2000);

                Utils.showToast(error.message || "Email ou senha incorretos.", "error");
                
                // Limpa senha para nova tentativa
                senhaInput.value = "";
                senhaInput.focus();
            }
        });
    }
});
