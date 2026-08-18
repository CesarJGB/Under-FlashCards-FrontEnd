// Harness Vite dirigido para los tests Playwright de la pantalla publica / login.
// Sirve la APLICACION REAL (index.html raiz del frontend), no un mock.
// - Puerto fijo 3100 (strictPort) para no chocar con el dev server (3000).
// - hmr desactivado para evitar el HMR wss:443 de produccion (Cloudflare).
// - Carga las variables VITE_/REACT_APP_ desde .env.local (incluye VITE_GOOGLE_CLIENT_ID).
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
    host: '127.0.0.1',
    port: 3100,
    strictPort: true,
    hmr: false,
  },
  worker: {
    format: 'es',
  },
});
