import { defineConfig, type ViteDevServer, type PreviewServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = fileURLToPath(new URL('../../../..', import.meta.url));
const localProjects = (server: ViteDevServer | PreviewServer) => {
  server.middlewares.use('/record', async (request, response) => {
    if (request.method !== 'POST' || request.headers.origin !== 'http://127.0.0.1:5188') {
      response.statusCode = 403;
      response.end();
      return;
    }
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 8_000_000) {
        response.statusCode = 413;
        response.end();
        return;
      }
    }
    await writeFile(join(tmpdir(), 'forma-performance-latest.json'), body);
    response.end('saved');
  });
  server.middlewares.use('/local-projects.json', async (_request, response) => {
    try {
      const data = await readFile(join(repository, '.data/projects.json'), 'utf8');
      response.setHeader('Content-Type', 'application/json');
      response.end(data);
    } catch {
      response.setHeader('Content-Type', 'application/json');
      response.end('{"projects":[]}');
    }
  });
};

export default defineConfig({
  root,
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  cacheDir: join(tmpdir(), 'forma-performance-vite-cache'),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-performance-fixtures',
      configureServer: localProjects,
      configurePreviewServer: localProjects,
    },
  ],
  resolve: { dedupe: ['react', 'react-dom', 'motion', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 5188, strictPort: true, fs: { allow: [repository] } },
  preview: { host: '127.0.0.1', port: 5188, strictPort: true },
  build: { outDir: join(tmpdir(), 'forma-performance-dist'), emptyOutDir: true },
});
