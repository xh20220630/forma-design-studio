import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

const root = await mkdtemp(path.join(os.tmpdir(), 'forma-local-provider-'));
process.env.FORMA_DATA_DIR = root;
delete process.env.FORMA_AGENT_TOKEN;
const fixture = await readFile(
  fileURLToPath(
    new URL('../../../packages/local-agent-bridge/tests/helpers/agent.mjs', import.meta.url),
  ),
  'utf8',
);
await writeFile(path.join(root, 'agent.mjs'), fixture);
if (process.platform === 'win32')
  await writeFile(path.join(root, 'codex.cmd'), '@echo off\n"%dp0%\\agent.mjs" %*');
else
  await writeFile(path.join(root, 'codex'), `#!${process.execPath}\n${fixture}`, { mode: 0o755 });
process.env.PATH = root + path.delimiter + process.env.PATH;
const { createApp } = await import('../src/app.ts');
const { generateJson } = await import('../src/services/generation.ts');
const { getPrivateProvider, resolveModel } = await import(
  '../src/infrastructure/providers/settings.ts'
);
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
const api = async (route: string, data?: unknown) => {
  const response = await fetch(
    base + route,
    data === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
  );
  return { status: response.status, body: await response.json() };
};
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
});

test('local discovery, persistence, model selection and design JSON use the CLI bridge', async () => {
  const detected = await api('/local-agents');
  assert.equal(detected.status, 200);
  assert.equal(
    detected.body.agents.find((agent: any) => agent.id === 'codex').version,
    'fixture-agent 1.0',
  );
  const saved = await api('/providers', {
    name: 'Local Codex',
    textProtocol: 'local-agent',
    localAgent: { agentId: 'codex' },
    apiKey: 'must-not-be-stored',
    headers: { 'X-Private': 'must-not-be-stored' },
  });
  assert.equal(saved.status, 201);
  const provider = saved.body.providers.at(-1);
  assert.equal(provider.baseUrl, 'local-agent://codex');
  assert.equal(provider.imageProtocol, 'local-agent');
  assert.equal(provider.localAgent.reasoningEffort, 'medium');
  assert.equal(provider.localAgent.reconstructionTimeoutMs, 600000);
  assert.equal(provider.auth, 'none');
  assert.equal(provider.hasApiKey, false);
  assert.deepEqual(provider.headerNames, []);
  assert.equal((await getPrivateProvider(provider.id)).apiKey, '');
  const selected = await api('/settings/models', {
    text: { providerId: provider.id, model: 'default' },
  });
  assert.equal(selected.body.configured, true);
  assert.equal(selected.body.imageConfigured, true);
  assert.equal(selected.body.imageFollowsText, true);
  assert.equal(selected.body.effectiveImage.providerId, provider.id);
  assert.equal(
    (
      await generateJson([
        { role: 'system', content: 'Return JSON' },
        { role: 'user', content: 'Describe UI' },
      ])
    ).reply,
    '桥梁连接成功 🌉',
  );
  const models = await api(`/providers/${provider.id}/models`);
  assert.deepEqual(
    models.body.models.map((model: any) => model.id),
    ['available-model', 'available-model-2'],
  );
  assert.equal(models.body.source, 'cli');
  const probe = await api('/providers/probe', { id: provider.id });
  assert.equal(probe.status, 200);
  const reply = await api('/providers/local-test', { id: provider.id });
  assert.equal(reply.status, 200);
  assert.equal(JSON.parse(reply.body.text).reply, '桥梁连接成功 🌉');
  assert.equal(
    (await api('/settings/models', { image: { providerId: provider.id, model: 'default' } }))
      .status,
    200,
  );
});

