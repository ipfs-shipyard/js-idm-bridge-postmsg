import { waitConnect } from './communication/window-channel';

let childIframe;

export const destroyIframe = () => {
    if (childIframe) {
        childIframe.remove();
        childIframe = undefined;
    }
};

export const createIframe = async (url, options) => {
    destroyIframe();

    const { origin } = new URL(url);

    childIframe = document.createElement('iframe');
    childIframe.id = 'idm-bridge-postmsg';
    childIframe.src = url;
    childIframe.style = 'position:absolute;width:0;height:0;border:0';

    document.body.appendChild(childIframe);

    const channel = await waitConnect(childIframe.contentWindow, {
        ...options,
        childOrigin: origin,
    });

    return channel;
};
