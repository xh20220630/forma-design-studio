import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:4310' } },
  build: {
    rollupOptions: {
      output: {
        // Explicit entry groups let Rollup order shared runtime dependencies without blanket vendor rules.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'scheduler'],
          'vendor-radix': ['radix-ui'],
          'vendor-motion': ['motion/react'],
        },
      },
    },
  },
});
