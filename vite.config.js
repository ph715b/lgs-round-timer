// ============================================================
// vite.config.js
// Multi-page app — index.html (main) + popout.html (pop-outs).
//
// IMPORTANT: base must be './' so that when Electron loads
// dist/index.html from disk (file://) all asset paths are
// relative and resolve correctly. A leading '/' would break it.
// ============================================================

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',   // ← relative paths — required for Electron file:// loading

  build: {
    outDir:      'dist',
    emptyOutDir: true,
    sourcemap:   false,
    rollupOptions: {
      input: {
        main:   resolve(__dirname, 'index.html'),
        popout: resolve(__dirname, 'popout.html'),
      },
    },
  },

  server: {
    port: 5173,
    open: true,
  },
});