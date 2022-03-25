import { Stack, Middleware } from './Stack';
import {
    Request,
    Response,
    RequestOptions,
    request,
    BodyRequestMethods,
    HTTPError
} from './HTTPRequest';
import { serializeNode } from './utility';

const { splice } = Array.prototype;

export interface Context {
    request: Request;
    response: Response;
}

export interface ClientOptions extends RequestOptions {
    baseURI?: string;
}

export class HTTPClient<T extends Context> extends Stack<T> {
    baseURI: string;
    options: RequestOptions;

    constructor({
        baseURI = document.baseURI,
        ...options
    }: ClientOptions = {}) {
        super();

        (this.baseURI = baseURI), (this.options = options);

        super.use(this.defaultWare);

        super.use(async ({ request: data, response }) => {
            data.path = new URL(data.path + '', this.baseURI) + '';

            Object.assign(
                response,
                await request({ ...options, ...data }).response
            );
        });
    }

    defaultWare: Middleware<T> = async ({ request, response }, next) => {
        const { method = 'GET', headers, body } = request;

        if (method in BodyRequestMethods && body) {
            if (body instanceof Node && !(body instanceof Document)) {
                const { type, data } = serializeNode(body);

                (headers['Content-Type'] = type), (request.body = data);
            } else if (typeof body === 'object') {
                if (
                    headers['Content-Type']?.startsWith(
                        'application/x-www-form-urlencoded'
                    )
                )
                    request.body = new URLSearchParams(body);
                else
                    try {
                        headers['Content-Type'] =
                            headers['Content-Type'] || 'application/json';

                        request.body = JSON.stringify(body);

                        request.responseType = request.responseType || 'json';
                    } catch {}
            }
        }
        await next();

        if (response.status > 299)
            throw new HTTPError(response.statusText, response);
    };

    use(...middlewares: Middleware<T>[]) {
        splice.call(this, -2, 0, ...middlewares);

        return this;
    }

    async request<B>(data: T['request']): Promise<Response<B>> {
        const context = {
            request: { ...data, headers: { ...data.headers } },
            response: {}
        } as T;

        await this.execute(context);

        return context.response;
    }

    async head(path: Request['path'], headers?: Request['headers']) {
        const { headers: data } = await this.request({
            method: 'HEAD',
            path,
            headers
        });
        return data;
    }

    get<B>(path: Request['path'], headers?: Request['headers']) {
        return this.request<B>({ path, headers });
    }

    post<B>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers']
    ) {
        return this.request<B>({
            method: 'POST',
            path,
            headers,
            body
        });
    }

    put<B>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers']
    ) {
        return this.request<B>({
            method: 'PUT',
            path,
            headers,
            body
        });
    }

    patch<B>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers']
    ) {
        return this.request<B>({
            method: 'PATCH',
            path,
            headers,
            body
        });
    }

    delete<B>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers']
    ) {
        return this.request<B>({
            method: 'DELETE',
            path,
            headers,
            body
        });
    }
}
