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

export interface FileHeaderInfo {
    mimeType?: string;
    extension?: string;
    contentLength?: number;
    lastModified?: Date;
    etag?: string;
}

const MAGIC_NUMBERS: Record<string, { mimeType: string; extension: string }> = {
    '89504E47': { mimeType: 'image/png', extension: 'png' },
    'FFD8FF': { mimeType: 'image/jpeg', extension: 'jpg' },
    '47494638': { mimeType: 'image/gif', extension: 'gif' },
    '52494646': { mimeType: 'image/webp', extension: 'webp' },
    '25504446': { mimeType: 'application/pdf', extension: 'pdf' },
    '504B0304': { mimeType: 'application/zip', extension: 'zip' },
    '1F8B08': { mimeType: 'application/gzip', extension: 'gz' },
    'D0CF11E0': { mimeType: 'application/vnd.ms-office', extension: 'doc' }
};

function detectMagicNumber(buffer: ArrayBuffer): { mimeType?: string; extension?: string } {
    const bytes = new Uint8Array(buffer, 0, 8);
    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

    for (const [magic, info] of Object.entries(MAGIC_NUMBERS)) {
        if (hex.startsWith(magic)) {
            return info;
        }
    }
    return {};
}

export async function readFileHeaders(url: string | URL, options: RequestOptions = {}): Promise<FileHeaderInfo> {
    const response = await fetch(url, {
        method: 'HEAD',
        ...options
    });

    if (!response.ok) {
        throw new Error(`Failed to read file headers: ${response.status} ${response.statusText}`);
    }

    const headers = response.headers;
    const contentType = headers.get('content-type');
    const contentLength = headers.get('content-length');
    const lastModified = headers.get('last-modified');
    const etag = headers.get('etag');

    let mimeType = contentType?.split(';')[0];
    let extension: string | undefined;

    // If no content-type or generic type, try to detect via partial content
    if (!mimeType || mimeType === 'application/octet-stream') {
        try {
            const partialResponse = await fetch(url, {
                method: 'GET',
                headers: {
                    'Range': 'bytes=0-7'
                },
                ...options
            });

            if (partialResponse.ok && partialResponse.body) {
                const buffer = await partialResponse.arrayBuffer();
                const detected = detectMagicNumber(buffer);
                mimeType = detected.mimeType || mimeType;
                extension = detected.extension;
            }
        } catch {
            // Fallback to headers only if partial request fails
        }
    }

    return {
        mimeType,
        extension,
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
        lastModified: lastModified ? new Date(lastModified) : undefined,
        etag: etag || undefined
    };
}