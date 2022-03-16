# KoAJAX

**HTTP Client** based on [Koa-like middlewares][1]

[![NPM Dependency](https://david-dm.org/EasyWebApp/KoAJAX.svg)][2]
[![CI & CD](https://github.com/EasyWebApp/KoAJAX/actions/workflows/main.yml/badge.svg)][3]
[![](https://data.jsdelivr.com/v1/package/npm/koajax/badge?style=rounded)][4]

[![NPM](https://nodei.co/npm/koajax.png?downloads=true&downloadRank=true&stars=true)][5]

## Usage

```Shell
npm install koajax
```

`index.html`

```HTML
<head>
    <script
        crossorigin
        src="https://polyfill.app/api/polyfill?features=es.string.match-all,es.object.from-entries,regenerator-runtime"
    ></script>
</head>
```

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

### Global Error fallback

```shell
npm install browser-unhandled-rejection
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
[2]: https://david-dm.org/EasyWebApp/KoAJAX
[3]: https://github.com/EasyWebApp/KoAJAX/actions/workflows/main.yml
[4]: https://www.jsdelivr.com/package/npm/koajax
[5]: https://nodei.co/npm/koajax/
[6]: https://web-cell.dev/iterable-observer/
