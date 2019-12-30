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
    headers?: HeadersInit;
    body?: BodyInit | HTMLFormElement | any;
}

export interface Response<B = Request['body']> {
    status: number;
    statusText: string;
    headers: { [key: string]: string | object };
    body?: B;
}

export interface LinkHeader {
    [rel: string]: {
        URI: string;
        rel: string;
        title?: string;
    };
}

export const headerParser = {
    Link(value: string): LinkHeader {
        return Object.fromEntries(
            Array.from(
                value.matchAll(/<(\S+?)>; rel="(\w+)"(?:; title="(.*?)")?/g),
                ([_, URI, rel, title]) => [rel, { rel, URI, title }]
            )
        );
    }
};

export function parseHeaders(raw: string): Response['headers'] {
    return Object.fromEntries(
        Array.from(
            raw.trim().matchAll(/^([\w-]+):\s*(.*)/gm),
            ([_, key, value]) => {
                key = key.replace(/(^[a-z]|-[a-z])/g, char =>
                    char.toUpperCase()
                );

                return [key, headerParser[key]?.(value) ?? value];
            }
        )
    );
}

export function request({
    method = 'GET',
    path,
    headers = {},
    body,
    ...rest
}: Request) {
    const request = new XMLHttpRequest();

    headers =
        headers instanceof Array
            ? headers
            : headers?.[Symbol.iterator] instanceof Function
            ? [...headers]
            : Object.entries(headers);

    return {
        response: new Promise<Response>((resolve, reject) => {
            request.onload = () =>
                resolve({
                    status: request.status,
                    statusText: request.statusText,
                    headers: parseHeaders(request.getAllResponseHeaders()),
                    body: request.response
                });
            request.onerror = request.ontimeout = reject;

            request.open(method, path);

            for (const [key, value] of headers)
                request.setRequestHeader(key, value);

            Object.assign(request, rest);

            request.send(body);
        }),
        upload: Observable.fromEvent<ProgressEvent>(request.upload, 'progress'),
        download: Observable.fromEvent<ProgressEvent>(request, 'progress')
    };
}
