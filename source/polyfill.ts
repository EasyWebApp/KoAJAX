export async function polyfill(origin = 'http://127.0.0.1') {
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
        'DOMParser',
        'XMLSerializer',
        'FormData',
        'TextEncoder',
        'XMLHttpRequest',
        'AbortSignal',
        'FileReader'
    ])
        globalThis[key] ||= window[key];
}
