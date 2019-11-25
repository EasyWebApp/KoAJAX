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

    execute(context?: C, depth = 0) {
        const middleware: Middleware<C> | undefined = this[depth];

        if (middleware instanceof Function)
            return middleware(
                context,
                this.execute.bind(this, context, ++depth)
            );
    }

    mount(condition: (context: C) => boolean, stack: Stack<C>) {
        return this.use((context, next) =>
            condition(context) ? stack.execute(context) : next()
        );
    }
}
