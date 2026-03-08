import { Blob, ReadableStream } from './XMLHttpRequest';

import { request, requestFetch, requestHead, requestXHR } from '../source';

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

describe('HEAD simulation fallback', () => {
    it('should return headers when HEAD succeeds', async () => {
        const mockHeaders = { 'Content-Type': 'text/html' };
        const { fetch } = globalThis;

        globalThis.fetch = async () =>
            ({
                ok: true,
                headers: new Headers(mockHeaders)
            }) as unknown as Response;

        try {
            const result = await requestHead({
                method: 'HEAD',
                path: 'http://example.com/'
            });

            expect(result.headers).toEqual(mockHeaders);
            expect(result.body).toBeUndefined();
        } finally {
            globalThis.fetch = fetch;
        }
    });

    it('should fall back to Range GET when HEAD is not supported', async () => {
        const { fetch } = globalThis,
            mockBody = new ArrayBuffer(4100),
            mockHeaders = { 'Content-Type': 'application/octet-stream' };
        let callCount = 0;

        globalThis.fetch = async () => {
            callCount++;

            if (callCount === 1)
                return {
                    ok: false,
                    status: 405,
                    statusText: 'Method Not Allowed',
                    headers: new Headers()
                } as unknown as Response;

            return {
                ok: true,
                headers: new Headers(mockHeaders),
                arrayBuffer: async () => mockBody,
                body: null
            } as unknown as Response;
        };

        try {
            const result = await requestHead({
                method: 'HEAD',
                path: 'http://example.com/file.bin'
            });

            expect(result.headers).toEqual(mockHeaders);
            expect(result.body).toBe(mockBody);
        } finally {
            globalThis.fetch = fetch;
        }
    });

    it('should fall back to plain GET when Range GET is also unsupported', async () => {
        const { fetch } = globalThis,
            mockHeaders = { 'Content-Type': 'application/octet-stream' };
        let callCount = 0;

        globalThis.fetch = async () => {
            callCount++;

            if (callCount === 1) throw new Error('HEAD not supported');

            if (callCount === 2) throw new Error('Range Not Satisfiable');

            return {
                headers: new Headers(mockHeaders),
                body: new (globalThis.ReadableStream as any)({
                    start(ctrl: any) {
                        ctrl.close();
                    }
                })
            } as unknown as Response;
        };

        try {
            const { headers } = await requestHead({
                method: 'HEAD',
                path: 'http://example.com/file.bin'
            });

            expect(headers).toEqual(mockHeaders);
        } finally {
            globalThis.fetch = fetch;
        }
    });

    it('should expose HEAD simulation via request()', async () => {
        const mockHeaders = { 'Content-Type': 'text/plain' };
        const { fetch } = globalThis;

        globalThis.fetch = async () =>
            ({
                ok: true,
                headers: new Headers(mockHeaders)
            }) as unknown as Response;

        try {
            const { response } = request({
                method: 'HEAD',
                path: 'http://example.com/'
            });
            const result = await response;

            expect(result.status).toBe(200);
            expect(result.headers).toEqual(mockHeaders);
        } finally {
            globalThis.fetch = fetch;
        }
    });
});
