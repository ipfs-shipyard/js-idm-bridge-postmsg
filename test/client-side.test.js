import { createClientSide } from '../src';

it('should export createClientSide', async () => {
    expect(typeof createClientSide).toBe('function');
});
