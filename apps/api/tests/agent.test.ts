import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = await mkdtemp(path.join(os.tmpdir(), 'forma-agent-test-'));
process.env.FORMA_DATA_DIR = path.join(directory, 'data');
delete process.env.OPENAI_API_KEY;
delete process.env.FORMA_AGENT_TOKEN;
const { createApp } = await import('../src/index.ts');
const tokens = { primary: '#0d99ff', background: '#f5f5f5', surface: '#ffffff', text: '#202124', muted: '#737373', border: '#e5e5e5', radius: 8, fontFamily: 'Inter, sans-serif', spacing: 8 };
const fixture = id => ({ id, name: id, description: '', category: 'Web App', status: 'draft', themeId: 'test', tokens: { ...tokens }, pages: [{ id: 'home', name: 'Home', width: 1000, height: 800, nodes: [{ id: 'title', name: 'Title', type: 'text', x: 20, y: 20, width: 200, height: 30, text: 'Existing', tokenBindings: { color: 'text' } }] }], components: [], revision: 0, updatedAt: new Date().toISOString(), cover: 'blank' });
const server = createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
async function api(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
const plans = [];
const providerRequests = [];
const provider = http.createServer(async (req, res) => {
  try {
    let body = ''; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body); providerRequests.push(input);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/images/generations') return res.end(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=' }] }));
    let output;
    if (Array.isArray(input.messages?.[1]?.content)) output = { pages: fixture('vision').pages, components: [] };
    else { const planned = plans.shift(); assert.ok(planned, 'Unexpected provider request'); output = typeof planned === 'function' ? await planned(input) : planned; }
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }));
  } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: { message: error.message } })); }
}).listen(0, '127.0.0.1');
await new Promise(resolve => provider.once('listening', resolve));
const configure = () => api('/settings', 'POST', { apiKey: 'agent-test-secret', baseUrl: `http://127.0.0.1:${provider.address().port}/v1`, textModel: 'test-planner', imageModel: 'test-image' });
const plan = actions => ({ message: '准备执行请求。', actions });
after(async () => {
  await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => provider.close(resolve))]);
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('forma-agent-test-'));
  await rm(directory, { recursive: true, force: true });
});

test('provider errors and real conversation history persist across a new process', async () => {
  const session = (await api('/agent/sessions', 'POST', {})).body;
  const reply = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '帮我设计一个应用' });
  assert.equal(reply.status, 400); assert.match(reply.body.error, /API Key/);
  assert.equal(reply.body.message.status, 'failed');
  assert.equal(reply.body.session.messages.length, 2);
  const child = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', "import {getAgentSession} from './src/agent.ts'; process.stdout.write(JSON.stringify(await getAgentSession(process.argv[1])));", session.id], { cwd: fileURLToPath(new URL('../', import.meta.url)), env: process.env });
  const restarted = JSON.parse(child.stdout);
  assert.deepEqual(restarted.messages, reply.body.session.messages);
  assert.equal((await api('/agent/sessions')).body.sessions[0].id, session.id);
  await configure();
});

test('global chat creates a bound project, tokens, variables and reusable components', async () => {
  const session = (await api('/agent/sessions', 'POST', {})).body;
  plans.push(plan([{ type: 'create_project', name: 'Agent app' }, { type: 'update_tokens', tokens: { primary: '#334455' } }, { type: 'create_variables', collection: { id: 'semantic', name: 'Semantic', modes: ['light', 'dark'], variables: [{ id: 'accent', name: 'Accent', type: 'color', values: { light: '#334455', dark: '#ffffff' } }] } }, { type: 'create_component', component: { id: 'agent-button', name: 'Button', width: 120, height: 40, nodes: [{ id: 'button', name: 'Button', type: 'button', x: 0, y: 0, width: 120, height: 40, text: 'Continue', tokenBindings: { fill: 'primary' }, variableBindings: { color: { collectionId: 'semantic', variableId: 'accent' } } }] } } ]));
  const reply = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '创建项目，设置主题变量并添加按钮组件', sessionRevision: 0 });
  assert.equal(reply.status, 200);
  assert.equal(reply.body.project.tokens.primary, '#334455');
  assert.equal(reply.body.project.tokens.surface, tokens.surface);
  assert.equal(reply.body.project.components[0].nodes[0].tokenBindings.fill, 'primary');
  assert.equal(reply.body.project.variableCollections[0].variables[0].values.dark, '#ffffff');
  assert.equal(reply.body.session.scope, 'global');
  assert.equal(reply.body.session.projectId, reply.body.project.id);
  assert.equal(reply.body.message.actions.length, 4);
  assert.ok(reply.body.message.actions.every(action => action.status === 'completed'));
  const persisted = (await api(`/projects/${reply.body.project.id}`)).body;
  assert.equal(persisted.components[0].id, 'agent-button');
  assert.equal(persisted.revision, 4);
  assert.equal((await api(`/agent/sessions?projectId=${persisted.id}`)).body.sessions.length, 0);
  const followup = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '过时消息', sessionRevision: 0 });
  assert.equal(followup.status, 409);
});

