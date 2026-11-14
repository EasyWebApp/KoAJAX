import { JSDOM } from 'jsdom';

const { window } = new JSDOM('', { url: 'http://localhost/' });

Object.assign(globalThis, {
    DOMParser: window.DOMParser,
    Document: window.Document,
    Blob: window.Blob,
    FileReader: window.FileReader,
    FormData: window.FormData,
    HTMLFormElement: window.HTMLFormElement,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    SVGElement: window.SVGElement,
    XMLHttpRequest: window.XMLHttpRequest,
    XMLSerializer: window.XMLSerializer,
    document: window.document,
    window
});
