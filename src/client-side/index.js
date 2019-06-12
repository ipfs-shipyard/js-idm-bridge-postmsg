import signal from 'pico-signals';
import { call } from '../utils/rpc';
import { openPrompt, closePrompt } from './prompt';
import { createIframe } from './iframe';

class ClientSide {
    #app;
    #walletUrl;
    #messagePort;
    #onSessionChange = signal();

    constructor(app, walletUrl, messagePort) {
        this.#app = app;
        this.#walletUrl = walletUrl;
        this.#messagePort = messagePort;
    }

    async isSessionValid(sessionId) {
        return call(this.#messagePort, 'isSessionValid', sessionId);
    }

    async authenticate() {
        try {
            return await openPrompt(
                this.#walletUrl,
                (messagePort) => call(messagePort, 'authenticate', this.#app)
            );
        } finally {
            closePrompt();
        }
    }

    async unauthenticate(sessionId) {
        await call(this.#messagePort, 'unauthenticate', sessionId);
    }

    async sign(sessionId, data, options) {
        options = {
            signWith: 'session',
            ...options,
        };

        if (options.signWith === 'session') {
            return call(this.#messagePort, 'sign', sessionId, data, options);
        }

        try {
            return await openPrompt(
                this.#walletUrl,
                (messagePort) => call(messagePort, 'sign', sessionId, data, options)
            );
        } finally {
            closePrompt();
        }
    }

    onSessionChange(fn) {
        return this.#onSessionChange.add(fn);
    }
}

const createClientSide = async (app, walletUrl) => {
    const messagePort = await createIframe(walletUrl);

    return new ClientSide(app, walletUrl, messagePort);
};

export default createClientSide;
