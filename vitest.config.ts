import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        '**/__tests__/**',
      ],
      thresholds: {
        // Audited baseline ratchet. Keep the gate executable and raise these
        // values only with behavior-focused tests instead of coverage filler.
        statements: 42,
        branches: 37,
        functions: 37,
        lines: 44,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@pdflover/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@pdflover/pdf-core': path.resolve(__dirname, 'packages/pdf-core/src'),
      '@': path.resolve(__dirname, 'apps/web/src'),
    },
  },
});
