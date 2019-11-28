import { Observable } from 'iterable-observer';

export enum NonIdempotentMethods {
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH'
}

export interface RequestOptions {
    withCredentials?: boolean;
    timeout?: number;
    responseType?: XMLHttpRequestResponseType;
}

export interface Request extends RequestOptions {
    method?: 'HEAD' | 'GET' | 'DELETE' | keyof typeof NonIdempotentMethods;
    path: string;
    headers?: { [key: string]: string };
    body?: BodyInit | HTMLFormElement | any;
}

export interface Response<B = Request['body']> {
    status: number;
    statusText: string;
    headers?: Request['headers'];
    body?: B;
}

export function request({
    method = 'GET',
    path,
    headers,
    body,
    ...rest
}: Request) {
    const request = new XMLHttpRequest();

    return {
        response: new Promise<Response>((resolve, reject) => {
            request.onload = () =>
                resolve({
                    status: request.status,
                    statusText: request.statusText,
                    headers: Object.fromEntries(
                        request
                            .getAllResponseHeaders()
                            .trim()
                            .split(/[\r\n]+/)
                            .map(item => item.split(/:\s*/))
                    ),
                    body: request.response
                });
            request.onerror = request.ontimeout = reject;

            request.open(method, path);

            for (const key in headers)
                request.setRequestHeader(key, headers[key]);

            Object.assign(request, rest);

            request.send(body);
        }),
        upload: Observable.fromEvent<ProgressEvent>(request.upload, 'progress'),
        download: Observable.fromEvent<ProgressEvent>(request, 'progress')
    };
}

export function serializeNode(root: Node) {
    var data: any, type: string;

    if (root instanceof HTMLFormElement) data = new FormData(root);
    else if (root instanceof HTMLElement)
        (data = root.outerHTML), (type = 'text/html');
    else {
        data = new XMLSerializer().serializeToString(root);

        type = root instanceof SVGElement ? 'image/svg' : 'application/xml';
    }

    return { data, type };
}
