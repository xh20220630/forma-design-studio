import { LocalAgentBridge, LocalAgentRequestError } from '@forma/local-agent-bridge';
import type { PrivateProvider } from './settings.ts';
import type { ChatMessage } from '../../shared/types.ts';
import { ApiError, requireValue } from '../../shared/errors.ts';
import { modelRequestError } from './diagnostics.ts';

const bridge = new LocalAgentBridge();

export function discoverLocalAgents() {
  return bridge.discover();
}

export async function localAgentModels(provider: PrivateProvider) {
  const agent = (await bridge.discover()).find(
    (agent) => agent.id === provider.localAgent?.agentId,
  );
  requireValue(
    agent?.available,
    agent?.error || '未找到此本地 Agent，请安装 CLI 并确保它位于 PATH。',
  );
  try {
    return { ...(await bridge.listModels(agent.id)), agent };
  } catch (error) {
    throw new ApiError(502, `读取本地模型列表失败：${(error as Error).message}`);
  }
}

export async function requestLocalAgent(
  provider: PrivateProvider,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
  purpose?: 'reconstruction',
) {
  requireValue(provider.localAgent, '本地 Agent 连接配置缺失。');
  const timeoutMs =
    purpose === 'reconstruction'
      ? (provider.localAgent.reconstructionTimeoutMs ?? 600000)
      : provider.timeoutMs;
  const effort = provider.localAgent.reasoningEffort ?? 'medium';
  try {
    return (
      await bridge.run({
        agentId: provider.localAgent.agentId,
        messages,
        model,
        timeoutMs,
        reasoningEffort:
          provider.localAgent.agentId === 'codex' && effort !== 'default' ? effort : undefined,
        signal,
      })
    ).text;
  } catch (error) {
    throw await modelRequestError(
      provider,
      model,
      'text',
      (error as Error).message,
      error instanceof LocalAgentRequestError ? error.upstreamStatus : undefined,
      error instanceof LocalAgentRequestError ? error.upstreamCode : undefined,
      { operation: purpose || 'chat', timeoutMs },
    );
  }
}

export async function requestLocalAgentImage(
  provider: PrivateProvider,
  model: string,
  prompt: string,
  reference?: { bytes: Uint8Array; mime: string; background?: 'transparent' | 'opaque' },
) {
  requireValue(provider.localAgent?.agentId === 'codex', '此本地 Agent 不支持内置生图。');
  try {
    const result = await bridge.run({
      agentId: 'codex',
      task: 'image',
      model,
      timeoutMs: provider.timeoutMs,
      transparentBackground:
        reference?.background === undefined ? undefined : reference.background === 'transparent',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...(reference
              ? [
                  {
                    type: 'image_url' as const,
                    image_url: {
                      url: `data:${reference.mime};base64,${Buffer.from(reference.bytes).toString('base64')}`,
                    },
                  },
                ]
              : []),
          ],
        },
      ],
    });
    requireValue(result.images?.[0], 'Codex 没有返回内置生图结果。', 502);
    return { b64_json: result.images[0].base64 };
  } catch (error) {
    throw await modelRequestError(
      provider,
      model,
      'image',
      (error as Error).message,
      error instanceof LocalAgentRequestError ? error.upstreamStatus : undefined,
      error instanceof LocalAgentRequestError ? error.upstreamCode : undefined,
      { operation: 'image', timeoutMs: provider.timeoutMs },
    );
  }
}
