import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));

export function createRealAppViteConfig({ port, fullstack = false, backendUrl } = {}) {
  if (!Number.isInteger(port)) {
    throw new Error('A fixed port is required for the real-app Vite server.');
  }

  if (fullstack && !backendUrl) {
    throw new Error('UNDER_FLASH_APP_BACKEND_URL is required for the full-stack Vite server.');
  }

  return {
    root: frontendRoot,
    plugins: [react()],
    envPrefix: ['VITE_', 'REACT_APP_'],
    resolve: {
      alias: {
        '@': sourceRoot,
      },
    },
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      hmr: false,
      ...(fullstack
        ? {
            proxy: {
              '/api': {
                target: backendUrl,
                changeOrigin: true,
                configure(proxy) {
                  proxy.on('proxyReq', (proxyRequest) => {
                    proxyRequest.removeHeader('origin');
                  });
                },
              },
            },
          }
        : {}),
    },
    worker: {
      format: 'es',
    },
  };
}