test('visual reconstruction uses its own deadline while chat deadlines remain enforced and diagnosed', async () => {
  const original = (await api('/settings')).body;
  const saved = await api('/providers', {
    name: 'Deadline Codex',
    textProtocol: 'local-agent',
    timeoutMs: 1000,
    localAgent: { agentId: 'codex', reasoningEffort: 'low', reconstructionTimeoutMs: 3000 },
  });
  const provider = saved.body.providers.at(-1);
  try {
    await api('/settings/models', { text: { providerId: provider.id, model: 'slow-design' } });
    await assert.rejects(generateJson([{ role: 'user', content: 'Hello' }]), (error: any) => {
      assert.equal(error.errorDetails.code, 'request_timeout');
      assert.equal(error.errorDetails.timeoutMs, 1000);
      assert.equal(error.errorDetails.operation, 'chat');
      assert.equal(error.errorDetails.upstreamStatus, undefined);
      return true;
    });
    const reconstructed = await generateJson(
      [{ role: 'user', content: 'Describe UI' }],
      'reconstruction',
    );
    assert.equal(reconstructed.reasoningEffort, 'model_reasoning_effort="low"');
    const { generateImage, generateDesign } = await import('../src/services/generation.ts');
    const { validateProject } = await import('../src/services/validation.ts');
    const project = validateProject({
      id: 'deadline-project',
      name: 'Deadline test',
      description: '',
      category: 'SaaS',
      status: 'draft',
      themeId: 'violet',
      tokens: {
        primary: '#8b5cf6',
        background: '#ffffff',
        surface: '#ffffff',
        text: '#111111',
        muted: '#777777',
        border: '#eeeeee',
        radius: 8,
        spacing: 8,
        fontFamily: 'Inter',
      },
      pages: [],
      components: [],
      revision: 0,
      updatedAt: new Date().toISOString(),
      cover: 'blank',
    });
    project.generation = { ...(await generateImage(project, 'Generate UI')), approved: true };
    const result = await generateDesign(project);
    assert.equal(result.pages[0].id, 'reconstructed');
    assert.equal(project.generation.approved, true);
  } finally {
    await api('/settings/models', { text: original.text, image: original.image });
  }
});

test('built-in generation saves a real image, retains approval, migrates old Codex connections and preserves explicit image providers', async () => {
  const settings = await api('/settings');
  const provider = settings.body.providers.find((item: any) => item.name === 'Local Codex');
  await api('/settings/models', { image: { providerId: '', model: '' } });
  const { validateProject } = await import('../src/services/validation.ts');
  const { mutateProject } = await import('../src/infrastructure/storage/store.ts');
  const project = validateProject({
    id: 'builtin-image-project',
    name: 'Image test',
    description: '',
    category: 'SaaS',
    status: 'draft',
    themeId: 'violet',
    tokens: {
      primary: '#8b5cf6',
      background: '#ffffff',
      surface: '#ffffff',
      text: '#111111',
      muted: '#777777',
      border: '#eeeeee',
      radius: 8,
      spacing: 8,
      fontFamily: 'Inter',
    },
    pages: [],
    components: [],
    revision: 0,
    updatedAt: new Date().toISOString(),
    cover: 'blank',
  });
  await mutateProject(project.id, () => project, { create: true });
  const generated = await api('/generate/image', {
    projectId: project.id,
    prompt: 'Generate a blue UI',
    pages: [{ name: 'Home', prompt: 'Generate a blue UI', width: 1440, height: 1000 }],
  });
  assert.equal(generated.status, 200);
  assert.equal(generated.body.project.generation.approved, false);
  assert.equal(generated.body.project.generation.width, 1);
  assert.equal(
    (await fetch(base.replace('/api', '') + generated.body.imageUrl)).headers.get('content-type'),
    'image/png',
  );
  assert.equal((await api('/generate/design', { projectId: project.id })).status, 409);
  assert.equal((await api('/generate/approve', { projectId: project.id })).status, 200);
  const persisted = JSON.parse(await readFile(path.join(root, 'settings.json'), 'utf8'));
  persisted.providers.find((item: any) => item.id === provider.id).imageProtocol = 'none';
  await writeFile(path.join(root, 'settings.json'), JSON.stringify(persisted));
  assert.equal((await api('/settings')).body.imageConfigured, true);
  const remote = await api('/providers', {
    name: 'Explicit image provider',
    baseUrl: 'http://localhost:1234/v1',
    auth: 'none',
    imageProtocol: 'openai-images',
  });
  const remoteId = remote.body.providers.at(-1).id;
  await api('/settings/models', { image: { providerId: remoteId, model: 'image-model' } });
  assert.equal((await resolveModel('image')).provider.id, remoteId);
  await api('/settings/models', { image: { providerId: '', model: '' } });
  assert.equal((await resolveModel('image')).provider.id, provider.id);
  await api('/settings/models', { text: { providerId: provider.id, model: 'unsupported-model' } });
  const failed = await api('/generate/image', {
    projectId: project.id,
    prompt: 'Draw UI',
    pages: [{ name: 'Home', prompt: 'Draw UI', width: 1440, height: 1000 }],
  });
  assert.equal(failed.body.errorDetails.channel, 'image');
  assert.equal(failed.body.errorDetails.upstreamStatus, 400);
  assert.equal(failed.body.errorDetails.code, 'model_unavailable');
  await api('/settings/models', { text: { providerId: provider.id, model: 'default' } });
});

