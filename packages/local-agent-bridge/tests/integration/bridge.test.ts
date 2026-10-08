import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { LocalAgentBridge, LocalAgentRequestError } from '../../src/index.ts';
import { createBridgeServer } from '../../src/server.ts';
import { findExecutable } from '../../src/discovery.ts';

const executable = fileURLToPath(new URL('../helpers/agent.mjs', import.meta.url));
const executables = { codex: executable, claude: executable, kimi: executable };
const message = (text: string) => [{ role: 'user', content: text }];

test('discovery accepts readable JavaScript entries without execute permission', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forma-agent-discovery-'));
  try {
    for (const extension of ['.js', '.cjs', '.mjs']) {
      const script = path.join(root, 'agent' + extension);
      await writeFile(script, "console.log('fixture-agent 1.0');\n", { mode: 0o644 });
      assert.equal(await findExecutable('codex', script), script);
      const agents = await new LocalAgentBridge({
        executables: { codex: script, claude: script, kimi: script },
      }).discover();
      const agent = agents.find((item) => item.id === 'codex')!;
      assert.equal(agent.available, true);
      assert.equal(agent.version, 'fixture-agent 1.0');
    }
    assert.equal(await findExecutable('codex', path.join(root, 'missing.mjs')), undefined);
    if (process.platform !== 'win32') {
      const launcher = path.join(root, 'codex');
      await writeFile(launcher, '#!/bin/sh\n', { mode: 0o644 });
      assert.equal(await findExecutable('codex', launcher), undefined);
      const executableLauncher = path.join(root, 'executable-codex');
      await writeFile(executableLauncher, '#!/bin/sh\n', { mode: 0o755 });
      assert.equal(await findExecutable('codex', executableLauncher), executableLauncher);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('model catalogs use public model IDs, paginate, exclude hidden entries, and preserve upstream errors', async () => {
  assert.equal(
    new LocalAgentRequestError({
      message: 'Rejected',
      codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 400 } },
    }).upstreamStatus,
    400,
  );
  const bridge = new LocalAgentBridge({ executables });
  assert.deepEqual(await bridge.listModels('codex'), {
    models: [
      { id: 'available-model', name: 'Available', isDefault: true },
      { id: 'available-model-2', name: 'Available 2', isDefault: false },
    ],
    source: 'cli',
  });
  assert.equal((await bridge.listModels('claude')).source, 'default-only');
  await assert.rejects(
    bridge.run({ agentId: 'codex', model: 'unsupported-model', messages: message('Hello') }),
    (error: unknown) => {
      assert.ok(error instanceof LocalAgentRequestError);
      assert.equal(error.upstreamStatus, 400);
      assert.match(error.message, /unsupported-model.*not supported/);
      assert.ok(!error.message.includes('"status"'));
      return true;
    },
  );
});

test('all adapters preserve literal input and Unicode, omit thoughts, and receive final replies over stdio', async () => {
  const bridge = new LocalAgentBridge({ executables });
  assert.ok(
    (await bridge.discover()).every(
      (agent) => agent.available && agent.version === 'fixture-agent 1.0',
    ),
  );
  for (const agentId of ['codex', 'claude', 'kimi'] as const) {
    const events: string[] = [];
    const result = await bridge.run({
      agentId,
      messages: message('中文 `literal` $(literal) "quoted"\nsecond line'),
      onEvent: (event) => events.push(event.type),
    });
    const parsed = JSON.parse(result.text);
    assert.equal(parsed.reply, '桥梁连接成功 🌉');
    assert.match(parsed.input, /literal/);
    assert.match(parsed.input, /中文/);
    assert.ok(!result.text.includes('hidden'));
    assert.equal(events[0], 'started');
    assert.equal(events.at(-1), 'completed');
    assert.ok(events.includes('text'));
  }
});

test('Codex receives image files and a model as separate arguments', async () => {
  const bridge = new LocalAgentBridge({ executables });
  const result = await bridge.run({
    agentId: 'codex',
    model: 'custom;literal',
    reasoningEffort: 'medium',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe image' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } },
        ],
      },
    ],
  });
  const parsed = JSON.parse(result.text);
  assert.equal(parsed.model, 'custom;literal');
  assert.equal(parsed.reasoningEffort, 'model_reasoning_effort="medium"');
  assert.deepEqual(parsed.images, ['reference-0.png']);
});

test('reasoning overrides are validated and local deadlines have a distinct error code', async () => {
  const bridge = new LocalAgentBridge({ executables });
  await assert.rejects(
    bridge.run({
      agentId: 'codex',
      reasoningEffort: 'arbitrary' as any,
      messages: message('hello'),
    }),
    /思考强度/,
  );
  await assert.rejects(
    bridge.run({ agentId: 'codex', messages: message('HANG'), timeoutMs: 1000 }),
    (error: unknown) =>
      error instanceof LocalAgentRequestError &&
      error.upstreamCode === 'local_timeout' &&
      error.upstreamStatus === undefined,
  );
});

