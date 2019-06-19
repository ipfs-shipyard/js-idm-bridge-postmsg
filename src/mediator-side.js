import { sha256 } from './utils/sha';
import { createExposer, createCaller } from './utils/communication/rpc';
import { connect as connectClient } from './utils/communication/message-channel';
import { connect as connectWallet } from './utils/communication/broadcast-channel';
import { getParentWindow, setWindowSize } from './utils/window';
import { NoParentWindowError, MissingPromptError, PromptDeniedError, OriginMismatchError, UnknownSessionError } from './utils/errors';

const WALLET_CHANNEL_NAME = '__IDM_BRIDGE_POSTMSG_WALLET__';

class MediatorSide {
    #clientOrigin;
    #callClient;
    #callWallet;

    #prompts;

    constructor(clientOrigin, clientPort, walletChannel) {
        this.#clientOrigin = clientOrigin;
        this.#callClient = createCaller(clientPort);
        this.#callWallet = createCaller(walletChannel);

        const exposeOnClient = createExposer(clientPort);

        exposeOnClient('isSessionValid', this.isSessionValid.bind(this));
        exposeOnClient('authenticate', this.authenticate.bind(this));
        exposeOnClient('unauthenticate', this.unauthenticate.bind(this));
        exposeOnClient('sign', this.sign.bind(this));

        const exposeOnWallet = createExposer(walletChannel);

        exposeOnWallet('onSessionDestroy', this.#handleSessionDestroy);
    }

    setPrompts(prompts) {
        ['unlock', 'authenticate', 'sign'].forEach((name) => {
            if (!prompts || !prompts[name]) {
                throw new MissingPromptError(name);
            }
        });

        this.#prompts = prompts;
    }

    async isSessionValid(sessionId) {
        try {
            await this.#retrieveSession(sessionId);
        } catch (err) {
            if (err instanceof UnknownSessionError) {
                return false;
            }
        }

        return true;
    }

    async authenticate(app) {
        this.#assertPrompt('unlock');
        this.#assertPrompt('authenticate');
        this.#assertAppSameOrigin(app);

        await this.#promptUnlock();

        app.id = await sha256(this.#clientOrigin);

        const { identityId, identities } = await this.#promptAuthenticate(app);

        const session = await this.#callWallet('createSession', identityId, app, { meta: this.#clientOrigin });
        const identity = identities.find((identity) => identity.id === identityId);

        return {
            id: session.id,
            did: identity.did,
            profileDetails: identity.profileDetails,
        };
    }

    async unauthenticate(sessionId) {
        await this.#retrieveSession(sessionId);

        await this.#callWallet('destroySession', sessionId);
    }

    async sign(sessionId, data, options) {
        options = {
            signWith: 'session',
            ...options,
        };

        const session = await this.#retrieveSession(sessionId);

        if (options.signWith === 'session') {
            return this.#callWallet('signWithSession', sessionId, data);
        }

        this.#assertPrompt('unlock');
        this.#assertPrompt('authenticate');

        await this.#promptUnlock();
        await this.#promptSign(sessionId, data);

        return this.#callWallet('signWithDevice', session.identityId, data);
    }

    #handleSessionDestroy = (sessionId, sessionMeta) => {
        if (sessionMeta === this.#clientOrigin) {
            this.#callClient('onSessionDestroy', sessionId).catch(() => {});
        }
    }

    #promptUnlock = async () => {
        const unlockFn = async (lockType, input) => {
            await this.#callWallet('unlock', lockType, input);
        };

        const { pristine, enabledLockTypes } = await this.#callWallet('getDataForUnlockPrompt');
        const { ok } = await this.#prompts.unlock({ pristine, enabledLockTypes, unlockFn });

        if (!ok) {
            throw new PromptDeniedError('Unlock prompt denied');
        }

        return { pristine };
    }

    #promptAuthenticate = async (app) => {
        const { identities } = await this.#callWallet('getDataForAuthenticatePrompt');
        const { ok, identityId } = await this.#prompts.authenticate({ app, identities });

        if (!ok) {
            throw new PromptDeniedError('Authentication prompt denied');
        }

        return { identities, identityId };
    }

    #promptSign = async (sessionId, data) => {
        const { app, identity } = await this.#callWallet('getDataForSignPrompt', sessionId);
        const { ok } = await this.#prompts.sign({ app, identity, data });

        if (!ok) {
            throw new PromptDeniedError('Signing prompt denied');
        }

        return { app, identity };
    }

    #retrieveSession = async (sessionId) => {
        let session;

        try {
            session = await this.#callWallet('getSession', sessionId);

            this.#assertSessionOrigin(session);
        } catch (err) {
            if (err.code === 'UNKNOWN_SESSION' || err instanceof OriginMismatchError) {
                throw new UnknownSessionError(sessionId);
            }
        }

        return session;
    }

    #assertPrompt = (name) => {
        if (!this.#prompts || !this.#prompts[name]) {
            throw new MissingPromptError(name);
        }
    }

    #assertSessionOrigin = (session) => {
        if (session.meta !== this.#clientOrigin) {
            throw new OriginMismatchError(this.#clientOrigin, session.meta);
        }
    }

    #assertAppSameOrigin = (app) => {
        if (app.homepageUrl) {
            const { origin } = new URL(app.homepageUrl);

            if (origin !== this.#clientOrigin) {
                throw new OriginMismatchError(origin, this.#clientOrigin);
            }
        }
    }
}

export const hasParent = () => !!getParentWindow();

const createMediatorSide = async (options) => {
    options = {
        minWidth: undefined,
        minHeight: undefined,
        ...options,
    };

    const parentWindow = getParentWindow();

    if (!parentWindow) {
        throw new NoParentWindowError();
    }

    setWindowSize(options.minWidth, options.minHeight);

    const walletChannel = await connectWallet(WALLET_CHANNEL_NAME);
    const { origin, messagePort } = await connectClient(parentWindow);

    return new MediatorSide(origin, messagePort, walletChannel);
};

export default createMediatorSide;
