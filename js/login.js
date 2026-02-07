/**
 * ============================================================================
 * ARQUIVO: js/login.js
 * DESCRIÇÃO: Lógica da página de Login (index.html).
 * ATUALIZAÇÃO: Sistema de "Warm-up" + Prefetch de Clientes no Login.
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js
 * AUTOR: Desenvolvedor Sênior (Sistema RPPS)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Verificar se já está logado
    Auth.redirectIfAuthenticated();

    // --- WARM-UP (ACORDAR SERVIDOR) ---
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

            try {
                // 1. TELA DE SINCRONIZAÇÃO (Loader Principal Personalizado)
                Utils.showLoading("Sincronizando banco de dados...", "database");
                
                // 2. Autenticação (Modo Silencioso)
                const response = await API.call('login', { email, senha }, 'POST', true);
                
                // Se chegou aqui, login ok
                Auth.saveSession(response);

                // 3. PRELOAD REAL (Cache Warming) — Inclui clientes!
                await Promise.all([
                    new Promise(resolve => {
                        API.processos.dashboard((data, source) => {
                            if (source === 'network') resolve();
                        }, true).catch(resolve); 
                    }),
                    
                    new Promise(resolve => {
                        API.processos.listar({}, (data, source) => {
                            if (source === 'network') resolve();
                        }, true).catch(resolve); 
                    }),

                    // ============================================================
                    // [FIX BUG 3] PREFETCH DE CLIENTES
                    // Busca a lista de clientes em paralelo e salva no localStorage.
                    // Quando o usuário abrir clientes.html ou novo-processo.html,
                    // os dados já estarão em cache instantaneamente.
                    // ============================================================
                    new Promise(resolve => {
                        API.clientes.listar().then(clientes => {
                            if (Array.isArray(clientes)) {
                                try {
                                    localStorage.setItem('rpps_clientes_cache', JSON.stringify({
                                        data: clientes,
                                        timestamp: Date.now()
                                    }));
                                    console.log('[Login] Prefetch de clientes: ' + clientes.length + ' clientes em cache.');
                                } catch (e) {
                                    console.warn('[Login] Erro ao cachear clientes:', e);
                                }
                            }
                            resolve();
                        }).catch(err => {
                            console.warn('[Login] Prefetch de clientes falhou (sem problemas):', err.message);
                            resolve();
                        });
                    })
                ]);

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
                console.error("Falha no login:", error);
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
});
