import {
    createAsyncIterator,
    likeArray,
    isTypedArray,
    stringifyDOM,
    formToJSON
} from 'web-utility';

globalThis.ProgressEvent ||= class ProgressEvent<
    T extends EventTarget = EventTarget
> extends Event {
    declare target: T | null;

    lengthComputable: boolean;
    total: number;
    loaded: number;

    constructor(
        type: string,
        { lengthComputable, total, loaded, ...meta }: ProgressEventInit = {}
    ) {
        super(type, meta);

        this.lengthComputable = lengthComputable;
        this.total = total;
        this.loaded = loaded;
    }
};

export async function parseDocument(text: string, contentType = '') {
    const [type] = contentType?.split(';') || [];

    return new DOMParser().parseFromString(
        text,
        (type as DOMParserSupportedType) || 'text/html'
    );
}

export function makeFormData(data: Record<string, any>) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
        const list = (
            typeof value !== 'string' && likeArray(value) ? value : [value]
        ) as ArrayLike<string | Blob>;

        for (const item of Array.from(list))
            if (item != null)
                if (typeof item === 'object')
                    formData.append(key, item, (item as File).name);
                else formData.append(key, item);
    }
    return formData;
}

export function serializeNode(root: Node): {
    contentType: string;
    data: string | URLSearchParams | FormData;
} {
    var contentType: string;

    if (!(root instanceof HTMLFormElement))
        return {
            contentType:
                root instanceof SVGElement
                    ? 'image/svg'
                    : root instanceof Document || root instanceof HTMLElement
                      ? 'text/html'
                      : 'application/xml',
            data: stringifyDOM(root)
        };

    if (root.querySelector('input[type="file"][name]'))
        return {
            contentType: 'multipart/form-data',
            data: new FormData(root)
        };
    const data = formToJSON<Record<string, any>>(root);

    switch ((contentType = root.enctype)) {
        case 'text/plain':
            return {
                contentType,
                data: Object.entries(data)
                    .map(([name, value]) => `${name}=${value}`)
                    .join('\n')
            };
        case 'application/x-www-form-urlencoded':
            return { contentType, data: new URLSearchParams(data) };
        default:
            return {
                contentType: 'application/json',
                data: JSON.stringify(data)
            };
    }
}

export function serialize<T>(
    data: T,
    contentType?: string
): {
    data: T | BodyInit;
    contentType?: string;
} {
    const [type] = contentType?.split(';') || [];

    switch (type) {
        case 'application/x-www-form-urlencoded':
            return {
                contentType,
                data: new URLSearchParams(data as Record<string, any>)
            };
        case 'multipart/form-data':
            return { data: makeFormData(data) };
        case 'application/json':
            return { contentType, data: JSON.stringify(data) };
        case 'text/html':
        case 'application/xml':
        case 'image/svg':
            return { contentType, data: stringifyDOM(data as Node) };
    }
    if (type) return { data, contentType };

    try {
        if (data instanceof URLSearchParams)
            return {
                contentType: 'application/x-www-form-urlencoded',
                data
            };
    } catch {}

    try {
        if (data instanceof FormData) return { data };
    } catch {}

    try {
        if (data instanceof Node) return serializeNode(data);
    } catch {}

    try {
        if (
            isTypedArray(data) ||
            data instanceof ArrayBuffer ||
            data instanceof DataView ||
            data instanceof Blob ||
            data instanceof ReadableStream
        )
            return {
                contentType: 'application/octet-stream',
                data
            };
    } catch {}

    try {
        return {
            contentType: 'application/json',
            data: JSON.stringify(data)
        };
    } catch {}

    throw new Error('Unserialized Object needs a specific Content-Type');
}

export type ProgressEventTarget = Pick<
    XMLHttpRequestEventTarget & FileReader,
    'dispatchEvent' | 'addEventListener' | 'removeEventListener'
>;
export type ProgressData = Pick<ProgressEvent, 'total' | 'loaded'>;

export const streamFromProgress = <T extends ProgressEventTarget>(target: T) =>
    createAsyncIterator<ProgressData, ProgressEvent<T>>(
        ({ next, complete, error }) => {
            const handleProgress = ({ loaded, total }: ProgressEvent) => {
                next({ loaded, total });

                if (loaded >= total) complete();
            };
            target.addEventListener('progress', handleProgress);
            target.addEventListener('error', error);

            return () => {
                target.removeEventListener('progress', handleProgress);
                target.removeEventListener('error', error);
            };
        }
    );
export async function* emitStreamProgress(
    stream: import('web-streams-polyfill').ReadableStream<Uint8Array>,
    total: number,
    eventTarget: ProgressEventTarget
): AsyncGenerator<Uint8Array> {
    var loaded = 0;

    for await (const chunk of stream) {
        yield chunk;

        loaded += (chunk as Uint8Array).byteLength;

        const event = new ProgressEvent('progress', {
            lengthComputable: isNaN(total),
            loaded,
            total
        });
        eventTarget.dispatchEvent(event);
    }
}

export enum FileMethod {
    text = 'readAsText',
    dataURL = 'readAsDataURL',
    binaryString = 'readAsBinaryString',
    arrayBuffer = 'readAsArrayBuffer'
}

export function readAs(
    file: Blob,
    method: keyof typeof FileMethod,
    encoding?: string
) {
    const reader = new FileReader();
    const result = new Promise<string | ArrayBuffer>((resolve, reject) => {
        reader.onerror = reject;
        reader.onload = () => resolve(reader.result);

        reader[FileMethod[method]](file, encoding);
    });
    return { progress: streamFromProgress(reader), result };
}

const DataURI = /^data:(.+?\/(.+?))?(;base64)?,([\s\S]+)/;
/**
 * @param  raw - Binary data
 *
 * @return  Base64 encoded data
 */
export async function encodeBase64(raw: string | Blob) {
    if (raw instanceof Blob) {
        const text = await readAs(raw, 'dataURL').result;

        return (DataURI.exec(text as string) || '')[4];
    }
    const text = encodeURIComponent(raw).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(+('0x' + p1))
    );
    return btoa(text);
}
