import { parseURLData, serializeNode, headerParser } from '../source';

describe('HTTP utility', () => {
    describe('Parse URL data', () => {
        it('should accept ? or # prefix', () => {
            expect(parseURLData('?')).toBeInstanceOf(Object);
            expect(parseURLData('#')).toBeInstanceOf(Object);
        });

        it('should parse Primitive values', () =>
            expect(parseURLData('?a=A&b=2&c=false')).toEqual(
                expect.objectContaining({
                    a: 'A',
                    b: 2,
                    c: false
                })
            ));

        it('should parse Multiple key to Array', () =>
            expect(parseURLData('?a=1&b=2&b=3')).toEqual(
                expect.objectContaining({ a: 1, b: [2, 3] })
            ));
    });

    describe('Parse Headers', () => {
        it('should parse Link header to Object', () => {
            expect(
                headerParser.Link(
                    [
                        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next"',
                        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"'
                    ] + ''
                )
            ).toEqual(
                expect.objectContaining({
                    next: {
                        rel: 'next',
                        URI:
                            'https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2'
                    },
                    last: {
                        rel: 'last',
                        URI:
                            'https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34'
                    }
                })
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

            const form = document.forms[0];

            expect(serializeNode(form)).toEqual(
                expect.objectContaining({
                    data: 'test=1&test=3&example=4',
                    type: 'application/x-www-form-urlencoded'
                })
            );

            form.enctype = 'text/plain';

            expect(serializeNode(form)).toEqual(
                expect.objectContaining({
                    data: 'test=1\ntest=3\nexample=4',
                    type: 'text/plain'
                })
            );
        });
    });
});
