# KoAJAX

**HTTP Client** based on [Koa-like middlewares][1]

[![NPM Dependency](https://img.shields.io/librariesio/github/EasyWebApp/KoAJAX.svg)][2]
[![CI & CD](https://github.com/EasyWebApp/KoAJAX/actions/workflows/main.yml/badge.svg)][3]
[![](https://data.jsdelivr.com/v1/package/npm/koajax/badge?style=rounded)][4]

[![NPM](https://nodei.co/npm/koajax.png?downloads=true&downloadRank=true&stars=true)][5]

## Feature

### Request Body

Automatic Serialized types:

1. Pure text: `string`
2. Form encoding: `URLSearchParams`, `FormData`
3. DOM object: `Node`
4. JSON object: `Object`
5. Binary data: `Blob`, `ArrayBuffer`, TypedArray, `DataView`
6. Stream object: `ReadableStream`

### Response Body

Automatic Parsed type:

1. HTML/XML: `Document`
2. JSON: `Object`
3. Binary data: `ArrayBuffer`

## Usage

### Browser

#### Installation

```powershell
npm install koajax
```

#### `index.html`

```html
<head>
    <script src="https://polyfill.web-cell.dev/feature/Regenerator.js"></script>
    <script src="https://polyfill.web-cell.dev/feature/ECMAScript.js"></script>
    <script src="https://polyfill.web-cell.dev/feature/TextEncoder.js"></script>
    <script src="https://polyfill.web-cell.dev/feature/AbortController.js"></script>
    <script src="https://polyfill.web-cell.dev/feature/Stream.js"></script>
</head>
```

### Node.js

#### Installation

```powershell
npm install koajax core-js jsdom
```

#### `index.ts`

```javascript
import { polyfill } from 'koajax/source/polyfill';

import { HTTPClient } from 'koajax';

const origin = 'https://your-target-origin.com';

polyfill(origin).then(() => {
    const client = new HTTPClient({
        baseURI: `${origin}/api`,
        responseType: 'json'
    });
    const { body } = await client.get('test/interface');

    console.log(body);
});
```

#### Execution

```powershell
npx tsx index.ts
```

### Non-polyfillable runtimes

1. https://github.com/idea2app/KoAJAX-Taro-adapter

## Example

### RESTful API with Token-based Authorization

```javascript
import { HTTPClient } from 'koajax';

var token = '';

export const client = new HTTPClient().use(
    async ({ request: { method, path, headers }, response }, next) => {
        if (token) headers['Authorization'] = 'token ' + token;

        await next();

        if (method === 'POST' && path.startsWith('/session'))
            token = response.headers.Token;
    }
);

client.get('/path/to/your/API').then(console.log);
```

### Up/Download files

#### Single HTTP request based on XMLHTTPRequest `progress` events

(based on [Async Generator][6])

```javascript
import { request } from 'koajax';

document.querySelector('input[type="file"]').onchange = async ({
    target: { files }
}) => {
    for (const file of files) {
        const { upload, download, response } = request({
            method: 'POST',
            path: '/files',
            body: file,
            responseType: 'json'
        });

        for await (const { loaded } of upload)
            console.log(`Upload ${file.name} : ${(loaded / file.size) * 100}%`);

        const { body } = await response;

        console.log(`Upload ${file.name} : ${body.url}`);
    }
};
```

#### Single HTTP request based on Fetch `duplex` streams

> This experimental feature has [some limitations][7].

```diff
-import { request } from 'koajax';
+import { requestFetch } from 'koajax';

document.querySelector('input[type="file"]').onchange = async ({
    target: { files }
}) => {
    for (const file of files) {
-        const { upload, download, response } = request({
+        const { upload, download, response } = requestFetch({
            method: 'POST',
            path: '/files',
+            headers: {
+                'Content-Type': file.type,
+                'Content-Length': file.size + ''
+            },
-            body: file,
+            body: file.stream(),
            responseType: 'json'
        });

        for await (const { loaded } of upload)
            console.log(`Upload ${file.name} : ${(loaded / file.size) * 100}%`);

        const { body } = await response;

        console.log(`Upload ${file.name} : ${body.url}`);
    }
};
```

#### Multiple HTTP requests based on `Range` header

```powershell
npm i native-file-system-adapter  # Web standard API polyfill
```

```javascript
import { showSaveFilePicker } from 'native-file-system-adapter';
import { HTTPClient } from 'koajax';

const bufferClient = new HTTPClient({ responseType: 'arraybuffer' });

document.querySelector('#download').onclick = async () => {
    const fileURL = 'https://your.server/with/Range/header/supported/file.zip';
    const suggestedName = new URL(fileURL).pathname.split('/').pop();

    const fileHandle = await showSaveFilePicker({ suggestedName });
    const writer = await fileHandle.createWritable(),
        stream = bufferClient.download(fileURL);

    try {
        for await (const { total, loaded, percent, buffer } of stream) {
            await writer.write(buffer);

            console.table({ total, loaded, percent });
        }
        window.alert(`File ${fileHandle.name} downloaded successfully!`);
    } finally {
        await writer.close();
    }
};
```

### Global Error fallback

```powershell
npm install browser-unhandled-rejection  # Web standard API polyfill
```

```javascript
import { auto } from 'browser-unhandled-rejection';
import { HTTPError } from 'koajax';

auto();

window.addEventListener('unhandledrejection', ({ reason }) => {
    if (!(reason instanceof HTTPError)) return;

    const { message } = reason.response.body;

    if (message) window.alert(message);
});
```

### Read Files

(based on [Async Generator][6])

```javascript
import { readAs } from 'koajax';

document.querySelector('input[type="file"]').onchange = async ({
    target: { files }
}) => {
    for (const file of files) {
        const { progress, result } = readAs(file, 'dataURL');

        for await (const { loaded } of progress)
            console.log(
                `Loading ${file.name} : ${(loaded / file.size) * 100}%`
            );

        const URI = await result;

        console.log(`Loaded ${file.name} : ${URI}`);
    }
};
```

[1]: https://github.com/koajs/koa#middleware
[2]: https://libraries.io/npm/koajax
[3]: https://github.com/EasyWebApp/KoAJAX/actions/workflows/main.yml
[4]: https://www.jsdelivr.com/package/npm/koajax
[5]: https://nodei.co/npm/koajax/
[6]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of#Iterating_over_async_generators
[7]: https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests#restrictions
