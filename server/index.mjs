import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { apiPort, allowedOrigins } from './config.mjs';
import { ApiError, requireValue } from './errors.mjs';
import { dataRoot, findProject, getState, mutateProject, removeProject } from './store.mjs';
import { validateId, validateProject, requireApproved, requireCurrentImage } from './validate.mjs';
import { currentGeneration, designContextHash } from './design-context.mjs';
import { generateFiles, previewSync } from './exporter.mjs';
import { generateDesign, generateImage, generateTheme, getProviderSettings, saveProviderSettings } from './provider.mjs';
import { bindWorkspace } from './workspaces.mjs';
import { createAgentSession, getAgentSession, listAgentSessions, sendAgentMessage } from './agent.mjs';
import { maybeAutoSync, synchronize } from './sync.mjs';

function constantEqual(actual, expected) {
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp() {
  const app = express(); app.disable('x-powered-by');
  app.use((req, res, next) => {
    const hostname = req.hostname;
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) return res.status(403).json({ error: '仅允许本机访问。' });
    const origin = req.get('origin');
    if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: '请求来源未授权。' });
    if (origin) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization'); return res.sendStatus(204); }
    const token = process.env.FORMA_AGENT_TOKEN;
    if (token && !origin && req.get('sec-fetch-site') !== 'same-origin' && req.path.startsWith('/api') && req.path !== '/api/health') {
      const supplied = (req.get('authorization') || '').replace(/^Bearer /, '');
      if (!constantEqual(supplied, token)) return res.status(401).json({ error: '需要 Agent Bearer Token。' });
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ error: '请求必须使用 application/json。' });
    res.set('X-Content-Type-Options', 'nosniff'); next();
  });
  app.use(express.json({ limit: '25mb' }));
  app.use((req, _res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) requireValue(req.body && typeof req.body === 'object' && !Array.isArray(req.body), '请求 body 必须是 JSON 对象。');
    next();
  });
  app.get('/api/health', async (_req, res) => res.json({ ok: true, service: 'forma', providerConfigured: (await getProviderSettings()).configured }));
  app.get('/api/state', async (_req, res) => res.json(await getState()));
  app.get('/api/agent/sessions', async (req, res) => res.json({ sessions: await listAgentSessions(req.query.projectId) }));
  app.post('/api/agent/sessions', async (req, res) => res.status(201).json(await createAgentSession(req.body)));
  app.get('/api/agent/sessions/:id', async (req, res) => res.json(await getAgentSession(req.params.id)));
  app.post('/api/agent/sessions/:id/messages', async (req, res) => { const result = await sendAgentMessage(req.params.id, req.body); res.status(result.status).json(result.body); });
  app.get('/api/projects/:id', async (req, res) => res.json(await findProject(validateId(req.params.id))));
  app.put('/api/projects/:id', async (req, res) => {
    const id = validateId(req.params.id); requireValue(req.body.id === id, '路径 ID 与项目 ID 不一致。');
    const incoming = validateProject(req.body);
    let project = await mutateProject(id, current => {
      if (current) requireValue(Number(incoming.revision) === current.revision, '项目已被其他会话更新，请刷新后再保存。', 409);
      return { ...incoming, workspace: current?.workspace ? { ...current.workspace, autoSync: Boolean(incoming.workspace?.autoSync) } : undefined, generation: currentGeneration(current, incoming), lastSyncedRevision: current?.lastSyncedRevision, status: current?.status === 'synced' ? 'in-progress' : incoming.status || 'draft' };
    }, { create: true });
    const sync = await maybeAutoSync(project); project = sync.project;
    res.json({ ...project, ...(sync.syncWarning ? { syncWarning: sync.syncWarning } : {}) });
  });
  app.delete('/api/projects/:id', async (req, res) => { await removeProject(validateId(req.params.id)); res.json({ ok: true }); });
  app.get('/api/settings', async (_req, res) => res.json(await getProviderSettings()));
  app.post('/api/settings', async (req, res) => res.json(await saveProviderSettings(req.body)));
  app.post('/api/generate/image', async (req, res) => {
    const snapshot = await findProject(validateId(req.body.projectId));
    const generation = await generateImage(snapshot, req.body.prompt);
    const project = await mutateProject(snapshot.id, current => {
      requireValue(current.revision === snapshot.revision, '生成期间项目已变更，请重试以保持设计一致。', 409);
      return { ...current, generation, status: 'in-progress' };
    });
    res.json({ imageUrl: generation.imageUrl, project });
  });
  app.post('/api/generate/approve', async (req, res) => {
    const project = await mutateProject(validateId(req.body.projectId), current => {
      requireValue(current.generation?.imageUrl, '请先生成设计图。', 409);
      requireCurrentImage(current);
      return { ...current, generation: { ...current.generation, approved: true } };
    });
    res.json({ approved: true, project });
  });
  app.post('/api/generate/design', async (req, res) => {
    const snapshot = await findProject(validateId(req.body.projectId)); requireApproved(snapshot);
    const design = await generateDesign(snapshot, req.body.prompt);
    const project = await mutateProject(snapshot.id, current => {
      requireValue(current.revision === snapshot.revision, '还原期间项目已变更，请刷新后重试。', 409);
      const next = { ...current, ...design, status: 'in-progress' };
      next.generation = { ...current.generation, contextHash: designContextHash(next) };
      return next;
    });
    const sync = await maybeAutoSync(project);
    res.json({ ...design, ...sync });
  });
  app.post('/api/generate/theme', async (req, res) => res.json(await generateTheme(req.body.prompt)));
  app.post('/api/workspace/bind', async (req, res) => {
    const snapshot = await findProject(validateId(req.body.projectId));
    const workspace = await bindWorkspace(snapshot, req.body);
    const project = await mutateProject(snapshot.id, current => ({ ...current, workspace, lastSyncedRevision: undefined }));
    res.json({ workspace, project });
  });
  app.post('/api/sync/preview', async (req, res) => res.json(await previewSync(await findProject(validateId(req.body.projectId)))));
  app.post('/api/sync/apply', async (req, res) => res.json(await synchronize(validateId(req.body.projectId), { expectedRevision: req.body.revision })));
  app.get('/api/projects/:id/export', async (req, res) => {
    const project = await findProject(validateId(req.params.id));
    res.set('Content-Disposition', `attachment; filename="${project.id}-export.json"`);
    res.json({ projectId: project.id, revision: project.revision, files: generateFiles(project).map(file => ({ ...file, path: `forma-generated/${file.path}` })) });
  });
  app.use('/api/assets', express.static(path.join(dataRoot, 'assets'), { dotfiles: 'deny', fallthrough: false, immutable: true, maxAge: '1y' }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API 路径不存在。' }));
  const dist = path.resolve('dist');
  if (existsSync(path.join(dist, 'index.html'))) { app.use(express.static(dist)); app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html'))); }
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500 && !(error instanceof ApiError)) console.error(error.message);
    res.status(status).json({ error: error instanceof ApiError ? error.message : status === 400 ? '请求 JSON 格式无效。' : status === 413 ? '请求数据过大。' : status === 404 ? '资源不存在。' : '服务器无法完成请求，请查看终端日志。' });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(apiPort, '127.0.0.1', () => console.log(`Forma API: http://127.0.0.1:${apiPort}`));
}
