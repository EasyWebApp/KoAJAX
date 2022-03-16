export async function polyfill(origin: string) {
    if (globalThis.XMLHttpRequest) return;

    const { JSDOM } = await import('jsdom');

    const { window } = await JSDOM.fromURL(origin);

    for (const key of [
        'Node',
        'Document',
        'document',
        'HTMLElement',
        'HTMLFormElement',
        'SVGElement',
        'XMLSerializer',
        'FormData',
        'XMLHttpRequest',
        'FileReader'
    ])
        globalThis[key] = window[key];
}
