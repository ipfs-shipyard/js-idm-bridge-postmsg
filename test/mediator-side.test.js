import { createMediatorSide, hasParent } from '../src';

it('should export createMediatorSide', async () => {
    expect(typeof createMediatorSide).toBe('function');
});

it('should export hasParent', async () => {
    expect(typeof hasParent).toBe('function');
});
