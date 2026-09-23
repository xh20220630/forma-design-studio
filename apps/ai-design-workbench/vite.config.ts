import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { assetsDir: 'static' },
  server: { port: 5176, proxy: { '/api': 'http://127.0.0.1:4311', '/assets': 'http://127.0.0.1:4311' } },
});
