import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(os.tmpdir(), 'forma-assets-'));
process.env.FORMA_DATA_DIR = root;
delete process.env.FORMA_AGENT_TOKEN;
const { createApp } = await import('../src/index.ts');
const { requestImage } = await import('../src/provider-transport.ts');
const { resolveModel } = await import('../src/provider-settings.ts');
/** 集中维护 { reconstructWithAssets, getReconstructionStatus } 的约定值或当前状态，供相关分支保持一致。 */
const { reconstructWithAssets, getReconstructionStatus } = await import('../src/reconstruction.ts');
const { generateFiles } = await import('../src/exporter.ts');
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=';
const tokens = {
  primary: '#0070f3',
  background: '#ffffff',
  surface: '#ffffff',
  text: '#111111',
  muted: '#777777',
  border: '#eeeeee',
  radius: 8,
  spacing: 8,
  fontFamily: 'Inter',
};
const regions = ['hero', 'feature'].map(
  /** 转换 reconstruction.test 中的集合条目，供后续处理或展示。 @param id - 唯一标识，用于查找、更新和建立引用。 @param i - 当前循环位置，从 0 开始。 @returns 当前条目转换后的结果。 */
  (id, i) => ({
    id,
    name: id,
    prompt: `Recreate ${id} product panel`,
    background: i ? 'transparent' : 'opaque',
    bounds: { x: 0, y: i * 0.5, width: 0.5, height: 0.5 },
  }),
);
const plan = {
  pages: [
    {
      id: 'home',
      name: 'Home',
      width: 1200,
      height: 1200,
      nodes: [
        {
          id: 'heading',
          name: 'Heading',
          type: 'text',
          x: 0,
          y: 0,
          width: 300,
          height: 40,
          text: 'Editable heading',
        },
        ...regions.map(
          /**
           * 转换 reconstruction.test 中的集合条目，供后续处理或展示。
           *
           * @param asset - 当前图片素材记录。
           * @param i - 当前循环位置，从 0 开始。
           * @returns 当前条目转换后的结果。
           */
          (asset, i) => ({
            id: asset.id,
            name: asset.name,
            type: 'image',
            x: 30,
            y: 100 + i * 400,
            width: 600,
            height: 300,
            src: `asset:${asset.id}`,
          }),
        ),
      ],
    },
  ],
  components: [],
  assets: regions,
};
const requests: {
  /** 资源或服务的访问地址。 */
  url: string;
  /** 发给供应商的额外请求头，可能包含私密认证值。 */
  headers: http.IncomingHttpHeaders;
  /** 请求正文或文档内容。 */
  body: Buffer;
}[] = [];
let failFeature = true;
let textOutput: unknown = plan;
const upstream = http
  .createServer(
    /**
     * 执行 reconstruction.test 传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 完成当前异步操作的 Promise，不携带业务数据。
     */
    async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      requests.push({ url: req.url!, headers: req.headers, body });
      res.setHeader('content-type', 'application/json');
      if (req.url?.includes('images/edits') || req.url === '/v1/custom/edit') {
        if (failFeature && body.toString().includes('Asset: feature.')) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: { message: 'temporary fixture failure' } }));
          return;
        }
        res.end(JSON.stringify({ data: [{ b64_json: png }] }));
      } else if (req.url?.includes('images/generations'))
        res.end(JSON.stringify({ data: [{ b64_json: png }] }));
      else if (req.url?.includes(':generateContent'))
        res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { mimeType: 'image/png', data: png } }],
                },
              },
            ],
          }),
        );
      else
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(textOutput) } }],
          }),
        );
    },
  )
  .listen(0, '127.0.0.1');
