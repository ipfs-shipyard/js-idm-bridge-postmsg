# idm-bridge-postmsg

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][codecov-image]][codecov-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url]

[npm-url]:https://npmjs.org/package/idm-bridge-postmsg
[downloads-image]:http://img.shields.io/npm/dm/idm-bridge-postmsg.svg
[npm-image]:http://img.shields.io/npm/v/idm-bridge-postmsg.svg
[travis-url]:https://travis-ci.org/ipfs-shipyard/js-idm-bridge-postmsg
[travis-image]:http://img.shields.io/travis/ipfs-shipyard/js-idm-bridge-postmsg/master.svg
[codecov-url]:https://codecov.io/gh/ipfs-shipyard/js-idm-bridge-postmsg
[codecov-image]:https://img.shields.io/codecov/c/github/ipfs-shipyard/js-idm-bridge-postmsg/master.svg
[david-dm-url]:https://david-dm.org/ipfs-shipyard/js-idm-bridge-postmsg
[david-dm-image]:https://img.shields.io/david/ipfs-shipyard/js-idm-bridge-postmsg.svg
[david-dm-dev-url]:https://david-dm.org/ipfs-shipyard/js-idm-bridge-postmsg?type=dev
[david-dm-dev-image]:https://img.shields.io/david/dev/ipfs-shipyard/js-idm-bridge-postmsg.svg

The [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) bridge to be used by both IDM Wallets and IDM Clients.


## Installation

```sh
$ npm install idm-bridge-postmsg
```

This library is written in modern JavaScript and is published in both CommonJS and ES module transpiled variants. If you target older browsers please make sure to transpile accordingly.


## Usage

**On the client-side of the bridge:**

```js
import { createClientSide } from 'idm-bridge-postmsg';

const app = {
    name: 'My app name',
    iconUrl: 'https://my.app.com/favicon.png',
    homepageUrl: 'https://my.app.com',
};

const idmWalletUrl = 'http://nomios.io';

await (async () => {
    const clientSide = await createClientSide(app, idmWalletUrl);
})();
```

**On the mediator-side of the bridge (operating on the wallet domain):**

```js
import { createMediatorSide } from 'idm-bridge-postmsg';

await (async () => {
    const mediatorSide = await createMediatorSide();

    mediatorSide.setPrompts({
        unlock: ({ pristine, lockTypes, unlockFn }) => {
            // Show the lock screen and unlock with `unlockFn(lockType, input)`

            // response = { ok };
            return response;
        },
        authenticate: async ({ app, identities }) => {
            // Show a prompt to either accept or deny
            const response = await promptToAcceptAndChooseIdentity(app, identities);

            // response = { ok, identityId };
            return response;
        },
        sign: async ({ app, identity, data }) => {
            // Show a prompt to either accept or deny
            const response = await promptToAcceptSigning(app, identity, data);

            // response = { ok };
            return response;
        },
    });
})();
```

**On the wallet-side of the bridge:**

```js
import { createWalletSide } from 'idm-bridge-postmsg';
import createIdmWallet from 'idm-wallet';

await (async () => {
    const idmWallet = await createIdmWallet();
    const walletSide = await createWalletSide(idmWallet);
})();
```

*NOTE*: To know if you either must use `createMediatorSide` or `createWalletSide` you may use the `hasParent` function:

```js
import { hasParent } from 'idm-bridge-postmsg';

if (hasParent()) {
    // Create mediator side
} else {
    // Create wallet side
}
```


## API

This library is following closely the [IDM Wallet Specification](https://github.com/ipfs-shipyard/pm-idm/blob/master/docs/idm-spec.md).

We will be providing proper API documentation once the both this library and the specification mature.


## Tests

```sh
$ npm test
$ npm test -- --watch # during development
```


## License

Released under the [MIT License](http://www.opensource.org/licenses/mit-license.php).
