import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiPort } from './config/runtime.ts';

import { createApp } from './app.ts';

export { createApp } from './app.ts';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(apiPort, '127.0.0.1', () =>
    console.log(`Forma API: http://127.0.0.1:${apiPort}`),
  );
}
