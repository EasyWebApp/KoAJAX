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
