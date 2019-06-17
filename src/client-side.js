import signal from 'pico-signals';
import { openPrompt } from './utils/prompt';
import { createIframe } from './utils/iframe';
import { createCaller, createExposer } from './utils/communication/rpc';

class ClientSide {
    #walletUrl;
    #callMediator;

    #onSessionChange = signal();

    constructor(walletUrl, mediatorPort) {
        this.#walletUrl = walletUrl;
        this.#callMediator = createCaller(mediatorPort);

        const expose = createExposer(mediatorPort);

        expose('onSessionDestroy', this.#handleSessionDestroy);
    }

    async isSessionValid(sessionId) {
        return this.#callMediator('isSessionValid', sessionId);
    }

    async authenticate(app) {
        return openPrompt(
            this.#walletUrl,
            async (mediatorPort) => {
                const caller = createCaller(mediatorPort, { timeout: 0 });

                return caller('authenticate', app);
            }
        );
    }

    async unauthenticate(sessionId) {
        await this.#callMediator('unauthenticate', sessionId);
    }

    async sign(sessionId, data, options) {
        options = {
            signWith: 'session',
            ...options,
        };

        if (options.signWith === 'session') {
            return this.#callMediator('sign', sessionId, data, options);
        }

        return openPrompt(
            this.#walletUrl,
            async (mediatorPort) => {
                const caller = createCaller(mediatorPort, { timeout: 0 });

                return caller('sign', sessionId, data, options);
            }
        );
    }

    onSessionChange(fn) {
        return this.#onSessionChange.add(fn);
    }

    #handleSessionDestroy = (sessionId) => {
        this.#onSessionChange.dispatch(sessionId, null);
    }
}

const createClientSide = async (walletUrl) => {
    const mediatorPort = await createIframe(walletUrl);

    return new ClientSide(walletUrl, mediatorPort);
};

export default createClientSide;
