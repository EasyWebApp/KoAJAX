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

```Shell
npm install koajax
```

`index.html`

```html
<head>
    <script src="https://polyfill.web-cell.dev/feature/Regenerator.js"></script>
    <script src="https://polyfill.web-cell.dev/feature/ECMAScript.js"></script>
    <script src="https://polyfill.web-cell.dev/feature/TextEncoder.js"></script>
</head>
```

### Node.js

```shell
npm install koajax jsdom
```

`index.js`

```javascript
import { HTTPClient } from 'koajax';
import { polyfill } from 'koajax/source/polyfill'

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

(based on [Iterable Observer][6])

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

#### Multiple HTTP requests based on `Range` header

```shell
npm i native-file-system-adapter  # Web standard API polyfill
```

```javascript
import { showSaveFilePicker } from 'native-file-system-adapter';
import { HTTPClient } from 'koajax';

const bufferClient = new HTTPClient({ responseType: 'arraybuffer' });

document.querySelector('#download').onclick = async () => {
    const fileURL = 'https://your.server/with/Range/header/supported/file.zip';
    const suggestedName = fileURL.split('/').at(-1);

    const fileHandle = await showSaveFilePicker({ suggestedName });
    const writer = await fileHandle.createWritable(),
        stream = bufferClient.download();

    for await (const { total, loaded, percent, buffer } of stream) {
        writer.write(buffer);

        console.table({ total, loaded, percent });
    }
    write.close();
    window.alert(`File ${fileHandle.name} downloaded successfully!`);
};
```

### Global Error fallback

```shell
npm install browser-unhandled-rejection  # Web standard API polyfill
```

```javascript
import { auto } from 'browser-unhandled-rejection';
import { HTTPError } from 'koajax';

auto();

self.addEventListener('unhandledrejection', event => {
    if (!(event.reason instanceof URIError)) return;

    const { message } = (event.reason as HTTPError).body;

    if (!message) return;

    event.preventDefault();

    self.alert(message);
});
```

### Read Files

(based on [Iterable Observer][6])

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
[6]: https://web-cell.dev/iterable-observer/
