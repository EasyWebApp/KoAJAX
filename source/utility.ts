import {
    createAsyncIterator,
    likeArray,
    isTypedArray,
    stringifyDOM,
    formToJSON
} from 'web-utility';

export type ProgressEventTarget = Pick<
    XMLHttpRequestEventTarget & FileReader,
    'dispatchEvent' | 'addEventListener' | 'removeEventListener'
>;
export type ProgressData = Pick<ProgressEvent, 'total' | 'loaded'>;

export enum FileMethod {
    text = 'readAsText',
    dataURL = 'readAsDataURL',
    binaryString = 'readAsBinaryString',
    arrayBuffer = 'readAsArrayBuffer'
}

const DataURI = /^data:(.+?\/(.+?))?(;base64)?,([\s\S]+)/;

export class HTTPUtility {
    constructor(
        public runtime: {
            Blob: typeof globalThis.Blob;
            DOMParser: typeof globalThis.DOMParser;
            FormData: typeof globalThis.FormData;
            FileReader: typeof globalThis.FileReader;
            URLSearchParams: typeof globalThis.URLSearchParams;
            ReadableStream: typeof globalThis.ReadableStream;
            ProgressEvent: typeof globalThis.ProgressEvent;
        } = {
            get Blob() {
                return globalThis.Blob;
            },
            get DOMParser() {
                return globalThis.DOMParser;
            },
            get FormData() {
                return globalThis.FormData;
            },
            get FileReader() {
                return globalThis.FileReader;
            },
            get URLSearchParams() {
                return globalThis.URLSearchParams;
            },
            get ReadableStream() {
                return globalThis.ReadableStream;
            },
            get ProgressEvent() {
                return (globalThis.ProgressEvent ||= class ProgressEvent<
                    T extends EventTarget = EventTarget
                > extends Event {
                    declare target: T | null;

                    lengthComputable: boolean;
                    total: number;
                    loaded: number;

                    constructor(
                        type: string,
                        {
                            lengthComputable,
                            total,
                            loaded,
                            ...meta
                        }: ProgressEventInit = {}
                    ) {
                        super(type, meta);

                        this.lengthComputable = lengthComputable;
                        this.total = total;
                        this.loaded = loaded;
                    }
                });
            }
        }
    ) {}

    polyfillProgressEvent = () => this.runtime.ProgressEvent;

    parseDocument = async (text: string, contentType = '') => {
        const [type] = contentType?.split(';') || [];

        return new this.runtime.DOMParser().parseFromString(
            text,
            (type as DOMParserSupportedType) || 'text/html'
        );
    };

    makeFormData = (data: Record<string, any>) => {
        const { FormData } = this.runtime;
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
    };

    serializeNode = (
        root: Node
    ): {
        contentType: string;
        data: string | URLSearchParams | FormData;
    } => {
        const { FormData, URLSearchParams } = this.runtime;
        let contentType: string;

        if (!(root instanceof HTMLFormElement))
            return {
                contentType:
                    root instanceof SVGElement
                        ? 'image/svg'
                        : root instanceof Document ||
                            root instanceof HTMLElement
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
    };

    serialize = <T>(
        data: T,
        contentType?: string
    ): {
        data: T | BodyInit;
        contentType?: string;
    } => {
        const { URLSearchParams, FormData, Blob, ReadableStream } =
            this.runtime;
        const [type] = contentType?.split(';') || [];

        switch (type) {
            case 'application/x-www-form-urlencoded':
                return {
                    contentType,
                    data: new URLSearchParams(data as Record<string, any>)
                };
            case 'multipart/form-data':
                return { data: this.makeFormData(data) };
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
            if (data instanceof Node) return this.serializeNode(data);
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
    };

    takeBytes = (
        stream: AsyncIterable<Uint8Array>,
        limit = Infinity
    ): AsyncGenerator<Uint8Array<ArrayBuffer>> => {
        return (async function* () {
            let total = 0;

            for await (const chunk of stream) {
                const remaining = limit - total;

                if (chunk.byteLength > remaining) {
                    yield chunk.slice(0, remaining);
                    break;
                }
                yield new Uint8Array(chunk);

                total += chunk.byteLength;

                if (total >= limit) break;
            }
        })();
    };

    readBytes = async (stream: AsyncIterable<Uint8Array>, limit = Infinity) => {
        const { Blob } = this.runtime;
        const chunks = await Array.fromAsync(this.takeBytes(stream, limit));

        return new Blob(chunks as BlobPart[]).arrayBuffer();
    };

    makeStream = (...chunks: BlobPart[]) => {
        const { Blob } = this.runtime;

        return new Blob(
            chunks as ArrayBuffer[]
        ).stream() as import('web-streams-polyfill').ReadableStream<Uint8Array>;
    };

    streamFromProgress = <T extends ProgressEventTarget>(target: T) =>
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

    emitStreamProgress = (
        stream: import('web-streams-polyfill').ReadableStream<Uint8Array>,
        total: number,
        eventTarget: ProgressEventTarget
    ): AsyncGenerator<Uint8Array> => {
        const self = this;

        return (async function* () {
            let loaded = 0;

            for await (const chunk of stream) {
                yield chunk;

                loaded += (chunk as Uint8Array).byteLength;

                const event = new self.runtime.ProgressEvent('progress', {
                    lengthComputable: isNaN(total),
                    loaded,
                    total
                });
                eventTarget.dispatchEvent(event);
            }
        })();
    };

    readAs = (
        file: Blob,
        method: keyof typeof FileMethod,
        encoding?: string
    ) => {
        const { FileReader } = this.runtime;
        const reader = new FileReader();
        const result = new Promise<string | ArrayBuffer>((resolve, reject) => {
            reader.onerror = reject;
            reader.onload = () => resolve(reader.result);

            reader[FileMethod[method]](file, encoding);
        });
        return { progress: this.streamFromProgress(reader), result };
    };

    /**
     * @param  raw - Binary data
     *
     * @return  Base64 encoded data
     */
    encodeBase64 = async (raw: string | Blob) => {
        if (raw instanceof Blob) {
            const text = await this.readAs(raw, 'dataURL').result;

            return (DataURI.exec(text as string) || '')[4];
        }
        const text = encodeURIComponent(raw).replace(
            /%([0-9A-F]{2})/g,
            (_, p1) => String.fromCharCode(+('0x' + p1))
        );
        return btoa(text);
    };
}

const _defaultUtility = new HTTPUtility();

export const polyfillProgressEvent = _defaultUtility.polyfillProgressEvent;
export const parseDocument = _defaultUtility.parseDocument;
export const makeFormData = _defaultUtility.makeFormData;
export const serializeNode = _defaultUtility.serializeNode;
export const serialize = _defaultUtility.serialize;
export const takeBytes = _defaultUtility.takeBytes;
export const readBytes = _defaultUtility.readBytes;
export const makeStream = _defaultUtility.makeStream;
export const streamFromProgress = _defaultUtility.streamFromProgress;
export const emitStreamProgress = _defaultUtility.emitStreamProgress;
export const readAs = _defaultUtility.readAs;
export const encodeBase64 = _defaultUtility.encodeBase64;
