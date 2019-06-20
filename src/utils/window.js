import { debounce } from 'lodash';

export const getParentWindow = () => {
    const parentWindow = window.opener || window.parent;

    return parentWindow && parentWindow !== self ? parentWindow : null;
};

export const setupWindow = (minWidth, minHeight) => {
    // Ignore in case of iframe
    if (!window.opener) {
        return;
    }

    const updateSize = () => {
        const width = Math.max(window.innerWidth, minWidth);
        const height = Math.max(window.innerHeight, minHeight);

        if (window.innerWidth !== width || window.innerHeight !== height) {
            const widthDiff = window.outerWidth - window.innerWidth;
            const heightDiff = window.outerHeight - window.innerHeight;

            window.resizeTo(width + widthDiff, height + heightDiff);
        }
    };

    updateSize();

    const handleResize = debounce(updateSize, 500);
    const handleUnload = () => window.close();

    window.addEventListener('unload', handleUnload);
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('unload', handleUnload);
        window.removeEventListener('resize', handleResize);
    };
};
