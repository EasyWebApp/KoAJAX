import 'web-streams-polyfill/polyfill/es5';
import { Observable } from 'iterable-observer';
import { parseJSON } from 'web-utility';

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
    signal?: AbortSignal;
}

export interface Response<B = Request['body']> {
    status: number;
    statusText: string;
    headers: Record<string, string | object>;
    body?: B;
}

export class HTTPError<B = Request['body']> extends URIError {
    constructor(
        message: string,
        public request: Request,
        public response: Response<B>
    ) {
        super(message);
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
    Link: (value: string): LinkHeader =>
        Object.fromEntries(
            Array.from(
                value.matchAll(/<(\S+?)>; rel="(\w+)"(?:; title="(.*?)")?/g),
                ([_, URI, rel, title]) => [rel, { rel, URI, title }]
            )
        )
};

export const parseHeaders = (raw: string): Response['headers'] =>
    Object.fromEntries(
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
export function parseBody<T>(raw: string, contentType: string): T {
    if (contentType.includes('text')) return raw as T;

    if (contentType.includes('json')) return parseJSON(raw);

    if (contentType.match(/html|xml/))
        try {
            return parseDocument(raw, contentType) as T;
        } catch {}

    return new TextEncoder().encode(raw).buffer as T;
}

export type ProgressData = Pick<ProgressEvent, 'total' | 'loaded'>;

export interface RequestResult<B> {
    response: Promise<Response<B>>;
    upload?: Observable<ProgressData>;
    download: Observable<ProgressData>;
}

export function requestXHR<B>({
    method = 'GET',
    path,
    headers = {},
    body,
    signal,
    ...rest
}: Request): RequestResult<B> {
    const request = new XMLHttpRequest(),
        header_list =
            headers instanceof Array
                ? headers
                : headers?.[Symbol.iterator] instanceof Function
                  ? [...(headers as Iterable<string[]>)]
                  : Object.entries(headers);
    const abort = () => request.abort();

    signal?.addEventListener('abort', abort);

    const response = new Promise<Response<B>>((resolve, reject) => {
        request.onreadystatechange = () => {
            if (request.readyState !== 4) return;

            if (!request.status && !signal?.aborted) return;

            resolve({
                status: request.status,
                statusText: request.statusText,
                headers: parseHeaders(request.getAllResponseHeaders()),
                body: request.response || request.responseText
            });
        };
        request.onerror = request.ontimeout = reject;

        request.open(method, path + '');

        for (const [key, value] of header_list)
            request.setRequestHeader(key, value);

        Object.assign(request, rest);

        request.send(body);
    }).then(({ body, ...meta }) => {
        signal?.throwIfAborted();

        const contentType = request.getResponseHeader('Content-Type') || '';

        if (typeof body === 'string' && !contentType.includes('text'))
            body = parseBody(body, contentType);

        return { ...meta, body };
    });

    response.finally(() => signal?.removeEventListener('abort', abort));

    return {
        response,
        upload: Observable.fromEvent<ProgressEvent>(request.upload, 'progress'),
        download: Observable.fromEvent<ProgressEvent>(request, 'progress')
    };
}

export function requestFetch<B>({
    path,
    method,
    headers,
    withCredentials,
    body,
    signal,
    timeout,
    responseType
}: Request): RequestResult<B> {
    const signals = [signal, timeout && AbortSignal.timeout(timeout)].filter(
        Boolean
    );

    headers =
        headers instanceof Headers
            ? Object.fromEntries(headers.entries())
            : headers instanceof Array
              ? Object.fromEntries(headers)
              : headers;
    headers =
        responseType === 'text'
            ? { ...headers, Accept: 'text/plain' }
            : responseType === 'json'
              ? { ...headers, Accept: 'application/json' }
              : responseType === 'document'
                ? {
                      ...headers,
                      Accept: 'text/html, application/xhtml+xml, application/xml'
                  }
                : responseType === 'arraybuffer' || responseType === 'blob'
                  ? { ...headers, Accept: 'application/octet-stream' }
                  : headers;

    const responsePromise = fetch(path + '', {
        method,
        headers,
        credentials: withCredentials ? 'include' : 'omit',
        body,
        signal: signals[0] && AbortSignal.any(signals)
    });
    const response = responsePromise.then(response =>
        parseFetchBody<B>(response, responseType)
    );
    return {
        response,
        download: Observable.from(iterateFetchBody(responsePromise))
    };
}

export async function parseFetchBody<B>(
    response: globalThis.Response,
    responseType: Request['responseType']
): Promise<Response<B>> {
    const header = parseHeaders(
        [...response.headers]
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')
    );
    if (response.status !== 204)
        try {
            var contentType = response.headers.get('Content-Type') || '',
                backup = response.clone();

            var data: B = await (responseType === 'text'
                ? response.text()
                : responseType === 'document'
                  ? parseDocument(await response.text(), contentType)
                  : responseType === 'json'
                    ? response.json()
                    : responseType === 'arraybuffer'
                      ? response.arrayBuffer()
                      : response.blob());
        } catch {
            const text = await backup.text();

            var data = parseBody<B>(text, contentType);
        }
    return {
        status: response.status,
        statusText: response.statusText,
        headers: header,
        body: data
    };
}

export async function* iterateFetchBody(
    responsePromise: Promise<globalThis.Response>
) {
    const response = await responsePromise;

    for await (const chunk of response.clone().body)
        yield {
            total: +response.headers.get('Content-Length'),
            loaded: (chunk as Uint8Array).byteLength
        };
}

export const request = <B>(options: Request): RequestResult<B> =>
    typeof globalThis.XMLHttpRequest === 'function'
        ? requestXHR<B>(options)
        : requestFetch<B>(options);
