import 'core-js/es/object/from-entries';
import 'core-js/es/promise/with-resolvers';
import 'core-js/es/string/match-all';
import 'core-js/full/array/from-async';

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
        'EventTarget',
        'AbortSignal',
        'ReadableStream',
        'ArrayBuffer',
        'Blob',
        'XMLHttpRequest',
        'FileReader'
    ])
        globalThis[key] ||= window[key];
}
