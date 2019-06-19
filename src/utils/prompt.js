import PCancelable from 'p-cancelable';
import { PromptClosedError } from './errors';
import { waitConnect } from './communication/message-channel';

const WINDOW_NAME = '__IDM_BRIDGE_POSTMSG__';
const WINDOW_SIZE = { width: 620, height: 700 };
const MONITOR_WINDOW_CLOSED_INTERVAL = 1000;

let promptWindow;

const openWindow = (url) => {
    const { width, height } = WINDOW_SIZE;
    const top = (window.top.outerHeight / 2) + window.top.screenY - (height / 2);
    const left = (window.top.outerWidth / 2) + window.top.screenX - (width / 2);

    return window.open(
        url,
        WINDOW_NAME,
        `width=${width}, height=${height},top=${top},left=${left},resizable=no`
    );
};

const monitorWindowClosed = (childWindow) => new PCancelable((resolve, reject, onCancel) => {
    const cleanup = () => clearInterval(intervalId);

    const intervalId = setInterval(() => {
        if (childWindow.closed) {
            reject(new PromptClosedError());
        }
    }, MONITOR_WINDOW_CLOSED_INTERVAL);

    onCancel(cleanup);
});

const closePromptIfSame = (promptWindowRef) => {
    if (promptWindow === promptWindowRef) {
        closePrompt();
    }
};

export const closePrompt = () => {
    if (promptWindow) {
        promptWindow.close();
        promptWindow = undefined;
    }
};

export const openPrompt = async (url, fn) => {
    closePrompt();

    const promptWindowRef = promptWindow = openWindow(url);

    const windowClosedPromise = monitorWindowClosed(promptWindowRef);
    const waitConnectPromise = waitConnect(promptWindowRef);

    try {
        await Promise.race([
            waitConnectPromise,
            windowClosedPromise,
        ]);
    } catch (err) {
        waitConnectPromise.cancel();
        windowClosedPromise.cancel();
        closePromptIfSame(promptWindowRef);
        throw err;
    }

    const { messagePort } = await waitConnectPromise;
    const resultPromise = fn(messagePort);

    try {
        await Promise.race([
            resultPromise,
            windowClosedPromise,
        ]);
    } catch (err) {
        resultPromise && resultPromise.cancel && resultPromise.cancel();
        windowClosedPromise.cancel();
        messagePort.close();
        closePromptIfSame(promptWindowRef);
        throw err;
    }

    windowClosedPromise.cancel();
    closePromptIfSame(promptWindowRef);

    return resultPromise;
};

window.addEventListener('unload', closePrompt);
