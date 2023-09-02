import { EventEmitter } from 'events';
import { Request } from '../source';

export class XMLHttpRequest extends EventEmitter {
    onload?: () => any;
    onerror?: () => any;

    responseURL: string;
    responseType: XMLHttpRequestResponseType;

    open(method: Request['method'], URI: string) {
        this.responseURL = URI;
    }

    setRequestHeader() {}

    upload = new EventEmitter();

    status: number;
    statusText: string;
    responseText: string;
    response: any;

    send(body: Request['body']) {
        setTimeout(() => {
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
                        typeof body === 'string' ? JSON.parse(body) : '';
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

            if (this.onload instanceof Function) this.onload();
        });
    }

    getResponseHeader(name: string) {
        return 'application/json';
    }

    getAllResponseHeaders() {
        return 'content-type: application/json';
    }
}
