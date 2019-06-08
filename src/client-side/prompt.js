import PCancelable from 'p-cancelable';
import { waitConnect } from '../utils/message-channel';
import { PromptClosedError } from '../utils/errors';

const WINDOW_NAME = '__IDM_BRIDGE_POSTMSG__';
const MONITOR_WINDOW_CLOSED_INTERVAL = 1000;

let childWindow;

const openWindow = (url, options) => {
    const { width, height } = options;
    const top = (window.top.outerHeight / 2) + window.top.screenY - (height / 2);
    const left = (window.top.outerWidth / 2) + window.top.screenX - (width / 2);

    childWindow = window.open(
        url,
        WINDOW_NAME,
        `width=${width}, height=${height}, top=${top}, left=${left}`
    );

    return childWindow;
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

export const openPrompt = async (url, fn, options) => {
    options = {
        width: 620,
        height: 700,
        ...options,
    };

    closePrompt();

    const childWindow = openWindow(url, options);

    const windowClosedPromise = monitorWindowClosed(childWindow, name);
    const waitConnectPromise = waitConnect(childWindow);

    try {
        await Promise.race([
            waitConnectPromise,
            windowClosedPromise,
        ]);
    } catch (err) {
        waitConnectPromise.cancel();
        windowClosedPromise.cancel();
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
        throw err;
    }

    windowClosedPromise.cancel();

    return resultPromise;
};

export const closePrompt = () => {
    if (childWindow) {
        childWindow.close();
        childWindow = undefined;
    }
};

window.addEventListener('unload', closePrompt);
