import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { AgentProcess } from './process.ts';
import { LocalAgentRequestError } from './errors.ts';
import type { preparePrompt } from './adapters.ts';
import type { AgentRunOptions, AgentRunResult } from './types.ts';

type GeneratedImage = NonNullable<AgentRunResult['images']>[number];

function decodeImage(base64: unknown): GeneratedImage {
  if (
    typeof base64 !== 'string' ||
    !base64.length ||
    base64.length > 40_000_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
  )
    throw new Error('Codex 内置生图返回的图片数据无效或超过大小限制。');
  const bytes = Buffer.from(base64, 'base64');
  const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? 'image/jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        ? 'image/webp'
        : undefined;
  if (!mimeType) throw new Error('Codex 未返回支持的 PNG、JPEG 或 WebP 图片。');
  return { base64, mimeType };
}

export function startImageAdapter(executable: string, cwd: string) {
  // Image results appear in both item and turn events as Base64, so text limits are too small.
  return AgentProcess.start(
    executable,
    [
      'app-server',
      '--stdio',
      '-c',
      'features.shell_tool=false',
      '-c',
      'features.unified_exec=false',
      '-c',
      'web_search="disabled"',
      '-c',
      'features.image_generation=true',
    ],
    cwd,
    96 * 1024 * 1024,
  );
}

export async function runImageAdapter(
  child: AgentProcess,
  model: string | undefined,
  cwd: string,
  prompt: ReturnType<typeof preparePrompt>,
  transparentBackground?: boolean,
  reasoningEffort?: AgentRunOptions['reasoningEffort'],
): Promise<GeneratedImage[]> {
  const images = new Map<string, GeneratedImage>();
  let imageFailure: unknown;
  let threadId = '';
  let complete!: () => void;
  let reject!: (error: Error) => void;
  const completed = new Promise<void>((resolve, fail) => {
    complete = resolve;
    reject = fail;
  });
  void completed.catch(() => {});
  void child.closed.then(() => reject(new Error('Codex 在完成内置生图前退出。')), reject);
  const collect = (item: any) => {
    if (item?.type !== 'imageGeneration') return;
    if (item.failure)
      imageFailure =
        item.failure.type === 'usageLimitExceeded'
          ? {
              ...item.failure,
              message:
                'Codex 内置生图额度已用完，请等待额度恢复，或在模型连接中选择其他生图供应商。',
              status: 429,
            }
          : item.failure;
    if (item.status === 'completed' && item.result) images.set(item.id, decodeImage(item.result));
  };
  child.onMessage = (message) => {
    try {
      if (message.id !== undefined && message.method) {
        child.send({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: 'Client tools are disabled' },
        });
        return;
      }
      const params = message.params;
      if (params?.threadId && params.threadId !== threadId) return;
      if (message.method === 'item/completed') collect(params?.item);
      if (message.method === 'error' && !params?.willRetry)
        throw new LocalAgentRequestError(params?.error);
      if (message.method === 'turn/completed') {
        const turn = params?.turn;
        if (turn?.status !== 'completed')
          throw new LocalAgentRequestError(turn?.error || 'Codex 生图回合未完成。');
        for (const item of turn.items || []) collect(item);
        if (!images.size)
          throw new LocalAgentRequestError(
            imageFailure ||
              'Codex 没有返回内置生图结果。请检查 CLI 版本、登录状态和账号的生图权限。',
          );
        complete();
      }
    } catch (error) {
      reject(error as Error);
      child.fail(error as Error);
    }
  };
  await child.request('initialize', {
    clientInfo: { name: 'forma-local-agent-bridge', version: '0.1.0' },
  });
  child.send({ jsonrpc: '2.0', method: 'initialized', params: {} });
  const thread = await child.request('thread/start', {
    cwd,
    ephemeral: true,
    approvalPolicy: 'never',
    sandbox: 'read-only',
    ...(model && model !== 'default' ? { model } : {}),
    baseInstructions:
      'Generate images only using the built-in image generation tool. Do not use shell, scripts, file editing, or external tools.',
    config: { model_reasoning_effort: reasoningEffort || 'low' },
  });
  if (typeof thread.thread?.id !== 'string') throw new Error('Codex 未返回有效生图会话。');
  threadId = thread.thread.id;
  const input: Record<string, unknown>[] = [
    {
      type: 'text',
      text:
        prompt.text +
        (transparentBackground === undefined
          ? ''
          : transparentBackground
            ? '\nThe output must have a transparent background. Request transparent background in the image generation tool.'
            : '\nThe output must have an opaque background.'),
    },
  ];
  for (const [index, image] of prompt.images.entries()) {
    const filename = path.join(cwd, `reference-${index}.${image.mimeType.split('/')[1]}`);
    await writeFile(filename, Buffer.from(image.data, 'base64'));
    input.push({ type: 'localImage', path: filename });
  }
  await child.request('turn/start', { threadId, input });
  await completed;
  return [images.values().next().value!];
}
