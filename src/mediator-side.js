import { sha256 } from './utils/sha';
import { connect as connectClient } from './utils/communication/window-channel';
import { connect as connectWallet } from './utils/communication/broadcast-channel';
import { getParentWindow, setupWindow } from './utils/window';
import { NoParentWindowError, MissingPromptError, PromptDeniedError, OriginMismatchError, UnknownSessionError } from './utils/errors';

const WALLET_CHANNEL_NAME = '__IDM_BRIDGE_POSTMSG_WALLET__';

class MediatorSide {
    #clientChannel;
    #walletChannel;

    #prompts;

    constructor(clientChannel, walletChannel) {
        this.#clientChannel = clientChannel;
        this.#walletChannel = walletChannel;

        clientChannel.expose('isSessionValid', this.isSessionValid.bind(this));
        clientChannel.expose('authenticate', this.authenticate.bind(this));
        clientChannel.expose('unauthenticate', this.unauthenticate.bind(this));
        clientChannel.expose('sign', this.sign.bind(this));

        walletChannel.expose('onSessionDestroy', this.#handleSessionDestroy);
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

        await this.#promptUnlock(app);

        app.id = await sha256(this.#clientChannel.parentOrigin);

        const { identityId, identities } = await this.#promptAuthenticate(app);

        const session = await this.#walletChannel.call('createSession', identityId, app, { meta: this.#clientChannel.parentOrigin });
        const identity = identities.find((identity) => identity.id === identityId);

        return {
            id: session.id,
            did: identity.did,
            profileDetails: identity.profileDetails,
        };
    }

    async unauthenticate(sessionId) {
        await this.#retrieveSession(sessionId);

        await this.#walletChannel.call('destroySession', sessionId);
    }

    async sign(sessionId, data, app, options) {
        this.#assertAppSameOrigin(app);

        options = {
            signWith: 'session',
            ...options,
        };

        const session = await this.#retrieveSession(sessionId);

        if (options.signWith === 'session') {
            return this.#walletChannel.call('signWithSession', sessionId, data);
        }

        this.#assertPrompt('unlock');
        this.#assertPrompt('authenticate');

        await this.#promptUnlock(app);
        await this.#promptSign(sessionId, data);

        return this.#walletChannel.call('signWithDevice', session.identityId, data);
    }

    #handleSessionDestroy = (sessionId, sessionMeta) => {
        if (sessionMeta === this.#clientChannel.parentOrigin) {
            this.#clientChannel.call('onSessionDestroy', sessionId).catch(() => {});
        }
    }

    #promptUnlock = async (app) => {
        const unlockFn = async (lockType, input) => {
            await this.#walletChannel.call('unlock', lockType, input);
        };

        const { pristine, enabledLockTypes } = await this.#walletChannel.call('getDataForUnlockPrompt');
        const { ok } = await this.#prompts.unlock({ app, pristine, enabledLockTypes, unlockFn });

        if (!ok) {
            throw new PromptDeniedError('Unlock prompt denied');
        }

        return { pristine };
    }

    #promptAuthenticate = async (app) => {
        const { identities } = await this.#walletChannel.call('getDataForAuthenticatePrompt');
        const { ok, identityId } = await this.#prompts.authenticate({ app, identities });

        if (!ok) {
            throw new PromptDeniedError('Authentication prompt denied');
        }

        return { identities, identityId };
    }

    #promptSign = async (sessionId, data) => {
        const { app, identity } = await this.#walletChannel.call('getDataForSignPrompt', sessionId);
        const { ok } = await this.#prompts.sign({ app, identity, data });

        if (!ok) {
            throw new PromptDeniedError('Signing prompt denied');
        }

        return { app, identity };
    }

    #retrieveSession = async (sessionId) => {
        let session;

        try {
            session = await this.#walletChannel.call('getSession', sessionId);

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
        if (session.meta !== this.#clientChannel.parentOrigin) {
            throw new OriginMismatchError(this.#clientChannel.parentOrigin, session.meta);
        }
    }

    #assertAppSameOrigin = (app) => {
        if (app.homepageUrl) {
            const { origin } = new URL(app.homepageUrl);

            if (origin !== this.#clientChannel.parentOrigin) {
                throw new OriginMismatchError(origin, this.#clientChannel.parentOrigin);
            }
        }
    }
}

export const hasParent = () => !!getParentWindow();

const createMediatorSide = async (options) => {
    options = {
        minWidth: 620,
        minHeight: 700,
        ...options,
    };

    const parentWindow = getParentWindow();

    if (!parentWindow) {
        throw new NoParentWindowError();
    }

    setupWindow(options.minWidth, options.minHeight);

    const walletChannel = await connectWallet(WALLET_CHANNEL_NAME);
    const clientChannel = await connectClient(parentWindow);

    return new MediatorSide(clientChannel, walletChannel);
};

export default createMediatorSide;
