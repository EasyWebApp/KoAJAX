import './XMLHttpRequest';

import { takeBytes, readBytes, makeStream } from '../source';

describe('ReadableStream helpers', () => {
    it('makeStream should emit concatenated binary chunks in order', async () => {
        const first = new Uint8Array([1, 2]);
        const second = new Uint8Array([3, 4, 5]);
        const buffer = await readBytes(makeStream(first, second));

        expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('makeStream should support mixed BlobPart chunks', async () => {
        const buffer = await readBytes(makeStream('Hi', new Uint8Array([33])));
        const bytes = new Uint8Array(buffer);

        expect(Array.from(bytes)).toEqual([72, 105, 33]);
    });

    it('should yield all chunks when stream is smaller than limit', async () => {
        const data = new Uint8Array([1, 2, 3]);
        const chunks = await Array.fromAsync(takeBytes(makeStream(data), 100));

        expect(new Uint8Array(await new Blob(chunks).arrayBuffer())).toEqual(
            data
        );
    });

    it('should stop after limit bytes are read', async () => {
        // Single chunk of exactly limit bytes should be yielded; the next chunk should not
        const a = new Uint8Array(4100).fill(1);
        const b = new Uint8Array(100).fill(2);
        const chunks = await Array.fromAsync(takeBytes(makeStream(a, b), 4100));
        const totalBytes = chunks.reduce((s, c) => s + c.byteLength, 0);

        // Exactly 4100 bytes should be read — no more
        expect(totalBytes).toBe(4100);
    });

    it('readBytes should read exactly the limit bytes', async () => {
        const data = new Uint8Array([1, 2, 3]);
        const buffer = await readBytes(makeStream(data, data), 4);

        expect(buffer.byteLength).toBe(4);
    });

    it('readBytes should collect all bytes when no limit is given', async () => {
        const data = new Uint8Array(10).fill(7);
        const buffer = await readBytes(makeStream(data));

        expect(new Uint8Array(buffer)).toEqual(data);
    });
});
