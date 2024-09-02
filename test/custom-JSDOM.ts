import JSDOMEnvironment from 'jest-environment-jsdom';

export default class extends JSDOMEnvironment {
    constructor(config, context) {
        super(config, context);

        this.global.fetch = fetch;
    }
}
