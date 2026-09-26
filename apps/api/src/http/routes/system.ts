import { getState } from '../../infrastructure/storage/store.ts';
import { getProviderSettings } from '../../services/generation.ts';
import { Router } from 'express';

export const systemRouter = Router();

systemRouter.get('/api/health', async (_req, res) =>
  res.json({
    ok: true,
    service: 'forma',
    providerConfigured: (await getProviderSettings()).configured,
  }),
);

systemRouter.get('/api/state', async (_req, res) => res.json(await getState()));
