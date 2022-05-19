import { Observable } from 'iterable-observer';
import { stringifyDOM, formToJSON } from 'web-utility';

export async function parseDocument(response: Response) {
    const text = await response.text(),
        [type] = response.headers.get('Content-Type')?.split(';') || [];

    return new DOMParser().parseFromString(
        text,
        (type as DOMParserSupportedType) || 'text/html'
    );
}

export function makeFormData(data: Record<string, any>) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(data))
        formData.append(key, value);

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

export function serialize(data: any, contentType?: string) {
    const [type] = contentType?.split(';') || [];

    switch (type) {
        case 'application/x-www-form-urlencoded':
            return {
                contentType,
                data: new URLSearchParams(data) + ''
            };
        case 'multipart/form-data':
            return { contentType, data: makeFormData(data) };
        case 'application/json':
            return { contentType, data: JSON.stringify(data) };
        case 'text/html':
        case 'application/xml':
        case 'image/svg':
            return { contentType, data: stringifyDOM(data) };
    }
    if (type) return { data, contentType };

    try {
        return {
            contentType: 'application/json',
            data: JSON.stringify(data)
        };
    } catch {
        try {
            return serializeNode(data);
        } catch {
            throw new Error(
                'Unserialized Object needs a specific Content-Type'
            );
        }
    }
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
