import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const root = await mkdtemp(path.join(os.tmpdir(), 'forma-providers-'));
process.env.FORMA_DATA_DIR = root;
process.env.OPENAI_API_KEY = 'environment-key';
delete process.env.FORMA_AGENT_TOKEN;
await writeFile(
  path.join(root, 'settings.json'),
  JSON.stringify({
    baseUrl: 'https://legacy.example/v1',
    apiKey: 'legacy-secret',
    textModel: 'old-text',
    imageModel: 'old-image',
  }),
);
const { createApp } = await import('../src/index.ts');
const { resolveModel, getPrivateProvider, validateProvider } = await import(
  '../src/provider-settings.ts'
);
const { requestText, requestImage, listProviderModels } = await import(
  '../src/provider-transport.ts'
);
const { generateJson, generateImage } = await import('../src/provider.ts');
const requests: {
  /** 资源或服务的访问地址。 */
  url: string;
  /** 发给供应商的额外请求头，可能包含私密认证值。 */
  headers: http.IncomingHttpHeaders;
  /** 请求正文或文档内容。 */
  body: any;
}[] = [];
const upstream = http
  .createServer(
    /**
     * 执行 providers.test 传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 当前步骤的处理结果。
     */
    async (req, res) => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : undefined;
      requests.push({ url: req.url!, headers: req.headers, body });
      res.setHeader('content-type', 'application/json');
      if (req.url!.startsWith('/slow-headers/') || req.url!.startsWith('/slow-body/')) {
        if (req.url!.startsWith('/slow-body/')) res.flushHeaders();
        const timer = setTimeout(
          /** 基于最新状态计算 Timeout 的下一份值，避免连续更新时读到旧状态。 @returns 供 React 保存的新状态。 */
          () =>
            res.end(
              JSON.stringify({
                choices: [{ message: { content: '{"ok":true}' } }],
              }),
            ),
          1500,
        );
        res.once(
          'close',
          /** 响应 close 事件，推进 providers.test 的状态更新。 @returns 无返回值；通过副作用完成当前操作。 */
          () => clearTimeout(timer),
        );
        return;
      }
      if (req.url!.startsWith('/upstream-timeout/')) {
        res.statusCode = 504;
        return res.end(JSON.stringify({ error: { message: 'upstream inference timeout' } }));
      }
      // A gateway may expose its catalog at the root but serve its website for a missing API prefix.
      if (req.url === '/chat/completions') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.end('<!doctype html><html><body>private-key private-header</body></html>');
      }
      if (req.url!.startsWith('/error/')) {
        res.statusCode = 401;
        return res.end(
          JSON.stringify({
            error: { message: 'key private-key header private-header' },
          }),
        );
      }
      if (req.url!.startsWith('/redirect/')) {
        res.statusCode = 302;
        res.setHeader('location', '/v1/models');
        return res.end('{}');
      }
      if (req.url!.includes('/models') && !body) {
        if (req.headers['x-api-key'])
          return res.end(
            JSON.stringify(
              req.url!.includes('after_id=')
                ? {
                    data: [{ id: 'claude-b', display_name: 'Claude B' }],
                    has_more: false,
                  }
                : {
                    data: [{ id: 'claude-a', display_name: 'Claude A' }],
                    has_more: true,
                    last_id: 'claude-a',
                  },
            ),
          );
        if (req.headers['x-goog-api-key'])
          return res.end(
            JSON.stringify(
              req.url!.includes('pageToken=')
                ? {
                    models: [{ name: 'models/gemini-b', displayName: 'Gemini B' }],
                  }
                : {
                    models: [{ name: 'models/gemini-a', displayName: 'Gemini A' }],
                    nextPageToken: 'next',
                  },
            ),
          );
        return res.end(JSON.stringify({ data: [{ id: 'text-local' }, { id: 'image-local' }] }));
      }
      if (req.url!.endsWith('/responses'))
        return res.end(
          JSON.stringify({
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: '{"protocol":"responses"}' }],
              },
            ],
          }),
        );
      if (req.url!.endsWith('/messages'))
        return res.end(
          JSON.stringify({
            content: [
              { type: 'thinking', thinking: 'hidden' },
              { type: 'text', text: '{"protocol":"anthropic"}' },
            ],
          }),
        );
      if (req.url!.endsWith(':generateContent'))
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: body.generationConfig.responseModalities
                    ? [
                        {
                          inlineData: {
                            mimeType: 'image/png',
                            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
                          },
                        },
                      ]
                    : [{ thought: true, text: 'hidden' }, { text: '{"protocol":"gemini"}' }],
                },
              },
            ],
          }),
        );
      if (req.url!.endsWith(':predict'))
        return res.end(
          JSON.stringify({
            predictions: [
              {
                bytesBase64Encoded:
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
              },
            ],
          }),
        );
      if (req.url!.endsWith('/images/generations'))
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
      res.end(
        JSON.stringify({
          choices: [{ message: { content: '{"protocol":"openai"}' } }],
        }),
      );
    },
  )
  .listen(0, '127.0.0.1');
