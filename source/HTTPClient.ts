export class HTTPClient {
    async request(url: string, init: RequestInit = {}): Promise<Response> {
        const method = (init.method || 'GET').toUpperCase();

        if (method !== 'HEAD') {
            return fetch(url, init);
        }

        try {
            // 1. Try HEAD first
            const response = await fetch(url, { ...init, method: 'HEAD' });
            if (response.ok) return response;
        } catch (e) {}

        // 2. Try GET with Range
        try {
            const response = await fetch(url, {
                ...init,
                method: 'GET',
                headers: { ...init.headers, Range: 'bytes=0-1024' }
            });
            if (response.status === 206 || response.status === 200) {
                // Create a proxy response that stops the stream after reading headers
                const body = response.body;
                if (body) {
                    const reader = body.getReader();
                    await reader.cancel();
                }
                return new Response(null, {
                    status: 200,
                    headers: response.headers
                });
            }
        } catch (e) {}

        // 3. Fallback: GET and close immediately
        const response = await fetch(url, { ...init, method: 'GET' });
        const body = response.body;
        if (body) {
            const reader = body.getReader();
            await reader.cancel();
        }
        return new Response(null, {
            status: 200,
            headers: response.headers
        });
    }
}
