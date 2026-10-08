import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { webDist } from './config/runtime.ts';
import { dataRoot } from './infrastructure/storage/store.ts';

import { localAccess } from './http/middleware/local-access.ts';
import { requireJsonObject } from './http/middleware/json-body.ts';
import { handleError } from './http/middleware/error-handler.ts';
import { systemRouter } from './http/routes/system.ts';
import { agentRouter } from './http/routes/agent.ts';
import { projectsRouter } from './http/routes/projects.ts';
import { providersRouter } from './http/routes/providers.ts';
import { generationRouter } from './http/routes/generation.ts';
import { workspaceRouter } from './http/routes/workspace.ts';
import { brandRouter } from './http/routes/brand.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(localAccess);
  app.use(express.json({ limit: '25mb' }));
  app.use(requireJsonObject);
  app.use(systemRouter);
  app.use(agentRouter);
  app.use(projectsRouter);
  app.use(providersRouter);
  app.use(generationRouter);
  app.use(brandRouter);
  app.use(workspaceRouter);
  app.use(
    '/api/assets',
    express.static(path.join(dataRoot, 'assets'), {
      dotfiles: 'deny',
      fallthrough: false,
      immutable: true,
      maxAge: '1y',
    }),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API 路径不存在。' }));
  const dist = webDist;
  if (existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(handleError);
  return app;
}
