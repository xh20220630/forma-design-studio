import { errorProperty } from './errors.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
try {
  process.loadEnvFile(path.join(repositoryRoot, '.env'));
} catch (error) {
  if (errorProperty(error, 'code') !== 'ENOENT') throw error;
}

// Package scripts run in apps/api; persisted data must stay at its pre-migration location.
export const dataRoot = path.resolve(repositoryRoot, process.env.FORMA_DATA_DIR || '.data');
export const webDist = path.join(repositoryRoot, 'apps/web/dist');

export const apiPort = Number(process.env.FORMA_PORT || 4310);
export const allowedOrigins = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  `http://127.0.0.1:${apiPort}`,
  `http://localhost:${apiPort}`,
  ...(process.env.FORMA_ALLOWED_ORIGINS || '').split(',').filter(Boolean),
]);
