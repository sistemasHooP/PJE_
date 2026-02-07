/**
 * ============================================================================
 * ARQUIVO: js/login.js
 * DESCRIÇÃO: Lógica da página de Login (index.html) - VERSÃO PERFEITA
 * ATUALIZAÇÃO: Sistema de "Warm-up" + Hash de senha com Crypto (standalone)
 * DEPENDÊNCIAS: js/api.js, js/auth.js, js/utils.js, js/crypto.js
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {

    console.log('🔷 [Login] Script inicializado');

    // 1. Verificar se já está logado
    if (Auth && typeof Auth.redirectIfAuthenticated === 'function') {
        Auth.redirectIfAuthenticated();
    }

    // --- WARM-UP (ACORDAR SERVIDOR) ---
    // Dispara um 'ping' silencioso assim que a tela carrega.
    console.log('🔥 [Login] Iniciando aquecimento do servidor...');
    
    if (typeof API !== 'undefined') {
        API.call('ping', {}, 'POST', true).then(function() {
            console.log('✅ [Login] Servidor pronto e aquecido');
        }).catch(function(e) {
            console.log('⚠️ [Login] Tentativa de aquecimento falhou (não crítico)');
        });
    }

    // Referências aos elementos do DOM
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const togglePasswordBtn = document.getElementById('toggle-password');

    // Validação de elementos essenciais
    if (!loginForm) {
        console.error('❌ [Login] Formulário não encontrado!');
        return;
    }

    if (!emailInput || !senhaInput) {
        console.error('❌ [Login] Campos de email ou senha não encontrados!');
        return;
    }

    console.log('✅ [Login] Elementos encontrados');

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
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        console.log('🔐 [Login] Formulário enviado');

        const email = emailInput.value.trim();
        const senha = senhaInput.value;

        if (!email || !senha) {
            mostrarErro('Por favor, preencha todos os campos.');
            return;
        }

        try {
            // Verifica se a biblioteca de criptografia está disponível
            if (typeof Crypto === 'undefined') {
                throw new Error('Biblioteca de segurança não carregada. Recarregue a página.');
            }

            console.log('🔐 [Login] Gerando hash da senha...');

            // 1. TELA DE SINCRONIZAÇÃO (Loader Principal)
            mostrarLoading('Sincronizando banco de dados...');

            // 2. HASH DA SENHA usando nossa implementação standalone
            const senhaHash = Crypto.SHA256(senha).toString();
            console.log('✅ [Login] Hash gerado:', senhaHash.substring(0, 16) + '...');

            // 3. Autenticação (Modo Silencioso)
            const response = await API.call('login', { 
                email: email, 
                senha: senhaHash 
            }, 'POST', true);

            // Se chegou aqui, login ok
            if (Auth && typeof Auth.saveSession === 'function') {
                Auth.saveSession(response);
            }

            console.log('✅ [Login] Autenticação bem-sucedida');

            // 4. PRELOAD REAL (Cache Warming)
            console.log('📥 [Login] Iniciando preload de dados...');
            
            await Promise.all([
                new Promise(function(resolve) {
                    if (API.processos && typeof API.processos.dashboard === 'function') {
                        API.processos.dashboard(function(data, source) {
                            if (source === 'network') {
                                console.log('✅ [Preload] Dashboard carregado');
                                resolve();
                            }
                        }, true).catch(resolve);
                    } else {
                        resolve();
                    }
                }),

                new Promise(function(resolve) {
                    if (API.processos && typeof API.processos.listar === 'function') {
                        API.processos.listar({}, function(data, source) {
                            if (source === 'network') {
                                console.log('✅ [Preload] Processos carregados');
                                resolve();
                            }
                        }, true).catch(resolve);
                    } else {
                        resolve();
                    }
                }),

                // Pré-carrega clientes para acelerar Novo Processo e aba Clientes
                new Promise(function(resolve) {
                    if (API.clientes && typeof API.clientes.listar === 'function') {
                        API.clientes.listar(function(data, source) {
                            if (source === 'network') {
                                console.log('✅ [Preload] Clientes carregados');
                                resolve();
                            }
                        }, true).catch(resolve);
                    } else {
                        resolve();
                    }
                })
            ]);

            console.log('✅ [Login] Preload concluído');

            // 5. Sucesso
            esconderLoading();

            setTimeout(function() {
                mostrarSucesso('Login realizado com sucesso!');

                // Redireciona
                setTimeout(function() {
                    if (Utils && typeof Utils.navigateTo === 'function') {
                        Utils.navigateTo(CONFIG.PAGES.DASHBOARD);
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }, 1000);
            }, 100);

        } catch (error) {
            console.error('❌ [Login] Falha no login:', error);
            esconderLoading();

            emailInput.classList.add('border-red-500');
            senhaInput.classList.add('border-red-500');

            setTimeout(function() {
                emailInput.classList.remove('border-red-500');
                senhaInput.classList.remove('border-red-500');
            }, 2000);

            mostrarErro(error.message || 'Email ou senha incorretos.');
            senhaInput.value = '';
            senhaInput.focus();
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // FUNÇÕES AUXILIARES
    // ═══════════════════════════════════════════════════════════════════════

    function mostrarLoading(mensagem) {
        if (Utils && typeof Utils.showLoading === 'function') {
            Utils.showLoading(mensagem, 'database');
        } else {
            console.log('⏳ [Login]', mensagem);
        }
    }

    function esconderLoading() {
        if (Utils && typeof Utils.hideLoading === 'function') {
            Utils.hideLoading();
        }
    }

    function mostrarErro(mensagem) {
        if (Utils && typeof Utils.showToast === 'function') {
            Utils.showToast(mensagem, 'error');
        } else {
            alert('Erro: ' + mensagem);
        }
    }

    function mostrarSucesso(mensagem) {
        if (Utils && typeof Utils.showToast === 'function') {
            Utils.showToast(mensagem, 'success');
        } else {
            console.log('✅ [Login]', mensagem);
        }
    }

    console.log('✅ [Login] Pronto para autenticação');
});
