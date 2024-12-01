import { Blob, ReadableStream } from './XMLHttpRequest';

import { requestFetch, requestXHR } from '../source';

describe('HTTP Request', () => {
    it('should return a Promise & an Observable with fetch()', async () => {
        const { download, response } = requestFetch<{ id: number }>({
            path: 'https://jsonplaceholder.typicode.com/posts/1',
            responseType: 'json'
        });
        expect(Symbol.asyncIterator in download).toBeTruthy();

        const { loaded, total } = (await Array.fromAsync(download)).at(-1);

        expect(loaded).toBeGreaterThanOrEqual(total);

        const { body } = await response;

        expect(body).toMatchObject({ id: 1 });
    });

    it('should return a Promise & 2 Observable with fetch() & Readable Stream', async () => {
        const blob = new Blob([JSON.stringify({ title: 'KoAJAX' })], {
            type: 'application/json'
        });
        const { upload, download, response } = requestFetch<{ title: string }>({
            method: 'POST',
            path: 'https://jsonplaceholder.typicode.com/posts',
            headers: {
                'Content-Type': blob.type,
                'Content-Length': blob.size + ''
            },
            body: ReadableStream.from(blob.stream()),
            responseType: 'json'
        });
        expect(Symbol.asyncIterator in upload!).toBeTruthy();
        expect(Symbol.asyncIterator in download).toBeTruthy();

        const { loaded, total } = (await Array.fromAsync(upload!)).at(-1);

        expect(loaded).toBeGreaterThanOrEqual(total);

        const { body } = await response;

        expect(body).toMatchObject({ title: 'KoAJAX' });
    });

    it('should return a Promise & 2 Observable with XHR', async () => {
        const { upload, download, response } = requestXHR({
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

    it('should send a Readable Stream with XHR', async () => {
        const blob = new Blob([JSON.stringify({ name: 'KoAJAX' })], {
            type: 'application/json'
        });
        const { response } = requestXHR({
            method: 'POST',
            path: '/201',
            body: ReadableStream.from(blob.stream()),
            responseType: 'json'
        });
        expect(await response).toEqual({
            status: 201,
            statusText: 'Created',
            headers: { 'Content-Type': 'application/json' },
            body: { name: 'KoAJAX' }
        });
    });
});
