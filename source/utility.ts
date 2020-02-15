import { request } from './HTTPRequest';
import { Observable } from 'iterable-observer';

export function isXDomain(URI: string) {
    return new URL(URI, document.baseURI).origin !== self.location.origin;
}

export type JSONValue = number | boolean | string | null;

export interface URLData {
    [key: string]: JSONValue | JSONValue[];
}

function parse(value: string) {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

export function parseURLData(raw = window.location.search) {
    const data = new URLSearchParams(/(?:\?|#)?(\S+)/.exec(raw)[1]);

    return Object.fromEntries(
        [...data.keys()].map(key => {
            const list = data.getAll(key).map(parse);

            return [key, list.length < 2 ? list[0] : list];
        })
    );
}

export async function blobOf(URI: string | URL) {
    const { body } = await request<Blob>({ path: URI, responseType: 'blob' })
        .response;

    return body;
}

const DataURI = /^data:(.+?\/(.+?))?(;base64)?,([\s\S]+)/;

export function blobFrom(URI: string) {
    var [_, type, __, base64, data] = DataURI.exec(URI) || [];

    data = base64 ? self.atob(data) : data;

    const aBuffer = new ArrayBuffer(data.length);
    const uBuffer = new Uint8Array(aBuffer);

    for (let i = 0; data[i]; i++) uBuffer[i] = data.charCodeAt(i);

    return new Blob([aBuffer], { type });
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

        let value: any = parse(v);

        switch (tagName) {
            case 'select':
                value = Array.from(selectedOptions, ({ value }) =>
                    parse(value)
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
