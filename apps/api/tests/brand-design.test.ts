import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Project } from '@forma/schema';

const directory = await mkdtemp(path.join(os.tmpdir(), 'forma-brand-test-'));
process.env.FORMA_DATA_DIR = directory;
delete process.env.OPENAI_API_KEY;
delete process.env.FORMA_AGENT_TOKEN;
const { createApp } = await import('../src/app.ts');
const { brandSvg, validateBrandVector, migrateBrandDesign } = await import(
  '../src/domain/brand-design.ts'
);
const { brandExportFiles, zipBrandFiles } = await import('../src/services/brand-export.ts');
const requests: { route: string; body: string }[] = [];
let failImage = false;
let maliciousVector = false;
let plan: { message: string; actions: Record<string, unknown>[] } = { message: '', actions: [] };
let onModelRequest: (() => Promise<void>) | undefined;
const vector = {
  width: 512,
  height: 512,
  paths: [{ d: 'M64 64H448V448H64ZM128 128V384H384V128Z', fill: '#000000', fillRule: 'evenodd' }],
};
const image =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=';
const upstream = http
  .createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ route: req.url!, body });
    res.setHeader('Content-Type', 'application/json');
    if (onModelRequest) {
      const operation = onModelRequest;
      onModelRequest = undefined;
      await operation();
    }
    if (req.url?.includes('/images/')) {
      if (failImage) {
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: { message: 'test image unavailable' } }));
      }
      return res.end(JSON.stringify({ data: [{ b64_json: image }] }));
    }
    const input = JSON.parse(body);
    const result = input.messages[0].content.includes('Reconstruct the supplied logo')
      ? maliciousVector
        ? { ...vector, paths: [{ ...vector.paths[0], d: 'M0 0"/><script>alert(1)</script>' }] }
        : vector
      : plan;
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }));
  })
  .listen(0, '127.0.0.1');
