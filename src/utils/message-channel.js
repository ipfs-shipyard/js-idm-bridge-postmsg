import PCancelable from 'p-cancelable';
import pTimeout from 'p-timeout';
import { CONNECT, CONNECT_ACK } from './message-types';

const CONNECT_TIMEOUT = 10000;
const CONNECT_WAIT_TIMEOUT = 30000;

export const waitConnect = (childWindow) => {
    const promise = new PCancelable((resolve, reject, onCancel) => {
        const cleanup = () => window.removeEventListener('message', handleMessage);

        const handleMessage = (message) => {
            if (!message.data || message.data.type !== CONNECT || message.source !== childWindow) {
                return;
            }

            const port2 = message.ports[0];

            port2.start();
            childWindow.postMessage({ type: CONNECT_ACK }, '*');

            cleanup();
            resolve({
                origin: message.origin,
                messagePort: port2,
            });
        };

        onCancel(cleanup);

        window.addEventListener('message', handleMessage);
    });

    return pTimeout(promise, CONNECT_WAIT_TIMEOUT);
};

export const connect = (parentWindow) => {
    const { port1, port2 } = new MessageChannel();

    const promise = new PCancelable((resolve, reject, onCancel) => {
        const cleanup = () => port1.removeEventListener('message', handleMessage);

        const handleMessage = (message) => {
            if (!message.data || message.data.type !== CONNECT_ACK || message.source !== parentWindow) {
                return;
            }

            port1.start();

            cleanup();
            resolve({
                origin: message.origin,
                messagePort: port1,
            });
        };

        onCancel(() => {
            port1.close();
            cleanup();
        });

        window.addEventListener('message', handleMessage);
        parentWindow.postMessage({ type: CONNECT }, '*', [port2]);
    });

    return pTimeout(promise, CONNECT_TIMEOUT);
};
