import { Observable } from 'iterable-observer';
import { sleep } from 'web-utility';

import { parseDocument } from './utility';

export enum BodyRequestMethods {
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH',
    DELETE = 'DELETE'
}

export interface RequestOptions {
    withCredentials?: boolean;
    timeout?: number;
    responseType?: XMLHttpRequestResponseType;
}

export interface Request extends RequestOptions {
    method?: 'HEAD' | 'GET' | keyof typeof BodyRequestMethods;
    path: string | URL;
    headers?: HeadersInit;
    body?: BodyInit | HTMLFormElement | any;
}

export interface Response<B = Request['body']> {
    status: number;
    statusText: string;
    headers: Record<string, string | object>;
    body?: B;
}

export class HTTPError<B = Request['body']> extends URIError {
    status: number;
    statusText: string;
    headers: Response<B>['headers'];
    body?: B;

    constructor(message: string, response: Response) {
        super(message);

        Object.assign(this, response);
    }
}

export type LinkHeader = Record<
    string,
    {
        URI: string;
        rel: string;
        title?: string;
    }
>;

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

export interface RequestResult<B> {
    response: Promise<Response<B>>;
    upload?: Observable<ProgressEvent>;
    download?: Observable<ProgressEvent>;
}

export function requestXHR<B>({
    method = 'GET',
    path,
    headers = {},
    body,
    ...rest
}: Request): RequestResult<B> {
    const request = new XMLHttpRequest(),
        header_list =
            headers instanceof Array
                ? headers
                : headers?.[Symbol.iterator] instanceof Function
                ? [...(headers as Iterable<string[]>)]
                : Object.entries(headers);

    return {
        response: new Promise((resolve, reject) => {
            request.onload = () =>
                resolve({
                    status: request.status,
                    statusText: request.statusText,
                    headers: parseHeaders(request.getAllResponseHeaders()),
                    body: request.response
                });
            request.onerror = request.ontimeout = reject;

            request.open(method, path + '');

            for (const [key, value] of header_list)
                request.setRequestHeader(key, value);

            Object.assign(request, rest);

            request.send(body);
        }),
        upload: Observable.fromEvent<ProgressEvent>(request.upload, 'progress'),
        download: Observable.fromEvent<ProgressEvent>(request, 'progress')
    };
}

export async function requestFetch<B>({
    path,
    method,
    headers,
    withCredentials,
    body,
    timeout,
    responseType
}: Request): Promise<Response<B>> {
    const controller = timeout ? new AbortController() : undefined;
    const timer =
        timeout &&
        sleep(timeout / 1000).then(() => {
            controller.abort();

            throw new RangeError('Timed out');
        });
    const fetchResult = fetch(path + '', {
        method,
        headers,
        credentials: withCredentials ? 'include' : 'omit',
        body,
        signal: controller?.signal
    });
    const response = await (timer
        ? Promise.race([timer, fetchResult])
        : fetchResult);

    const header = parseHeaders(
        [...response.headers]
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')
    );
    if (response.status !== 204)
        var data = await (responseType === 'text'
            ? response.text()
            : responseType === 'document'
            ? parseDocument(response)
            : responseType === 'json'
            ? response.json()
            : responseType === 'arraybuffer'
            ? response.arrayBuffer()
            : response.blob());

    return {
        status: response.status,
        statusText: response.statusText,
        headers: header,
        body: data
    };
}

export function request<B>(options: Request): RequestResult<B> {
    return typeof globalThis.XMLHttpRequest === 'function'
        ? requestXHR<B>(options)
        : { response: requestFetch<B>(options) };
}
