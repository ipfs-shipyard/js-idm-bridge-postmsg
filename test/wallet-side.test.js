import { createWalletSide, hasParent } from '../src';

it('should export createWalletSide', async () => {
    expect(typeof createWalletSide).toBe('function');
});

it('should export hasParent', async () => {
    expect(typeof hasParent).toBe('function');
});
