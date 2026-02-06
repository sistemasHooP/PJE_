/**
 * ============================================================================
 * ARQUIVO: ClienteService.gs
 * DESCRIÇÃO: Regras de negócio para gestão de clientes.
 * VERSÃO: 1.1 - CPF robusto, OTP e acesso seguro a processos
 * DEPENDÊNCIAS: Database.gs, Utils.gs, Config.gs, Auth.gs, RateLimiter.gs
 * AUTOR: Sistema RPPS Jurídico
 * ============================================================================
 */

var ClienteService = {

  /**
   * Busca cliente por CPF (sempre normalizado).
   * @param {any} cpf
   * @returns {Object|null}
   */
  buscarPorCPF: function(cpf) {
    var cpfNormalizado = Utils.normalizarCPF(cpf);

    if (!cpfNormalizado || cpfNormalizado.length !== 11) {
      return null;
    }

    var resultados = Database.findByCPF(CONFIG.SHEET_NAMES.CLIENTES, 'cpf', cpfNormalizado);
    if (resultados && resultados.length > 0) {
      return resultados[0];
    }

    return null;
  },

  /**
   * Cadastra novo cliente (gestor).
   */
  cadastrar: function(payload) {
    var auth = AuthService.verificarToken(payload);
    if (!auth.valido) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!AuthService.isGestor(auth.user.perfil)) {
      throw new Error('Acesso negado. Apenas advogados podem cadastrar clientes.');
    }

    var nome = String(payload.nome_completo || '').trim();
    var cpfNormalizado = Utils.normalizarCPF(payload.cpf);
    var email = String(payload.email || '').trim().toLowerCase();
    var telefone = String(payload.telefone || '').replace(/\D/g, '');

    if (!nome) {
      throw new Error('Nome do cliente é obrigatório.');
    }

    if (!cpfNormalizado || cpfNormalizado.length !== 11) {
      throw new Error('CPF inválido. Digite um CPF com 11 dígitos.');
    }

    if (!Utils.isValidCPF(cpfNormalizado)) {
      throw new Error('CPF inválido. Verifique os dígitos informados.');
    }

    if (!email) {
      throw new Error('Email do cliente é obrigatório.');
    }

    if (!Utils.isValidEmail(email)) {
      throw new Error('Email inválido. Verifique o formato.');
    }

    var clienteExistente = this.buscarPorCPF(cpfNormalizado);
    if (clienteExistente) {
      throw new Error('Já existe um cliente cadastrado com este CPF: ' + Utils.maskCPF(cpfNormalizado));
    }

    var clientesPorEmail = Database.findBy(CONFIG.SHEET_NAMES.CLIENTES, 'email', email);
    if (clientesPorEmail && clientesPorEmail.length > 0) {
      throw new Error('Já existe um cliente cadastrado com este email.');
    }

    var clienteSalvo = Database.create(CONFIG.SHEET_NAMES.CLIENTES, {
      nome_completo: nome,
      cpf: cpfNormalizado,
      email: email,
      telefone: telefone,
      status: ENUMS.STATUS_CLIENTE.ATIVO,
      codigo_acesso: '',
      codigo_expira: '',
      tentativas: 0,
      ultimo_acesso: '',
      criado_por: auth.user.email
    });

    Utils.logAction(auth.user.email, ENUMS.ACOES_LOG.CRIAR_CLIENTE,
      'Cliente cadastrado: ' + nome + ' (CPF: ' + Utils.maskCPF(cpfNormalizado) + ')');

    return {
      id: clienteSalvo.id,
      nome_completo: clienteSalvo.nome_completo,
      cpf: clienteSalvo.cpf,
      email: clienteSalvo.email,
      telefone: clienteSalvo.telefone,
      status: clienteSalvo.status
    };
  },

  /**
   * Lista clientes para gestores.
   */
  listar: function(payload) {
    var auth = AuthService.verificarToken(payload);
    if (!auth.valido) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!AuthService.isGestor(auth.user.perfil)) {
      throw new Error('Acesso negado.');
    }

    var clientes = Database.read(CONFIG.SHEET_NAMES.CLIENTES);

    return clientes.map(function(c) {
      return {
        id: c.id,
        nome_completo: c.nome_completo,
        cpf: c.cpf,
        cpf_formatado: Utils.formatCPF(c.cpf),
        cpf_mascarado: Utils.maskCPF(c.cpf),
        email: c.email,
        telefone: c.telefone,
        status: c.status,
        created_at: c.created_at
      };
    });
  },

  /**
   * Atualiza cliente (gestor).
   */
  atualizar: function(payload) {
    var auth = AuthService.verificarToken(payload);
    if (!auth.valido) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!AuthService.isGestor(auth.user.perfil)) {
      throw new Error('Acesso negado.');
    }

    if (!payload.id) {
      throw new Error('ID do cliente não informado.');
    }

    var clienteExistente = Database.findById(CONFIG.SHEET_NAMES.CLIENTES, payload.id);
    if (!clienteExistente) {
      throw new Error('Cliente não encontrado.');
    }

    var dadosAtualizar = {};

    if (payload.nome_completo) {
      dadosAtualizar.nome_completo = String(payload.nome_completo).trim();
    }

    if (payload.email) {
      var email = String(payload.email).trim().toLowerCase();
      if (!Utils.isValidEmail(email)) {
        throw new Error('Email inválido.');
      }
      dadosAtualizar.email = email;
    }

    if (payload.telefone !== undefined) {
      dadosAtualizar.telefone = String(payload.telefone || '').replace(/\D/g, '');
    }

    if (payload.status) {
      dadosAtualizar.status = payload.status;
    }

    var clienteAtualizado = Database.update(CONFIG.SHEET_NAMES.CLIENTES, payload.id, dadosAtualizar);

    Utils.logAction(auth.user.email, 'ATUALIZAR_CLIENTE',
      'Cliente atualizado: ' + (clienteExistente.nome_completo || payload.id));

    return clienteAtualizado;
  },

  /**
   * Solicita OTP para cliente via CPF.
   */
  solicitarCodigo: function(payload) {
    if (!payload.cpf) {
      throw new Error('CPF não informado.');
    }

    var cpfNormalizado = Utils.normalizarCPF(payload.cpf);
    if (!cpfNormalizado || cpfNormalizado.length !== 11 || !Utils.isValidCPF(cpfNormalizado)) {
      throw new Error('CPF inválido.');
    }

    // RATE LIMIT OTP DESATIVADO TEMPORARIAMENTE (AMBIENTE DE TESTE)
    // Se quiser reativar depois, restaure RateLimiter.verificarEnvioCodigo(cpfNormalizado).

    var cliente = this.buscarPorCPF(cpfNormalizado);
    if (!cliente) {
      throw new Error('CPF não encontrado no sistema. Entre em contato com o escritório.');
    }

    if (cliente.status !== ENUMS.STATUS_CLIENTE.ATIVO) {
      throw new Error('Acesso bloqueado. Entre em contato com o escritório.');
    }

    var codigo = Utils.gerarCodigoNumerico(6);
    var expiracao = new Date(new Date().getTime() + CONFIG.SECURITY.CODIGO_OTP_EXPIRY);

    Database.update(CONFIG.SHEET_NAMES.CLIENTES, cliente.id, {
      codigo_acesso: codigo,
      codigo_expira: expiracao.toISOString(),
      tentativas: 0
    });

    this._enviarEmailCodigo(cliente.email, cliente.nome_completo, codigo);

    Utils.logAction('SISTEMA', ENUMS.ACOES_LOG.ENVIAR_CODIGO_OTP,
      'Código OTP enviado para CPF: ' + Utils.maskCPF(cpfNormalizado));

    return {
      mensagem: 'Código enviado para seu email.',
      emailMascarado: this._mascararEmail(cliente.email)
    };
  },

  /**
   * Valida OTP e gera token do cliente.
   */
  validarCodigo: function(payload) {
    if (!payload.cpf || !payload.codigo) {
      throw new Error('CPF e código são obrigatórios.');
    }

    var cpfNormalizado = Utils.normalizarCPF(payload.cpf);
    var codigo = String(payload.codigo).trim();

    var cliente = this.buscarPorCPF(cpfNormalizado);
    if (!cliente) {
      throw new Error('Dados inválidos.');
    }

    var tentativas = parseInt(cliente.tentativas, 10) || 0;
    if (tentativas >= 5) {
      Database.update(CONFIG.SHEET_NAMES.CLIENTES, cliente.id, {
        status: ENUMS.STATUS_CLIENTE.BLOQUEADO
      });
      throw new Error('Muitas tentativas incorretas. Acesso bloqueado.');
    }

    if (!cliente.codigo_acesso) {
      throw new Error('Solicite um novo código de acesso.');
    }

    var expiracao = new Date(cliente.codigo_expira);
    if (new Date() > expiracao) {
      throw new Error('Código expirado. Solicite um novo.');
    }

    if (String(cliente.codigo_acesso) !== codigo) {
      Database.update(CONFIG.SHEET_NAMES.CLIENTES, cliente.id, {
        tentativas: tentativas + 1
      });
      throw new Error('Código incorreto. ' + (4 - tentativas) + ' tentativa(s) restante(s).');
    }

    Database.update(CONFIG.SHEET_NAMES.CLIENTES, cliente.id, {
      codigo_acesso: '',
      codigo_expira: '',
      tentativas: 0,
      ultimo_acesso: new Date().toISOString()
    });

    var token = AuthService._gerarTokenJWT({
      id: cliente.id,
      email: cliente.email,
      nome: cliente.nome_completo
    }, ENUMS.PERFIL.CLIENTE);

    Utils.logAction(cliente.email, ENUMS.ACOES_LOG.LOGIN_CLIENTE,
      'Login cliente: ' + cliente.nome_completo);

    return {
      token: token,
      cliente: {
        id: cliente.id,
        nome: cliente.nome_completo,
        email: cliente.email
      }
    };
  },

  /**
   * Lista processos do cliente autenticado.
   */
  getMeusProcessos: function(payload) {
    var auth = AuthService.verificarToken(payload);
    if (!auth.valido) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!AuthService.isCliente(auth.user.perfil)) {
      throw new Error('Acesso negado.');
    }

    var cliente = Database.findById(CONFIG.SHEET_NAMES.CLIENTES, auth.user.id);
    if (!cliente) {
      throw new Error('Cliente não encontrado.');
    }

    var processosPorId = Database.findBy(CONFIG.SHEET_NAMES.PROCESSOS, 'cliente_id', cliente.id);
    var emailCliente = String(cliente.email || '').trim().toLowerCase();

    var todos = processosPorId.slice();
    if (emailCliente) {
      var processos = Database.read(CONFIG.SHEET_NAMES.PROCESSOS);
      var porEmail = processos.filter(function(p) {
        return String(p.email_interessado || '').trim().toLowerCase() === emailCliente;
      });
      todos = todos.concat(porEmail);
    }

    var vistos = {};
    var unicos = [];

    for (var i = 0; i < todos.length; i++) {
      var p = todos[i];
      if (!vistos[p.id]) {
        vistos[p.id] = true;
        unicos.push({
          id: p.id,
          numero_processo: p.numero_processo,
          tipo: p.tipo,
          status: p.status,
          data_entrada: p.data_entrada,
          data_prazo: p.data_prazo,
          parte_nome: p.parte_nome
        });
      }
    }

    unicos.sort(function(a, b) {
      return new Date(b.data_entrada) - new Date(a.data_entrada);
    });

    return unicos;
  },

  /**
   * Detalhe de processo para cliente autenticado.
   */
  getProcessoDetalhe: function(payload) {
    var auth = AuthService.verificarToken(payload);
    if (!auth.valido) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!AuthService.isCliente(auth.user.perfil)) {
      throw new Error('Acesso negado.');
    }

    if (!payload.id_processo) {
      throw new Error('ID do processo não informado.');
    }

    var cliente = Database.findById(CONFIG.SHEET_NAMES.CLIENTES, auth.user.id);
    if (!cliente) {
      throw new Error('Cliente não encontrado.');
    }

    var processo = Database.findById(CONFIG.SHEET_NAMES.PROCESSOS, payload.id_processo);
    if (!processo) {
      throw new Error('Processo não encontrado.');
    }

    var emailCliente = String(cliente.email || '').trim().toLowerCase();
    var emailProcesso = String(processo.email_interessado || '').trim().toLowerCase();

    var temAcesso = (String(processo.cliente_id || '') === String(cliente.id || '')) ||
                    (emailCliente && emailProcesso && emailCliente === emailProcesso);

    if (!temAcesso) {
      Utils.logAction(cliente.email, ENUMS.ACOES_LOG.ACESSO_NEGADO,
        'Tentativa de acesso ao processo: ' + (processo.numero_processo || processo.id));
      throw new Error('Você não tem acesso a este processo.');
    }

    var movimentacoes = Database.findBy(CONFIG.SHEET_NAMES.MOVIMENTACOES, 'id_processo', processo.id);
    movimentacoes.sort(function(a, b) {
      return new Date(b.data_movimentacao) - new Date(a.data_movimentacao);
    });

    var movsLimpas = movimentacoes.map(function(m) {
      return {
        id: m.id,
        tipo: m.tipo,
        descricao: m.descricao,
        data_movimentacao: m.data_movimentacao,
        data_prazo: m.data_prazo,
        anexo_nome: m.anexo_nome,
        anexo_link: m.anexo_link
      };
    });

    return {
      processo: {
        id: processo.id,
        numero_processo: processo.numero_processo,
        tipo: processo.tipo,
        status: processo.status,
        data_entrada: processo.data_entrada,
        data_prazo: processo.data_prazo,
        parte_nome: processo.parte_nome,
        descricao: processo.descricao
      },
      movimentacoes: movsLimpas
    };
  },

  _enviarEmailCodigo: function(email, nome, codigo) {
    var assunto = 'Código de Acesso - Sistema Jurídico';

    var primeiroNome = String(nome || 'Cliente').trim().split(' ')[0] || 'Cliente';

    var htmlBody =
      '<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">' +
      '  <div style="background: #2c3e50; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">' +
      '    <h2 style="color: white; margin: 0;">Sistema Jurídico RPPS</h2>' +
      '  </div>' +
      '  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">' +
      '    <p style="color: #333; font-size: 16px;">Olá, <strong>' + primeiroNome + '</strong>!</p>' +
      '    <p style="color: #666;">Seu código de acesso é:</p>' +
      '    <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">' +
      '      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2c3e50;">' + codigo + '</span>' +
      '    </div>' +
      '    <p style="color: #999; font-size: 14px;">Este código expira em <strong>10 minutos</strong>.</p>' +
      '    <p style="color: #999; font-size: 14px;">Se você não solicitou este código, ignore este email.</p>' +
      '    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">' +
      '    <p style="color: #999; font-size: 12px; text-align: center;">Email automático - Não responda.</p>' +
      '  </div>' +
      '</div>';

    try {
      MailApp.sendEmail({
        to: email,
        subject: assunto,
        htmlBody: htmlBody
      });
    } catch (e) {
      Logger.log('[ClienteService] Erro ao enviar OTP: ' + e.toString());
      throw new Error('Erro ao enviar código. Tente novamente.');
    }
  },

  _mascararEmail: function(email) {
    if (!email || email.indexOf('@') === -1) return '***@***.com';

    var partes = email.split('@');
    var usuario = partes[0];
    var dominio = partes[1];

    if (usuario.length <= 2) {
      return usuario.charAt(0) + '***@' + dominio;
    }

    return usuario.charAt(0) + '***' + usuario.charAt(usuario.length - 1) + '@' + dominio;
  }
};
