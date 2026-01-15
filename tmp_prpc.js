export class PrpcError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PrpcError';
    }
}
export class PrpcClient {
    constructor(ip) {
        this.baseUrl = `http://${ip}:6000/rpc`;
    }
    async call(method) {
        const request = {
            jsonrpc: '2.0',
            method,
            id: 1,
        };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        try {
            const { default: fetch } = await import('node-fetch');
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new PrpcError(`HTTP error: ${response.status}`);
            }
            const rpcResponse = await response.json();
            if (rpcResponse.error) {
                throw new PrpcError(rpcResponse.error.message);
            }
            if (!rpcResponse.result) {
                throw new PrpcError('No result in response');
            }
            return rpcResponse.result;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new PrpcError('Request timed out');
            }
            throw error;
        }
    }
    async getPods() {
        return this.call('get-pods');
    }
    async getStats() {
        return this.call('get-stats');
    }
}
//# sourceMappingURL=index.js.map