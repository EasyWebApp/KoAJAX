const { push } = Array.prototype;

export type Middleware<C = any> = (
    context: C,
    next: () => Promise<any>
) => Promise<any> | any;

export class Stack<C = any> {
    length = 0;

    use(...middlewares: Middleware<C>[]) {
        push.apply(this, middlewares);

        return this;
    }

    execute(context?: C, depth = 0): ReturnType<Middleware<C>> {
        const middleware = Reflect.get(this, depth) as
            Middleware<C> | undefined;

        if (middleware instanceof Function)
            return middleware(
                context as C,
                this.execute.bind(this, context, ++depth)
            );
    }

    mount(condition: (context: C) => boolean, stack: Stack<C>) {
        return this.use((context, next) =>
            condition(context) ? stack.execute(context) : next()
        );
    }
}
