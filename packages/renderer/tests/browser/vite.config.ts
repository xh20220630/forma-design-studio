import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: join(tmpdir(), 'forma-renderer-vite-cache'),
  server: {
    host: '127.0.0.1',
    port: 5187,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../../../..', import.meta.url))] },
  },
};
