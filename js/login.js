/**
 * ============================================================================
 * ARQUIVO: login.js
 * DESCRIÇÃO: Autenticação do advogado com PRELOAD de clientes
 * VERSÃO: 2.1 - CORRIGIDO e COMPLETO
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {
  
  console.log('🔷 [Login] Script carregado. Iniciando...');

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSCA ELEMENTOS DO DOM (com fallback para diferentes IDs)
  // ═══════════════════════════════════════════════════════════════════════════

  // Formulário de login (tenta diferentes IDs)
  const loginForm = document.getElementById('login-form') || 
                    document.getElementById('loginForm') || 
                    document.querySelector('form');

  if (!loginForm) {
    console.error('❌ [Login] ERRO: Formulário de login não encontrado!');
    console.error('Certifique-se que existe um <form> com id="login-form"');
    return;
  }

  console.log('✅ [Login] Formulário encontrado:', loginForm.id || 'sem id');

  // Campos de entrada (tenta diferentes IDs/names)
  const emailInput = document.getElementById('email') || 
                     document.querySelector('input[name="email"]') ||
                     document.querySelector('input[type="email"]');

  const senhaInput = document.getElementById('senha') || 
                     document.getElementById('password') ||
                     document.querySelector('input[name="senha"]') ||
                     document.querySelector('input[name="password"]') ||
                     document.querySelector('input[type="password"]');

  const loginButton = document.getElementById('btn-login') ||
                      document.getElementById('loginButton') ||
                      document.querySelector('button[type="submit"]') ||
                      loginForm.querySelector('button');

  // Elementos de feedback visual (opcionais)
  const loadingDiv = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');

  // Validação dos elementos essenciais
  if (!emailInput || !senhaInput) {
    console.error('❌ [Login] ERRO: Campos de email ou senha não encontrados!');
    console.error('Email input:', emailInput);
    console.error('Senha input:', senhaInput);
    return;
  }

  console.log('✅ [Login] Campos encontrados:');
  console.log('  - Email:', emailInput.id || emailInput.name || 'sem identificador');
  console.log('  - Senha:', senhaInput.id || senhaInput.name || 'sem identificador');
  console.log('  - Botão:', loginButton ? (loginButton.id || 'sem id') : 'não encontrado');

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 WARM-UP IMEDIATO (assim que a página carrega)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Warm-up silencioso em background (desperta o Apps Script)
  if (typeof API !== 'undefined') {
    API.call('ping').then(function() {
      console.log('✅ [Login] Warm-up bem-sucedido');
    }).catch(function(err) {
      console.warn('⚠️ [Login] Warm-up falhou (não crítico):', err.message);
    });
  } else {
    console.warn('⚠️ [Login] API não encontrada. Verifique se api.js foi carregado.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    console.log('🔐 [Login] Formulário enviado');

    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    if (!email || !senha) {
      mostrarErro('Preencha todos os campos');
      return;
    }

    // Desabilita botão e mostra loading
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.innerHTML = '<div class="spinner border-white"></div><span>Autenticando...</span>';
    }

    if (loadingDiv) {
      loadingDiv.classList.remove('hidden');
    }

    if (loadingText) {
      loadingText.textContent = 'Autenticando...';
    }

    try {
      // Verifica se dependências estão disponíveis
      if (typeof API === 'undefined') {
        throw new Error('API não encontrada. Verifique se api.js foi carregado.');
      }

      if (typeof CryptoJS === 'undefined') {
        throw new Error('CryptoJS não encontrado. Verifique se foi carregado.');
      }

      if (typeof Auth === 'undefined') {
        throw new Error('Auth não encontrado. Verifique se auth.js foi carregado.');
      }

      // 1️⃣ PASSO 1: LOGIN
      console.log('🔐 [Login] Iniciando autenticação...');
      
      const response = await API.call('login', { 
        email: email, 
        senha: CryptoJS.SHA256(senha).toString() 
      });

      if (!response || !response.token) {
        throw new Error('Resposta inválida do servidor');
      }

      // Salva token e dados do usuário
      Auth.setToken(response.token);
      Auth.setUser(response.usuario);

      console.log('✅ [Login] Autenticação bem-sucedida');
      
      if (loadingText) {
        loadingText.textContent = 'Carregando dados...';
      }

      // 2️⃣ PASSO 2: PRELOAD DE CLIENTES EM BACKGROUND
      console.log('📥 [Login] Iniciando preload de clientes...');
      
      await preloadClientes();

      // 3️⃣ PASSO 3: PRELOAD DE DASHBOARD (opcional, mas melhora UX)
      console.log('📊 [Login] Preload de dashboard...');
      
      API.call('getDashboard').catch(function() {
        // Ignora erros de preload (dashboard carrega depois)
      });

      // 4️⃣ SUCESSO: Redireciona para o dashboard
      console.log('✅ [Login] Preload concluído. Redirecionando...');
      
      mostrarSucesso('Login realizado com sucesso!');
      
      setTimeout(function() {
        window.location.href = './dashboard.html';
      }, 500);

    } catch (error) {
      console.error('❌ [Login] Erro:', error);
      
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.innerHTML = '<span>ACESSAR SISTEMA</span>';
      }
      
      if (loadingDiv) {
        loadingDiv.classList.add('hidden');
      }
      
      const mensagem = error.message || 'Erro ao fazer login';
      mostrarErro(mensagem);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚀 FUNÇÃO DE PRELOAD DE CLIENTES (CRÍTICA PARA PERFORMANCE)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Preload de clientes durante o login
   * Armazena no cache para uso rápido na aba "Novo Processo"
   */
  async function preloadClientes() {
    try {
      console.log('📦 [Preload] Buscando lista de clientes...');
      
      const startTime = performance.now();
      
      // Chama endpoint otimizado de listagem
      const clientes = await API.call('listarClientes');
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      if (!clientes || !Array.isArray(clientes)) {
        console.warn('⚠️ [Preload] Resposta inválida de clientes');
        return;
      }

      console.log('✅ [Preload] ' + clientes.length + ' clientes carregados em ' + duration + 'ms');

      // Salva no cache (verifica se Cache existe)
      if (typeof Cache !== 'undefined') {
        // TTL de 30 minutos (suficiente para sessão de trabalho)
        Cache.set('lista_clientes', clientes, 30 * 60 * 1000);

        // Cria índices para busca rápida
        var indicesPorCPF = {};
        var indicesPorNome = {};

        clientes.forEach(function(cliente, index) {
          // Índice por CPF (limpo)
          if (cliente.cpf) {
            indicesPorCPF[cliente.cpf] = index;
          }

          // Índice por nome (normalizado para busca)
          if (cliente.nome_completo) {
            var nomeNormalizado = cliente.nome_completo
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
            
            indicesPorNome[nomeNormalizado] = index;
          }
        });

        // Salva índices
        Cache.set('clientes_indice_cpf', indicesPorCPF, 30 * 60 * 1000);
        Cache.set('clientes_indice_nome', indicesPorNome, 30 * 60 * 1000);

        console.log('🔍 [Preload] Índices de busca criados');
      } else {
        console.warn('⚠️ [Preload] Cache não encontrado. Salvando no localStorage...');
        
        // Fallback para localStorage
        try {
          localStorage.setItem('lista_clientes', JSON.stringify(clientes));
          localStorage.setItem('lista_clientes_timestamp', Date.now().toString());
        } catch (e) {
          console.error('❌ [Preload] Erro ao salvar em localStorage:', e);
        }
      }

    } catch (error) {
      // Não bloqueia o login se o preload falhar
      // O usuário terá uma primeira busca mais lenta, mas não trava
      console.warn('⚠️ [Preload] Falha ao carregar clientes (não crítico):', error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÕES DE FEEDBACK VISUAL
  // ═══════════════════════════════════════════════════════════════════════════

  function mostrarErro(mensagem) {
    console.error('❌ [Login] Erro:', mensagem);
    
    // Tenta usar UI.showToast se disponível
    if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
      UI.showToast(mensagem, 'error');
    } else {
      // Fallback: cria toast simples
      criarToast(mensagem, 'error');
    }
  }

  function mostrarSucesso(mensagem) {
    console.log('✅ [Login] Sucesso:', mensagem);
    
    // Tenta usar UI.showToast se disponível
    if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
      UI.showToast(mensagem, 'success');
    } else {
      // Fallback: cria toast simples
      criarToast(mensagem, 'success');
    }
  }

  /**
   * Cria um toast simples (fallback se UI.showToast não existir)
   */
  function criarToast(mensagem, tipo) {
    const container = document.getElementById('toast-container') || document.body;
    
    const cores = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    };
    
    const toast = document.createElement('div');
    toast.className = `${cores[tipo] || cores.info} text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in`;
    toast.textContent = mensagem;
    
    container.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITÁRIOS
  // ═══════════════════════════════════════════════════════════════════════════

  // Auto-focus no email
  if (emailInput) {
    emailInput.focus();
  }

  // Enter no email vai para senha
  if (emailInput && senhaInput) {
    emailInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        senhaInput.focus();
      }
    });
  }

  // Atalho: Ctrl+Enter para submit rápido
  if (senhaInput) {
    senhaInput.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        loginForm.dispatchEvent(new Event('submit'));
      }
    });
  }

  console.log('✅ [Login] Script inicializado com sucesso');
});
