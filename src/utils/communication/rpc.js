import { RPC_CALL } from './message-types';
import pTimeout from 'p-timeout';
import * as rpc from 'postmsg-rpc';

const isSameOrigin = (message, targetOrigin) => targetOrigin === '*' || message.origin === targetOrigin;

const createRpcOptions = (self, target, targetOrigin) => ({
    postMessage: (data) => target.postMessage({ type: RPC_CALL, payload: data }, targetOrigin),
    addListener: (name, handler) => self.addEventListener(name, handler),
    removeListener: (name, handler) => self.removeEventListener(name, handler),
    getMessageData: (message) => {
        // Return an empty message from unexpected origins
        if (!isSameOrigin(message, targetOrigin)) {
            return null;
        }

        return message.data && message.data.payload;
    },
});

const createExposer = (self, target, options) => {
    options = {
        targetOrigin: '*',
        ...options,
    };

    const rpcOptions = createRpcOptions(self, target, options.targetOrigin);
    const closeFns = new Set();

    const expose = (funcName, func) => {
        // Wrap `func` so that we preserve error codes
        // See: https://github.com/tableflip/postmsg-rpc/blob/5f3905523dc1c07db8f4987bb4a21f29c943996b/src/server.js#L24
        const wrappedFunc = async (...args) => {
            try {
                return await func(...args);
            } catch (err) {
                err.output = {
                    payload: { code: err.code },
                };

                throw err;
            }
        };

        const { close } = rpc.expose(funcName, wrappedFunc, rpcOptions);

        closeFns.add(close);
    };

    const close = () => {
        closeFns.forEach((fn) => fn());
        closeFns.clear();
    };

    return {
        expose,
        close,
    };
};

const createCaller = (self, target, options) => {
    options = {
        callTimeout: 30000,
        targetOrigin: '*',
        ...options,
    };

    const rpcOptions = createRpcOptions(self, target, options.targetOrigin);
    const closeFns = new Set();

    const call = (funcName, ...args) => {
        const promise = rpc.caller(funcName, rpcOptions)(...args);

        closeFns.add(promise.cancel);

        promise
        .finally(() => closeFns.delete(promise.cancel))
        .catch(() => {});

        return Object.assign(
            pTimeout(promise, options.callTimeout),
            { cancel: () => promise.cancel() }
        );
    };

    const close = () => {
        closeFns.forEach((fn) => fn());
        closeFns.clear();
    };

    return {
        call,
        close,
    };
};

const createRpc = (self, target, options) => {
    const { expose, close: closeExposer } = createExposer(self, target, options);
    const { call, close: closeCaller } = createCaller(self, target, options);

    const close = () => {
        closeExposer();
        closeCaller();
    };

    return {
        expose,
        call,
        close,
    };
};

export default createRpc;
