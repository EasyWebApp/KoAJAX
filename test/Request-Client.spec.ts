import 'core-js/es/object/from-entries';
import 'core-js/es/string/match-all';
import { Observable } from 'iterable-observer';

import { request, HTTPClient } from '../source';
import { XMLHttpRequest } from './XMLHttpRequest';
// @ts-ignore
global.XMLHttpRequest = XMLHttpRequest;

describe('HTTP Request', () => {
    it('should return a Promise & 2 Observable', async () => {
        const { upload, download, response } = request({
            path: '/200',
            responseType: 'json'
        });

        expect(upload).toBeInstanceOf(Observable);
        expect(download).toBeInstanceOf(Observable);

        expect(await response).toEqual(
            expect.objectContaining({
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/json' },
                body: { message: 'Hello, World!' }
            })
        );
    });
});

describe('HTTP Client', () => {
    const client = new HTTPClient({ responseType: 'json' });

    it('should return Data while Status is less then 300', async () => {
        const { headers, body } = await client.get('/200');

        expect(headers).toEqual(
            expect.objectContaining({ 'Content-Type': 'application/json' })
        );
        expect(body).toEqual(
            expect.objectContaining({ message: 'Hello, World!' })
        );
    });

    it('should throw Error while Status is greater then 300', async () => {
        try {
            await client.get('/404');
        } catch (error) {
            expect({ ...error }).toEqual(
                expect.objectContaining({
                    status: 404,
                    statusText: 'Not Found',
                    headers: { 'Content-Type': 'application/json' },
                    body: { message: 'Hello, Error!' }
                })
            );
        }
    });

    it('should serialize JSON automatically', async () => {
        const { body } = await client.post('/201', { test: 'example' });

        expect(body).toEqual(expect.objectContaining({ test: 'example' }));
    });

    it('should invoke Custom Middlewares', async () => {
        const data: any[] = [];

        client.use(async ({ request: { path }, response }, next) => {
            data.push(path);

            await next();

            data.push(response.status);
        });

        await client.get('/200');

        expect(data).toEqual(expect.arrayContaining(['/200', 200]));
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
