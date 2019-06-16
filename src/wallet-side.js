import { createExposer, createCaller } from './utils/communication/rpc';
import { listen } from './utils/communication/broadcast-channel';

const WALLET_CHANNEL_NAME = '__IDM_BRIDGE_POSTMSG_WALLET__';

class WalletSide {
    #idmWallet;
    #callMediator;

    constructor(idmWallet, walletChannel) {
        this.#idmWallet = idmWallet;
        this.#callMediator = createCaller(walletChannel, { timeout: 1 });

        const expose = createExposer(walletChannel);

        expose('unlock', this.unlock.bind(this));
        expose('getSession', this.getSession.bind(this));
        expose('createSession', this.createSession.bind(this));
        expose('destroySession', this.destroySession.bind(this));
        expose('signWithSession', this.signWithSession.bind(this));
        expose('signWithDevice', this.signWithDevice.bind(this));
        expose('getDataForUnlockPrompt', this.getDataForUnlockPrompt.bind(this));
        expose('getDataForAuthenticatePrompt', this.getDataForAuthenticatePrompt.bind(this));
        expose('getDataForSignPrompt', this.getDataForSignPrompt.bind(this));

        this.#idmWallet.sessions.onDestroy(this.#handleSessionDestroy);
    }

    async unlock(lockType, input) {
        await this.#idmWallet.locker.getLock(lockType).unlock(input);
        await this.#idmWallet.identities.load().catch(() => {});
    }

    getSession = (sessionId) => {
        const session = this.#idmWallet.sessions.get(sessionId);

        return this.#serializeSession(session);
    };

    async createSession(identityId, app, options) {
        const session = await this.#idmWallet.sessions.create(identityId, app, options);

        return this.#serializeSession(session);
    }

    async destroySession(sessionId) {
        await this.#idmWallet.sessions.destroy(sessionId);
    }

    async signWithSession(sessionId, data) {
        const session = this.#idmWallet.sessions.get(sessionId);

        return session.getSigner()(data);
    }

    async signWithDevice(identityId, data) {
        const identity = this.#idmWallet.identities.get(identityId);

        return identity.getSigner()(data);
    }

    async getDataForUnlockPrompt() {
        const pristine = this.#idmWallet.locker.isPristine();
        const lockTypes = this.#idmWallet.locker.listLockTypes();
        const enabledLockTypes = lockTypes.map((lockType) => this.#idmWallet.locker.getLock(lockType).isEnabled());

        return {
            pristine,
            enabledLockTypes,
        };
    }

    async getDataForAuthenticatePrompt() {
        const identities = this.#idmWallet.identities.list();

        return {
            identities: identities.map(this.#serializeIdentity),
        };
    }

    async getDataForSignPrompt(sessionId) {
        const session = this.#idmWallet.sessions.get(sessionId);

        const identity = this.#idmWallet.identities.get(session.getIdentityId());
        const app = identity.apps.get(session.getAppId());

        return {
            app,
            identity: this.#serializeIdentity(identity),
        };
    }

    #handleSessionDestroy = (sessionId, sessionMeta) => {
        this.#callMediator('onSessionDestroy', sessionId, sessionMeta).catch(() => {});
    }

    #serializeSession = (session) => ({
        id: session.getId(),
        identityId: session.getIdentityId(),
        meta: session.getMeta(),
    });

    #serializeIdentity = (identity) => ({
        id: identity.getId(),
        did: identity.getDid(),
        profileDetails: identity.profile.getDetails(),
    });
}

const createWalletSide = (idmWallet) => {
    const walletChannel = listen(WALLET_CHANNEL_NAME);

    return new WalletSide(idmWallet, walletChannel);
};

export default createWalletSide;
