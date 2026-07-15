import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes('commonjsHelpers')) return 'vendor-runtime';
          if (id.includes('/pdfjs-dist/') || id.includes('/pdf-lib/')) {
            return 'pdf-libs';
          }
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('/zustand/') || id.includes('/@tanstack/react-query/')) {
            return 'state';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
});
