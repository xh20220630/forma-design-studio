import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const directory = await mkdtemp(path.join(os.tmpdir(), 'forma-page-generation-'));
process.env.FORMA_DATA_DIR = directory;
delete process.env.OPENAI_API_KEY;
delete process.env.FORMA_AGENT_TOKEN;
const { createApp } = await import('../src/app.ts');
const { preparePagePlan } = await import('../src/services/page-generation.ts');
const names = [
  '照护中心',
  '照护记录',
  '发现',
  '知识详情',
  '我的',
  '宠物档案',
  '编辑宠物资料',
  '陪豆包玩',
  '成长等级',
  '成长徽章',
  '健康记录',
  '新增健康记录',
  '体重管理',
  '疫苗与驱虫计划',
  '新增或编辑提醒',
  '成长相册',
  '消息中心',
  '设置',
];
const tasks = names.map((name) => ({
  name,
  prompt: `仅设计${name}页面的内容和控件`,
  width: 375,
  height: 812,
}));
const requests: Record<string, any>[] = [];
let failImages = false;
let invalidPlan = false;
const upstream = http
  .createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    requests.push({ route: req.url, ...input });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/images/generations') {
      if (failImages) {
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: { message: 'temporary image failure' } }));
      }
      return res.end(
        JSON.stringify({
          data: [
            {
              b64_json:
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
            },
          ],
        }),
      );
    }
    const output = Array.isArray(input.messages[1].content)
      ? {
          assets: [],
          components: [],
          pages: [
            {
              id: 'wrong-model-id',
              name: 'Wrong model name',
              width: 375,
              height: 812,
              nodes: [
                {
                  id: 'title',
                  name: '标题',
                  type: 'text',
                  x: 20,
                  y: 20,
                  width: 250,
                  height: 30,
                  text: 'Page content',
                },
              ],
            },
          ],
        }
      : input.messages[0].content.startsWith('You are Forma')
        ? {
            message: '按页面分别生成。',
            actions: [
              {
                type: 'generate_image',
                prompt: '宠物移动应用',
                styleGuide: '绿色宠物插画风格',
                pages: tasks,
              },
            ],
          }
        : {
            styleGuide: '绿色宠物插画风格，统一字体、导航和圆角',
            pages: invalidPlan ? [tasks[0], tasks[0]] : tasks,
          };
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }));
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
  name: '宠物小家',
  description: '',
  category: 'Mobile',
  status: 'draft',
  themeId: 'test',
  tokens: {
    primary: '#33795e',
    background: '#f5f7f6',
    surface: '#ffffff',
    text: '#233831',
    muted: '#829089',
    border: '#e5ebe7',
    radius: 8,
    spacing: 8,
    fontFamily: 'Inter',
  },
  pages: [
    {
      id: 'existing-page',
      name: '已有页面',
      width: 1440,
      height: 1000,
      nodes: [
        {
          id: 'existing-node',
          name: '已有内容',
          type: 'text',
          x: 20,
          y: 20,
          width: 200,
          height: 30,
          text: 'Keep me',
        },
      ],
    },
  ],
  components: [
    {
      id: 'shared-button',
      name: '共享按钮',
      description: '',
      category: 'Custom',
      width: 80,
      height: 30,
      nodes: [],
    },
  ],
  revision: 0,
  updatedAt: new Date().toISOString(),
  cover: 'blank',
});
after(async () => {
  await Promise.all(
    [server, upstream].map((item) => new Promise<void>((resolve) => item.close(() => resolve()))),
  );
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('forma-page-generation-'));
  await rm(directory, { recursive: true, force: true });
});

