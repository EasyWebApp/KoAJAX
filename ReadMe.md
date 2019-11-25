# KoAJAX

**HTTP Client** based on [Koa-like middlewares][1]

[![NPM Dependency](https://david-dm.org/EasyWebApp/KoAJAX.svg)][2]
[![Build Status](https://travis-ci.com/EasyWebApp/KoAJAX.svg?branch=master)][3]
[![](https://data.jsdelivr.com/v1/package/npm/koajax/badge?style=rounded)][4]

[![NPM](https://nodei.co/npm/koajax.png?downloads=true&downloadRank=true&stars=true)][5]

## Usage

```javascript
import { HTTPClient } from 'koajax';

var token = '';

export const client = new HTTPClient().use(
    async ({ request: { method, path, headers }, response }, next) => {
        if (token) headers.Authorization = 'token ' + token;

        await next();

        if (method === 'POST' && new URL(path).pathname.startsWith('/session'))
            token = response.headers.Token;
    }
);

client.get('/path/to/your/API');
```

[1]: https://github.com/koajs/koa#middleware
[2]: https://david-dm.org/EasyWebApp/KoAJAX
[3]: https://travis-ci.com/EasyWebApp/KoAJAX
[4]: https://www.jsdelivr.com/package/npm/koajax
[5]: https://nodei.co/npm/koajax/
