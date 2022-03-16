import { JSDOM } from 'jsdom';

const { window } = new JSDOM();

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
    global[key] = window[key];
