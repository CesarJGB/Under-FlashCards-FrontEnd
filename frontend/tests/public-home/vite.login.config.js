// Harness Vite dirigido para los tests Playwright de la pantalla publica / login.
// Sirve la APLICACION REAL (index.html raiz del frontend), no un mock.
// - Puerto fijo 3100 (strictPort) para no chocar con el dev server (3000).
// - hmr desactivado para evitar el HMR wss:443 de produccion (Cloudflare).
// - Carga las variables VITE_/REACT_APP_ desde .env.local (incluye VITE_GOOGLE_CLIENT_ID).
import { defineConfig } from 'vite';
import { createRealAppViteConfig } from '../vite-real-app.config.js';

export default defineConfig(createRealAppViteConfig({ port: 3100 }));
