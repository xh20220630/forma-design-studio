import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { AgentProcess } from './process.ts';
import { LocalAgentRequestError } from './errors.ts';
import type { AgentMessage, AgentRunOptions, LocalAgentId } from './types.ts';

interface PreparedPrompt {
  text: string;
  images: { mimeType: string; data: string }[];
}

export function preparePrompt(
  messages: AgentMessage[],
  task: 'text' | 'image' = 'text',
): PreparedPrompt {
  const images: PreparedPrompt['images'] = [];
  const transcript = messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === 'string'
        ? message.content
        : message.content
            .map((part) => {
              if (part.type === 'text') return part.text;
              const match =
                /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
                  part.image_url.url,
                );
              if (!match) throw new Error('本地 Agent 仅接受内联 PNG、JPEG、WebP 或 GIF 图片。');
              images.push({ mimeType: match[1], data: match[2] });
              return `[Attached image ${images.length}]`;
            })
            .join('\n'),
  }));
  return {
    text:
      (task === 'image'
        ? 'Generate exactly one image using the built-in image generation tool, following the design requirements below. Use attached images as visual references. Do not use shell, scripts, file editing, or external tools. Return the actual generated image, not a description or file path.\nConversation:\n'
        : 'You are the model for a UI design application. Follow the system instructions in the conversation below, then answer the last user message. Return only the requested response, without narration or markdown fences. Do not run commands, edit files, or use external tools. The application applies validated design operations itself.\nConversation:\n') +
      JSON.stringify(transcript),
    images,
  };
}

export async function startAdapter(
  agentId: LocalAgentId,
  executable: string,
  model: string | undefined,
  cwd: string,
  prompt: PreparedPrompt,
  reasoningEffort?: AgentRunOptions['reasoningEffort'],
) {
  const selectedModel = model && model !== 'default' ? model : undefined;
  if (agentId === 'codex') {
    const args = [
      'exec',
      '--json',
      '--color',
      'never',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--ephemeral',
      '-c',
      'approval_policy="never"',
      '-c',
      'features.shell_tool=false',
      '-c',
      'features.unified_exec=false',
      '-c',
      'features.image_generation=false',
      '-c',
      'web_search="disabled"',
    ];
    if (reasoningEffort) args.push('-c', `model_reasoning_effort="${reasoningEffort}"`);
    if (selectedModel) args.push('--model', selectedModel);
    for (const [index, image] of prompt.images.entries()) {
      const filename = path.join(cwd, `reference-${index}.${image.mimeType.split('/')[1]}`);
      await writeFile(filename, Buffer.from(image.data, 'base64'));
      args.push('--image', filename);
    }
    args.push('--', '-');
    return AgentProcess.start(executable, args, cwd);
  }
  if (agentId === 'claude') {
    const args = [
      '--print',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--no-session-persistence',
      '--tools',
      '',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
    ];
    if (selectedModel) args.push('--model', selectedModel);
    return AgentProcess.start(executable, args, cwd);
  }
  return AgentProcess.start(executable, ['acp'], cwd);
}

export async function runAdapter(
  agentId: LocalAgentId,
  process: AgentProcess,
  model: string | undefined,
  cwd: string,
  prompt: PreparedPrompt,
  onText: (text: string) => void,
): Promise<string> {
  let finalText: string | undefined;
  let streamedText = '';
  let sessionId = '';
  process.onMessage = (message) => {
    if (!message || typeof message !== 'object') throw new Error('CLI 返回了无效事件。');
    if (agentId === 'codex') {
      if (message.type === 'error' || message.type === 'turn.failed') {
        process.fail(new LocalAgentRequestError(message));
      }
      if (
        message.type === 'item.completed' &&
        message.item?.type === 'agent_message' &&
        typeof message.item.text === 'string'
      ) {
        finalText = message.item.text;
        onText(finalText!);
      }
    } else if (agentId === 'claude') {
      if (message.type === 'assistant' && Array.isArray(message.message?.content)) {
        const text = message.message.content
          .filter((part: any) => part.type === 'text' && typeof part.text === 'string')
          .map((part: any) => part.text)
          .join('');
        if (text) onText(text);
      }
      if (message.type === 'result') {
        if (message.is_error)
          process.fail(
            new Error(
              String(message.errors?.join('; ') || message.result || 'Claude Code 请求失败。'),
            ),
          );
        else if (typeof message.result === 'string') finalText = message.result;
      }
    } else if (message.method === 'session/update' && message.params?.sessionId === sessionId) {
      const update = message.params.update;
      if (
        update?.sessionUpdate === 'agent_message_chunk' &&
        update.content?.type === 'text' &&
        typeof update.content.text === 'string'
      ) {
        streamedText += update.content.text;
        onText(update.content.text);
      }
    } else if (message.id !== undefined && message.method) {
      // Tools and permission prompts are denied: the design application owns all mutations.
      process.send(
        message.method === 'session/request_permission'
          ? { jsonrpc: '2.0', id: message.id, result: { outcome: { outcome: 'cancelled' } } }
          : {
              jsonrpc: '2.0',
              id: message.id,
              error: { code: -32601, message: 'Client method is not supported' },
            },
      );
    }
  };
  if (agentId === 'codex') process.child.stdin.end(prompt.text);
  else if (agentId === 'claude') {
    process.send({
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: prompt.text },
          ...prompt.images.map((image) => ({
            type: 'image',
            source: { type: 'base64', media_type: image.mimeType, data: image.data },
          })),
        ],
      },
    });
    process.child.stdin.end();
  } else {
    const initialized = await process.request('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'forma-local-agent-bridge', version: '0.1.0' },
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    });
    if (prompt.images.length && !initialized.agentCapabilities?.promptCapabilities?.image)
      throw new Error('此 Kimi 版本未声明图片输入能力。');
    const session = await process.request('session/new', { cwd, mcpServers: [] });
    if (typeof session.sessionId !== 'string') throw new Error('Kimi 未返回有效会话 ID。');
    sessionId = session.sessionId;
    if (session.modes?.availableModes?.some((mode: any) => mode.id === 'plan')) {
      await process.request('session/set_mode', { sessionId, modeId: 'plan' });
    }
    if (model && model !== 'default')
      await process.request('session/set_model', { sessionId, modelId: model });
    const result = await process.request('session/prompt', {
      sessionId,
      prompt: [
        { type: 'text', text: prompt.text },
        ...prompt.images.map((image) => ({
          type: 'image',
          mimeType: image.mimeType,
          data: image.data,
        })),
      ],
    });
    if (result.stopReason !== 'end_turn')
      throw new Error(`Kimi 回合未正常完成（${String(result.stopReason)}）。`);
    finalText = streamedText;
    await process.stop();
  }
  await process.closed;
  if (!finalText?.trim())
    throw new Error('本地 Agent 没有返回最终文本，请检查 CLI 登录、模型及协议版本。');
  return finalText;
}