const server = createApp().listen(0, '127.0.0.1');
await Promise.all(
  [server, upstream].map(
    /**
     * 转换 reconstruction.test 中的集合条目，供后续处理或展示。
     *
     * @param s - 当前遍历的状态或文本片段。
     * @returns 当前条目转换后的结果。
     */
    (s) =>
      new Promise<void>(
        /** 把 reconstruction.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。 @param resolve - 异步操作成功时调用的完成函数。 @returns 无返回值；通过 resolve 或 reject 结束等待。 */
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
         * 转换 reconstruction.test 中的集合条目，供后续处理或展示。
         *
         * @param s - 当前遍历的状态或文本片段。
         * @returns 当前条目转换后的结果。
         */
        (s) =>
          new Promise<void>(
            /**
             * 把 reconstruction.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
             *
             * @param resolve - 异步操作成功时调用的完成函数。
             * @returns 无返回值；通过 resolve 或 reject 结束等待。
             */
            (resolve) =>
              s.close(
                /** 执行 reconstruction.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 无返回值；通过副作用完成当前操作。 */
                () => resolve(),
              ),
          ),
      ),
    );
    await rm(root, { recursive: true, force: true });
  },
);
/**
 * 准备当前场景所需的项目、连接和服务状态。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @returns 场景初始化结果。
 */
async function setup(id: string) {
  await api('/settings', {
    baseUrl: `http://127.0.0.1:${port(upstream)}/v1`,
    apiKey: 'fixture-secret',
    textModel: 'vision',
    imageModel: 'image',
  });
  const project = {
    id,
    name: id,
    description: '',
    category: 'Web',
    status: 'draft',
    themeId: 'custom',
    tokens,
    pages: [{ id: 'home', name: 'Home', width: 1200, height: 800, nodes: [] }],
    components: [],
    revision: 0,
    updatedAt: new Date().toISOString(),
    cover: 'blank',
  };
  assert.equal((await api(`/projects/${id}`, project, 'PUT')).status, 200);
  const generated = await api('/generate/image', {
    projectId: id,
    prompt: 'Landing page',
  });
  assert.equal(generated.status, 200, generated.body.error);
  await api('/generate/approve', { projectId: id });
  return (await api(`/projects/${id}`)).body;
}
/**
 * 验证reference-informed asset regeneration persists partial success and resumes before assembly/export。
 * @returns 完成当前检查或生命周期操作。
 */
