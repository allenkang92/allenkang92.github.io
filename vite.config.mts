import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/assets/js/dist/',
  build: {
    outDir: resolve(projectRoot, 'assets/js/dist'),
    emptyOutDir: true,
    manifest: 'manifest.json',
    rollupOptions: {
      input: resolve(projectRoot, 'frontend/posts/main.tsx'),
    },
  },
});
