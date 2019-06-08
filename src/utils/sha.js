export const sha256 = async (input) => {
    // Hash the message, converting the input to an Uint8Array
    input = new TextEncoder('utf-8').encode(input);

    const hashBuffer = await crypto.subtle.digest('SHA-256', input);

    // Convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Convert bytes to hex string
    const hashHex = hashArray.map((b) => `00${b.toString(16)}`.slice(-2)).join('');

    return hashHex;
};