const server = createApp().listen(0, '127.0.0.1');
await Promise.all(
  [upstream, server].map(
    /**
     * 转换 providers.test 中的集合条目，供后续处理或展示。
     *
     * @param s - 当前遍历的状态或文本片段。
     * @returns 当前条目转换后的结果。
     */
    (s) =>
      new Promise<void>(
        /** 把 providers.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。 @param resolve - 异步操作成功时调用的完成函数。 @returns 无返回值；通过 resolve 或 reject 结束等待。 */
        (resolve) => s.once('listening', resolve),
      ),
  ),
);
const upstreamBase = `http://127.0.0.1:${(upstream.address() as import('node:net').AddressInfo).port}`;
const appBase = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`;
/**
 * 统一请求 API 并转换失败响应，使调用方只处理业务数据。
 *
 * @param route - 要请求的接口路径。
 * @param method - HTTP 请求方法。
 * @param data - 当前操作处理的数据。
 * @returns 解析后的 API 响应。
 */
async function api(route: string, method = 'GET', data?: unknown) {
  const response = await fetch(appBase + route, {
    method,
    ...(data === undefined
      ? {}
      : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
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
         * 转换 providers.test 中的集合条目，供后续处理或展示。
         *
         * @param s - 当前遍历的状态或文本片段。
         * @returns 当前条目转换后的结果。
         */
        (s) =>
          new Promise<void>(
            /**
             * 把 providers.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
             *
             * @param resolve - 异步操作成功时调用的完成函数。
             * @returns 无返回值；通过 resolve 或 reject 结束等待。
             */
            (resolve) =>
              s.close(
                /** 执行 providers.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 无返回值；通过副作用完成当前操作。 */
                () => resolve(),
              ),
          ),
      ),
    );
    await rm(root, { recursive: true, force: true });
  },
);
const messages = [
  { role: 'system', content: 'Return JSON.' },
  {
    role: 'user',
    content: [
      { type: 'text' as const, text: 'Describe image' },
      {
        type: 'image_url' as const,
        image_url: {
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
        },
      },
    ],
  },
];

/**
 * 验证legacy settings migrate; independent bindings route generation and keep credentials private。
 * @returns 完成当前检查或生命周期操作。
 */
test('legacy settings migrate; independent bindings route generation and keep credentials private', async () => {
  const legacy = (await api('/settings')).body;
  assert.equal(legacy.text.model, 'old-text');
  assert.equal(legacy.image.model, 'old-image');
  assert.equal(legacy.providers[0].hasApiKey, true);
  assert.ok(!JSON.stringify(legacy).includes('legacy-secret'));
  const textResult = await api('/providers', 'POST', {
    name: 'Local text',
    baseUrl: upstreamBase + '/text/v1',
    auth: 'none',
    imageProtocol: 'none',
  });
  assert.equal(textResult.status, 201);
  const textId = textResult.body.providers.at(-1).id;
  const imageResult = await api('/providers', 'POST', {
    name: 'Images',
    baseUrl: upstreamBase + '/image/v1',
    apiKey: 'private-key',
    headers: { 'X-Test': 'private-header' },
    textProtocol: 'none',
  });
  const imageId = imageResult.body.providers.at(-1).id;
  assert.ok(!JSON.stringify(imageResult.body).includes('private-key'));
  assert.ok(!JSON.stringify(imageResult.body).includes('private-header'));
  const selected = (
    await api('/settings/models', 'POST', {
      text: { providerId: textId, model: 'local-text' },
      image: { providerId: imageId, model: 'local-image' },
    })
  ).body;
  assert.equal(selected.configured, true);
  assert.equal(selected.imageConfigured, true);
  assert.deepEqual(await generateJson(messages), { protocol: 'openai' });
  assert.equal(requests.at(-1)?.url, '/text/v1/chat/completions');
  assert.equal(requests.at(-1)?.headers.authorization, undefined);
  const project = {
    id: 'routing',
    name: 'Routing',
    description: '',
    pages: [],
    components: [],
    tokens: {},
    revision: 0,
  } as any;
  await generateImage(project, 'UI design');
  assert.equal(requests.at(-1)?.url, '/image/v1/images/generations');
  assert.equal(requests.at(-1)?.body.model, 'local-image');
  assert.equal(requests.at(-1)?.headers.authorization, 'Bearer private-key');
  await api(`/providers/${imageId}`, 'PUT', { name: 'Renamed', apiKey: '' });
  assert.equal((await getPrivateProvider(imageId)).apiKey, 'private-key');
  const before = await readFile(path.join(root, 'settings.json'), 'utf8');
  const probe = await api('/providers/probe', 'POST', {
    id: imageId,
    baseUrl: upstreamBase + '/probe/v1',
  });
  assert.equal(probe.status, 200);
  assert.equal(probe.body.models.length, 2);
  assert.equal(await readFile(path.join(root, 'settings.json'), 'utf8'), before);
  assert.equal(
    (
      await api('/settings/models', 'POST', {
        text: { providerId: imageId, model: 'wrong-channel' },
      })
    ).status,
    400,
  );
  assert.equal((await resolveModel('text')).provider.id, textId);
  await api(`/providers/${imageId}`, 'PUT', { clearApiKey: true, headers: {} });
  assert.equal((await getPrivateProvider(imageId)).apiKey, '');
  assert.equal((await api('/settings')).body.imageConfigured, false);
  await api(`/providers/${imageId}`, 'DELETE');
  const remaining = (await api('/settings')).body;
  assert.equal(remaining.image.providerId, '');
  assert.equal(remaining.text.providerId, textId);
  await api(`/providers/${textId}`, 'PUT', {
    textProtocol: 'none',
    imageProtocol: 'openai-images',
  });
  assert.equal((await api('/settings')).body.text.providerId, '');
});

/**
 * 验证protocol adapters preserve images, auth, model selection and JSON output。
 * @returns 完成当前检查或生命周期操作。
 */
test('protocol adapters preserve images, auth, model selection and JSON output', async () => {
  for (const protocol of ['openai', 'openai-responses', 'anthropic', 'gemini'] as const) {
    const provider = validateProvider({
      name: protocol,
      baseUrl: upstreamBase + '/v1',
      apiKey: 'adapter-key',
      textProtocol: protocol,
    });
    const result = await requestText(provider, 'chosen-model', messages);
    assert.equal(
      JSON.parse(result).protocol,
      protocol === 'openai-responses' ? 'responses' : protocol,
    );
    const request = requests.at(-1)!;
    assert.ok(
      JSON.stringify(request.body).includes(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
      ),
    );
    if (protocol === 'anthropic') {
      assert.equal(request.headers['x-api-key'], 'adapter-key');
      assert.equal(request.headers['anthropic-version'], '2023-06-01');
      assert.equal(request.body.messages[0].content[1].source.media_type, 'image/png');
    } else if (protocol === 'gemini') {
      assert.equal(request.headers['x-goog-api-key'], 'adapter-key');
      assert.equal(request.body.generationConfig.responseMimeType, 'application/json');
      assert.equal(request.url, '/v1/models/chosen-model:generateContent');
    } else {
      assert.equal(request.headers.authorization, 'Bearer adapter-key');
      assert.equal(request.body.model, 'chosen-model');
    }
    if (protocol === 'openai-responses') {
      assert.equal(request.body.store, false);
      assert.equal(request.body.input[1].content[1].type, 'input_image');
    }
  }
  for (const protocol of ['openai-images', 'gemini', 'imagen'] as const) {
    const provider = validateProvider({
      baseUrl: upstreamBase + '/v1',
      apiKey: 'image-key',
      imageProtocol: protocol,
    });
    assert.deepEqual(await requestImage(provider, 'image-model', 'Draw a UI'), {
      b64_json:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
    });
    if (protocol !== 'openai-images')
      assert.equal(requests.at(-1)?.headers['x-goog-api-key'], 'image-key');
  }
  const custom = validateProvider({
    baseUrl: upstreamBase + '/custom',
    auth: 'api-key',
    apiKey: 'custom-key',
    textPath: 'invoke/{model}',
    jsonMode: false,
  });
  await requestText(custom, 'org/model', messages);
  assert.equal(requests.at(-1)?.url, '/custom/invoke/org%2Fmodel');
  assert.equal(requests.at(-1)?.headers['api-key'], 'custom-key');
  assert.equal(requests.at(-1)?.body.response_format, undefined);
});

/**
 * 验证catalog pagination, failed requests and redirects do not expose secrets。
 * @returns 完成当前检查或生命周期操作。
 */
test('catalog pagination, failed requests and redirects do not expose secrets', async () => {
  for (const protocol of ['anthropic', 'gemini'] as const) {
    const models = await listProviderModels(
      validateProvider({
        baseUrl: upstreamBase + '/v1',
        apiKey: 'catalog-key',
        textProtocol: protocol,
      }),
    );
    assert.equal(models.models.length, 2);
    assert.ok(
      models.models.every(
        /** 检查不成立，供集合筛选或定位使用。 @param m - 当前变换矩阵或消息。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (m) => !m.id.startsWith('models/'),
      ),
    );
  }
  const result = await api('/providers/probe', 'POST', {
    baseUrl: upstreamBase + '/error',
    apiKey: 'private-key',
    headers: { 'x-custom': 'private-header' },
  });
  assert.equal(result.status, 502);
  assert.ok(!JSON.stringify(result.body).includes('private-key'));
  assert.ok(!JSON.stringify(result.body).includes('private-header'));
  const start = requests.length;
  const redirect = await api('/providers/probe', 'POST', {
    baseUrl: upstreamBase + '/redirect',
    apiKey: 'secret',
  });
  assert.equal(redirect.status, 502);
  assert.equal(requests.length, start + 1);
  for (const data of [
    { baseUrl: 'https://user:pass@example.com/v1' },
    { textPath: '//elsewhere/messages' },
    { headers: { host: 'elsewhere' } },
    { textProtocol: 'none', imageProtocol: 'none' },
  ])
    assert.equal((await api('/providers', 'POST', data)).status, 400);
});

/**
 * 验证root catalog success does not hide an HTML fallback at an unversioned chat endpoint。
 * @returns 完成当前检查或生命周期操作。
 */
test('root catalog success does not hide an HTML fallback at an unversioned chat endpoint', async () => {
  const provider = validateProvider({
    baseUrl: upstreamBase,
    apiKey: 'private-key',
    headers: { 'x-custom': 'private-header' },
  });
  assert.equal((await listProviderModels(provider)).models.length, 2);
  await assert.rejects(
    /** 执行 providers.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => requestText(provider, 'local-text', messages),
    /**
     * 执行 providers.test 传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param error - 当前操作的失败信息，供界面反馈或重试判断。
     * @returns 条件是否成立的布尔值。
     */
    (error) => {
      assert.match(error.message, /返回了网页/);
      assert.match(error.message, /\/chat\/completions/);
      assert.match(error.message, /API Base URL/);
      assert.match(error.message, /\/v1/);
      assert.ok(!error.message.includes('private-key'));
      assert.ok(!error.message.includes('private-header'));
      return true;
    },
  );
  const fixed = { ...provider, baseUrl: upstreamBase + '/v1' };
  assert.deepEqual(JSON.parse(await requestText(fixed, 'local-text', messages)), {
    protocol: 'openai',
  });
});

/**
 * 验证local request deadline identifies its stage and differs from an upstream HTTP timeout。
 * @returns 完成当前检查或生命周期操作。
 */
test('local request deadline identifies its stage and differs from an upstream HTTP timeout', async () => {
  for (const [path, stage] of [
    ['slow-headers', '等待上游响应'],
    ['slow-body', '接收响应内容'],
  ]) {
    const provider = validateProvider({
      baseUrl: `${upstreamBase}/${path}`,
      auth: 'none',
      timeoutMs: 1000,
    });
    await assert.rejects(
      /** 执行 providers.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
      () => requestText(provider, 'local-text', messages),
      /**
       * 执行 providers.test 传入的局部处理步骤，使调用处能够控制结果如何更新。
       *
       * @param error - 当前操作的失败信息，供界面反馈或重试判断。
       * @returns 条件是否成立的布尔值。
       */
      (error) => {
        assert.match(error.message, /本地.*1 秒/);
        assert.ok(error.message.includes(stage));
        assert.ok(!error.message.includes('HTTP 504'));
        return true;
      },
    );
  }
  const provider = validateProvider({
    baseUrl: upstreamBase + '/upstream-timeout',
    auth: 'none',
  });
  await assert.rejects(
    /** 执行 providers.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => requestText(provider, 'local-text', messages),
    /**
     * 执行 providers.test 传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param error - 当前操作的失败信息，供界面反馈或重试判断。
     * @returns 条件是否成立的布尔值。
     */
    (error) => {
      assert.match(error.message, /HTTP 504/);
      assert.ok(!error.message.includes('本地'));
      return true;
    },
  );
});
