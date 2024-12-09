import { AbortController } from 'abortcontroller-polyfill/dist/cjs-ponyfill';
import { Blob } from 'buffer';
import { ReadableStream } from 'web-streams-polyfill';

export { Blob, ReadableStream };

import '../source/polyfill';
import { Request } from '../source';

export class XMLHttpRequest extends EventTarget {
    readyState = 0;

    onreadystatechange?: () => any;
    onerror?: () => any;

    responseURL: string;
    responseType: XMLHttpRequestResponseType;

    #updateReadyState(state: number) {
        this.readyState = state;
        this.onreadystatechange?.();
    }

    overrideMimeType(type: string) {}

    open(method: Request['method'], URI: string) {
        this.responseURL = URI;

        this.#updateReadyState(1);
    }

    setRequestHeader() {}

    upload = new EventTarget();

    status: number;
    statusText: string;
    responseText: string;
    response: any;

    send(body: Request['body']) {
        setTimeout(() => this.#updateReadyState(2));

        setTimeout(() => this.#updateReadyState(3));

        setTimeout(() => this.#mockResponse(body));
    }

    async #mockResponse(body: Request['body']) {
        if (this.readyState > 3) return;

        this.status = Number(this.responseURL.split('/').slice(-1)[0]);

        switch (this.status) {
            case 200: {
                this.statusText = 'OK';
                this.response = { message: 'Hello, World!' };
                break;
            }
            case 201: {
                this.statusText = 'Created';
                this.response =
                    typeof body === 'string'
                        ? JSON.parse(body)
                        : body instanceof Blob
                          ? await body.text()
                          : body;
                break;
            }
            case 404: {
                this.statusText = 'Not Found';
                this.response = { message: 'Hello, Error!' };
            }
        }

        if (this.responseType === 'json')
            this.responseText = JSON.stringify(this.response);
        else this.response = JSON.stringify(this.response);

        this.#updateReadyState(4);
    }

    abort() {
        this.status = 0;
        this.#updateReadyState(4);
    }

    getResponseHeader(name: string) {
        return 'application/json';
    }

    getAllResponseHeaders() {
        return 'content-type: application/json';
    }
}

global.AbortController = AbortController;
// @ts-ignore
global.ReadableStream = ReadableStream;
// @ts-ignore
// https://github.com/jsdom/jsdom/issues/2555#issuecomment-1864762292
global.Blob = Blob;
// @ts-ignore
global.XMLHttpRequest = XMLHttpRequest;
