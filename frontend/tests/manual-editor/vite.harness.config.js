import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  server: {
    hmr: false,
  },
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./harness.html', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
});
