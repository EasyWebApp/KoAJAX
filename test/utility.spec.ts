import 'core-js/es/object/from-entries';
import 'core-js/es/string/match-all';
import { parseHeaders, serializeNode } from '../source';

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
