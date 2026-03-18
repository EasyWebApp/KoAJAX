import { Stack, Middleware } from './Stack';
import {
    Request,
    Response,
    RequestOptions,
    request,
    BodyRequestMethods,
    HTTPError
} from './HTTPRequest';
import { ProgressData, serialize } from './utility';

const { splice } = Array.prototype;

export interface Context {
    request: Request;
    response: Response;
}

export interface ClientOptions extends RequestOptions {
    baseURI?: string;
    baseRequest?: typeof request;
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

export interface TransferProgress extends ProgressData {
    percent: number;
    buffer: ArrayBuffer;
}

export class HTTPClient<T extends Context> extends Stack<T> {
    baseURI: string;
    baseRequest: typeof request;
    options: RequestOptions;

    constructor({
        baseURI = globalThis.document?.baseURI,
        baseRequest = request,
        ...options
    }: ClientOptions = {}) {
        super();

        this.baseURI = baseURI;
        this.baseRequest = baseRequest;
        this.options = options;

        super.use(this.defaultWare);

        super.use(async ({ request: data, response }) => {
            data.path = new URL(data.path + '', this.baseURI) + '';

            // Handle HEAD request simulation
            if (data.method === 'HEAD') {
                try {
                    // First try a Range request to get only headers
                    const rangeHeaders = {
                        ...data.headers,
                        'Range': 'bytes=0-0'
                    };
                    
                    const rangeResponse = await this.baseRequest({
                        ...this.options,
                        ...data,
                        method: 'GET',
                        headers: rangeHeaders,
                        signal: data.signal
                    });

                    // Create HEAD-like response by copying headers and removing body
                    Object.assign(response, {
                        status: rangeResponse.status,
                        statusText: rangeResponse.statusText,
                        headers: rangeResponse.headers,
                        body: null
                    });

                    // Close the stream if it exists
                    if (rangeResponse.body && typeof rangeResponse.body.cancel === 'function') {
                        rangeResponse.body.cancel();
                    }
                } catch (error) {
                    // Fallback: Make GET request and immediately terminate
                    const getResponse = await this.baseRequest({
                        ...this.options,
                        ...data,
                        method: 'GET',
                        signal: data.signal
                    });

                    Object.assign(response, {
                        status: getResponse.status,
                        statusText: getResponse.statusText,
                        headers: getResponse.headers,
                        body: null
                    });

                    // Terminate the stream immediately
                    if (getResponse.body && typeof getResponse.body.cancel === 'function') {
                        getResponse.body.cancel();
                    }
                }
            } else {
                Object.assign(
                    response,
                    await this.baseRequest({ ...this.options, ...data })
                );
            }
        });
    }

    defaultWare: Middleware<T> = ({ request, response }, next) => next();

    async get(path: string, options: MethodOptions = {}) {
        return this.execute<T>({
            request: { method: 'GET', path, ...options },
            response: {} as Response
        });
    }

    async delete(path: string, options: MethodOptions = {}) {
        return this.execute<T>({
            request: { method: 'DELETE', path, ...options },
            response: {} as Response
        });
    }

    async head(path: string, options: MethodOptions = {}) {
        return this.execute<T>({
            request: { method: 'HEAD', path, ...options },
            response: {} as Response
        });
    }

    async options(path: string, options: MethodOptions = {}) {
        return this.execute<T>({
            request: { method: 'OPTIONS', path, ...options },
            response: {} as Response
        });
    }

    private bodyRequest<D = any>(
        method: BodyRequestMethods,
        path: string,
        body?: D,
        { headers, ...rest }: MethodOptions = {}
    ) {
        return this.execute<T>({
            request: {
                method,
                path,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: serialize(body),
                ...rest
            },
            response: {} as Response
        });
    }

    async post<D = any>(
        path: string,
        body?: D,
        options: MethodOptions = {}
    ) {
        return this.bodyRequest('POST', path, body, options);
    }

    async put<D = any>(path: string, body?: D, options: MethodOptions = {}) {
        return this.bodyRequest('PUT', path, body, options);
    }

    async patch<D = any>(
        path: string,
        body?: D,
        options: MethodOptions = {}
    ) {
        return this.bodyRequest('PATCH', path, body, options);
    }

    async *download(
        path: string,
        { range, chunkSize = 65536, ...options }: DownloadOptions = {}
    ) {
        const rangeText = range?.join('-');

        const { headers, body } = (await this.get(path, {
            ...options,
            headers: {
                ...options.headers,
                ...(rangeText && { Range: `bytes=${rangeText}` })
            }
        })) as T & { response: Response };

        if (!body) throw new HTTPError('Empty response body');

        const reader = body.getReader(),
            size = +headers['Content-Length'];

        let received = 0;

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const buffer = value.buffer;

            received += buffer.byteLength;

            const total = size || received,
                percent = +((received / total) * 100).toFixed(2);

            yield { total, received, percent, buffer } as TransferProgress;
        }
    }

    async upload<D = any>(
        path: string,
        body?: D,
        options: MethodOptions = {}
    ) {
        return this.post<D>(path, body, options);
    }
}