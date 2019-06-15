import { waitConnect } from './communication/message-channel';

let childIframe;

export const destroyIframe = () => {
    if (childIframe) {
        childIframe.remove();
        childIframe = undefined;
    }
};

export const createIframe = async (url) => {
    destroyIframe();

    childIframe = document.createElement('iframe');
    childIframe.id = 'idm-bridge-postmsg';
    childIframe.src = url;
    childIframe.style = 'width:0;height:0;border:0';

    document.body.appendChild(childIframe);

    const { messagePort } = await waitConnect(childIframe.contentWindow);

    return messagePort;
};
