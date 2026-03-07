import './XMLHttpRequest';

import { HTTPClient } from '../source';

describe('HTTP Client', () => {
    const client = new HTTPClient({ responseType: 'json' });

    it('should return Data while Status is less then 300', async () => {
        const { headers, body } = await client.get('/200');

        expect(headers).toEqual({ 'Content-Type': 'application/json' });
        expect(body).toEqual({ message: 'Hello, World!' });
    });

    it('should throw Error while Status is greater then 300', async () => {
        try {
            await client.get('/404');
        } catch (error) {
            expect({ ...error }).toEqual({
                request: {
                    method: 'GET',
                    path: 'http://localhost/404',
                    headers: {}
                },
                response: {
                    status: 404,
                    statusText: 'Not Found',
                    headers: { 'Content-Type': 'application/json' },
                    body: { message: 'Hello, Error!' }
                }
            });
        }
    });

    it('should serialize JSON automatically', async () => {
        const { body } = await client.post('/201', { test: 'example' });

        expect(body).toEqual({ test: 'example' });
    });

    it('should invoke Custom Middlewares', async () => {
        const data: any[] = [];

        client.use(async ({ request: { path }, response }, next) => {
            data.push(path);

            await next();

            data.push(response.status);
        });

        await client.get('/200');

        expect(data).toEqual(['/200', 200]);
    });

    describe('HEAD simulation fallback', () => {
        it('should fall back to Range GET when HEAD is not supported', async () => {
            const headers = await client.head('/head-fallback');

            expect(headers).toEqual({ 'Content-Type': 'application/json' });
        });

        it('should fall back to plain GET (fetch) when Range GET is also unsupported', async () => {
            // Use a custom baseRequest so Range header reaches the mock
            // (JSDOM's Headers class silently drops the Range header, so the
            // global XHR mock cannot observe it)
            const fallbackClient = new HTTPClient({
                baseURI: 'http://localhost/',
                baseRequest: ({ method, headers }) => {
                    let status = 200;
                    if (method === 'HEAD') status = 405;
                    else if ('Range' in Object(headers)) status = 416;

                    return {
                        response: Promise.resolve({
                            status,
                            statusText: 'Test',
                            headers: {},
                            body: null
                        }),
                        download: (async function* () {})()
                    };
                }
            });

            const mockHeaders = new Headers({
                'Content-Type': 'application/octet-stream'
            });
            const originalFetch = globalThis.fetch;

            globalThis.fetch = async () =>
                ({ headers: mockHeaders, body: null }) as unknown as Response;

            try {
                const headers = await fallbackClient.head('/no-range-support');

                expect(headers).toEqual({
                    'Content-Type': 'application/octet-stream'
                });
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });

    it('should throw Abort Error as Abort Signal emitted', async () => {
        const controller = new AbortController();

        setTimeout(() => controller.abort());

        try {
            await client.get('/200', {}, { signal: controller.signal });
        } catch (error) {
            expect(error.message).toBe('signal is aborted without reason');
        }
    });
});