test('project chat isolates scope and keeps active theme modes and bindings consistent', async () => {
  const initial = fixture('scope-a'); initial.themeModes = { dark: { ...tokens, background: '#101010' } }; initial.activeMode = 'dark';
  const first = (await api('/projects/scope-a', 'PUT', initial)).body;
  const second = (await api('/projects/scope-b', 'PUT', fixture('scope-b'))).body;
  const session = (await api('/agent/sessions', 'POST', { projectId: first.id })).body;
  plans.push(plan([{ type: 'update_tokens', tokens: { primary: '#abcdef' } }]));
  const reply = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '修改主色', projectRevision: first.revision });
  assert.equal(reply.status, 200); assert.equal(reply.body.project.themeModes.dark.primary, '#abcdef');
  assert.equal(reply.body.project.tokens.background, '#101010');
  assert.equal(reply.body.project.pages[0].nodes[0].tokenBindings.color, 'text');
  plans.push(plan([{ type: 'update_tokens', projectId: second.id, tokens: { primary: '#ff0000' } }]));
  const crossScope = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '修改其他项目' });
  assert.equal(crossScope.status, 409);
  assert.equal((await api('/projects/scope-b')).body.tokens.primary, tokens.primary);
  plans.push(plan([{ type: 'create_project', name: 'Forbidden' }]));
  assert.equal((await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '创建另一个项目' })).status, 409);
  assert.equal((await api(`/agent/sessions?projectId=${first.id}`)).body.sessions[0].id, session.id);
  assert.ok(!(await api('/agent/sessions')).body.sessions.some(item => item.id === session.id));
});

test('model planning cannot approve images and explicit image review gates reconstruction', async () => {
  const project = (await api('/projects/image-chat', 'PUT', fixture('image-chat'))).body;
  const session = (await api('/agent/sessions', 'POST', { projectId: project.id })).body;
  plans.push(plan([{ type: 'approve_image' }]));
  assert.equal((await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '模型自行批准' })).status, 502);
  plans.push(plan([{ type: 'reconstruct_design' }]));
  assert.equal((await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '跳过图片' })).status, 409);
  plans.push(plan([{ type: 'generate_image', prompt: 'Dashboard for this project' }]));
  const generated = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '生成 UI 设计图' });
  assert.equal(generated.status, 200); assert.equal(generated.body.project.generation.approved, false);
  assert.equal(generated.body.message.actions[0].status, 'awaiting-approval');
  const imageUrl = generated.body.project.generation.imageUrl;
  const wrong = await api(`/agent/sessions/${session.id}/messages`, 'POST', { action: { type: 'approve_image', projectId: project.id, revision: generated.body.project.revision, imageUrl: '/api/assets/wrong.png' } });
  assert.equal(wrong.status, 409);
  const approved = await api(`/agent/sessions/${session.id}/messages`, 'POST', { action: { type: 'approve_image', projectId: project.id, revision: generated.body.project.revision, imageUrl } });
  assert.equal(approved.status, 200); assert.equal(approved.body.project.generation.approved, true);
  const reconstructed = await api(`/agent/sessions/${session.id}/messages`, 'POST', { action: { type: 'reconstruct_design', projectId: project.id, revision: approved.body.project.revision, imageUrl } });
  assert.equal(reconstructed.status, 200); assert.equal(reconstructed.body.project.pages[0].nodes[0].text, 'Existing');
  assert.ok(providerRequests.some(request => Array.isArray(request.messages?.[1]?.content)));
});

test('concurrent project changes reject a stale planned mutation and preserve actual state', async () => {
  const project = (await api('/projects/stale-chat', 'PUT', fixture('stale-chat'))).body;
  const session = (await api('/agent/sessions', 'POST', { projectId: project.id })).body;
  plans.push(async () => {
    const update = await api(`/projects/${project.id}`, 'PUT', { ...project, name: 'Changed elsewhere' });
    assert.equal(update.status, 200);
    return plan([{ type: 'update_tokens', tokens: { primary: '#ff0000' } }]);
  });
  const reply = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '修改主色' });
  assert.equal(reply.status, 409); assert.equal(reply.body.message.actions[0].status, 'failed');
  const stored = (await api(`/projects/${project.id}`)).body;
  assert.equal(stored.name, 'Changed elsewhere'); assert.equal(stored.tokens.primary, tokens.primary);
  assert.equal(reply.body.project.name, 'Changed elsewhere'); assert.equal(reply.body.project.revision, stored.revision);
});

