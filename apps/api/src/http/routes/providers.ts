import { getProviderSettings, saveProviderSettings } from '../../services/generation.ts';
import {
  saveProvider,
  deleteProvider,
  getPrivateProvider,
  validateProvider,
  saveModelBindings,
} from '../../infrastructure/providers/settings.ts';
import { listProviderModels } from '../../infrastructure/providers/transport.ts';
import { Router } from 'express';
import type { ApiRequest } from '../types.ts';

export const providersRouter = Router();

providersRouter.get('/api/settings', async (_req, res) => res.json(await getProviderSettings()));

providersRouter.post('/api/settings', async (req: ApiRequest, res) =>
  res.json(await saveProviderSettings(req.body)),
);

providersRouter.post('/api/providers', async (req: ApiRequest, res) =>
  res.status(201).json(await saveProvider(req.body)),
);

providersRouter.put('/api/providers/:id', async (req: ApiRequest, res) =>
  res.json(await saveProvider(req.body, req.params.id)),
);

providersRouter.delete('/api/providers/:id', async (req: ApiRequest, res) =>
  res.json(await deleteProvider(req.params.id)),
);

providersRouter.post('/api/settings/models', async (req: ApiRequest, res) =>
  res.json(await saveModelBindings(req.body)),
);

providersRouter.get('/api/providers/:id/models', async (req: ApiRequest, res) =>
  res.json(await listProviderModels(await getPrivateProvider(req.params.id))),
);

providersRouter.post('/api/providers/probe', async (req: ApiRequest, res) => {
  const current =
    typeof req.body.id === 'string' ? await getPrivateProvider(req.body.id) : undefined;
  const provider = validateProvider(req.body, current);
  const start = Date.now();
  const result = await listProviderModels(provider);
  res.json({ ...result, latencyMs: Date.now() - start });
});
