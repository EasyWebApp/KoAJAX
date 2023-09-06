import 'core-js/es/object/from-entries';
import 'core-js/es/string/match-all';

import { makeFormData, parseHeaders, serializeNode } from '../source';

describe('HTTP utility', () => {
    describe('Parse Headers', () => {
        it('should parse Link header to Object', () => {
            expect(
                parseHeaders(
                    'link:' +
                        [
                            '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next"',
                            '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"'
                        ]
                )
            ).toEqual(
                expect.objectContaining({
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
                })
            );
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

            const form = document.forms[0];

            expect(serializeNode(form)).toEqual(
                expect.objectContaining({
                    data: 'test=1%2C3&example=4',
                    contentType: 'application/x-www-form-urlencoded'
                })
            );

            form.enctype = 'text/plain';

            expect(serializeNode(form)).toEqual(
                expect.objectContaining({
                    data: 'test=1,3\nexample=4',
                    contentType: 'text/plain'
                })
            );
        });
    });
});
