import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { pwaPrecache } from './vite/pwa-precache';
import { csp } from './vite/csp';

// BASE_PATH lets the same build be served from a sub-path (e.g. GitHub Pages
// serves the repo at /<repo>/). Defaults to root for local dev/preview.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [pwaPrecache(), csp()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
      '@shell': fileURLToPath(new URL('./src/shell', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Keep the Anthropic SDK in its own chunk so it is only downloaded when
        // a module actually invokes the AI hook (see src/engine/ai/assistant.ts).
        manualChunks(id) {
          if (id.includes('@anthropic-ai/sdk')) return 'anthropic-sdk';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