test('model errors are recorded with upstream status, persist in chat, and switching uses the new model', async () => {
  const saved = await api('/providers', {
    name: 'Recovery Codex',
    textProtocol: 'local-agent',
    localAgent: { agentId: 'codex' },
  });
  const provider = saved.body.providers.at(-1);
  await api('/settings/models', { text: { providerId: provider.id, model: 'unsupported-model' } });
  const failed = await api('/providers/local-test', { id: provider.id });
  assert.equal(failed.status, 502);
  assert.equal(failed.body.errorDetails.upstreamStatus, 400);
  assert.equal(failed.body.errorDetails.code, 'model_unavailable');
  assert.equal(failed.body.errorDetails.model, 'unsupported-model');
  const created = await api('/agent/sessions', { scope: 'global' });
  const turn = await api(`/agent/sessions/${created.body.id}/messages`, {
    content: '你好',
    sessionRevision: created.body.revision,
  });
  assert.equal(turn.status, 502);
  assert.equal(turn.body.message.errorDetails.code, 'model_unavailable');
  assert.deepEqual(turn.body.errorDetails, turn.body.message.errorDetails);
  await api('/settings/models', { text: { providerId: provider.id, model: 'available-model' } });
  const repaired = await api('/providers/local-test', { id: provider.id });
  assert.equal(repaired.status, 200);
  assert.equal(JSON.parse(repaired.body.text).model, 'available-model');
  const history = await api(`/agent/sessions/${created.body.id}`);
  assert.equal(history.body.messages.at(-1).errorDetails.model, 'unsupported-model');
  const records = JSON.parse(await readFile(path.join(root, 'model-request-errors.json'), 'utf8'));
  assert.equal(records.at(-1).upstreamStatus, 400);
  await api('/settings/models', { text: { providerId: provider.id, model: 'bad-parameter' } });
  const invalid = await api('/providers/local-test', { id: provider.id });
  assert.equal(invalid.body.errorDetails.code, 'invalid_request');
  assert.equal(invalid.body.errorDetails.upstreamStatus, 400);
});

test('browser input cannot introduce commands, shell arguments, arbitrary paths, or unknown agent IDs', async () => {
  for (const localAgent of [
    { agentId: 'unknown' },
    { agentId: 'codex', executable: 'arbitrary' },
    { agentId: 'codex', args: ['--dangerously-bypass-approvals-and-sandbox'] },
    { agentId: 'codex', cwd: root },
    { agentId: 'codex', reasoningEffort: 'unsafe"; command' },
    { agentId: 'codex', reconstructionTimeoutMs: 600001 },
    { agentId: 'codex', reconstructionTimeoutMs: '600000' },
  ]) {
    assert.equal(
      (await api('/providers', { name: 'Rejected', textProtocol: 'local-agent', localAgent }))
        .status,
      400,
    );
  }
  assert.equal(
    (await api('/providers', { name: 'Missing Agent', textProtocol: 'local-agent' })).status,
    400,
  );
});

test('parameter errors mentioning a model are not mistaken for model availability and recorded errors redact credentials', async () => {
  const { modelRequestError } = await import('../src/infrastructure/providers/diagnostics.ts');
  const { validateProvider } = await import('../src/infrastructure/providers/settings.ts');
  const provider = validateProvider({
    name: 'Private upstream',
    baseUrl: 'http://127.0.0.1:1234/v1',
    apiKey: 'secret-credential',
    headers: { 'X-Private': 'secret-header' },
  });
  const parameterError = await modelRequestError(
    provider,
    'valid-model',
    'text',
    "The model 'valid-model' uses a parameter that is not supported: max_tokens; secret-credential secret-header",
    400,
  );
  assert.equal(parameterError.errorDetails?.code, 'invalid_request');
  const unavailable = await modelRequestError(
    provider,
    'removed-model',
    'image',
    'Request rejected',
    400,
    'unsupported_model',
  );
  assert.equal(unavailable.errorDetails?.code, 'model_unavailable');
  assert.equal(unavailable.errorDetails?.channel, 'image');
  const records = await readFile(path.join(root, 'model-request-errors.json'), 'utf8');
  assert.ok(!records.includes('secret-credential'));
  assert.ok(!records.includes('secret-header'));
  assert.ok(records.includes('[REDACTED]'));
});
