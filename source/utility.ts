import { request } from './HTTPRequest';
import { Observable } from 'iterable-observer';

export function parseJSON(raw: string) {
    try {
        return JSON.parse(raw, (key, value) =>
            /^\d{4}(-\d{2}){2}T\d{2}(:\d{2}){2}\.\d{3}Z$/.test(value)
                ? new Date(value)
                : value
        );
    } catch {
        return raw;
    }
}

export async function blobOf(URI: string | URL) {
    const { body } = await request<Blob>({ path: URI, responseType: 'blob' })
        .response;

    return body;
}

export type HTMLField = HTMLInputElement &
    HTMLTextAreaElement &
    HTMLSelectElement &
    HTMLFieldSetElement;

export interface FormJSON {
    [key: string]: string | number | (string | boolean)[];
}

export function formToJSON(
    form: HTMLFormElement | HTMLFieldSetElement
): FormJSON {
    const data = {};

    for (const field of form.elements) {
        let {
            tagName,
            type,
            name,
            value: v,
            checked,
            defaultValue,
            selectedOptions
        } = field as HTMLField;

        if (!name) continue;

        tagName = tagName.toLowerCase();

        const box = tagName !== 'fieldset' && field.closest('fieldset');

        if (box && box !== form) continue;

        if (['radio', 'checkbox'].includes(type))
            if (checked) v = defaultValue || 'true';
            else continue;

        let value: any = parseJSON(v);

        switch (tagName) {
            case 'select':
                value = Array.from(selectedOptions, ({ value }) =>
                    parseJSON(value)
                );
                break;
            case 'fieldset':
                value = formToJSON(field as HTMLFieldSetElement);
        }

        if (name in data) data[name] = [].concat(data[name], value);
        else data[name] = value;
    }

    return data;
}

export function serializeNode(root: Node) {
    var data: string | FormData, type: string;

    if (root instanceof HTMLFormElement) {
        data = new FormData(root);

        if (root.querySelector('input[type="file"][name]'))
            type = 'multipart/form-data';
        else {
            const form = [...data];

            switch ((type = root.enctype)) {
                case 'text/plain':
                    data = form
                        .map(([name, value]) => `${name}=${value}`)
                        .join('\n');
                    break;
                case 'application/x-www-form-urlencoded':
                    data = new URLSearchParams(form as string[][]) + '';
            }
        }
    } else if (root instanceof HTMLElement)
        (data = root.outerHTML), (type = 'text/html');
    else {
        data = new XMLSerializer().serializeToString(root);

        type = root instanceof SVGElement ? 'image/svg' : 'application/xml';
    }

    return { data, type };
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
