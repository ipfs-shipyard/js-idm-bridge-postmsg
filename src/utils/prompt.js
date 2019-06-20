import PCancelable from 'p-cancelable';
import { PromptClosedError } from './errors';
import { waitConnect } from './communication/window-channel';

const WINDOW_NAME = '__IDM_BRIDGE_POSTMSG__';
const MONITOR_WINDOW_CLOSED_INTERVAL = 1000;

let promptWindow;

const openWindow = (url, options) => {
    options = {
        width: 620,
        height: 728,
        ...options,
    };

    const top = (window.top.outerHeight / 2) + window.top.screenY - (options.height / 2);
    const left = (window.top.outerWidth / 2) + window.top.screenX - (options.width / 2);

    return window.open(
        url,
        WINDOW_NAME,
        `width=${options.width}, height=${options.height},top=${top},left=${left},resizable=no`
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

export const openPrompt = async (url, fn, options) => {
    closePrompt();

    const { origin } = new URL(url);

    const childWindow = promptWindow = openWindow(url, options);

    const windowClosedPromise = monitorWindowClosed(childWindow);
    const waitConnectPromise = waitConnect(childWindow, {
        ...options,
        childOrigin: origin,
    });

    try {
        await Promise.race([
            waitConnectPromise,
            windowClosedPromise,
        ]);
    } catch (err) {
        waitConnectPromise.cancel();
        windowClosedPromise.cancel();
        closePromptIfSame(childWindow);
        throw err;
    }

    const windowChannel = await waitConnectPromise;
    const resultPromise = fn(windowChannel);

    try {
        await Promise.race([
            resultPromise,
            windowClosedPromise,
        ]);
    } catch (err) {
        windowChannel.close();
        windowClosedPromise.cancel();
        closePromptIfSame(childWindow);
        throw err;
    }

    windowClosedPromise.cancel();
    closePromptIfSame(childWindow);

    return resultPromise;
};

window.addEventListener('unload', closePrompt);
