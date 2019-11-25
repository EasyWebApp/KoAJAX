import { Stack } from '../source';

describe('Stack', () => {
    const stack = new Stack<{ count: number }>(),
        list = [];

    it('should append Middlewares', () => {
        stack.use(
            async (context, next) => {
                list.push(context.count++);

                await next();

                list.push(context.count++);
            },
            context => list.push(context.count++)
        );

        expect(stack.length).toBe(2);
    });

    it('should execute Middlewares in order', async () => {
        await stack.execute({ count: 0 });

        expect(list).toEqual(expect.arrayContaining([0, 1, 2]));
    });

    it('should catch Errors by next()', async () => {
        const stack = new Stack<{ error: Error }>(),
            context = { error: null };

        stack.use(
            async (context, next) => {
                try {
                    await next();
                } catch (error) {
                    context.error = error;
                }
            },
            () => {
                throw Error('test');
            }
        );

        await stack.execute(context);

        expect(context.error).toEqual(Error('test'));
    });

    it('should execute only one Stack Path while Stacks nested', async () => {
        const stack = new Stack<{ deep: boolean }>(),
            list = [];

        stack.use(async (_, next) => {
            list.push(0);

            await next();

            list.push(1);
        });

        stack.mount(
            ({ deep }) => deep,
            new Stack().use(() => list.push(2))
        );

        stack.use(() => list.push(3));

        await stack.execute({ deep: true });

        expect(list).toEqual(expect.arrayContaining([0, 1, 2]));

        list.length = 0;

        await stack.execute({ deep: false });

        expect(list).toEqual(expect.arrayContaining([0, 1, 3]));
    });
});
