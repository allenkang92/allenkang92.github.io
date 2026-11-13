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
    // 배포 전에 열린 이전 HTML이 참조하는 해시 번들도 보존한다.
    emptyOutDir: false,
    manifest: 'manifest.json',
    rollupOptions: {
      input: resolve(projectRoot, 'frontend/posts/main.tsx'),
    },
  },
});
