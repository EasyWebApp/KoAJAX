import type { ReadableStream } from 'web-streams-polyfill';
import { parseJSON } from 'web-utility';

import {
    emitStreamProgress,
    parseDocument,
    ProgressData,
    ProgressEventTarget,
    streamFromProgress
} from './utility';

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

export interface Request<T = any> extends RequestOptions {
    method?: 'HEAD' | 'GET' | keyof typeof BodyRequestMethods;
    path: string | URL;
    headers?: HeadersInit;
    body?: BodyInit | HTMLFormElement | T;
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
    { URI: string; rel: string; title?: string }
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
    const request = new XMLHttpRequest();
    const header = new Headers(headers);
    const bodyPromise =
        body instanceof globalThis.ReadableStream
            ? Array.fromAsync(body as ReadableStream).then(
                  parts => new Blob(parts)
              )
            : Promise.resolve(body);
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

        const [MIMEType] = header.get('Accept')?.split(',') || [
            rest.responseType === 'document'
                ? 'application/xhtml+xml'
                : rest.responseType === 'json'
                  ? 'application/json'
                  : ''
        ];
        if (MIMEType) request.overrideMimeType(MIMEType);

        request.open(method, path + '');

        for (const [key, value] of header) request.setRequestHeader(key, value);

        Object.assign(request, rest);

        bodyPromise.then(body => request.send(body));
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
    const isStream = body instanceof globalThis.ReadableStream;
    var upload: AsyncGenerator<ProgressData> | undefined;

    if (isStream) {
        const uploadProgress = new EventTarget();

        body = globalThis.ReadableStream['from'](
            emitStreamProgress(
                body as ReadableStream<Uint8Array>,
                +headers['Content-Length'],
                uploadProgress
            )
        ) as ReadableStream<Uint8Array>;

        upload = streamFromProgress(uploadProgress);
    }
    const downloadProgress = new EventTarget();

    const response = fetch(path + '', {
        method,
        headers,
        credentials: withCredentials ? 'include' : 'omit',
        body,
        signal: signals[0] && AbortSignal.any(signals),
        // @ts-expect-error https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests
        duplex: isStream ? 'half' : undefined
    }).then(response =>
        parseResponse<B>(response, responseType, downloadProgress)
    );
    return { response, upload, download: streamFromProgress(downloadProgress) };
}

export async function parseResponse<B>(
    { status, statusText, headers, body }: globalThis.Response,
    responseType: Request['responseType'],
    downloadProgress: ProgressEventTarget
): Promise<Response<B>> {
    const stream = globalThis.ReadableStream['from'](
        emitStreamProgress(
            body as ReadableStream<Uint8Array>,
            +headers.get('Content-Length'),
            downloadProgress
        )
    ) as ReadableStream<Uint8Array>;

    const contentType = headers.get('Content-Type') || '';

    const header = parseHeaders(
        [...headers].map(([key, value]) => `${key}: ${value}`).join('\n')
    );
    const rBody =
        status === 204
            ? undefined
            : await parseFetchBody<B>(stream, contentType, responseType);

    return { status, statusText, headers: header, body: rBody };
}

export async function parseFetchBody<B>(
    stream: ReadableStream<Uint8Array>,
    contentType: string,
    responseType: Request['responseType']
) {
    const blob = new Blob(await Array.fromAsync(stream), { type: contentType });

    if (responseType === 'blob') return blob as B;

    if (responseType === 'arraybuffer') return blob.arrayBuffer() as B;

    const text = await blob.text();

    if (responseType === 'text') return text as B;

    return parseBody<B>(text, contentType);
}

const rawRequest =
    typeof globalThis.XMLHttpRequest === 'function' ? requestXHR : requestFetch;

/**
 * Minimum byte count for magic-number–based file type detection,
 * consistent with the file-type library
 * {@link https://github.com/sindresorhus/file-type}.
 */
export const FILE_TYPE_MAGIC_NUMBER_SIZE = 4100;

