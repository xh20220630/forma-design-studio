import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (args.includes('--version')) {
  console.log('fixture-agent 1.0');
  process.exit(0);
}
const family = args.includes('app-server')
  ? 'catalog'
  : args.includes('acp')
    ? 'kimi'
    : args.includes('--json')
      ? 'codex'
      : 'claude';
const lines = createInterface({ input: process.stdin });
let input = '';
let permissionRequest;
let imageModel;
const send = (message) => process.stdout.write(JSON.stringify(message) + '\n');
const finish = async (prompt, id) => {
  const model = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'default';
  if (model === 'slow-design') await new Promise((resolve) => setTimeout(resolve, 1300));
  if (
    family === 'codex' &&
    (model === 'unsupported-model' || prompt.includes('MODEL_UNAVAILABLE'))
  ) {
    send({
      type: 'error',
      message: JSON.stringify({
        type: 'error',
        status: 400,
        error: {
          type: 'invalid_request_error',
          message: `The '${model}' model is not supported when using Codex with a ChatGPT account.`,
        },
      }),
    });
    process.exit(1);
  }
  if (family === 'codex' && model === 'bad-parameter') {
    send({
      type: 'error',
      message: JSON.stringify({
        status: 400,
        error: { message: 'max_tokens must be a positive integer' },
      }),
    });
    process.exit(1);
  }
  if (prompt.includes('CLI_FAIL')) {
    console.error('fixture failed');
    process.exit(7);
  }
  if (prompt.includes('NO_FINAL')) {
    process.exit(0);
  }
  if (prompt.includes('MALFORMED')) {
    console.log('broken-json');
    setInterval(() => {}, 1000);
    return;
  }
  if (prompt.includes('HANG')) {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    if (family === 'codex')
      send({
        type: 'item.completed',
        item: {
          type: 'agent_message',
          text: JSON.stringify({ childPid: child.pid, cwd: process.cwd() }),
        },
      });
    setInterval(() => {}, 1000);
    return;
  }
  const text = JSON.stringify(
    prompt.includes('You translate approved web UI images')
      ? {
          assets: [],
          components: [],
          pages: [{ id: 'reconstructed', name: 'Reconstructed', width: 1, height: 1, nodes: [] }],
        }
      : {
          reply: '桥梁连接成功 🌉',
          input: prompt,
          model: args.includes('--model') ? args[args.indexOf('--model') + 1] : 'default',
          images: readdirSync(process.cwd()).filter((name) => name.startsWith('reference-')),
          reasoningEffort:
            args.find((arg) => arg.startsWith('model_reasoning_effort=')) || 'cli-default',
        },
  );
  if (family === 'codex') {
    const payload = Buffer.from(
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }) + '\n',
    );
    const boundary = payload.indexOf(Buffer.from('桥')) + 1;
    process.stdout.write(payload.subarray(0, boundary));
    await new Promise((resolve) => setImmediate(resolve));
    process.stdout.write(payload.subarray(boundary));
    send({ type: 'turn.completed' });
  } else if (family === 'claude') {
    send({
      type: 'assistant',
      message: {
        content: [
          { type: 'thinking', thinking: 'hidden' },
          { type: 'text', text },
        ],
      },
    });
    send({ type: 'result', is_error: false, result: text });
  } else {
    send({
      jsonrpc: '2.0',
      method: 'session/update',
      params: {
        sessionId: 'fixture-session',
        update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hidden' } },
      },
    });
    send({
      jsonrpc: '2.0',
      method: 'session/update',
      params: {
        sessionId: 'fixture-session',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
      },
    });
    send({ jsonrpc: '2.0', id, result: { stopReason: 'end_turn' } });
    return;
  }
  lines.close();
};
lines.on('line', async (line) => {
  if (family === 'codex') {
    input += line + '\n';
    return;
  }
  const message = JSON.parse(line);
  if (family === 'catalog') {
    if (message.method === 'initialize') send({ jsonrpc: '2.0', id: message.id, result: {} });
    if (message.method === 'model/list')
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: message.params.cursor
          ? {
              data: [
                {
                  id: 'internal-2',
                  model: 'available-model-2',
                  displayName: 'Available 2',
                  isDefault: false,
                },
              ],
              nextCursor: null,
            }
          : {
              data: [
                {
                  id: 'internal-1',
                  model: 'available-model',
                  displayName: 'Available',
                  isDefault: true,
                },
                { model: 'hidden-model', hidden: true },
              ],
              nextCursor: 'page-2',
            },
      });
    if (message.method === 'thread/start') {
      imageModel = message.params.model;
      send({ jsonrpc: '2.0', id: message.id, result: { thread: { id: 'image-thread' } } });
    }
    if (message.method === 'turn/start') {
      send({ jsonrpc: '2.0', id: message.id, result: { turn: { id: 'image-turn' } } });
      const prompt = message.params.input[0].text;
      if (prompt.includes('HANG')) return;
      if (imageModel === 'unsupported-model') {
        send({
          method: 'turn/completed',
          params: {
            threadId: 'image-thread',
            turn: {
              status: 'failed',
              error: {
                message: JSON.stringify({
                  status: 400,
                  error: {
                    message: `The '${imageModel}' model is not supported when using Codex with a ChatGPT account.`,
                  },
                }),
              },
            },
          },
        });
        return;
      }
      const reference = message.params.input.find((item) => item.type === 'localImage');
      if (
        prompt.includes('VERIFY_REFERENCE') &&
        (!reference ||
          readFileSync(reference.path).toString() !== 'hello' ||
          !prompt.includes('transparent background'))
      )
        throw new Error('Reference image or background was not passed');
      if (
        !args.includes('features.shell_tool=false') ||
        !args.includes('features.unified_exec=false')
      )
        throw new Error('Image generation must disable shell tools');
      const item = {
        type: 'imageGeneration',
        id: 'image-item',
        status: 'completed',
        result: prompt.includes('BAD_IMAGE')
          ? 'aGVsbG8='
          : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
        failure: prompt.includes('IMAGE_QUOTA')
          ? { type: 'usageLimitExceeded', limitId: 'images', resetsAt: null }
          : null,
        savedPath: 'untrusted-path-must-not-be-read.png',
      };
      if (item.failure) {
        item.status = 'failed';
        item.result = '';
      }
      if (!prompt.includes('NO_IMAGE'))
        send({ method: 'item/completed', params: { threadId: 'image-thread', item } });
      send({
        method: 'turn/completed',
        params: {
          threadId: 'image-thread',
          turn: { status: 'completed', items: prompt.includes('NO_IMAGE') ? [] : [item] },
        },
      });
    }
    return;
  }
  if (family === 'claude') {
    await finish(JSON.stringify(message.message.content));
    return;
  }
  if (message.method === 'initialize')
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: { protocolVersion: 1, agentCapabilities: { promptCapabilities: { image: true } } },
    });
  else if (message.method === 'session/new')
    send({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'fixture-session' } });
  else if (message.method === 'session/set_model')
    send({ jsonrpc: '2.0', id: message.id, result: {} });
  else if (message.method === 'session/prompt') {
    permissionRequest = { prompt: JSON.stringify(message.params.prompt), id: message.id };
    send({
      jsonrpc: '2.0',
      id: 900,
      method: 'session/request_permission',
      params: {
        sessionId: 'fixture-session',
        options: [{ optionId: 'allow', kind: 'allow_once' }],
      },
    });
  } else if (message.id === 900) {
    if (message.result?.outcome?.outcome !== 'cancelled') {
      console.error('permission was not denied');
      process.exit(8);
    }
    await finish(permissionRequest.prompt, permissionRequest.id);
  }
});
lines.on('close', () => {
  if (family === 'codex') void finish(input);
});
