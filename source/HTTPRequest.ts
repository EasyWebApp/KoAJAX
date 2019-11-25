import { Observable } from 'iterable-observer';

export enum NonIdempotentMethods {
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH'
}

export interface Request {
    method?: 'HEAD' | 'GET' | 'DELETE' | keyof typeof NonIdempotentMethods;
    path: string;
    headers?: { [key: string]: string };
    body?: BodyInit | HTMLFormElement | any;
    responseType?: XMLHttpRequestResponseType;
}

export interface Response {
    status: number;
    statusText: string;
    headers: Request['headers'];
    body: Request['body'];
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
            request.onerror = reject;

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
