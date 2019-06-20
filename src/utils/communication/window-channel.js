import PCancelable from 'p-cancelable';
import pTimeout from 'p-timeout';
import { CONNECT, CONNECT_ACK } from './message-types';
import createRpc from './rpc';

const isSameOrigin = (message, expectedOrign) => expectedOrign === '*' || message.origin === expectedOrign;

export const waitConnect = (childWindow, options) => {
    options = {
        timeout: 20000,
        callTimeout: 30000,
        childOrigin: '*',
        ...options,
    };

    const promise = new PCancelable((resolve, reject, onCancel) => {
        const handleMessage = (message) => {
            if (!isSameOrigin(message, options.childOrigin) || !message.data || message.data.type !== CONNECT) {
                return;
            }

            childWindow.postMessage({ type: CONNECT_ACK }, options.childOrigin);

            const rpc = createRpc(window, childWindow, {
                targetOrigin: options.childOrigin,
                callTimeout: options.callTimeout,
            });

            resolve({
                childOrigin: message.origin,
                ...rpc,
            });
        };

        onCancel(() => window.removeEventListener('message', handleMessage));

        window.addEventListener('message', handleMessage);
    });

    return Object.assign(
        pTimeout(promise, options.timeout),
        { cancel: () => promise.cancel() }
    );
};

export const connect = (parentWindow, options) => {
    options = {
        timeout: 10000,
        callTimeout: 30000,
        parentOrigin: '*',
        ...options,
    };

    const promise = new PCancelable((resolve, reject, onCancel) => {
        const cleanup = () => window.removeEventListener('message', handleMessage);

        const handleMessage = (message) => {
            if (!isSameOrigin(message, options.parentOrigin) || !message.data || message.data.type !== CONNECT_ACK) {
                return;
            }

            cleanup();

            const rpc = createRpc(window, parentWindow, {
                targetOrigin: message.origin,
                callTimeout: options.callTimeout,
            });

            resolve({
                parentOrigin: message.origin,
                ...rpc,
            });
        };

        onCancel(cleanup);

        window.addEventListener('message', handleMessage);
        parentWindow.postMessage({ type: CONNECT }, options.parentOrigin);
    });

    return Object.assign(
        pTimeout(promise, options.timeout),
        { cancel: () => promise.cancel() }
    );
};