test('reference-informed asset regeneration persists partial success and resumes before assembly/export', async () => {
  const before = await setup('assets');
  assert.equal(before.generation.width, 1);
  assert.equal(before.generation.height, 1);
  const failed = await api('/generate/design', { projectId: before.id });
  assert.equal(failed.status, 502, failed.body.error);
  assert.match(failed.body.error, /feature.*已完成素材会保留/);
  const progress = (await api('/projects/assets/reconstruction')).body;
  assert.equal(progress.phase, 'failed');
  assert.equal(progress.draft, undefined);
  assert.deepEqual(
    progress.assets.map(
      /** 提取 a 的状态，供后续计算或展示使用。 @param a - 第一个比较或计算对象。 @returns a的状态。 */
      (a: {
        /** 对象当前所处状态，决定后续可执行操作。 */
        status: string;
      }) => a.status,
    ),
    ['completed', 'failed'],
  );
  const retained = progress.assets[0].url;
  assert.equal((await api('/projects/assets')).body.revision, before.revision);
  failFeature = false;
  const restored = await api('/generate/design', { projectId: before.id });
  assert.equal(restored.status, 200, restored.body.error);
  const nodes = restored.body.project.pages[0].nodes;
  assert.equal(nodes[0].type, 'text');
  assert.equal(nodes[1].src, retained);
  assert.equal(nodes[1].imageFit, 'contain');
  assert.notEqual(nodes[2].src, before.generation.imageUrl);
  assert.equal(
    requests.filter(
      /** 判断 reconstruction.test 中的条目是否符合保留条件。 @param r - 当前遍历的响应或结果。 @returns 该条目是否符合条件。 */
      (r) => r.url.endsWith('chat/completions'),
    ).length,
    1,
  );
  const edits = requests.filter(
    /** 判断 reconstruction.test 中的条目是否符合保留条件。 @param r - 当前遍历的响应或结果。 @returns 该条目是否符合条件。 */
    (r) => r.url.endsWith('images/edits'),
  );
  assert.equal(edits.length, 3);
  for (const req of edits) {
    assert.match(String(req.headers['content-type']), /^multipart\/form-data; boundary=/);
    assert.equal(req.headers.authorization, 'Bearer fixture-secret');
    assert.ok(req.body.includes(Buffer.from(png, 'base64')));
    assert.ok(!req.body.toString().includes('name="size"'));
    assert.match(req.body.toString(), /source rectangle/);
  }
  assert.match(edits[2].body.toString(), /name="background"\r\n\r\ntransparent/);
  const completed = (await api('/projects/assets/reconstruction')).body;
  assert.equal(completed.phase, 'completed');
  assert.ok(
    completed.assets.every(
      /** 检查 a 的宽度等于1且 a 的高度等于1，供集合筛选或定位使用。 @param a - 第一个比较或计算对象。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (a: {
        /** 对象的宽度。 */
        width: number;
        /** 对象的高度。 */
        height: number;
      }) => a.width === 1 && a.height === 1,
    ),
  );
  const files = await generateFiles(restored.body.project);
  const serialized = files.find(
    /** 判断 reconstruction.test 中的条目是否符合查找条件。 @param f - 当前遍历的文件或条目。 @returns 该条目是否符合条件。 */
    (f) => f.path.endsWith('design.json'),
  )!.content;
  assert.ok(serialized.includes(`data:image/png;base64,${png}`));
  assert.ok(serialized.includes('"imageFit": "contain"'));
  const filesBefore = (await readdir(path.join(root, 'assets'))).length;
  await api('/generate/design', { projectId: before.id });
  assert.equal((await readdir(path.join(root, 'assets'))).length, filesBefore);
});
/**
 * 验证invalid asset plans fail before image spend; new reference receives a new plan。
 * @returns 完成当前检查或生命周期操作。
 */
test('invalid asset plans fail before image spend; new reference receives a new plan', async () => {
  const project = await setup('invalid-assets');
  const count = requests.filter(
    /** 判断 reconstruction.test 中的条目是否符合保留条件。 @param r - 当前遍历的响应或结果。 @returns 该条目是否符合条件。 */
    (r) => r.url.endsWith('images/edits'),
  ).length;
  textOutput = {
    ...plan,
    assets: [{ ...regions[0], bounds: { x: 0.9, y: 0, width: 0.5, height: 0.5 } }, regions[1]],
  };
  const failed = await api('/generate/design', { projectId: project.id });
  assert.equal(failed.status, 502);
  assert.match(failed.body.error, /区域超出/);
  assert.equal(
    requests.filter(
      /** 判断 reconstruction.test 中的条目是否符合保留条件。 @param r - 当前遍历的响应或结果。 @returns 该条目是否符合条件。 */
      (r) => r.url.endsWith('images/edits'),
    ).length,
    count,
  );
  textOutput = plan;
  assert.equal((await api('/generate/design', { projectId: project.id })).status, 200);
  const completed = (await api('/projects/invalid-assets/reconstruction')).body;
  await api('/generate/image', { projectId: project.id, prompt: 'New design' });
  assert.equal((await api('/projects/invalid-assets/reconstruction')).body, null);
  await api('/generate/approve', { projectId: project.id });
  assert.equal((await api('/generate/design', { projectId: project.id })).status, 200);
  assert.notEqual(
    (await api('/projects/invalid-assets/reconstruction')).body.assets[0].url,
    completed.assets[0].url,
  );
});
/**
 * 验证image adapters omit legacy fixed size and preserve reference input and custom edit path。
 * @returns 完成当前检查或生命周期操作。
 */
