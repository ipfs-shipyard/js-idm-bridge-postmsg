const getParentWindow = () => {
    const parentWindow = window.opener || window.parent;

    return parentWindow && parentWindow !== self ? parentWindow : null;
};

export default getParentWindow;
