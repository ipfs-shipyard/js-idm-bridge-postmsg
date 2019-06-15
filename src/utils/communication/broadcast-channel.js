import PCancelable from 'p-cancelable';
import pTimeout from 'p-timeout';
import { CONNECT, CONNECT_ACK } from './message-types';

const CONNECT_TIMEOUT = 10000;

export const listen = (channelName) => {
    const broadcastChannel = new BroadcastChannel(channelName);

    broadcastChannel.addEventListener('message', (message) => {
        if (!message.data || message.data.type !== CONNECT) {
            return;
        }

        broadcastChannel.postMessage({ type: CONNECT_ACK });
    });

    return broadcastChannel;
};

export const connect = (channelName) => {
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
            resolve(broadcastChannel);
        };

        onCancel(() => {
            cleanup();
            broadcastChannel.close();
        });

        broadcastChannel.addEventListener('message', handleMessage);

        const intervalId = setInterval(() => broadcastChannel.postMessage({ type: CONNECT }), 500);
    });

    return pTimeout(promise, CONNECT_TIMEOUT);
};
