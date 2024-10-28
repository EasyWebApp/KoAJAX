import 'core-js/es/object/from-entries';
import 'core-js/es/promise/with-resolvers';
import 'core-js/es/string/match-all';
import type { ReadableStream } from 'web-streams-polyfill';
import { parseJSON } from 'web-utility';

import { parseDocument, ProgressData, streamFromProgress } from './utility';

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
    if (contentType.includes('json')) return parseJSON(raw);

    if (contentType.match(/html|xml/))
        try {
            return parseDocument(raw, contentType) as T;
        } catch {}

    if (contentType.includes('text')) return raw as T;

    return new TextEncoder().encode(raw).buffer as T;
}

export interface RequestResult<B> {
    response: Promise<Response<B>>;
    upload?: AsyncGenerator<ProgressData>;
    download: AsyncGenerator<ProgressData>;
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
            const { readyState, status, statusText, responseType } = request;

            if (readyState !== 4 || (!status && !signal?.aborted)) return;

            resolve({
                status,
                statusText,
                headers: parseHeaders(request.getAllResponseHeaders()),
                body:
                    responseType && responseType !== 'text'
                        ? request.response
                        : request.responseText
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
        upload: streamFromProgress(request.upload),
        download: streamFromProgress(request)
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

    return {
        response: parseResponse(responsePromise, responseType),
        download: iterateFetchBody(responsePromise)
    };
}

export async function parseResponse<B>(
    responsePromise: Promise<globalThis.Response>,
    responseType: Request['responseType']
): Promise<Response<B>> {
    const { status, statusText, headers, body } = (
        await responsePromise
    ).clone();

    const contentType = headers.get('Content-Type') || '';

    const header = parseHeaders(
        [...headers].map(([key, value]) => `${key}: ${value}`).join('\n')
    );
    const rBody =
        status === 204
            ? undefined
            : await parseFetchBody<B>(
                  body as ReadableStream<Uint8Array>,
                  contentType,
                  responseType
              );
    return { status, statusText, headers: header, body: rBody };
}

export async function parseFetchBody<B>(
    stream: ReadableStream<Uint8Array>,
    contentType: string,
    responseType: Request['responseType']
) {
    const chunks: Uint8Array[] = [];

    for await (const chunk of stream) chunks.push(chunk);

    const blob = new Blob(chunks, { type: contentType });

    if (responseType === 'blob') return blob as B;

    if (responseType === 'arraybuffer') return blob.arrayBuffer() as B;

    const text = await blob.text();

    if (responseType === 'text') return text as B;

    return parseBody<B>(text, contentType);
}

export async function* iterateFetchBody(
    responsePromise: Promise<globalThis.Response>
) {
    const { headers, body } = (await responsePromise).clone();

    const total = +headers.get('Content-Length');
    var loaded = 0;

    for await (const { byteLength } of body as ReadableStream<Uint8Array>) {
        loaded += byteLength;

        yield { total, loaded };
    }
}

export const request =
    typeof globalThis.XMLHttpRequest === 'function' ? requestXHR : requestFetch;