test('Codex built-in images accept references, deduplicate events, require actual image bytes and support cancellation', async () => {
  const bridge = new LocalAgentBridge({ executables });
  const result = await bridge.run({
    agentId: 'codex',
    task: 'image',
    transparentBackground: true,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'VERIFY_REFERENCE' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } },
        ],
      },
    ],
  });
  assert.equal(result.text, '');
  assert.equal(result.images?.length, 1);
  assert.equal(result.images?.[0].mimeType, 'image/png');
  await assert.rejects(
    bridge.run({ agentId: 'codex', task: 'image', messages: message('IMAGE_QUOTA') }),
    (error: unknown) =>
      error instanceof LocalAgentRequestError &&
      error.upstreamStatus === 429 &&
      /额度已用完/.test(error.message),
  );
  for (const [prompt, pattern] of [
    ['NO_IMAGE', /没有返回内置生图结果/],
    ['BAD_IMAGE', /未返回支持的/],
  ] as const)
    await assert.rejects(
      bridge.run({ agentId: 'codex', task: 'image', messages: message(prompt) }),
      pattern,
    );
  await assert.rejects(
    bridge.run({ agentId: 'claude', task: 'image', messages: message('hello') }),
    /仅 Codex/,
  );
  await assert.rejects(
    bridge.run({
      agentId: 'codex',
      task: 'image',
      model: 'unsupported-model',
      messages: message('hello'),
    }),
    (error: unknown) => error instanceof LocalAgentRequestError && error.upstreamStatus === 400,
  );
  await assert.rejects(
    bridge.run({ agentId: 'codex', task: 'image', messages: message('HANG'), timeoutMs: 1000 }),
    /超过 1 秒/,
  );
  const controller = new AbortController();
  const pending = bridge.run({
    agentId: 'codex',
    task: 'image',
    messages: message('HANG'),
    signal: controller.signal,
    onEvent: (event) => {
      if (event.type === 'started') controller.abort(new Error('image cancelled'));
    },
  });
  await assert.rejects(pending, /image cancelled/);
  assert.ok(
    (await bridge.run({ agentId: 'codex', task: 'image', messages: message('next') })).images
      ?.length,
  );
});

test('failed, malformed and missing final output never become successful model replies', async () => {
  const bridge = new LocalAgentBridge({ executables });
  for (const [text, pattern] of [
    ['CLI_FAIL', /退出码 7/],
    ['MALFORMED', /输出流无效/],
    ['NO_FINAL', /最终文本/],
  ] as const) {
    await assert.rejects(bridge.run({ agentId: 'codex', messages: message(text) }), pattern);
  }
  await assert.rejects(
    bridge.run({ agentId: 'unknown' as any, messages: message('hello') }),
    /不支持/,
  );
});

test('abort and timeout terminate the whole child process tree and remove the temporary workspace', async () => {
  for (const manualAbort of [true, false]) {
    const bridge = new LocalAgentBridge({ executables, maxConcurrentRuns: 1 });
    const controller = new AbortController();
    let childPid = 0;
    let cwd = '';
    const pending = bridge.run({
      agentId: 'codex',
      messages: message('HANG'),
      timeoutMs: 1000,
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === 'text') {
          ({ childPid, cwd } = JSON.parse(event.text));
          if (manualAbort) controller.abort(new Error('test cancelled'));
        }
      },
    });
    await assert.rejects(pending, manualAbort ? /test cancelled/ : /超过 1 秒/);
    assert.ok(childPid);
    assert.throws(() => process.kill(childPid, 0));
    assert.equal(existsSync(cwd), false);
    assert.ok((await bridge.run({ agentId: 'codex', messages: message('next') })).text);
  }
});

test('standalone HTTP bridge requires a token and approved origin, streams replies and supports cancellation', async () => {
  const token = 'fixture-token-with-enough-length';
  const { server, bridge } = createBridgeServer({
    token,
    executables,
    allowedOrigins: ['http://localhost:5173'],
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(base + '/agents')).status, 401);
    assert.equal(
      (
        await fetch(base + '/agents', {
          headers: { ...headers, Origin: 'https://untrusted.example' },
        })
      ).status,
      403,
    );
    const rejectedHost = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(
        base + '/agents',
        { headers: { ...headers, Host: 'untrusted.example' } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(rejectedHost, 403);
    const agents = await (await fetch(base + '/agents', { headers })).json();
    assert.equal(agents.agents.length, 3);
    const models = await (await fetch(base + '/agents/codex/models', { headers })).json();
    assert.equal(models.source, 'cli');
    assert.equal(models.models[0].id, 'available-model');
    const failure = await fetch(base + '/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: 'codex',
        model: 'unsupported-model',
        messages: message('Hello'),
      }),
    });
    assert.equal(failure.status, 502);
    assert.equal((await failure.json()).upstreamStatus, 400);
    const image = await fetch(base + '/runs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ agentId: 'codex', task: 'image', messages: message('draw') }),
    });
    assert.equal(image.status, 200);
    assert.equal((await image.json()).images[0].mimeType, 'image/png');
    const response = await fetch(base + '/runs', {
      method: 'POST',
      headers: { ...headers, Accept: 'text/event-stream' },
      body: JSON.stringify({ agentId: 'kimi', messages: message('hello') }),
    });
    const output = await response.text();
    assert.match(output, /event: started/);
    assert.match(output, /event: text/);
    assert.match(output, /event: completed/);
    assert.match(output, /桥梁连接成功/);
    const hanging = await fetch(base + '/runs', {
      method: 'POST',
      headers: { ...headers, Accept: 'text/event-stream' },
      body: JSON.stringify({ agentId: 'codex', messages: message('HANG') }),
    });
    const reader = hanging.body!.getReader();
    let buffer = '';
    while (!buffer.includes('event: started'))
      buffer += new TextDecoder().decode((await reader.read()).value);
    const runId = JSON.parse(buffer.split('data: ')[1].split('\n')[0]).runId;
    assert.equal((await fetch(base + '/runs/' + runId, { method: 'DELETE', headers })).status, 200);
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      buffer += new TextDecoder().decode(part.value);
    }
    assert.match(buffer, /event: error/);
  } finally {
    bridge.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
