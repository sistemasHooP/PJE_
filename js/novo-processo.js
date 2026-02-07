/**
 * ============================================================================
 * ARQUIVO: novo-processo.js
 * DESCRIÇÃO: Wizard de criação de processo (2 steps) COM CACHE
 * VERSÃO: 3.0 - OTIMIZADO com cache de clientes
 * FIX: Usa cache do preload + atualiza após cadastro inline
 * ============================================================================
 */

let clienteSelecionado = null;
let clientesCache = []; // Cache local da página

document.addEventListener('DOMContentLoaded', async function() {
  // Verifica autenticação
  if (!Auth.isAuthenticated()) {
    window.location.href = './index.html';
    return;
  }

  // Carrega clientes do cache (preload do login)
  await carregarClientesDoCache();

  // Configuração do wizard
  configurarWizard();
  configurarBuscaCliente();
  configurarFormularioProcesso();
});

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 CARREGA CLIENTES DO CACHE (INSTANTÂNEO)
// ═══════════════════════════════════════════════════════════════════════════

async function carregarClientesDoCache() {
  try {
    console.log('📦 [NovoProcesso] Carregando clientes do cache...');

    // Tenta buscar do cache (salvo no login)
    clientesCache = Cache.get('lista_clientes') || [];

    if (clientesCache.length > 0) {
      console.log(`✅ [NovoProcesso] ${clientesCache.length} clientes carregados do cache (instantâneo)`);
      return;
    }

    // Se não tem cache, busca da rede (fallback)
    console.log('⚠️ [NovoProcesso] Cache vazio. Buscando da rede...');
    
    const loadingMsg = UI.showToast('Carregando lista de clientes...', 'info', 0);

    try {
      clientesCache = await API.call('listarClientes');
      
      // Salva no cache para próximas vezes
      Cache.set('lista_clientes', clientesCache, 30 * 60 * 1000);
      
      UI.hideToast(loadingMsg);
      
      console.log(`✅ [NovoProcesso] ${clientesCache.length} clientes carregados da rede`);

    } catch (error) {
      UI.hideToast(loadingMsg);
      console.error('❌ [NovoProcesso] Erro ao carregar clientes:', error);
      UI.showToast('Não foi possível carregar a lista de clientes', 'error');
    }

  } catch (error) {
    console.error('❌ [NovoProcesso] Erro ao acessar cache:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSCA DE CLIENTE (INSTANT SEARCH NO CACHE)
// ═══════════════════════════════════════════════════════════════════════════

function configurarBuscaCliente() {
  const inputBusca = document.getElementById('busca_cliente');
  const resultadosDiv = document.getElementById('resultados_busca');
  const btnNovoCli = document.getElementById('btn_novo_cliente_inline');
  const formNovoCli = document.getElementById('form_novo_cliente');
  const btnCancelarCadastro = document.getElementById('btn_cancelar_cadastro');

  if (!inputBusca) return;

  // ═══════════════════════════════════════════════════════════════
  // INSTANT SEARCH (busca no cache local - sem requisição de rede)
  // ═══════════════════════════════════════════════════════════════

  let timeoutBusca;

  inputBusca.addEventListener('input', function(e) {
    clearTimeout(timeoutBusca);

    const termo = e.target.value.trim();

    // Limpa resultados se menos de 2 caracteres
    if (termo.length < 2) {
      resultadosDiv.innerHTML = '';
      resultadosDiv.classList.add('hidden');
      return;
    }

    // Debounce de 200ms para não sobrecarregar a interface
    timeoutBusca = setTimeout(() => {
      buscarClienteNoCache(termo);
    }, 200);
  });

  /**
   * Busca cliente no cache local (INSTANTÂNEO - sem rede)
   */
  function buscarClienteNoCache(termo) {
    if (clientesCache.length === 0) {
      resultadosDiv.innerHTML = '<div class="p-4 text-gray-500">Lista de clientes não carregada</div>';
      resultadosDiv.classList.remove('hidden');
      return;
    }

    // Normaliza termo de busca
    const termoNormalizado = termo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

    // Busca em todos os campos
    const resultados = clientesCache.filter(cliente => {
      // Busca por nome
      const nome = (cliente.nome_completo || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Busca por CPF (limpo)
      const cpf = (cliente.cpf || '').replace(/\D/g, '');
      const termoNumerico = termo.replace(/\D/g, '');

      // Busca por email
      const email = (cliente.email || '').toLowerCase();

      return nome.includes(termoNormalizado) || 
             cpf.includes(termoNumerico) || 
             email.includes(termoNormalizado);
    });

    console.log(`🔍 [Busca] "${termo}" → ${resultados.length} resultado(s) (instantâneo)`);

    // Exibe resultados
    if (resultados.length === 0) {
      resultadosDiv.innerHTML = `
        <div class="p-4 text-center">
          <p class="text-gray-600 mb-2">Nenhum cliente encontrado</p>
          <button 
            id="btn_cadastrar_inline" 
            class="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            + Cadastrar novo cliente
          </button>
        </div>
      `;

      document.getElementById('btn_cadastrar_inline').addEventListener('click', () => {
        mostrarFormularioCadastro();
      });

    } else {
      // Limita a 5 resultados
      const top5 = resultados.slice(0, 5);

      resultadosDiv.innerHTML = top5.map(cliente => `
        <div 
          class="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 transition-colors"
          data-cliente-id="${cliente.id}"
        >
          <div class="font-medium text-gray-900">${cliente.nome_completo}</div>
          <div class="text-sm text-gray-600">
            CPF: ${cliente.cpf_mascarado || cliente.cpf} • ${cliente.email}
          </div>
        </div>
      `).join('');

      // Adiciona eventos de clique
      resultadosDiv.querySelectorAll('[data-cliente-id]').forEach(div => {
        div.addEventListener('click', function() {
          const clienteId = this.dataset.clienteId;
          const cliente = clientesCache.find(c => c.id === clienteId);
          selecionarCliente(cliente);
        });
      });
    }

    resultadosDiv.classList.remove('hidden');
  }

  // ═══════════════════════════════════════════════════════════════
  // SELEÇÃO DE CLIENTE
  // ═══════════════════════════════════════════════════════════════

  function selecionarCliente(cliente) {
    clienteSelecionado = cliente;

    inputBusca.value = `${cliente.nome_completo} - ${cliente.cpf_mascarado || cliente.cpf}`;
    resultadosDiv.innerHTML = '';
    resultadosDiv.classList.add('hidden');

    // Habilita botão "Próximo"
    document.getElementById('btn_proximo_step').disabled = false;

    console.log('✅ [Cliente] Selecionado:', cliente.nome_completo);
  }

  // ═══════════════════════════════════════════════════════════════
  // CADASTRO INLINE DE CLIENTE
  // ═══════════════════════════════════════════════════════════════

  btnNovoCli.addEventListener('click', mostrarFormularioCadastro);
  btnCancelarCadastro.addEventListener('click', esconderFormularioCadastro);

  function mostrarFormularioCadastro() {
    formNovoCli.classList.remove('hidden');
    btnNovoCli.classList.add('hidden');
    document.getElementById('novo_cliente_nome').focus();
  }

  function esconderFormularioCadastro() {
    formNovoCli.classList.add('hidden');
    btnNovoCli.classList.remove('hidden');
    formNovoCli.reset();
  }

  // Submit do formulário de cadastro inline
  document.getElementById('form_novo_cliente_inline').addEventListener('submit', async function(e) {
    e.preventDefault();

    const nome = document.getElementById('novo_cliente_nome').value.trim();
    const cpf = document.getElementById('novo_cliente_cpf').value.replace(/\D/g, '');
    const email = document.getElementById('novo_cliente_email').value.trim();
    const telefone = document.getElementById('novo_cliente_telefone').value.replace(/\D/g, '');

    if (!nome || !cpf || !email) {
      UI.showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    const btnSalvar = document.getElementById('btn_salvar_cliente_inline');
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    try {
      // Cadastra o cliente
      const novoCliente = await API.call('cadastrarCliente', {
        nome_completo: nome,
        cpf: cpf,
        email: email,
        telefone: telefone
      });

      console.log('✅ [Cliente] Cadastrado:', novoCliente);

      // 🔥 ATUALIZAÇÃO AUTOMÁTICA DO CACHE (sem precisar recarregar página)
      clientesCache.push(novoCliente);
      
      // Ordena alfabeticamente
      clientesCache.sort((a, b) => {
        return (a.nome_completo || '').localeCompare(b.nome_completo || '');
      });

      // Atualiza cache persistente
      Cache.set('lista_clientes', clientesCache, 30 * 60 * 1000);

      console.log('🔄 [Cache] Atualizado com novo cliente');

      UI.showToast('Cliente cadastrado com sucesso!', 'success');

      // Seleciona automaticamente o cliente recém-cadastrado
      selecionarCliente(novoCliente);

      // Esconde formulário
      esconderFormularioCadastro();

    } catch (error) {
      console.error('❌ [Cliente] Erro ao cadastrar:', error);
      UI.showToast(error.message || 'Erro ao cadastrar cliente', 'error');

    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar Cliente';
    }
  });

  // Click fora fecha resultados
  document.addEventListener('click', function(e) {
    if (!inputBusca.contains(e.target) && !resultadosDiv.contains(e.target)) {
      resultadosDiv.classList.add('hidden');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WIZARD (CONTROLE DE STEPS)
// ═══════════════════════════════════════════════════════════════════════════

function configurarWizard() {
  const step1 = document.getElementById('step_1');
  const step2 = document.getElementById('step_2');
  const btnProximo = document.getElementById('btn_proximo_step');
  const btnVoltar = document.getElementById('btn_voltar_step');

  btnProximo.addEventListener('click', () => {
    if (!clienteSelecionado) {
      UI.showToast('Selecione um cliente para continuar', 'warning');
      return;
    }

    step1.classList.add('hidden');
    step2.classList.remove('hidden');

    // Preenche info do cliente no step 2
    document.getElementById('cliente_info_nome').textContent = clienteSelecionado.nome_completo;
    document.getElementById('cliente_info_cpf').textContent = clienteSelecionado.cpf_mascarado || clienteSelecionado.cpf;
  });

  btnVoltar.addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMULÁRIO DE PROCESSO (STEP 2)
// ═══════════════════════════════════════════════════════════════════════════

function configurarFormularioProcesso() {
  const form = document.getElementById('form_processo');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!clienteSelecionado) {
      UI.showToast('Cliente não selecionado', 'error');
      return;
    }

    const numero = document.getElementById('numero_processo').value.trim();
    const tipoAcao = document.getElementById('tipo_acao').value;
    const vara = document.getElementById('vara').value.trim();
    const dataEntrada = document.getElementById('data_entrada').value;
    const valorCausa = document.getElementById('valor_causa').value;
    const observacoes = document.getElementById('observacoes').value.trim();

    if (!numero || !tipoAcao || !dataEntrada) {
      UI.showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    const btnSalvar = document.getElementById('btn_criar_processo');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="animate-spin">⏳</span> Criando processo...';

    try {
      const novoProcesso = await API.call('criarProcesso', {
        cliente_id: clienteSelecionado.id,
        cpf: clienteSelecionado.cpf, // CPF limpo para vínculo
        numero_processo: numero,
        tipo_acao: tipoAcao,
        vara: vara,
        data_entrada: dataEntrada,
        valor_causa: valorCausa,
        observacoes: observacoes
      });

      console.log('✅ [Processo] Criado:', novoProcesso);

      UI.showToast('Processo criado com sucesso!', 'success');

      // Invalida cache de processos (para atualizar dashboard e lista)
      Cache.remove('lista_processos');
      Cache.remove('dashboard_stats');

      setTimeout(() => {
        window.location.href = './processos.html';
      }, 1000);

    } catch (error) {
      console.error('❌ [Processo] Erro:', error);
      UI.showToast(error.message || 'Erro ao criar processo', 'error');

      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Criar Processo';
    }
  });
}
