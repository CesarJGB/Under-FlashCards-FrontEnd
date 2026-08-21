import { defineConfig } from 'vite';
import { createRealAppViteConfig } from '../vite-real-app.config.js';

const fullstack = process.env.UNDER_FLASH_APP_FULLSTACK === '1';

export default defineConfig(createRealAppViteConfig({
  port: 3200,
  fullstack,
  backendUrl: process.env.UNDER_FLASH_APP_BACKEND_URL,
}));
