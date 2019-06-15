import { RPC_CALL } from './message-types';
import pTimeout from 'p-timeout';
import * as rpc from 'postmsg-rpc';

const createRpcOptions = (target) => ({
    postMessage: (data) => target.postMessage({ type: RPC_CALL, payload: data }),
    addListener: (name, handler) => target.addEventListener(name, handler),
    removeListener: (name, handler) => target.removeEventListener(name, handler),
    getMessageData: (message) => message.data && message.data.payload,
});

export const createExposer = (target) => {
    const rpcOptions = createRpcOptions(target);

    return (funcName, func) => {
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

        return close;
    };
};

export const createCaller = (target, options) => {
    const rpcOptions = createRpcOptions(target);

    options = {
        ...options,
        timeout: 30000,
    };

    return (funcName, ...args) => {
        let promise = rpc.caller(funcName, rpcOptions)(...args);

        if (options.timeout) {
            promise = pTimeout(promise, options.timeout);
        }

        return promise;
    };
};
