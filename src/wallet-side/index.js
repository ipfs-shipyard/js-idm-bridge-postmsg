import { connect } from '../utils/message-channel';
import { expose } from '../utils/rpc';
import { sha256 } from '../utils/sha';
import { NoParentWindowError, MissingPromptError, PromptDeniedError, OriginMismatchError } from '../utils/errors';
import getParentWindow from './parent';

class WalletSide {
    #idmWallet;
    #clientOrigin;
    #prompts;

    constructor(idmWallet, clientOrigin, messagePort, prompts) {
        this.#idmWallet = idmWallet;
        this.#clientOrigin = clientOrigin;
        this.#prompts = prompts;

        expose(messagePort, 'isSessionValid', this.#isSessionValid);
        expose(messagePort, 'authenticate', this.#authenticate);
        expose(messagePort, 'unauthenticate', this.#unauthenticate);
    }

    #authenticate = async (app) => {
        const { ok, identityId, options } = await this.#prompts.authenticate(app);

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

    #assertSessionOrigin = (session) => {
        if (this.#clientOrigin !== session.getMeta()) {
            throw new OriginMismatchError(this.#clientOrigin, session.getMeta());
        }
    }
}

export const hasParent = () => !!getParentWindow();

const createWalletSide = async (idmWallet, prompts) => {
    const parentWindow = getParentWindow();

    if (!parentWindow) {
        throw new NoParentWindowError();
    }

    if (!prompts || !prompts.authenticate) {
        throw new MissingPromptError('authenticate');
    }

    if (!prompts || !prompts.sign) {
        throw new MissingPromptError('sign');
    }

    const { origin, messagePort } = await connect(parentWindow);

    return new WalletSide(idmWallet, origin, messagePort, prompts);
};

export default createWalletSide;
