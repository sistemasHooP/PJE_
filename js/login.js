/**
 * ============================================================================
 * ARQUIVO: login.js
 * DESCRIÇÃO: Autenticação do advogado com PRELOAD de clientes
 * VERSÃO: 2.0 - OTIMIZADO com cache de clientes
 * FIX: Adiciona preload de clientes durante o login para evitar travamento
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const senhaInput = document.getElementById('senha');
  const loginButton = document.getElementById('loginButton');
  const loadingDiv = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 WARM-UP IMEDIATO (assim que a página carrega)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Warm-up silencioso em background (desperta o Apps Script)
  API.call('ping').catch(() => {
    // Ignora erros de warm-up
  });

  console.log('🚀 [Login] Warm-up iniciado em background');

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    if (!email || !senha) {
      UI.showToast('Preencha todos os campos', 'error');
      return;
    }

    loginButton.disabled = true;
    loadingDiv.classList.remove('hidden');
    loadingText.textContent = 'Autenticando...';

    try {
      // 1️⃣ PASSO 1: LOGIN
      console.log('🔐 [Login] Iniciando autenticação...');
      
      const response = await API.call('login', { 
        email, 
        senha: CryptoJS.SHA256(senha).toString() 
      });

      if (!response || !response.token) {
        throw new Error('Resposta inválida do servidor');
      }

      // Salva token e dados do usuário
      Auth.setToken(response.token);
      Auth.setUser(response.usuario);

      console.log('✅ [Login] Autenticação bem-sucedida');
      loadingText.textContent = 'Carregando dados...';

      // 2️⃣ PASSO 2: PRELOAD DE CLIENTES EM BACKGROUND
      // Isso evita travamento na aba "Novo Processo"
      console.log('📥 [Login] Iniciando preload de clientes...');
      
      await preloadClientes();

      // 3️⃣ PASSO 3: PRELOAD DE DASHBOARD (opcional, mas melhora UX)
      console.log('📊 [Login] Preload de dashboard...');
      
      API.call('getDashboard').catch(() => {
        // Ignora erros de preload (dashboard carrega depois)
      });

      // 4️⃣ SUCESSO: Redireciona para o dashboard
      console.log('✅ [Login] Preload concluído. Redirecionando...');
      
      UI.showToast('Login realizado com sucesso!', 'success');
      
      setTimeout(() => {
        window.location.href = './dashboard.html';
      }, 500);

    } catch (error) {
      console.error('❌ [Login] Erro:', error);
      
      loginButton.disabled = false;
      loadingDiv.classList.add('hidden');
      
      const mensagem = error.message || 'Erro ao fazer login';
      UI.showToast(mensagem, 'error');
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

      console.log(`✅ [Preload] ${clientes.length} clientes carregados em ${duration}ms`);

      // Salva no cache do utils.js (Cache.set)
      // TTL de 30 minutos (suficiente para sessão de trabalho)
      Cache.set('lista_clientes', clientes, 30 * 60 * 1000);

      // Cria índices para busca rápida
      const indicesPorCPF = {};
      const indicesPorNome = {};

      clientes.forEach((cliente, index) => {
        // Índice por CPF (limpo)
        if (cliente.cpf) {
          indicesPorCPF[cliente.cpf] = index;
        }

        // Índice por nome (normalizado para busca)
        if (cliente.nome_completo) {
          const nomeNormalizado = cliente.nome_completo
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

    } catch (error) {
      // Não bloqueia o login se o preload falhar
      // O usuário terá uma primeira busca mais lenta, mas não trava
      console.warn('⚠️ [Preload] Falha ao carregar clientes (não crítico):', error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITÁRIOS
  // ═══════════════════════════════════════════════════════════════════════════

  // Auto-focus no email
  emailInput.focus();

  // Enter no email vai para senha
  emailInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      senhaInput.focus();
    }
  });

  // Atalho: Ctrl+Enter para submit rápido
  senhaInput.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      loginForm.dispatchEvent(new Event('submit'));
    }
  });
});
