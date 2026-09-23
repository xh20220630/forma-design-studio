import type { ProviderModel } from '@forma/schema';
import type { ChatMessage } from './types.ts';
import type { PrivateProvider } from './provider-settings.ts';
import { ApiError, isRecord, requireValue } from './errors.ts';

function redact(provider: PrivateProvider, value: string) {
  let result = value;
  for (const secret of [provider.apiKey, ...Object.values(provider.headers)].filter(Boolean)) result = result.replaceAll(secret, '[REDACTED]');
  return result;
}
function routeUrl(provider: PrivateProvider, route: string) {
  return new URL(`${provider.baseUrl}/${route.replace(/^\/+/, '')}`);
}
export async function providerRequest(provider: PrivateProvider, protocol: string, route: string, body?: unknown, query?: Record<string, string>) {
  const url = routeUrl(provider, route);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
  const headers = new Headers({ 'content-type': 'application/json' });
  if (protocol === 'anthropic') headers.set('anthropic-version', '2023-06-01');
  if (provider.apiKey && provider.auth !== 'none') {
    const keyHeader = provider.auth === 'api-key' ? 'api-key' : provider.auth === 'bearer' ? 'authorization'
      : protocol === 'anthropic' ? 'x-api-key' : ['gemini', 'imagen'].includes(protocol) ? 'x-goog-api-key' : 'authorization';
    headers.set(keyHeader, keyHeader === 'authorization' ? `Bearer ${provider.apiKey}` : provider.apiKey);
  }
  for (const [name, value] of Object.entries(provider.headers)) headers.set(name, value);
  let response: Response;
  try {
    response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error',
      signal: AbortSignal.timeout(body === undefined ? Math.min(provider.timeoutMs, 30000) : provider.timeoutMs) });
  } catch (error) {
    throw new ApiError(502, error instanceof Error && /Timeout|Abort/.test(error.name) ? '模型服务超时，请重试。' : '无法连接模型服务，请检查地址、协议和网络。');
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ApiError(502, `模型服务返回非 JSON 数据（HTTP ${response.status}）。`); }
  if (!response.ok) {
    const message = isRecord(payload) ? (isRecord(payload.error) ? payload.error.message : payload.error) || payload.message : undefined;
    throw new ApiError(502, `模型服务请求失败（HTTP ${response.status}）：${redact(provider, String(message || '未知错误')).slice(0, 700)}`);
  }
  requireValue(isRecord(payload), '模型服务返回的数据结构无效。', 502);
  return payload;
}

