import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/money.ts', 'src/lib/invoice-transition-types.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
