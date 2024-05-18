import { Observable } from 'iterable-observer';
import { likeArray, isTypedArray, stringifyDOM, formToJSON } from 'web-utility';

/**
 * @see {@link https://github.com/mo/abortcontroller-polyfill/issues/70}
 */
AbortSignal.prototype.throwIfAborted ||= function (this: AbortSignal) {
    const { aborted, reason = 'Aborted' } = this;

    if (!aborted) return;

    throw reason instanceof DOMException
        ? reason
        : new DOMException(
              reason instanceof Error ? reason.message : reason + '',
              'AbortError'
          );
};

/**
 * @see {@link https://github.com/mo/abortcontroller-polyfill/issues/73#issuecomment-2085543258}
 */
AbortSignal.any ||= (iterable: Iterable<AbortSignal>) => {
    const controller = new AbortController();

    function abort(this: AbortSignal) {
        controller.abort(this.reason);
        clean();
    }
    function clean() {
        for (const signal of iterable)
            signal.removeEventListener('abort', abort);
    }
    for (const signal of iterable)
        if (signal.aborted) {
            controller.abort(signal.reason);
            break;
        } else signal.addEventListener('abort', abort);

    return controller.signal;
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

export function serializeNode(root: Node) {
    var contentType: string;

    if (!(root instanceof HTMLFormElement))
        return {
            contentType:
                root instanceof SVGElement
                    ? 'image/svg'
                    : root instanceof HTMLDocument ||
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
            return {
                contentType,
                data: new URLSearchParams(data) + ''
            };
        default:
            return {
                contentType: 'application/json',
                data: JSON.stringify(data)
            };
    }
}

export function serialize<T>(data: T, contentType?: string) {
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

enum FileMethod {
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

    return {
        progress: Observable.fromEvent<ProgressEvent>(reader, 'progress'),
        result: new Promise<string | ArrayBuffer>((resolve, reject) => {
            reader.onerror = reject;
            reader.onload = () => resolve(reader.result);

            reader[FileMethod[method]](file, encoding);
        })
    };
}
