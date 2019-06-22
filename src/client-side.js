import signal from 'pico-signals';
import { openPrompt } from './utils/prompt';
import { createIframe } from './utils/iframe';

const PROMPT_CALL_TIMEOUT = 10 * 60000;

class ClientSide {
    #walletUrl;
    #mediatorChannel;

    #onSessionChange = signal();

    constructor(walletUrl, mediatorChannel) {
        this.#walletUrl = walletUrl;
        this.#mediatorChannel = mediatorChannel;

        this.#mediatorChannel.expose('onSessionDestroy', this.#handleSessionDestroy);
    }

    async isSessionValid(sessionId) {
        return this.#mediatorChannel.call('isSessionValid', sessionId);
    }

    async authenticate(app) {
        return openPrompt(
            this.#walletUrl,
            (mediatorChannel) => mediatorChannel.call('authenticate', app),
            { callTimeout: PROMPT_CALL_TIMEOUT }
        );
    }

    async unauthenticate(sessionId) {
        await this.#mediatorChannel.call('unauthenticate', sessionId);
    }

    async sign(sessionId, data, app, options) {
        options = {
            signWith: 'session',
            ...options,
        };

        if (options.signWith === 'session') {
            return this.#mediatorChannel.call('sign', sessionId, data, app, options);
        }

        return openPrompt(
            this.#walletUrl,
            (mediatorChannel) => mediatorChannel.call('sign', sessionId, data, app, options),
            { callTimeout: PROMPT_CALL_TIMEOUT }
        );
    }

    onSessionChange(fn) {
        return this.#onSessionChange.add(fn);
    }

    #handleSessionDestroy = (sessionId) => {
        this.#onSessionChange.dispatch(sessionId, undefined);
    }
}

const createClientSide = async (walletUrl) => {
    let mediatorChannel;

    try {
        mediatorChannel = await createIframe(walletUrl);
    } catch (err) {
        if (err.name === 'TimeoutError') {
            err.message = `Unable to connect to wallet at ${walletUrl}, please make sure it's open`;
        }

        throw err;
    }

    return new ClientSide(walletUrl, mediatorChannel);
};

export default createClientSide;
