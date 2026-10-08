import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { discoverAgents, findExecutable, agentDefinitions } from './discovery.ts';
import { preparePrompt, runAdapter, startAdapter } from './adapters.ts';
import type { AgentProcess } from './process.ts';
import type { AgentRunOptions, AgentRunResult, BridgeOptions } from './types.ts';
import { listAgentModels } from './models.ts';
import { runImageAdapter, startImageAdapter } from './images.ts';
import { LocalAgentRequestError } from './errors.ts';
import type { LocalAgentId } from './types.ts';

export { discoverAgents } from './discovery.ts';
export { LocalAgentRequestError } from './errors.ts';
export type {
  LocalAgentId,
  LocalAgentInfo,
  AgentMessage,
  BridgeEvent,
  AgentRunOptions,
  AgentRunResult,
  BridgeOptions,
  AgentModelCatalog,
} from './types.ts';

export class LocalAgentBridge {
  private options: BridgeOptions;
  private active = new Set<AbortController>();

  constructor(options: BridgeOptions = {}) {
    this.options = options;
  }

  discover() {
    return discoverAgents(this.options);
  }

  async listModels(agentId: LocalAgentId, signal?: AbortSignal) {
    if (this.active.size >= (this.options.maxConcurrentRuns ?? 2))
      throw new Error('本地 Agent 正忙，请在当前任务结束后重试。');
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.throwIfAborted();
    signal?.addEventListener('abort', abort, { once: true });
    this.active.add(controller);
    try {
      return await listAgentModels(agentId, this.options, controller.signal);
    } finally {
      signal?.removeEventListener('abort', abort);
      this.active.delete(controller);
    }
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    if (!agentDefinitions.some((agent) => agent.id === options.agentId))
      throw new Error('不支持此本地 Agent。');
    if (options.task !== undefined && !['text', 'image'].includes(options.task))
      throw new Error('任务类型无效。');
    if (
      options.reasoningEffort !== undefined &&
      (options.agentId !== 'codex' ||
        !['low', 'medium', 'high', 'xhigh'].includes(options.reasoningEffort))
    )
      throw new Error('思考强度选项无效，仅 Codex 支持此设置。');
    if (options.task === 'image' && options.agentId !== 'codex')
      throw new Error('目前仅 Codex 支持内置生图，请选择 Codex 或独立生图连接。');
    if (
      options.transparentBackground !== undefined &&
      typeof options.transparentBackground !== 'boolean'
    )
      throw new Error('透明背景选项必须是布尔值。');
    if (
      !Array.isArray(options.messages) ||
      !options.messages.length ||
      options.messages.length > 200 ||
      options.messages.some(
        (message) =>
          !message ||
          typeof message.role !== 'string' ||
          !(typeof message.content === 'string' || Array.isArray(message.content)),
      )
    )
      throw new Error('消息列表格式无效。');
    if (Buffer.byteLength(JSON.stringify(options.messages)) > 25 * 1024 * 1024)
      throw new Error('消息超过 25 MB 限制。');
    if (
      options.model !== undefined &&
      (typeof options.model !== 'string' ||
        options.model.length > 300 ||
        /[\r\n\0]/.test(options.model))
    )
      throw new Error('模型 ID 格式无效。');
    const timeoutMs = options.timeoutMs ?? 180000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000)
      throw new Error('超时必须位于 1000–600000 毫秒。');
    if (this.active.size >= (this.options.maxConcurrentRuns ?? 2))
      throw new Error('本地 Agent 正忙，请在当前任务结束后重试。');
    options.signal?.throwIfAborted();
    const controller = new AbortController();
    this.active.add(controller);
    const abort = () =>
      controller.abort(options.signal?.reason || new Error('本地 Agent 请求已取消。'));
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () =>
        controller.abort(
          new LocalAgentRequestError({
            code: 'local_timeout',
            message: `本地 Agent 请求超过 ${timeoutMs / 1000} 秒，已终止进程。`,
          }),
        ),
      timeoutMs,
    );
    const runId = randomUUID();
    let cwd: string | undefined;
    let child: AgentProcess | undefined;
    const stop = () =>
      child?.fail(
        controller.signal.reason instanceof Error
          ? controller.signal.reason
          : new Error('本地 Agent 请求已取消。'),
      );
    controller.signal.addEventListener('abort', stop, { once: true });
    try {
      const prompt = preparePrompt(options.messages, options.task);
      const executable = await findExecutable(
        options.agentId,
        this.options.executables?.[options.agentId],
      );
      if (!executable) throw new Error('未找到本地 Agent，请安装 CLI 并确保它位于 PATH。');
      controller.signal.throwIfAborted();
      cwd = await mkdtemp(path.join(os.tmpdir(), 'forma-agent-'));
      child =
        options.task === 'image'
          ? await startImageAdapter(executable, cwd)
          : await startAdapter(
              options.agentId,
              executable,
              options.model,
              cwd,
              prompt,
              options.reasoningEffort,
            );
      controller.signal.throwIfAborted();
      options.onEvent?.({ type: 'started', runId, agentId: options.agentId });
      const images =
        options.task === 'image'
          ? await runImageAdapter(
              child,
              options.model,
              cwd,
              prompt,
              options.transparentBackground,
              options.reasoningEffort,
            )
          : undefined;
      const text = images
        ? ''
        : await runAdapter(options.agentId, child, options.model, cwd, prompt, (text) =>
            options.onEvent?.({ type: 'text', runId, text }),
          );
      controller.signal.throwIfAborted();
      options.onEvent?.({ type: 'completed', runId });
      return { runId, agentId: options.agentId, text, ...(images ? { images } : {}) };
    } catch (error) {
      options.onEvent?.({ type: 'error', runId, message: (error as Error).message });
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', stop);
      try {
        if (child) {
          await child.stop();
          await child.closed.catch(() => {});
        }
        if (cwd) await rm(cwd, { recursive: true, force: true });
      } finally {
        this.active.delete(controller);
      }
    }
  }

  close() {
    for (const controller of this.active)
      controller.abort(new Error('本地 Agent 桥接服务已关闭。'));
  }
}
