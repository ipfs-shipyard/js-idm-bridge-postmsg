import PCancelable from 'p-cancelable';
import pTimeout from 'p-timeout';
import { CONNECT, CONNECT_ACK } from './message-types';
import createRpc from './rpc';

export const listen = (channelName, options) => {
    options = {
        callTimeout: 30000,
        ...options,
    };

    const broadcastChannel = new BroadcastChannel(channelName);

    broadcastChannel.addEventListener('message', (message) => {
        if (!message.data || message.data.type !== CONNECT) {
            return;
        }

        broadcastChannel.postMessage({ type: CONNECT_ACK });
    });

    const rpc = createRpc(broadcastChannel, broadcastChannel, {
        callTimeout: options.callTimeout,
    });

    const close = () => {
        rpc.close();
        broadcastChannel.close();
    };

    return {
        ...rpc,
        close,
    };
};

export const connect = (channelName, options) => {
    options = {
        interval: 500,
        timeout: 10000,
        callTimeout: 30000,
        ...options,
    };

    const broadcastChannel = new BroadcastChannel(channelName);

    const promise = new PCancelable((resolve, reject, onCancel) => {
        const cleanup = () => {
            clearInterval(intervalId);
            broadcastChannel.removeEventListener('message', handleMessage);
        };

        const handleMessage = (message) => {
            if (!message.data || message.data.type !== CONNECT_ACK) {
                return;
            }

            cleanup();

            const rpc = createRpc(broadcastChannel, broadcastChannel, {
                callTimeout: options.callTimeout,
            });

            const close = () => {
                rpc.close();
                broadcastChannel.close();
            };

            resolve({
                ...rpc,
                close,
            });
        };

        onCancel(() => {
            cleanup();
            broadcastChannel.close();
        });

        broadcastChannel.addEventListener('message', handleMessage);

        const intervalId = setInterval(() => {
            broadcastChannel.postMessage({ type: CONNECT });
        }, options.interval);
    });

    return Object.assign(
        pTimeout(promise, options.timeout),
        { cancel: () => promise.cancel() }
    );
};
