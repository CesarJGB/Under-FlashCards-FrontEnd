import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
// THIS BREAKS THE AUTH. Backend URL and client id come from .env.
export default defineConfig({
  plugins: [react()],
  // Allow both Vite-style and CRA-style env var names from .env.
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
  },
});
