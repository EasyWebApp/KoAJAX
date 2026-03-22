import './XMLHttpRequest';

import {
    encodeBase64,
    makeFormData,
    parseHeaders,
    readAs,
    readBytes,
    serializeNode,
    takeBytes
} from '../source';

describe('HTTP utility', () => {
    describe('Parse Headers', () => {
        it('should parse Link header to Object', () => {
            const meta = parseHeaders(
                'link:' +
                    [
                        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next"',
                        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"'
                    ]
            );
            expect(meta).toEqual({
                Link: {
                    next: {
                        rel: 'next',
                        URI: 'https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2'
                    },
                    last: {
                        rel: 'last',
                        URI: 'https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34'
                    }
                }
            });
        });
    });

    describe('Form Data', () => {
        it('should make a Form Data instance from a Plain Object', () => {
            const formData = makeFormData({
                a: 1,
                b: [2, 3, null, undefined],
                c: new Blob()
            });
            const entries = [...formData];

            expect(entries.filter(([key]) => key === 'a')).toEqual([
                ['a', '1']
            ]);
            expect(entries.filter(([key]) => key === 'b')).toEqual([
                ['b', '2'],
                ['b', '3']
            ]);
            expect(entries.find(([key]) => key === 'c')?.[1]).toBeInstanceOf(
                Blob
            );
        });
    });

    describe('Serialize DOM nodes', () => {
        it('should serialize Input fields to String', () => {
            document.body.innerHTML = `
            <form>
                <input type="checkbox" name="test" value="1" checked>
                <input type="checkbox" name="test" value="2">
                <input type="checkbox" name="test" value="3" checked>

                <input type="number" name="example" value="4">

                <textarea value="5"></textarea>

                <input type="file">
            </form>`;

            const [form] = document.forms;

            const result1 = serializeNode(form);

            expect(result1.data + '').toBe('test=1%2C3&example=4');
            expect(result1.contentType).toBe(
                'application/x-www-form-urlencoded'
            );
            form.enctype = 'text/plain';

            const result2 = serializeNode(form);

            expect(result2.data + '').toBe('test=1,3\nexample=4');
            expect(result2.contentType).toBe('text/plain');
        });
    });

    describe('Blob', () => {
        const text = '😂';
        const blob = new Blob([text], { type: 'text/plain' });

        it('should read a Blob as a Text', async () => {
            const text = await readAs(blob, 'text').result;

            expect(text).toBe('😂');
        });

        it('should encode an Unicode string or blob to a Base64 string', async () => {
            expect(await encodeBase64(text)).toBe('8J+Ygg==');
            expect(await encodeBase64(blob)).toBe('8J+Ygg==');
        });
    });

    describe('ReadableStream helpers', () => {
        it('should yield all chunks when stream is smaller than limit', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const chunks = await Array.fromAsync(
                takeBytes(new Blob([data]).stream(), 100)
            );

            expect(
                new Uint8Array(await new Blob(chunks).arrayBuffer())
            ).toEqual(data);
        });

        it('should stop after limit bytes are read', async () => {
            // Single chunk of exactly limit bytes should be yielded; the next chunk should not
            const a = new Uint8Array(4100).fill(1);
            const b = new Uint8Array(100).fill(2);
            const chunks = await Array.fromAsync(
                takeBytes(new Blob([a, b]).stream(), 4100)
            );
            const totalBytes = chunks.reduce((s, c) => s + c.byteLength, 0);

            // Exactly 4100 bytes should be read — no more
            expect(totalBytes).toBe(4100);
        });

        it('readBytes should read exactly the limit bytes', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const buffer = await readBytes(new Blob([data, data]).stream(), 4);

            expect(buffer.byteLength).toBe(4);
        });

        it('readBytes should collect all bytes when no limit is given', async () => {
            const data = new Uint8Array(10).fill(7);
            const buffer = await readBytes(new Blob([data]).stream());

            expect(new Uint8Array(buffer)).toEqual(data);
        });
    });
});
