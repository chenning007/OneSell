/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Remove strict CSP meta tag in dev mode — Vite's HMR needs inline scripts
    {
      name: 'dev-csp-bypass',
      transformIndexHtml(html) {
        if (process.env.NODE_ENV === 'production') return html;
        return html.replace(
          /<meta\s+http-equiv="Content-Security-Policy"[^>]*\/?\s*>/,
          '<!-- CSP disabled in dev mode for Vite HMR -->',
        );
      },
    },
  ],
  // Use relative paths so Electron can load the built renderer via file://
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