test('sync requires a reviewed session preview and rejects stale revisions or file changes', async () => {
  let project = (await api('/projects/sync-chat', 'PUT', fixture('sync-chat'))).body;
  const workspace = path.join(directory, 'workspace'); await mkdir(workspace);
  project = (await api('/workspace/bind', 'POST', { projectId: project.id, kind: 'local', path: workspace })).body.project;
  const session = (await api('/agent/sessions', 'POST', { projectId: project.id })).body;
  const fabricated = await api(`/agent/sessions/${session.id}/messages`, 'POST', { action: { type: 'apply_sync', projectId: project.id, revision: project.revision, previewId: 'fabricated' } });
  assert.equal(fabricated.status, 409);
  plans.push(plan([{ type: 'preview_sync' }]));
  const preview = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '同步设计到代码' });
  assert.equal(preview.status, 200); assert.equal(preview.body.syncPreview.files.length, 5);
  const stale = await api(`/agent/sessions/${session.id}/messages`, 'POST', { action: { type: 'apply_sync', projectId: project.id, revision: project.revision - 1, previewId: preview.body.syncPreview.previewId } });
  assert.equal(stale.status, 409);
  const applied = await api(`/agent/sessions/${session.id}/messages`, 'POST', { action: { type: 'apply_sync', projectId: project.id, revision: project.revision, previewId: preview.body.syncPreview.previewId } });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.message.actions[0].previewId, preview.body.syncPreview.previewId);
  assert.match(await readFile(path.join(workspace, 'forma-generated', 'index.tsx'), 'utf8'), /FormaPage/);
  const replay = await api(`/agent/sessions/${session.id}/messages`, 'POST', { action: { type: 'apply_sync', projectId: project.id, revision: project.revision, previewId: preview.body.syncPreview.previewId } });
  assert.equal(replay.status, 409);
  plans.push(plan([{ type: 'preview_sync' }]));
  const second = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '再次预览' });
  await writeFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'manual change');
  const changed = await api(`/agent/sessions/${session.id}/messages`, 'POST', { action: { type: 'apply_sync', projectId: project.id, revision: project.revision, previewId: second.body.syncPreview.previewId } });
  assert.equal(changed.status, 409); assert.match(changed.body.error, /预览后/);
  assert.equal(await readFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'utf8'), 'manual change');
});

test('chat mutations respect established automatic sync without bypassing first manual synchronization', async () => {
  let project = (await api('/projects/auto-chat', 'PUT', fixture('auto-chat'))).body;
  const workspace = path.join(directory, 'auto-workspace'); await mkdir(workspace);
  project = (await api('/workspace/bind', 'POST', { projectId: project.id, kind: 'local', path: workspace })).body.project;
  project = (await api(`/projects/${project.id}`, 'PUT', { ...project, workspace: { ...project.workspace, autoSync: true } })).body;
  const session = (await api('/agent/sessions', 'POST', { projectId: project.id })).body;
  plans.push(plan([{ type: 'update_tokens', tokens: { primary: '#010203' } }]));
  const beforeFirstSync = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '更新主题' });
  assert.equal(beforeFirstSync.status, 200); assert.equal(beforeFirstSync.body.message.actions[0].autoSynced, undefined);
  await assert.rejects(() => readFile(path.join(workspace, 'forma-generated', 'tokens.css')), { code: 'ENOENT' });
  project = (await api('/sync/apply', 'POST', { projectId: project.id, revision: beforeFirstSync.body.project.revision })).body.project;
  plans.push(plan([{ type: 'update_tokens', tokens: { primary: '#040506' } }]));
  const automatic = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '再次更新主题' });
  assert.equal(automatic.status, 200); assert.equal(automatic.body.message.actions[0].autoSynced, true);
  assert.equal(automatic.body.project.lastSyncedRevision, automatic.body.project.revision);
  assert.match(await readFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'utf8'), /#040506/);
  await writeFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'manual edit');
  plans.push(plan([{ type: 'update_tokens', tokens: { primary: '#070809' } }]));
  const conflicted = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '保留设计修改但保护本地文件' });
  assert.equal(conflicted.status, 200); assert.equal(conflicted.body.project.tokens.primary, '#070809');
  assert.match(conflicted.body.message.actions[0].syncWarning, /本地修改/);
  assert.equal(await readFile(path.join(workspace, 'forma-generated', 'tokens.css'), 'utf8'), 'manual edit');
});

test('a session rejects a second turn while its model request is still running', async () => {
  const project = (await api('/projects/busy-chat', 'PUT', fixture('busy-chat'))).body;
  const session = (await api('/agent/sessions', 'POST', { projectId: project.id })).body;
  let begin, release;
  const entered = new Promise(resolve => { begin = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  plans.push(async () => { begin(); await gate; return plan([]); });
  const first = api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '第一条消息' });
  await entered;
  try {
    const second = await api(`/agent/sessions/${session.id}/messages`, 'POST', { content: '第二条消息' });
    assert.equal(second.status, 409);
    assert.equal((await api(`/agent/sessions/${session.id}`)).body.messages.at(-1).status, 'pending');
  } finally { release(); }
  assert.equal((await first).status, 200);
});
