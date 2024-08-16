import { Stack, Middleware } from './Stack';
import {
    Request,
    Response,
    RequestOptions,
    request,
    BodyRequestMethods,
    HTTPError
} from './HTTPRequest';
import { serialize } from './utility';

const { splice } = Array.prototype;

export interface Context {
    request: Request;
    response: Response;
}

export interface ClientOptions extends RequestOptions {
    baseURI?: string;
}

export type MethodOptions = Omit<
    Request,
    'method' | 'path' | 'headers' | 'body'
>;

export interface DownloadOptions
    extends Pick<Request, 'headers' | 'withCredentials' | 'signal'> {
    chunkSize?: number;
    range?: [number?, number?];
}

export interface TransferProgress
    extends Pick<ProgressEvent, 'total' | 'loaded'> {
    percent: number;
    buffer: ArrayBuffer;
}

export class HTTPClient<T extends Context> extends Stack<T> {
    baseURI: string;
    options: RequestOptions;

    constructor({
        baseURI = globalThis.document?.baseURI,
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
        const { method = 'GET', headers = {}, body } = request;

        if (method in BodyRequestMethods && body && typeof body === 'object') {
            const { contentType, data } = serialize(
                body,
                headers['Content-Type']
            );
            if (contentType) headers['Content-Type'] = contentType;
            request.body = data;
        }
        await next();

        if (response.status > 299)
            throw new HTTPError(response.statusText, request, response);
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

    async head(
        path: Request['path'],
        headers?: Request['headers'],
        options?: MethodOptions
    ) {
        const { headers: data } = await this.request({
            method: 'HEAD',
            path,
            headers,
            ...options
        });
        return data;
    }

    get<B>(
        path: Request['path'],
        headers?: Request['headers'],
        options?: MethodOptions
    ) {
        return this.request<B>({ method: 'GET', path, headers, ...options });
    }

    post<B>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers'],
        options?: MethodOptions
    ) {
        return this.request<B>({
            method: 'POST',
            path,
            headers,
            body,
            ...options
        });
    }

    put<B>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers'],
        options?: MethodOptions
    ) {
        return this.request<B>({
            method: 'PUT',
            path,
            headers,
            body,
            ...options
        });
    }

    patch<B>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers'],
        options?: MethodOptions
    ) {
        return this.request<B>({
            method: 'PATCH',
            path,
            headers,
            body,
            ...options
        });
    }

    delete<B>(
        path: Request['path'],
        body?: Request['body'],
        headers?: Request['headers'],
        options?: MethodOptions
    ) {
        return this.request<B>({
            method: 'DELETE',
            path,
            headers,
            body,
            ...options
        });
    }

    async *download(
        path: Request['path'],
        {
            headers,
            chunkSize = 1024 ** 2,
            range: [start = 0, end = Infinity] = [],
            ...options
        }: DownloadOptions = {}
    ): AsyncGenerator<TransferProgress> {
        var total = 0;

        function setEndAsHeader(length: number) {
            total = length;

            if (end === Infinity) end = total;
        }

        try {
            const { 'Content-Length': length } = await this.head(
                path,
                headers,
                options
            );
            setEndAsHeader(+length);
        } catch (error) {
            console.error(error);
        }

        for (
            let i = start, j = i - 1 + chunkSize;
            i < end;
            i = j + 1, j += chunkSize
        ) {
            const {
                status,
                headers: { 'Content-Range': range },
                body
            } = await this.get<ArrayBuffer>(
                path,
                { ...headers, Range: `bytes=${i}-${j}` },
                options
            );
            const totalBytes = +(range as string)?.split('/').pop();

            if (totalBytes) setEndAsHeader(totalBytes);

            if (status !== 206) {
                yield { total, loaded: total, percent: 100, buffer: body };
                break;
            }
            const loaded = i + body.byteLength;

            yield {
                total,
                loaded,
                percent: +((loaded / total) * 100).toFixed(2),
                buffer: body
            };
        }
    }
}
