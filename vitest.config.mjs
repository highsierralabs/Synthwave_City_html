// Unit tests are pure logic in the node environment: tests/**/*.test.ts and tests/**/*.test.mjs.
export default {
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
  },
  define: { DEV: 'true' },
};
