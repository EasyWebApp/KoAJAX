import { Blob } from 'buffer';

import { HTTPClient, ProgressData, request, requestFetch } from '../source';
import { XMLHttpRequest } from './XMLHttpRequest';
// @ts-ignore
// https://github.com/jsdom/jsdom/issues/2555#issuecomment-1864762292
global.Blob = Blob;
// @ts-ignore
global.XMLHttpRequest = XMLHttpRequest;

describe('HTTP Request', () => {
    it('should return a Promise & 2 Observable with fetch()', async () => {
        const { download, response } = requestFetch<{ login: string }>({
            path: 'https://api.github.com/users/TechQuery',
            responseType: 'json'
        });
        expect(Symbol.asyncIterator in download).toBeTruthy();

        var progress: ProgressData = { loaded: 0, total: 0 };

        for await (const part of download) progress = part;

        expect(progress.loaded).toBeGreaterThanOrEqual(progress.total);

        const { body } = await response;

        expect(body).toMatchObject({ login: 'TechQuery' });
    });

    it('should return a Promise & 2 Observable', async () => {
        const { upload, download, response } = request({
            path: '/200',
            responseType: 'json'
        });

        expect(Symbol.asyncIterator in upload!).toBeTruthy();
        expect(Symbol.asyncIterator in download).toBeTruthy();

        expect(await response).toEqual({
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
            body: { message: 'Hello, World!' }
        });
    });
});

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
            expect(error).toBeInstanceOf(DOMException);
        }
    });
});