const server = createApp().listen(0, '127.0.0.1');
await Promise.all(
  [server, upstream].map((item) => new Promise<void>((resolve) => item.once('listening', resolve))),
);
const port = (item: http.Server) => (item.address() as AddressInfo).port;
async function api(route: string, body?: unknown, method = body ? 'POST' : 'GET') {
  const response = await fetch(`http://127.0.0.1:${port(server)}/api${route}`, {
    method,
    ...(body
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  return { status: response.status, body: await response.json() };
}
const fixture = (id: string) => ({
  id,
  name: '品牌测试',
  description: '',
  category: 'Design',
  status: 'draft',
  themeId: 'test',
  tokens: {
    primary: '#000000',
    background: '#ffffff',
    surface: '#ffffff',
    text: '#000000',
    muted: '#666666',
    border: '#eeeeee',
    radius: 8,
    spacing: 8,
    fontFamily: 'Inter',
  },
  pages: [{ id: 'page', name: '已有页面', width: 1440, height: 900, nodes: [] }],
  components: [],
  revision: 0,
  cover: 'blank',
  updatedAt: new Date().toISOString(),
});
await api('/settings', {
  baseUrl: `http://127.0.0.1:${port(upstream)}/v1`,
  apiKey: 'test-only',
  textModel: 'planner',
  imageModel: 'image',
});
after(async () => {
  await Promise.all(
    [server, upstream].map((item) => new Promise<void>((resolve) => item.close(() => resolve()))),
  );
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('forma-brand-test-'));
  await rm(directory, { recursive: true, force: true });
});

test('brand design is an isolated conversation using the full guide, without a brief or approval gate', async () => {
  let project: Project = (await api('/projects/brand-chat', fixture('brand-chat'), 'PUT')).body;
  const session = (await api('/agent/sessions', { projectId: project.id, mode: 'brand' })).body;
  const design = (await api('/agent/sessions', { projectId: project.id })).body;
  assert.equal(
    (await api(`/agent/sessions?projectId=${project.id}&mode=brand`)).body.sessions[0].id,
    session.id,
  );
  assert.equal(
    (await api(`/agent/sessions?projectId=${project.id}`)).body.sessions[0].id,
    design.id,
  );
  assert.equal((await api('/agent/sessions', { mode: 'brand' })).status, 400);
  assert.equal((await api('/agent/sessions', { mode: 'unknown' })).status, 400);
  const turn = async (content: string, expected = 200) => {
    const result = await api(`/agent/sessions/${session.id}/messages`, {
      content,
      projectRevision: project.revision,
    });
    assert.equal(result.status, expected, result.body.error);
    if (result.body.project) project = result.body.project;
    return result.body;
  };
  plan = {
    message: '用对话边界与检索命中表达多聊，先给你一版黑白设计。',
    actions: [
      {
        type: 'generate_brand_image',
        name: '多聊 · 检索命中',
        prompt: '多聊是群聊与搜索平台，黑白，保留聊天和搜索含义，用定位边界代替放大镜。',
      },
    ],
  };
  const first = await turn('设计多聊的品牌 Logo，黑白高级感，聊天与搜索结合，不一定用放大镜。');
  assert.equal(first.message.content, plan.message);
  assert.equal(first.message.actions[0].status, 'completed');
  const original = project.brandDesign!.artifacts[0];
  assert.equal(first.message.actions[0].brandArtifactId, original.id);
  assert.equal(project.generation, undefined);
  assert.equal(project.generationPlan, undefined);
  assert.equal(project.pages[0].name, '已有页面');
  assert.equal(project.brandDesign!.adoptedArtifactId, undefined);
  const guide = await readFile(
    new URL('../../../docs/brand/ai-logo-brand-design-guide.md', import.meta.url),
    'utf8',
  );
  const plannerRequest = requests.find((request) => request.route === '/v1/chat/completions')!;
  assert.ok(JSON.parse(plannerRequest.body).messages[0].content.includes(guide));
  assert.ok(JSON.parse(plannerRequest.body).messages[0].content.includes('不要罗列问卷'));
  assert.ok(!JSON.parse(plannerRequest.body).messages[0].content.includes('UI design must follow'));

  plan = {
    message: '保留黑白气质，去掉圆圈，用命中的文字线索保留搜索含义。',
    actions: [
      {
        type: 'generate_brand_image',
        name: '多聊 · 修改稿',
        parentArtifactId: original.id,
        prompt: '保留黑白和对话尾部，去掉装饰圆圈，保留搜索含义。',
      },
    ],
  };
  await turn('旁边的圆圈意义不明，去掉，但是别丢了搜索含义。');
  const refined = project.brandDesign!.artifacts.at(-1)!;
  assert.equal(refined.parentId, original.id);
  assert.equal(project.brandDesign!.artifacts.length, 2);
  assert.ok(
    requests.some(
      (request) =>
        request.route === '/v1/images/edits' &&
        request.body.includes('reference.png') &&
        request.body.includes('去掉装饰圆圈'),
    ),
  );

  plan = {
    message: '整理这一版的 SVG。',
    actions: [{ type: 'vectorize_brand_logo', artifactId: 'latest' }],
  };
  maliciousVector = true;
  await turn('给我 SVG', 502);
  maliciousVector = false;
  assert.equal(project.brandDesign!.artifacts.length, 2);
  await turn('重新给我 SVG');
  const editable = project.brandDesign!.artifacts.at(-1)!;
  assert.deepEqual(editable.vector, vector);
  assert.equal(editable.parentId, refined.id);
  assert.equal(project.brandDesign!.adoptedArtifactId, undefined);
  assert.equal(brandExportFiles(project, editable.id).length, 4);
  const download = await fetch(
    `http://127.0.0.1:${port(server)}/api/projects/${project.id}/brand/export?artifactId=${editable.id}`,
  );
  assert.equal(download.status, 200);
  const zip = Buffer.from(await download.arrayBuffer());
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), 4);
  assert.equal(
    (await api(`/projects/${project.id}/brand/export?artifactId=${original.id}`)).status,
    409,
  );
  assert.equal((await api(`/projects/${project.id}/brand/export?artifactId=missing`)).status, 404);

  plan = {
    message: '将这版用作项目标志。',
    actions: [{ type: 'adopt_brand_logo', artifactId: editable.id }],
  };
  await turn('就用这一版作为当前项目 Logo');
  assert.equal(project.brandDesign!.adoptedArtifactId, editable.id);
  const saved = (
    await api(
      `/projects/${project.id}`,
      { ...project, name: '更新项目名', brandDesign: undefined },
      'PUT',
    )
  ).body;
  assert.equal(saved.brandDesign.adoptedArtifactId, editable.id);
  project = saved;
  const restored = (await api(`/agent/sessions/${session.id}`)).body;
  assert.equal(restored.mode, 'brand');
  assert.equal(restored.messages[1].actions[0].brandArtifactId, original.id);

  const count = requests.length;
  const review = await api(`/agent/sessions/${session.id}/messages`, {
    action: {
      type: 'approve_image',
      projectId: project.id,
      revision: project.revision,
      imageUrl: original.imageUrl,
    },
  });
  assert.equal(review.status, 400);
  assert.equal(requests.length, count);
  plan = {
    message: '越界操作',
    actions: [{ type: 'update_tokens', tokens: { primary: '#ff0000' } }],
  };
  await turn('不修改页面数据', 502);
  plan = {
    message: '越界操作',
    actions: [{ type: 'generate_brand_image', name: 'bad', prompt: 'bad' }],
  };
  assert.equal(
    (await api(`/agent/sessions/${design.id}/messages`, { content: '测试普通对话边界' })).status,
    502,
  );
  plan = { message: '这版的检索边界承载搜索含义，黑白配色可以保留。', actions: [] };
  const advice = await turn('只解释一下构思，不生成新图');
  assert.equal(advice.message.content, plan.message);
  assert.deepEqual(advice.message.actions, []);
});

