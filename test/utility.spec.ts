import 'core-js/es/object/from-entries';
import 'core-js/es/string/match-all';
import { parseJSON, parseHeaders, formToJSON, serializeNode } from '../source';

describe('HTTP utility', () => {
    describe('JSON Parser', () => {
        it('should parse JSON strings within Primitive values', () => {
            expect(parseJSON('1')).toBe(1);
            expect(parseJSON('1x')).toBe('1x');
        });

        it('should parse JSON strings within ISO Date values', () => {
            const { time } = parseJSON('{"time": "2020-01-23T00:00:00.000Z"}');

            expect(time).toBeInstanceOf(Date);
            expect((time as Date).toJSON()).toBe('2020-01-23T00:00:00.000Z');
        });
    });

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
                            URI:
                                'https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2'
                        },
                        last: {
                            rel: 'last',
                            URI:
                                'https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34'
                        }
                    }
                })
            );
        });
    });

    describe('Serialize DOM nodes', () => {
        it('should convert a Form to JSON', () => {
            document.body.innerHTML = `
            <form>
                <input type="checkbox" name="switch" checked>

                <input type="checkbox" name="list" value="1" checked>
                <input type="checkbox" name="list" value="2">
                <input type="checkbox" name="list" value="3" checked>

                <select name="array" multiple>
                    <option>1</option>
                    <option selected>2</option>
                    <option selected>3</option>
                </select>

                <fieldset name="test">
                    <input type="text" name="example" value="sample" />
                </fieldset>
            </form>`;

            const data = formToJSON(document.forms[0]);

            expect(data).toEqual(
                expect.objectContaining({
                    switch: true,
                    list: [1, 3],
                    array: [2, 3],
                    test: { example: 'sample' }
                })
            );
        });

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
