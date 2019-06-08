import { RPC_CALL } from './message-types';
import * as rpc from 'postmsg-rpc';

const createOptions = (target) => ({
    postMessage: (data) => target.postMessage({ type: RPC_CALL, payload: data }),
    addListener: (name, handler) => target.addEventListener(name, handler),
    removeListener: (name, handler) => target.removeEventListener(name, handler),
    getMessageData: (message) => message.data && message.data.payload,
});

export const expose = (target, funcName, func) => {
    const { close } = rpc.expose(funcName, func, createOptions(target));

    return close;
};

export const caller = (target, funcName) => rpc.caller(funcName, createOptions(target));

export const call = (target, funcName, ...args) => rpc.caller(funcName, createOptions(target))(...args);
