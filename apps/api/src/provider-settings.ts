import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ModelProvider, ModelBinding, ProviderSettings } from '@forma/schema';
import { ApiError, isRecord, requireValue } from './errors.ts';
import { dataRoot, readJson, transact, writeJson } from './store.ts';

export interface PrivateProvider extends Omit<ModelProvider, 'hasApiKey' | 'headerNames'> {
  apiKey: string;
  headers: Record<string, string>;
}
interface StoredSettings { version: 2; providers: PrivateProvider[]; text: ModelBinding; image: ModelBinding }
const settingsPath = path.join(dataRoot, 'settings.json');
const emptyBinding = (): ModelBinding => ({ providerId: '', model: '' });
const defaults = {
  name: '自定义供应商', baseUrl: 'https://api.openai.com/v1', textProtocol: 'openai', imageProtocol: 'openai-images',
  auth: 'auto', apiKey: '', headers: {}, modelsPath: '', textPath: '', imagePath: '', timeoutMs: 180000,
  maxOutputTokens: 8192, jsonMode: true, imageSize: '1536x1024',
} satisfies Omit<PrivateProvider, 'id'>;

async function readSettings(): Promise<StoredSettings> {
  const raw = await readJson<Record<string, unknown>>(settingsPath, {});
  if (raw.version === 2 && Array.isArray(raw.providers)) return raw as unknown as StoredSettings;
  // Import the previous single connection and environment defaults only before v2 is saved.
  const provider: PrivateProvider = { ...defaults, id: 'legacy-default', name: '默认供应商',
    baseUrl: String(raw.baseUrl || process.env.FORMA_API_BASE_URL || defaults.baseUrl),
    apiKey: String(raw.apiKey || process.env.OPENAI_API_KEY || '') };
  return { version: 2, providers: [provider],
    text: { providerId: provider.id, model: String(raw.textModel || process.env.FORMA_TEXT_MODEL || 'gpt-4.1') },
    image: { providerId: provider.id, model: String(raw.imageModel || process.env.FORMA_IMAGE_MODEL || 'gpt-image-1') } };
}

function ready(provider: PrivateProvider | undefined, model: string, channel: 'text' | 'image') {
  return Boolean(provider && model && provider[channel === 'text' ? 'textProtocol' : 'imageProtocol'] !== 'none'
    && (provider.auth === 'none' || provider.apiKey || Object.keys(provider.headers).length));
}
function publicSettings(settings: StoredSettings): ProviderSettings {
  const text = settings.providers.find(p => p.id === settings.text.providerId);
  const image = settings.providers.find(p => p.id === settings.image.providerId);
  return {
    providers: settings.providers.map(({ apiKey, headers, ...provider }) => ({ ...provider, hasApiKey: Boolean(apiKey), headerNames: Object.keys(headers) })),
    text: settings.text, image: settings.image,
    configured: ready(text, settings.text.model, 'text'), imageConfigured: ready(image, settings.image.model, 'image'),
    baseUrl: text?.baseUrl || '', textModel: settings.text.model, imageModel: settings.image.model,
  };
}
export async function getProviderSettings() { return publicSettings(await readSettings()); }

export function validateProvider(input: Record<string, unknown>, current?: PrivateProvider): PrivateProvider {
  const next: PrivateProvider = { ...defaults, ...current, id: current?.id || randomUUID() };
  for (const key of ['name', 'baseUrl', 'modelsPath', 'textPath', 'imagePath', 'imageSize'] as const) {
    if (input[key] === undefined) continue;
    requireValue(typeof input[key] === 'string' && input[key].length <= 1000, `${key} 格式无效。`);
    next[key] = input[key].trim();
  }
  requireValue(next.name.length > 0 && next.baseUrl.length > 0, '供应商名称和服务地址不能为空。');
  let base: URL;
  try { base = new URL(next.baseUrl); } catch { throw new ApiError(400, 'API Base URL 格式无效。'); }
  requireValue(!base.username && !base.password && !base.search && !base.hash, '服务地址不能包含凭据、查询参数或片段。');
  requireValue(base.protocol === 'https:' || (base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)), 'API 服务必须使用 HTTPS，本地服务可使用 HTTP。');
  next.baseUrl = next.baseUrl.replace(/\/+$/, '');
  for (const [key, allowed] of [
    ['textProtocol', ['openai', 'openai-responses', 'anthropic', 'gemini', 'none']],
    ['imageProtocol', ['openai-images', 'gemini', 'imagen', 'none']],
    ['auth', ['auto', 'bearer', 'api-key', 'none']],
  ] as const) {
    if (input[key] === undefined) continue;
    requireValue(typeof input[key] === 'string' && (allowed as readonly string[]).includes(input[key]), `${key} 不受支持。`);
    Object.assign(next, { [key]: input[key] });
  }
  requireValue(next.textProtocol !== 'none' || next.imageProtocol !== 'none', '至少启用文本或图片中的一种能力。');
  for (const key of ['modelsPath', 'textPath', 'imagePath'] as const) {
    // Paths stay on the configured host; credentials never follow redirects to another host.
    requireValue(!next[key] || (/^[a-zA-Z0-9_/{}/:.-]+$/.test(next[key]) && !next[key].includes('..') && !next[key].includes('://') && !next[key].startsWith('//')), `${key} 必须是相对接口路径，可包含 {model}。`);
  }
  for (const [key, min, max] of [['timeoutMs', 1000, 600000], ['maxOutputTokens', 128, 131072]] as const) {
    if (input[key] === undefined) continue;
    requireValue(typeof input[key] === 'number' && Number.isInteger(input[key]) && input[key] >= min && input[key] <= max, `${key} 必须位于 ${min}–${max}。`);
    next[key] = input[key];
  }
  if (input.jsonMode !== undefined) { requireValue(typeof input.jsonMode === 'boolean', 'JSON 模式必须是布尔值。'); next.jsonMode = input.jsonMode; }
  if (input.clearApiKey === true) next.apiKey = '';
  if (input.apiKey !== undefined) {
    requireValue(typeof input.apiKey === 'string' && input.apiKey.length <= 8192 && !/[\r\n]/.test(input.apiKey), 'API Key 格式无效。');
    if (input.apiKey.trim()) next.apiKey = input.apiKey.trim();
  }
  if (input.headers !== undefined) {
    requireValue(isRecord(input.headers) && Object.keys(input.headers).length <= 20, '自定义请求头必须是最多 20 项的 JSON 对象。');
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.headers)) {
      requireValue(/^[a-zA-Z0-9-]+$/.test(key) && !['host', 'content-length', 'connection', 'transfer-encoding', 'cookie'].includes(key.toLowerCase()), '包含不支持的请求头名称。');
      requireValue(typeof value === 'string' && value.length <= 8192 && !/[\r\n]/.test(value), '请求头值必须是单行字符串。');
      headers[key.toLowerCase()] = value;
    }
    next.headers = headers;
  }
  return next;
}

