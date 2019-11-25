import 'ts-polyfill/lib/es2019-object';
import { Observable } from 'iterable-observer';

import { request } from '../source';
import { XMLHttpRequest } from './XMLHttpRequest';
// @ts-ignore
global.XMLHttpRequest = XMLHttpRequest;

describe('HTTP Request', () => {
    it('should return a Promise & 2 Observable', async () => {
        const { upload, download, response } = request({ path: 'test' });

        expect(upload).toBeInstanceOf(Observable);
        expect(download).toBeInstanceOf(Observable);

        expect(await response).toEqual(
            expect.objectContaining({
                status: 200,
                statusText: 'OK',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: { message: 'Hello, World!' }
            })
        );
    });
});
