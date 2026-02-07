/**
 * API Client - Portal Jurídico
 * Comunicação com Google Apps Script (Web App)
 * Inclui autenticação JWT e cache inteligente
 */

const API = {

    /**
     * Base URL da API (Google Apps Script Web App)
     * Esta configuração é carregada do config.js
     */
    baseUrl: window.CONFIG ? window.CONFIG.API_URL : '',

    /**
     * Faz uma requisição HTTP para a API
     */
    call: async function(action, data = {}, method = 'POST', isSilent = false) {
        try {
            if (!this.baseUrl) {
                throw new Error('API_URL não configurada. Verifique config.js');
            }

            // Mostra loading (se não for silencioso)
            if (!isSilent) {
                Utils.showLoading(true);
            }

            const token = Auth.getToken();

            const payload = {
                action: action,
                data: data,
                token: token
            };

            const response = await fetch(this.baseUrl, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                if (result.code === 'TOKEN_EXPIRED' || result.code === 'INVALID_TOKEN') {
                    Auth.logout();
                    throw new Error('Sua sessão expirou. Faça login novamente.');
                }
                throw new Error(result.error || 'Erro desconhecido');
            }

            return result.data;

        } catch (error) {
            console.error('Erro na API:', error);
            throw error;
        } finally {
            if (!isSilent) {
                Utils.showLoading(false);
            }
        }
    },

    /**
     * Define o TTL do cache por ação.
     * Ajuste aqui para equilibrar velocidade x atualização de dados.
     * (Em minutos)
     */
    getCacheTTL: function(action) {
        const map = {
            // Clientes mudam pouco, mas a lista é pesada: guardar mais tempo deixa tudo mais rápido
            listarClientes: 60,

            // Processos podem mudar mais: cache menor
            listarProcessos: 10,

            // Dashboard costuma ser consultado o tempo todo
            getDashboard: 5
        };

        return map[action] || 5;
    },

    /**
     * Cache Inteligente (Stale-While-Revalidate).
     * Retorna dados do cache imediatamente e atualiza em background.
     */
    fetchWithCache: async function(action, params, callback, forceSilent = false) {

        // Cache key
        const cacheKey = `${action}_${JSON.stringify(params)}`;

        // 1. Tenta cache
        const cachedData = Utils.Cache.get(cacheKey);
        const hasCache = cachedData !== null;

        if (hasCache) {
            callback(cachedData, 'cache');
        }

        // 2. Busca na rede (background)
        try {
            const networkData = await this.call(action, params, 'POST', hasCache || forceSilent);

            // 3. Salva no cache para a próxima vez (TTL por ação)
            const ttlMinutes = API.getCacheTTL(action);
            Utils.Cache.set(cacheKey, networkData, ttlMinutes);

            // 4. Retorna dados atualizados
            callback(networkData, 'network');

        } catch (err) {
            console.warn('Falha na rede, mantendo cache:', err.message);
            if (!hasCache && !forceSilent) throw err;
        }
    },

    /**
     * Endpoints específicos
     */
    auth: {
        login: async function(email, senha) {
            return await API.call('login', { email, senha }, 'POST', false);
        }
    },

    dashboard: {
        get: async function(onResult, silent) {
            return await API.fetchWithCache('getDashboard', {}, onResult, silent);
        }
    },

    clientes: {
        listar: async function(onResult, silent) {
            return await API.fetchWithCache('listarClientes', {}, onResult, silent);
        },
        cadastrar: async function(data, isSilent = false) {
            return await API.call('cadastrarCliente', data, 'POST', isSilent);
        },
        buscarPorId: async function(id, isSilent = true) {
            return await API.call('buscarClientePorId', { id: id }, 'POST', isSilent);
        }
    },

    processos: {
        listar: async function(filtros, onResult, silent) {
            return await API.fetchWithCache('listarProcessos', filtros || {}, onResult, silent);
        },
        criar: async function(data, isSilent = false) {
            return await API.call('criarProcesso', data, 'POST', isSilent);
        },
        buscarPorId: async function(id, isSilent = false) {
            return await API.call('buscarProcessoPorId', { id: id }, 'POST', isSilent);
        },
        atualizar: async function(data, isSilent = false) {
            return await API.call('atualizarProcesso', data, 'POST', isSilent);
        }
    },

    movimentacoes: {
        listar: async function(processoId, onResult, silent) {
            return await API.fetchWithCache('listarMovimentacoes', { processo_id: processoId }, onResult, silent);
        },
        adicionar: async function(data, isSilent = false) {
            return await API.call('adicionarMovimentacao', data, 'POST', isSilent);
        }
    },

    drive: {
        upload: async function(base64, fileName, folderId, isSilent = false) {
            return await API.call('uploadArquivo', { base64, fileName, folderId }, 'POST', isSilent);
        }
    }
};
