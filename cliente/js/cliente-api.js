/**
 * ============================================================================
 * ARQUIVO: cliente/js/cliente-api.js
 * DESCRIÇÃO: Cliente HTTP para comunicação com o Backend (Google Apps Script).
 * VERSÃO: 2.1 - Com suporte a arquivos (Proxy)
 * ============================================================================
 */

const ClienteAPI = {
    
    /**
     * Helper genérico para requisições POST
     */
    request: async (payload) => {
        try {
            // Adiciona timestamp para evitar cache
            payload._t = new Date().getTime();

            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                mode: 'text/plain', // Importante para evitar preflight OPTIONS no GAS
                body: JSON.stringify(payload)
            });

            const text = await response.text();
            
            try {
                const json = JSON.parse(text);
                
                if (json.status === 'error') {
                    throw new Error(json.message || 'Erro no servidor');
                }
                
                return json.data;

            } catch (jsonError) {
                console.error('Erro de Parse JSON:', text);
                throw new Error('Resposta inválida do servidor.');
            }

        } catch (error) {
            console.error('Erro na API:', error);
            throw error;
        }
    },

    /**
     * Solicita código de acesso (Login passo 1)
     */
    solicitarCodigo: async (cpf) => {
        return ClienteAPI.request({
            action: 'solicitarCodigoCliente',
            cpf: cpf
        });
    },

    /**
     * Valida código e retorna token (Login passo 2)
     */
    validarCodigo: async (cpf, codigo) => {
        return ClienteAPI.request({
            action: 'loginCliente',
            cpf: cpf,
            codigo: codigo
        });
    },

    /**
     * Busca os processos do cliente logado
     */
    getMeusProcessos: async (token) => {
        return ClienteAPI.request({
            action: 'getMeusProcessos',
            token: token
        });
    },

    /**
     * Busca detalhes de um processo específico
     */
    getDetalhesProcesso: async (token, idProcesso) => {
        return ClienteAPI.request({
            action: 'getProcessoCliente',
            token: token,
            idProcesso: idProcesso
        });
    },

    /**
     * [NOVO] Lista arquivos de uma pasta do Drive (Proxy)
     */
    listarArquivos: async (pastaId) => {
        return ClienteAPI.request({
            action: 'listarArquivosDaPasta',
            pastaId: pastaId
        });
    },

    /**
     * [NOVO] Baixa o conteúdo do arquivo em Base64 para visualização
     */
    baixarArquivo: async (idArquivo) => {
        return ClienteAPI.request({
            action: 'downloadArquivo',
            idArquivo: idArquivo
        });
    }
};
