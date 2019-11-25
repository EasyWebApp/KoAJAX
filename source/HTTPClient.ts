import { Stack, Middleware } from './Stack';
import {
    Request,
    Response,
    NonIdempotentMethods,
    request,
    RequestOptions
} from './HTTPRequest';

const { splice } = Array.prototype;

export interface Context {
    request: Request;
    response: Response;
}

interface ClientOptions extends RequestOptions {
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
            data.path = new URL(data.path, baseURI) + '';

            Object.assign(
                response,
                await request({ ...options, ...data }).response
            );
        });
    }

    defaultWare: Middleware<T> = async ({ request, response }, next) => {
        const { method = 'GET', headers, body } = request;

        if (method in NonIdempotentMethods && body) {
            if (body instanceof HTMLFormElement)
                request.body = new FormData(body);
            else if (typeof body === 'object') {
                if (
                    headers &&
                    headers['Content-Type'].startsWith(
                        'application/x-www-form-urlencoded'
                    )
                )
                    request.body = new URLSearchParams(body);
                else {
                    request.headers = request.headers || {};
                    request.headers['Content-Type'] = 'application/json';

                    request.body = JSON.stringify(body);

                    request.responseType = request.responseType || 'json';
                }
            }
        }

        await next();

        if (response.status > 299)
            throw Object.assign(new URIError(response.statusText), response);
    };

    use(...middlewares: Middleware<T>[]) {
        splice.call(this, -2, 0, ...middlewares);

        return this;
    }

    async request<B = any>(data: T['request']): Promise<Response<B>> {
        const context = {
            request: { headers: {}, ...data },
            response: {}
        } as T;

        await this.execute(context);

        return context.response;
    }

    async head(
        path: Request['path'],
        headers?: Request['headers'],
        options?: RequestOptions
    ) {
        const { headers: data } = await this.request({
            method: 'HEAD',
            path,
            headers,
            ...options
        });

        return data;
    }

    get<B = any>(
        path: Request['path'],
        headers?: Request['headers'],
        options?: RequestOptions
    ) {
        return this.request<B>({ path, headers, ...options });
    }

    post<B = any>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers'],
        options?: RequestOptions
    ) {
        return this.request<B>({
            method: 'POST',
            path,
            headers,
            body,
            ...options
        });
    }

    put<B = any>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers'],
        options?: RequestOptions
    ) {
        return this.request<B>({
            method: 'PUT',
            path,
            headers,
            body,
            ...options
        });
    }

    patch<B = any>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers'],
        options?: RequestOptions
    ) {
        return this.request<B>({
            method: 'PATCH',
            path,
            headers,
            body,
            ...options
        });
    }

    async delete(
        path: Request['path'],
        headers?: Request['headers'],
        options?: RequestOptions
    ) {
        const { headers: data } = await this.request({
            method: 'DELETE',
            path,
            headers,
            ...options
        });

        return data;
    }
}