test('image failure and concurrent project changes preserve existing brand assets', async () => {
  let project: Project = (await api('/projects/brand-failure', fixture('brand-failure'), 'PUT'))
    .body;
  const session = (await api('/agent/sessions', { projectId: project.id, mode: 'brand' })).body;
  plan = {
    message: '生成品牌图',
    actions: [{ type: 'generate_brand_image', name: '草稿', prompt: '清爽品牌图' }],
  };
  failImage = true;
  const failure = await api(`/agent/sessions/${session.id}/messages`, { content: '生成一个标志' });
  failImage = false;
  assert.equal(failure.status, 502);
  assert.equal(failure.body.message.status, 'failed');
  assert.equal(failure.body.project.brandDesign, undefined);
  onModelRequest = async () => {
    project = (
      await api(`/projects/${project.id}`, { ...project, name: '并发保留的新名称' }, 'PUT')
    ).body;
  };
  const conflict = await api(`/agent/sessions/${session.id}/messages`, { content: '再试一次' });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.project.name, '并发保留的新名称');
  assert.equal(conflict.body.project.brandDesign, undefined);
});

test('earlier form-based works migrate without losing briefs, history or adopted logo', () => {
  const old = {
    brief: { name: '多聊' },
    rounds: [],
    revisions: [
      {
        id: 'old',
        imageUrl: '/api/assets/old.png',
        width: 512,
        height: 512,
        prompt: '黑白标志',
        createdAt: new Date().toISOString(),
        vector,
      },
    ],
    approvedRevisionId: 'old',
  };
  const migrated = migrateBrandDesign(old);
  assert.equal(migrated.artifacts[0].id, 'old');
  assert.equal(migrated.adoptedArtifactId, 'old');
  assert.deepEqual(migrated.legacy, old);
  assert.throws(() =>
    validateBrandVector({
      ...vector,
      paths: [{ ...vector.paths[0], fill: 'url(https://example.com)' }],
    }),
  );
  assert.match(brandSvg(validateBrandVector(vector), true), /fill="#FFFFFF"/);
  assert.equal(
    zipBrandFiles([
      { name: 'logo.svg', content: brandSvg(validateBrandVector(vector)) },
    ]).readUInt32LE(0),
    0x04034b50,
  );
});
