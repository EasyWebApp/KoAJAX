import {
    encodeBase64,
    makeFormData,
    parseHeaders,
    readAs,
    serializeNode
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

            expect(serializeNode(form)).toEqual({
                data: 'test=1%2C3&example=4',
                contentType: 'application/x-www-form-urlencoded'
            });
            form.enctype = 'text/plain';

            expect(serializeNode(form)).toEqual({
                data: 'test=1,3\nexample=4',
                contentType: 'text/plain'
            });
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
});
