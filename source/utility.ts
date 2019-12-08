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
