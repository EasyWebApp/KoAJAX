import { Observable } from 'iterable-observer';

export function isXDomain(URI: string) {
    return new URL(URI, document.baseURI).origin !== self.location.origin;
}

export type JSONValue = number | boolean | string | null;

export interface URLData {
    [key: string]: JSONValue | JSONValue[];
}

export function parseURLData(raw = window.location.search) {
    const data: URLData = {};

    for (let [key, value] of new URLSearchParams(
        /(?:\?|#)?(\S+)/.exec(raw)[1]
    )) {
        try {
            value = JSON.parse(value);
        } catch (error) {
            /**/
        }

        if (!(data[key] != null)) {
            data[key] = value;
            continue;
        }

        if (!(data[key] instanceof Array)) data[key] = [data[key] as JSONValue];

        (data[key] as JSONValue[]).push(value);
    }

    return data;
}

export interface LinkHeader {
    [rel: string]: {
        URI: string;
        rel: string;
        title?: string;
    };
}

export const headerParser = {
    Link(value: string) {
        const link: LinkHeader = {};

        value.replace(
            /<(\S+?)>; rel="(\w+)"(?:; title="(.*?)")?/g,
            (_, URI: string, rel: string, title: string) => {
                link[rel] = { URI, rel };

                if (title != null) link[rel].title = title;
                return '';
            }
        );
        return link;
    }
};

export type HTMLField =
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | HTMLFieldSetElement;

export interface FormJSON {
    [key: string]: string | number | (string | boolean)[];
}

export function formToJSON({
    elements
}: HTMLFormElement | HTMLFieldSetElement): FormJSON {
    const data = Object.getOwnPropertyNames(elements).map(key => {
        if (!isNaN(+key)) return;

        const field: HTMLField = elements[key];

        if (field instanceof HTMLFieldSetElement)
            return [key, formToJSON(field)];

        if (field instanceof RadioNodeList)
            return [
                key,
                Array.from(
                    field,
                    ({ checked, defaultValue }: HTMLInputElement) =>
                        checked ? defaultValue || true : null
                ).filter(Boolean)
            ];

        if (field instanceof HTMLSelectElement)
            return [
                key,
                Array.from(field.selectedOptions, ({ value }) => value)
            ];

        return [key, field.type === 'number' ? +field.value : field.value];
    });

    return Object.fromEntries(data.filter(Boolean));
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
