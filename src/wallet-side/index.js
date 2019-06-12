import { connect } from '../utils/message-channel';
import { expose } from '../utils/rpc';
import { sha256 } from '../utils/sha';
import { NoParentWindowError, MissingHookError, PromptDeniedError, OriginMismatchError } from '../utils/errors';
import getParentWindow from './parent';

class WalletSide {
    #idmWallet;
    #clientOrigin;
    #hooks;

    constructor(idmWallet, clientOrigin, messagePort, hooks) {
        this.#idmWallet = idmWallet;
        this.#clientOrigin = clientOrigin;
        this.#hooks = hooks;

        expose(messagePort, 'isSessionValid', this.#isSessionValid);
        expose(messagePort, 'authenticate', this.#authenticate);
        expose(messagePort, 'unauthenticate', this.#unauthenticate);
        expose(messagePort, 'sign', this.#sign);
    }

    #authenticate = async (app) => {
        await this.#hooks.prePrompt('authenticate');
        await this.#idmWallet.identities.load();

        const { ok, identityId, options } = await this.#hooks.promptAuthenticate(app);

        if (!ok) {
            throw new PromptDeniedError('Authentication prompt denied');
        }

        app.id = await sha256(this.#clientOrigin);

        const session = await this.#idmWallet.sessions.create(identityId, app, {
            ...options,
            meta: this.#clientOrigin,
        });

        const identity = this.#idmWallet.identities.get(identityId);

        return {
            id: session.getId(),
            did: identity.getDid(),
            profileDetails: identity.profile.getDetails(),
        };
    };

    #isSessionValid = (sessionId) => {
        if (!this.#idmWallet.sessions.isValid(sessionId)) {
            return false;
        }

        const session = this.#idmWallet.sessions.get(sessionId);

        this.#assertSessionOrigin(session);

        return true;
    }

    #unauthenticate = async (sessionId) => {
        if (!this.#idmWallet.sessions.isValid(sessionId)) {
            return;
        }

        const session = this.#idmWallet.sessions.get(sessionId);

        this.#assertSessionOrigin(session);

        await this.#idmWallet.sessions.destroy(sessionId);
    };

    #sign = async (sessionId, data, options) => {
        const session = this.#idmWallet.sessions.get(sessionId);

        this.#assertSessionOrigin(session);

        options = {
            signWith: 'session',
            ...options,
        };

        if (options.signWith === 'session') {
            return session.getSigner()(data);
        }

        await this.#hooks.prePrompt('sign');
        await this.#idmWallet.identities.load();

        const identity = this.#idmWallet.identities.get(session.getIdentityId());
        const app = identity.apps.get(session.getAppId());

        const { ok } = await this.#hooks.promptSign(app, identity, data);

        if (!ok) {
            throw new PromptDeniedError('Authentication prompt denied');
        }

        return identity.getSigner()(data);
    };

    #assertSessionOrigin = (session) => {
        if (this.#clientOrigin !== session.getMeta()) {
            throw new OriginMismatchError(this.#clientOrigin, session.getMeta());
        }
    }
}

export const hasParent = () => !!getParentWindow();

const createWalletSide = async (idmWallet, hooks) => {
    const parentWindow = getParentWindow();

    if (!parentWindow) {
        throw new NoParentWindowError();
    }

    if (!hooks || !hooks.promptAuthenticate) {
        throw new MissingHookError('promptAuthenticate');
    }
    if (!hooks || !hooks.promptSign) {
        throw new MissingHookError('promptSign');
    }

    const { origin, messagePort } = await connect(parentWindow);

    return new WalletSide(idmWallet, origin, messagePort, hooks);
};

export default createWalletSide;
