import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export default defineConfig({
  root: here,
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}/` },
      { find: 'wxt/browser', replacement: path.resolve(here, 'browser-mock.ts') },
    ],
  },
  server: {
    port: 5180,
    strictPort: true,
  },
});
