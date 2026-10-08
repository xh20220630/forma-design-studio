import { getProviderSettings, saveProviderSettings } from '../../services/generation.ts';
import {
  saveProvider,
  deleteProvider,
  getPrivateProvider,
  validateProvider,
  saveModelBindings,
} from '../../infrastructure/providers/settings.ts';
import { listProviderModels } from '../../infrastructure/providers/transport.ts';
import {
  discoverLocalAgents,
  requestLocalAgent,
} from '../../infrastructure/providers/local-agent.ts';
import { requireValue } from '../../shared/errors.ts';
import { Router } from 'express';
import type { ApiRequest } from '../types.ts';

export const providersRouter = Router();

providersRouter.get('/api/local-agents', async (_req, res) =>
  res.json({ agents: await discoverLocalAgents() }),
);

providersRouter.post('/api/providers/local-test', async (req: ApiRequest, res) => {
  const provider = await getPrivateProvider(String(req.body.id || ''));
  requireValue(provider.textProtocol === 'local-agent', '请选择本地 Agent 连接。');
  const controller = new AbortController();
  res.once('close', () => {
    if (!res.writableEnded) controller.abort(new Error('测试对话已取消。'));
  });
  const start = Date.now();
  const settings = await getProviderSettings();
  const model = settings.text.providerId === provider.id ? settings.text.model : 'default';
  const text = await requestLocalAgent(
    provider,
    model,
    [{ role: 'user', content: 'Reply with exactly: Forma local agent bridge connected.' }],
    controller.signal,
  );
  res.json({ text, latencyMs: Date.now() - start });
});

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