export interface HeadResponse {
    headers: Response['headers'];
    /** First {@link FILE_TYPE_MAGIC_NUMBER_SIZE} bytes from the response body. */
    body?: ArrayBuffer;
}

async function* takeBytes(
    stream: AsyncIterable<Uint8Array>,
    limit: number
): AsyncGenerator<ArrayBuffer> {
    let total = 0;

    for await (const chunk of stream) {
        yield new Uint8Array(chunk).buffer;
        total += chunk.byteLength;
        if (total >= limit) break;
    }
}

/**
 * Sends a `HEAD` request, falling back to simulation when the server does
 * not support `HEAD`. Tries, in order:
 * 1. A standard `HEAD` request via `fetch()`.
 * 2. A `Range` GET to retrieve the first {@link FILE_TYPE_MAGIC_NUMBER_SIZE}
 *    bytes (magic-number file header).
 * 3. A plain `GET` that reads the first {@link FILE_TYPE_MAGIC_NUMBER_SIZE}
 *    bytes then cancels the body stream.
 */
export async function requestHead({
    path,
    headers,
    withCredentials,
    timeout,
    signal
}: Request): Promise<HeadResponse> {
    const normalizedHeaders: Record<string, string> = !headers
        ? {}
        : headers instanceof Headers
          ? Object.fromEntries(headers)
          : Array.isArray(headers)
            ? Object.fromEntries(headers)
            : (headers as Record<string, string>);

    const signals = [signal, timeout && AbortSignal.timeout(timeout)].filter(
        Boolean
    ) as AbortSignal[];
    const fetchOptions: globalThis.RequestInit = {
        credentials: withCredentials ? 'include' : 'omit',
        signal: signals[1] ? AbortSignal.any(signals) : signals[0]
    };

    const toHeaders = (raw: globalThis.Headers) =>
        parseHeaders([...raw].map(([k, v]) => `${k}: ${v}`).join('\n'));

    // Tier 1: fetch() HEAD
    try {
        const response = await fetch(path + '', {
            method: 'HEAD',
            ...fetchOptions,
            headers: normalizedHeaders
        });
        if (response.ok) return { headers: toHeaders(response.headers) };
    } catch {
        // HEAD not supported; fall through to simulation tiers
    }

    // Tier 2: Range GET – read magic-number bytes only
    try {
        const response = await fetch(path + '', {
            ...fetchOptions,
            headers: {
                ...normalizedHeaders,
                Range: `bytes=0-${FILE_TYPE_MAGIC_NUMBER_SIZE - 1}`
            }
        });
        if (!response.ok)
            throw new Error(`${response.status} ${response.statusText}`);

        const body = await response.arrayBuffer();
        return { headers: toHeaders(response.headers), body };
    } catch {
        // Server does not support Range requests; fall back to plain GET
    }

    // Tier 3: plain GET – read magic-number bytes then cancel the body stream
    const rawResponse = await fetch(path + '', {
        ...fetchOptions,
        headers: normalizedHeaders
    });
    const chunks = rawResponse.body
        ? await Array.fromAsync(
              takeBytes(
                  rawResponse.body as unknown as AsyncIterable<Uint8Array>,
                  FILE_TYPE_MAGIC_NUMBER_SIZE
              )
          )
        : [];
    const body = await new Blob(chunks).arrayBuffer();

    return { headers: toHeaders(rawResponse.headers), body };
}

/**
 * Sends a {@link Request}, with automatic HEAD-simulation fallback for
 * servers that do not support the `HEAD` method.
 */
export function request<B>(req: Request): RequestResult<B> {
    if (req.method === 'HEAD') {
        const response = requestHead(req).then(
            ({ headers, body }) =>
                ({
                    status: 200,
                    statusText: 'OK',
                    headers,
                    body: body as unknown as B
                }) satisfies Response<B>
        );
        return {
            response,
            download: (async function* (): AsyncGenerator<ProgressData> {})()
        };
    }
    return rawRequest<B>(req);
}
