import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { docsPreview } from './tooling/docs-preview';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const docsRoot = fileURLToPath(new URL('../../docs', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, 'FORMA_');
  const apiPort = process.env.FORMA_PORT || env.FORMA_PORT || '4310';
  return {
    envDir: repositoryRoot,
    plugins: [docsPreview(docsRoot), react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      // Shared packages and design studies must resolve the application's runtime.
      dedupe: ['react', 'react-dom', 'motion', 'lucide-react', '@fontsource-variable/geist'],
    },
    server: { port: 5173, fs: { allow: [repositoryRoot] }, proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
    build: {
      rollupOptions: {
        output: {
          // Explicit entry groups let Rollup order shared runtime dependencies without blanket vendor rules.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
            'vendor-motion': ['motion/react'],
          },
        },
      },
    },
  };
});