export async function listProviderModels(provider: PrivateProvider): Promise<{ models: ProviderModel[] }> {
  const protocol = provider.textProtocol !== 'none' ? provider.textProtocol : provider.imageProtocol;
  const results = new Map<string, ProviderModel>();
  const seen = new Set<string>();
  let cursor = '';
  for (let page = 0; page < 20; page++) {
    const query: Record<string, string> = protocol === 'anthropic' ? { limit: '1000', ...(cursor ? { after_id: cursor } : {}) }
      : ['gemini', 'imagen'].includes(protocol) ? { pageSize: '1000', ...(cursor ? { pageToken: cursor } : {}) }
      : cursor ? { after: cursor } : {};
    const payload = await providerRequest(provider, protocol, provider.modelsPath || 'models', undefined, query);
    const items = Array.isArray(payload.data) ? payload.data : payload.models;
    requireValue(Array.isArray(items), '上游没有返回模型列表；可在模型选择中手动填写模型 ID。', 502);
    for (const item of items) {
      if (!isRecord(item)) continue;
      const id = typeof item.id === 'string' ? item.id : typeof item.name === 'string' ? item.name.replace(/^models\//, '') : undefined;
      if (!id) continue;
      const name = typeof item.display_name === 'string' ? item.display_name : typeof item.displayName === 'string' ? item.displayName : id;
      results.set(id, { id: redact(provider, id), name: redact(provider, name) });
    }
    const next = typeof payload.nextPageToken === 'string' ? payload.nextPageToken
      : payload.has_more === true && typeof payload.last_id === 'string' ? payload.last_id : '';
    if (!next) return { models: [...results.values()].sort((a, b) => a.id.localeCompare(b.id)) };
    requireValue(!seen.has(next), '上游模型列表分页重复，未能读取完整列表。', 502);
    seen.add(next); cursor = next;
  }
  throw new ApiError(502, '上游模型列表超过分页限制，请手动填写模型 ID。');
}

function parts(message: ChatMessage) {
  return typeof message.content === 'string' ? [{ type: 'text' as const, text: message.content }] : message.content;
}
function inlineImage(url: string) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([\s\S]+)$/.exec(url);
  requireValue(match, '当前协议的视觉输入需要本地图片。');
  return { mimeType: match[1], data: match[2] };
}
function geminiMessages(messages: ChatMessage[]) {
  return {
    systemInstruction: { parts: messages.filter(m => m.role === 'system').flatMap(m => parts(m).filter(p => p.type === 'text').map(p => ({ text: p.text }))) },
    contents: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user',
      parts: parts(m).map(p => p.type === 'text' ? { text: p.text } : { inlineData: inlineImage(p.image_url.url) }) })),
  };
}
const modelRoute = (path: string, model: string) => path.replaceAll('{model}', encodeURIComponent(model.replace(/^models\//, '')));
function geminiParts(response: Record<string, unknown>) {
  const candidate: unknown = Array.isArray(response.candidates) ? response.candidates[0] : undefined;
  return isRecord(candidate) && isRecord(candidate.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts.filter(isRecord) : [];
}

export async function requestText(provider: PrivateProvider, model: string, messages: ChatMessage[]): Promise<string> {
  const protocol = provider.textProtocol;
  requireValue(protocol !== 'none', '此供应商不支持文本请求。');
  let response: Record<string, unknown>;
  if (protocol === 'anthropic') {
    response = await providerRequest(provider, protocol, modelRoute(provider.textPath || 'messages', model), {
      model, max_tokens: provider.maxOutputTokens,
      system: messages.filter(m => m.role === 'system').flatMap(m => parts(m).filter(p => p.type === 'text').map(p => p.text)).join('\n'),
      messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user',
        content: parts(m).map(p => {
          if (p.type === 'text') return p;
          const image = inlineImage(p.image_url.url);
          return { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.data } };
        }) })),
    });
    return Array.isArray(response.content) ? response.content.filter(isRecord).filter(p => p.type === 'text').map(p => p.text).join('') : '';
  }
  if (protocol === 'gemini') {
    response = await providerRequest(provider, protocol, modelRoute(provider.textPath || 'models/{model}:generateContent', model), {
      ...geminiMessages(messages), generationConfig: { maxOutputTokens: provider.maxOutputTokens, ...(provider.jsonMode ? { responseMimeType: 'application/json' } : {}) },
    });
    return geminiParts(response).filter(p => typeof p.text === 'string' && p.thought !== true).map(p => p.text).join('');
  }
  if (protocol === 'openai-responses') {
    response = await providerRequest(provider, protocol, modelRoute(provider.textPath || 'responses', model), {
      model, store: false, max_output_tokens: provider.maxOutputTokens,
      input: messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : m.content.map(p => p.type === 'text' ? { type: 'input_text', text: p.text } : { type: 'input_image', image_url: p.image_url.url }) })),
      ...(provider.jsonMode ? { text: { format: { type: 'json_object' } } } : {}),
    });
    if (typeof response.output_text === 'string') return response.output_text;
    return Array.isArray(response.output) ? response.output.filter(isRecord).flatMap(item => Array.isArray(item.content) ? item.content.filter(isRecord) : []).filter(p => p.type === 'output_text').map(p => p.text).join('') : '';
  }
  response = await providerRequest(provider, protocol, modelRoute(provider.textPath || 'chat/completions', model), {
    model, messages, ...(provider.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });
  const choice: unknown = Array.isArray(response.choices) ? response.choices[0] : undefined;
  const content = isRecord(choice) && isRecord(choice.message) ? choice.message.content : undefined;
  return typeof content === 'string' ? content : Array.isArray(content) ? content.filter(isRecord).map(p => p.text || '').join('') : '';
}

export async function requestImage(provider: PrivateProvider, model: string, prompt: string): Promise<{ b64_json?: string; url?: string }> {
  const protocol = provider.imageProtocol;
  requireValue(protocol !== 'none', '此供应商未启用图片生成。');
  if (protocol === 'gemini') {
    const response = await providerRequest(provider, protocol, modelRoute(provider.imagePath || 'models/{model}:generateContent', model), {
      contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    const image = geminiParts(response).map(p => p.inlineData || p.inline_data).find(isRecord);
    requireValue(image && typeof image.data === 'string', '模型没有返回图片，请选择支持生图的 Gemini 模型。', 502);
    return { b64_json: image.data };
  }
  if (protocol === 'imagen') {
    const response = await providerRequest(provider, protocol, modelRoute(provider.imagePath || 'models/{model}:predict', model), {
      instances: [{ prompt }], parameters: { sampleCount: 1 },
    });
    const image: unknown = Array.isArray(response.predictions) ? response.predictions[0] : undefined;
    requireValue(isRecord(image) && typeof image.bytesBase64Encoded === 'string', 'Imagen 没有返回图片。', 502);
    return { b64_json: image.bytesBase64Encoded };
  }
  const response = await providerRequest(provider, protocol, modelRoute(provider.imagePath || 'images/generations', model), {
    model, prompt, n: 1, ...(provider.imageSize ? { size: provider.imageSize } : {}),
  });
  const result: unknown = Array.isArray(response.data) ? response.data[0] : undefined;
  requireValue(isRecord(result) && (typeof result.b64_json === 'string' || typeof result.url === 'string'), '模型没有返回图片，请确认模型支持 Images API。', 502);
  return { ...(typeof result.b64_json === 'string' ? { b64_json: result.b64_json } : {}), ...(typeof result.url === 'string' ? { url: result.url } : {}) };
}