test('18 screens are generated, reviewed and reconstructed separately without replacing completed pages', async () => {
  await api('/settings', {
    baseUrl: `http://127.0.0.1:${port(upstream)}/v1`,
    apiKey: 'test-only',
    textModel: 'planner',
    imageModel: 'image',
  });
  await api('/projects/pages', fixture('pages'), 'PUT');
  const generated = await api('/generate/image', {
    projectId: 'pages',
    prompt: `设计一个宠物移动应用，包含${names.join('、')}`,
  });
  assert.equal(generated.status, 200, generated.body.error);
  let project = generated.body.project;
  const plan = project.generationPlan;
  assert.equal(plan.pages.length, 18);
  assert.deepEqual(
    plan.pages.map((page: any) => page.name),
    names,
  );
  assert.equal(requests.filter((item) => item.route === '/v1/images/generations').length, 1);
  const firstPrompt = requests.find((item) => item.route === '/v1/images/generations')!.prompt;
  assert.match(firstPrompt, /exactly ONE complete UI screen/);
  assert.match(firstPrompt, /375 × 812/);
  assert.match(firstPrompt, /Only page: 照护中心/);
  assert.ok(!firstPrompt.includes(tasks[1].prompt));
  assert.ok(!firstPrompt.includes('Only page: 照护记录'));
  const session = (await api('/agent/sessions', { projectId: project.id })).body;
  const review = async (action: Record<string, unknown>) =>
    api(`/agent/sessions/${session.id}/messages`, {
      action: { projectId: project.id, revision: project.revision, ...action },
    });
  assert.equal(
    (await review({ type: 'generate_page_image', planId: plan.id, pageId: plan.pages[1].id }))
      .status,
    409,
  );
  assert.equal((await api('/generate/design', { projectId: project.id })).status, 409);
  for (let index = 0; index < tasks.length; index++) {
    if (index > 0) {
      if (index === 1) {
        failImages = true;
        const failed = await review({
          type: 'generate_page_image',
          planId: plan.id,
          pageId: plan.pages[index].id,
        });
        assert.equal(failed.status, 502);
        assert.equal(
          failed.body.project.generationPlan.pages[0].reconstructedImageUrl,
          project.generation.imageUrl,
        );
        assert.equal(failed.body.project.pages.length, 2);
        failImages = false;
      }
      const next = await review({
        type: 'generate_page_image',
        planId: plan.id,
        pageId: plan.pages[index].id,
      });
      assert.equal(next.status, 200, next.body.error);
      project = next.body.project;
      assert.equal(project.generation.approved, false);
      assert.equal(project.generation.pageId, plan.pages[index].id);
      assert.equal(
        (await review({ type: 'approve_image', imageUrl: plan.pages[0].generation.imageUrl }))
          .status,
        409,
      );
    }
    const approved = await review({ type: 'approve_image', imageUrl: project.generation.imageUrl });
    assert.equal(approved.status, 200, approved.body.error);
    project = approved.body.project;
    const restored = await review({
      type: 'reconstruct_design',
      imageUrl: project.generation.imageUrl,
    });
    assert.equal(restored.status, 200, restored.body.error);
    project = restored.body.project;
    assert.equal(project.pages.length, index + 2);
    assert.deepEqual(project.pages[0], fixture('pages').pages[0]);
    assert.equal(project.pages[index + 1].id, plan.pages[index].id);
    assert.equal(project.pages[index + 1].name, names[index]);
    assert.equal(
      project.generationPlan.pages[index].reconstructedImageUrl,
      project.generation.imageUrl,
    );
    assert.equal(project.components[0].id, 'shared-button');
  }
  assert.equal(
    project.generationPlan.pages.filter((page: any) => page.reconstructedImageUrl).length,
    18,
  );
  assert.equal(
    new Set(project.generationPlan.pages.map((page: any) => page.generation.imageUrl)).size,
    18,
  );
  const vision = requests.filter((item) => Array.isArray(item.messages?.[1]?.content));
  assert.equal(vision.length, 18);
  for (const request of vision) {
    const context = request.messages[1].content[0].text;
    assert.equal(
      JSON.parse(context.slice(9, context.indexOf('\nApproved image request:'))).pages.length,
      1,
    );
    assert.equal(
      request.messages[1].content.filter((item: any) => item.type === 'image_url').length,
      1,
    );
  }
});

test('invalid page plans fail before spending on images and server-owned progress cannot be forged', async () => {
  await api('/projects/invalid-plan', fixture('invalid-plan'), 'PUT');
  const count = requests.filter((item) => item.route === '/v1/images/generations').length;
  invalidPlan = true;
  const failed = await api('/generate/image', {
    projectId: 'invalid-plan',
    prompt: 'Design pages',
  });
  invalidPlan = false;
  assert.equal(failed.status, 502);
  assert.match(failed.body.error, /名称重复/);
  assert.equal(requests.filter((item) => item.route === '/v1/images/generations').length, count);
  await assert.rejects(
    preparePagePlan(fixture('invalid-plan') as any, 'Design', [{ ...tasks[0], width: -1 }]),
    /尺寸/,
  );
  await assert.rejects(
    preparePagePlan(fixture('invalid-plan') as any, 'Design', [{ ...tasks[0], pageId: 'missing' }]),
    /不存在/,
  );
  const current = (await api('/projects/pages')).body;
  const forged = await api(
    '/projects/pages',
    { ...current, generationPlan: { id: 'forged', pages: [] } },
    'PUT',
  );
  assert.equal(forged.status, 200);
  assert.deepEqual(forged.body.generationPlan, current.generationPlan);
});

test('chat keeps all 18 pages in one action and a failed first image retains the queue for retry', async () => {
  await api('/projects/first-image-failure', fixture('first-image-failure'), 'PUT');
  const session = (await api('/agent/sessions', { projectId: 'first-image-failure' })).body;
  failImages = true;
  const failed = await api(`/agent/sessions/${session.id}/messages`, {
    content: '分别设计全部 18 页',
  });
  failImages = false;
  assert.equal(failed.status, 502);
  assert.equal(failed.body.project.generationPlan.pages.length, 18);
  assert.equal(failed.body.project.generation, undefined);
  assert.deepEqual(failed.body.project.pages, fixture('first-image-failure').pages);
  const count = requests.filter((item) => item.route === '/v1/images/generations').length;
  const retried = await api(`/agent/sessions/${session.id}/messages`, {
    action: {
      type: 'generate_page_image',
      projectId: 'first-image-failure',
      revision: failed.body.project.revision,
      planId: failed.body.project.generationPlan.id,
      pageId: failed.body.project.generationPlan.pages[0].id,
    },
  });
  assert.equal(retried.status, 200, retried.body.error);
  assert.equal(
    requests.filter((item) => item.route === '/v1/images/generations').length,
    count + 1,
  );
  assert.equal(retried.body.project.generationPlan.id, failed.body.project.generationPlan.id);
  assert.equal(retried.body.project.generationPlan.pages.length, 18);
});
