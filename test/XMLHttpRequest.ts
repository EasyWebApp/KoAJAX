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
    response: any;

    send(body: Request['body']) {
        setTimeout(() => {
            const status = Number(this.responseURL.split('/').slice(-1)[0]);

            switch (status) {
                case 200: {
                    this.status = status;
                    this.statusText = 'OK';
                    this.response = { message: 'Hello, World!' };
                    break;
                }
                case 201: {
                    this.status = status;
                    this.statusText = 'Created';
                    this.response =
                        this.responseType === 'json' && typeof body === 'string'
                            ? JSON.parse(body)
                            : '';
                    break;
                }
                case 404: {
                    this.status = status;
                    this.statusText = 'Not Found';
                    this.response = { message: 'Hello, Error!' };
                }
            }

            if (this.onload instanceof Function) this.onload();
        });
    }

    getAllResponseHeaders() {
        return 'Content-Type: application/json';
    }
}
