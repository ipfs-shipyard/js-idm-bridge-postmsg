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
        const valid = await call(this.#messagePort, 'isSessionValid', sessionId);

        return valid;
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

    onSessionChange(fn) {
        return this.#onSessionChange.add(fn);
    }
}

const createClientSide = async (app, walletUrl) => {
    const messagePort = await createIframe(walletUrl);

    return new ClientSide(app, walletUrl, messagePort);
};

export default createClientSide;