test('image adapters omit legacy fixed size and preserve reference input and custom edit path', async () => {
  const { provider } = await resolveModel('image');
  await requestImage({ ...provider, imageSize: '1536x1024' }, 'image', 'Generate full page');
  assert.equal(JSON.parse(requests.at(-1)!.body.toString()).size, undefined);
  await requestImage(
    {
      ...provider,
      imageEditPath: 'custom/edit',
      headers: { 'Content-Type': 'application/json' },
    },
    'image',
    'A panel',
    { bytes: Buffer.from(png, 'base64'), mime: 'image/png' },
  );
  assert.equal(requests.at(-1)!.url, '/v1/custom/edit');
  assert.match(String(requests.at(-1)!.headers['content-type']), /multipart/);
  await requestImage(
    { ...provider, imageProtocol: 'gemini', imagePath: '' },
    'gemini-image',
    'Recreate panel',
    { bytes: Buffer.from(png, 'base64'), mime: 'image/png' },
  );
  const content = JSON.parse(requests.at(-1)!.body.toString());
  assert.equal(content.contents[0].parts[1].inlineData.data, png);
  const count = requests.length;
  await assert.rejects(
    requestImage({ ...provider, imageProtocol: 'imagen' }, 'imagen', 'panel', {
      bytes: Buffer.from(png, 'base64'),
      mime: 'image/png',
    }),
    /不支持参考图/,
  );
  assert.equal(requests.length, count);
});
/**
 * 验证active reconstruction cannot duplicate work; interrupted records can resume。
 * @returns 完成当前检查或生命周期操作。
 */
test('active reconstruction cannot duplicate work; interrupted records can resume', async () => {
  const project = await setup('locked');
  let release!: (value: Record<string, unknown>) => void;
  const pending = reconstructWithAssets(
    project,
    Buffer.from(png, 'base64'),
    'image/png',
    /**
     * 执行 reconstruction.test 传入的局部处理步骤，使调用处能够控制结果如何更新。
     * @returns 当前步骤的处理结果。
     */
    () =>
      new Promise(
        /**
         * 把 reconstruction.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
         *
         * @param resolve - 异步操作成功时调用的完成函数。
         * @returns 无返回值；通过 resolve 或 reject 结束等待。
         */
        (resolve) => {
          release = resolve;
        },
      ),
  );
  while (!release)
    await new Promise(
      /** 把 reconstruction.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。 @param resolve - 异步操作成功时调用的完成函数。 @returns 无返回值；通过 resolve 或 reject 结束等待。 */
      (resolve) => setTimeout(resolve, 5),
    );
  await assert.rejects(
    reconstructWithAssets(
      project,
      Buffer.from(png, 'base64'),
      'image/png',
      /** 执行 reconstruction.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
      async () => plan,
    ),
    /正在还原/,
  );
  assert.equal((await getReconstructionStatus(project))!.phase, 'analyzing');
  release(plan);
  await pending;
  const files = await readdir(path.join(root, 'reconstructions'));
  for (const filename of files) {
    const file = path.join(root, 'reconstructions', filename);
    const state = JSON.parse(await readFile(file, 'utf8'));
    if (state.sourceImageUrl !== project.generation.imageUrl) continue;
    state.phase = 'assets';
    await writeFile(file, JSON.stringify(state));
  }
  assert.equal((await getReconstructionStatus(project))!.phase, 'failed');
  let analyzed = false;
  await reconstructWithAssets(
    project,
    Buffer.from(png, 'base64'),
    'image/png',
    /**
     * 执行 reconstruction.test 传入的局部处理步骤，使调用处能够控制结果如何更新。
     * @returns 当前步骤的处理结果。
     */
    async () => {
      analyzed = true;
      return plan;
    },
  );
  assert.equal(analyzed, false);
  assert.equal((await getReconstructionStatus(project))!.phase, 'completed');
});
