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
        // The Anthropic SDK is only ever imported dynamically
        // (src/engine/ai/assistant.ts), so Rollup already splits it into its own
        // chunk that loads on first use; this only names that chunk. Do not
        // reintroduce a manualChunks rule for it: that pulled Vite's preload
        // helper into the SDK chunk, and the entry then imported the whole SDK
        // eagerly on every page load.
        chunkFileNames: (chunk) =>
          chunk.moduleIds.some((id) => id.includes('@anthropic-ai/sdk')) ? 'assets/anthropic-sdk-[hash].js' : 'assets/[name]-[hash].js',
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
