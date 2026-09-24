import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = await mkdtemp(path.join(os.tmpdir(), 'forma-generation-contract-'));
process.env.FORMA_DATA_DIR = root;
delete process.env.FORMA_AGENT_TOKEN;
const { createApp } = await import('../src/index.ts');
const tokens = {
  primary: '#0070f3',
  background: '#ffffff',
  surface: '#ffffff',
  text: '#111111',
  muted: '#777777',
  border: '#eeeeee',
  radius: 8,
  spacing: 8,
  fontFamily: 'Inter, sans-serif',
};
const node = {
  id: 'title',
  name: 'Title',
  type: 'text',
  x: 20,
  y: 20,
  width: 250,
  height: 40,
  text: 'Forma',
  fontWeight: '700',
  tokenBindings: { color: 'text', border: 'border' },
  strokeWidth: 1,
};
let output: unknown = {
  assets: [],
  pages: [{ id: 'home', name: 'Home', width: 1440, height: 1000, nodes: [node] }],
  components: [
    {
      id: 'label',
      name: 'Label',
      description: '',
      category: 'Custom',
      width: 250,
      height: 40,
      nodes: [{ ...node, fontWeight: 'bold' }],
    },
  ],
};
const upstream = http
  .createServer(
    /**
     * 执行generation-contract.test传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 完成当前异步操作的 Promise，不携带业务数据。
     */
    async (req, res) => {
      for await (const _ of req) {
        /* consume request */
      }
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify(
          req.url?.endsWith('/images/generations')
            ? {
                data: [
                  {
                    b64_json:
                      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
                  },
                ],
              }
            : { choices: [{ message: { content: JSON.stringify(output) } }] },
        ),
      );
    },
  )
  .listen(0, '127.0.0.1');
const server = createApp().listen(0, '127.0.0.1');
await Promise.all(
  [server, upstream].map(
    /**
     * 转换generation-contract.test中的集合条目，供后续处理或展示。
     *
     * @param s - 当前遍历的状态或文本片段。
     * @returns 当前条目转换后的结果。
     */
    (s) =>
      new Promise<void>(
        /** 把generation-contract.test中的回调式操作接入 Promise，以便调用方等待完成或处理失败。 @param resolve - 异步操作成功时调用的完成函数。 @returns 无返回值；通过 resolve 或 reject 结束等待。 */
        (resolve) => s.once('listening', resolve),
      ),
  ),
);
/**
 * 读取临时服务实际监听端口，避免固定端口发生冲突。
 *
 * @param s - 当前遍历的状态或文本片段。
 * @returns 服务正在使用的端口号。
 */
const port = (s: http.Server) => (s.address() as import('node:net').AddressInfo).port;
/**
 * 统一请求 API 并转换失败响应，使调用方只处理业务数据。
 *
 * @param route - 要请求的接口路径。
 * @param body - 请求正文或文档内容。
 * @param method - HTTP 请求方法。
 * @returns 解析后的 API 响应。
 */
async function api(route: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`http://127.0.0.1:${port(server)}/api${route}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  return { status: response.status, body: await response.json() };
}
after(
  /**
   * 组织当前场景的准备或清理步骤。
   * @returns 完成当前检查或生命周期操作。
   */
  async () => {
    await Promise.all(
      [server, upstream].map(
        /**
         * 转换generation-contract.test中的集合条目，供后续处理或展示。
         *
         * @param s - 当前遍历的状态或文本片段。
         * @returns 当前条目转换后的结果。
         */
        (s) =>
          new Promise<void>(
            /**
             * 把generation-contract.test中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
             *
             * @param resolve - 异步操作成功时调用的完成函数。
             * @returns 无返回值；通过 resolve 或 reject 结束等待。
             */
            (resolve) =>
              s.close(
                /** 执行generation-contract.test传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 无返回值；通过副作用完成当前操作。 */
                () => resolve(),
              ),
          ),
      ),
    );
    await rm(root, { recursive: true, force: true });
  },
);
/**
 * 验证image reconstruction adapts unambiguous model field representations and still rejects invalid graphs。
 * @returns 完成当前检查或生命周期操作。
 */
test('image reconstruction adapts unambiguous model field representations and still rejects invalid graphs', async () => {
  await api('/settings', {
    baseUrl: `http://127.0.0.1:${port(upstream)}/v1`,
    apiKey: 'test-only',
    textModel: 'vision',
    imageModel: 'image',
  });
  const project = {
    id: 'contract',
    name: 'Contract',
    description: '',
    category: 'Web',
    status: 'draft',
    themeId: 'custom',
    tokens,
    pages: [{ id: 'home', name: 'Home', width: 1440, height: 1000, nodes: [] }],
    components: [],
    revision: 0,
    updatedAt: new Date().toISOString(),
    cover: 'blank',
  };
  assert.equal((await api('/projects/contract', project, 'PUT')).status, 200);
  assert.equal(
    (
      await api('/generate/image', {
        projectId: 'contract',
        prompt: 'A landing page',
      })
    ).status,
    200,
  );
  assert.equal((await api('/generate/approve', { projectId: 'contract' })).status, 200);
  const restored = await api('/generate/design', { projectId: 'contract' });
  assert.equal(restored.status, 200, restored.body.error);
  assert.equal(restored.body.pages[0].nodes[0].fontWeight, 700);
  assert.equal(restored.body.components[0].nodes[0].fontWeight, 700);
  assert.equal(restored.body.pages[0].nodes[0].tokenBindings.stroke, 'border');
  assert.equal(restored.body.pages[0].nodes[0].tokenBindings.border, undefined);
  const revision = restored.body.project.revision;
  output = {
    assets: [],
    pages: [{ ...project.pages[0], nodes: [{ ...node, fontWeight: '1500' }] }],
    components: [],
  };
  await rm(path.join(root, 'reconstructions'), {
    recursive: true,
    force: true,
  });
  const invalid = await api('/generate/design', { projectId: 'contract' });
  assert.equal(invalid.status, 502);
  assert.match(invalid.body.error, /字重/);
  assert.equal((await api('/projects/contract')).body.revision, revision);
  output = {
    assets: [],
    pages: [
      {
        ...project.pages[0],
        nodes: [
          {
            ...node,
            fontWeight: 700,
            tokenBindings: { stroke: 'primary', border: 'border' },
          },
        ],
      },
    ],
    components: [],
  };
  assert.equal((await api('/generate/design', { projectId: 'contract' })).status, 502);
  output = {
    assets: [],
    pages: [
      {
        ...project.pages[0],
        nodes: [{ ...node, fontWeight: 700, tokenBindings: { border: 'spacing' } }],
      },
    ],
    components: [],
  };
  assert.equal((await api('/generate/design', { projectId: 'contract' })).status, 502);
});
