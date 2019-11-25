import { EventEmitter } from 'events';

export class XMLHttpRequest extends EventEmitter {
    onload?: () => any;
    onerror?: () => any;

    open() {}

    setRequestHeader() {}

    upload = new EventEmitter();

    send() {
        setTimeout(() => this.onload instanceof Function && this.onload());
    }

    getAllResponseHeaders() {
        return 'Content-Type: application/json';
    }

    status = 200;
    statusText = 'OK';

    response = {
        message: 'Hello, World!'
    };
}