function binding(value: unknown, providers: PrivateProvider[], channel: 'text' | 'image'): ModelBinding {
  requireValue(isRecord(value) && typeof value.providerId === 'string' && typeof value.model === 'string', '模型选择格式无效。');
  const model = value.model.trim();
  requireValue(model.length <= 300 && !/[\r\n]/.test(model), '模型 ID 格式无效。');
  if (!value.providerId) { requireValue(!model, '请先选择供应商。'); return emptyBinding(); }
  const provider = providers.find(p => p.id === value.providerId);
  requireValue(provider, '选择的供应商不存在。');
  requireValue(provider[channel === 'text' ? 'textProtocol' : 'imageProtocol'] !== 'none', `该供应商未启用${channel === 'text' ? '文本' : '生图'}能力。`);
  return { providerId: provider.id, model };
}

export function saveModelBindings(input: Record<string, unknown>) {
  return transact(async () => {
    const settings = await readSettings();
    for (const channel of ['text', 'image'] as const) if (input[channel] !== undefined) settings[channel] = binding(input[channel], settings.providers, channel);
    await writeJson(settingsPath, settings);
    return publicSettings(settings);
  });
}
export function saveProvider(input: Record<string, unknown>, id?: string) {
  return transact(async () => {
    const settings = await readSettings();
    const current = id ? settings.providers.find(p => p.id === id) : undefined;
    if (id) requireValue(current, '供应商不存在。', 404);
    const next = validateProvider(input, current);
    settings.providers = current ? settings.providers.map(p => p.id === id ? next : p) : [...settings.providers, next];
    for (const channel of ['text', 'image'] as const) {
      if (settings[channel].providerId === next.id && next[channel === 'text' ? 'textProtocol' : 'imageProtocol'] === 'none') settings[channel] = emptyBinding();
    }
    await writeJson(settingsPath, settings);
    return publicSettings(settings);
  });
}
export function deleteProvider(id: string) {
  return transact(async () => {
    const settings = await readSettings();
    requireValue(settings.providers.some(p => p.id === id), '供应商不存在。', 404);
    settings.providers = settings.providers.filter(p => p.id !== id);
    for (const channel of ['text', 'image'] as const) if (settings[channel].providerId === id) settings[channel] = emptyBinding();
    await writeJson(settingsPath, settings);
    return publicSettings(settings);
  });
}
export async function getPrivateProvider(id: string) {
  const settings = await readSettings();
  const provider = settings.providers.find(p => p.id === id);
  requireValue(provider, '供应商不存在。', 404);
  return provider;
}
export async function resolveModel(channel: 'text' | 'image') {
  const settings = await readSettings();
  const selected = settings[channel];
  const provider = settings.providers.find(p => p.id === selected.providerId);
  requireValue(ready(provider, selected.model, channel), `请先配置${channel === 'text' ? '文本 / 视觉' : '图片生成'}供应商和模型。`);
  return { provider: provider!, model: selected.model };
}

// Preserve the old settings endpoint for existing local clients.
export function saveProviderSettings(input: Record<string, unknown>) {
  if ('text' in input || 'image' in input) return saveModelBindings(input);
  return transact(async () => {
    const settings = await readSettings();
    const current = settings.providers.find(p => p.id === settings.text.providerId) || settings.providers[0];
    const next = validateProvider(input, current);
    settings.providers = current ? settings.providers.map(p => p.id === current.id ? next : p) : [next];
    for (const channel of ['text', 'image'] as const) {
      const key = channel === 'text' ? 'textModel' : 'imageModel';
      if (input[key] !== undefined) {
        requireValue(typeof input[key] === 'string' && input[key].trim().length > 0, `${key} 不能为空。`);
        settings[channel] = binding({ providerId: next.id, model: input[key] }, settings.providers, channel);
      }
    }
    await writeJson(settingsPath, settings);
    return publicSettings(settings);
  });
}
