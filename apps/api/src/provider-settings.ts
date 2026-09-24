import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ModelProvider, ModelBinding, ProviderSettings } from '@forma/schema';
import { ApiError, isRecord, requireValue } from './errors.ts';
import { dataRoot, readJson, transact, writeJson } from './store.ts';

/** 含认证信息的服务端供应商配置，只供持久化和上游请求使用。 */
export interface PrivateProvider extends Omit<ModelProvider, 'hasApiKey' | 'headerNames'> {
  /** 服务端保存的供应商密钥，禁止作为公开配置返回。 */
  apiKey: string;
  /** 发给供应商的额外请求头，可能包含私密认证值。 */
  headers: Record<string, string>;
}
/** 保存在服务端的完整模型设置，与浏览器可见摘要分开维护。 */
interface StoredSettings {
  /** 规范或安装内容的版本标识。 */
  version: 2;
  /** 可供选择的供应商连接。 */
  providers: PrivateProvider[];
  /** 需要展示或编辑的文字内容。 */
  text: ModelBinding;
  /** 图片数据、图片模型绑定或页面图片节点。 */
  image: ModelBinding;
}
const settingsPath = path.join(dataRoot, 'settings.json');
/**
 * 创建未选择供应商和模型的绑定，作为设置缺失时的默认状态。
 * @returns 空模型绑定。
 */
const emptyBinding = (): ModelBinding => ({ providerId: '', model: '' });
const defaults = {
  name: '自定义供应商',
  baseUrl: 'https://api.openai.com/v1',
  textProtocol: 'openai',
  imageProtocol: 'openai-images',
  auth: 'auto',
  apiKey: '',
  headers: {},
  modelsPath: '',
  textPath: '',
  imagePath: '',
  imageEditPath: '',
  timeoutMs: 180000,
  maxOutputTokens: 8192,
  jsonMode: true,
  imageSize: '',
} satisfies Omit<PrivateProvider, 'id'>;

/**
 * 加载持久化的供应商设置，并兼容已有配置格式。
 * @returns 供服务端使用的完整设置。
 */
async function readSettings(): Promise<StoredSettings> {
  const raw = await readJson<Record<string, unknown>>(settingsPath, {});
  if (raw.version === 2 && Array.isArray(raw.providers)) return raw as unknown as StoredSettings;
  // Import the previous single connection and environment defaults only before v2 is saved.
  const provider: PrivateProvider = {
    ...defaults,
    id: 'legacy-default',
    name: '默认供应商',
    baseUrl: String(raw.baseUrl || process.env.FORMA_API_BASE_URL || defaults.baseUrl),
    apiKey: String(raw.apiKey || process.env.OPENAI_API_KEY || ''),
  };
  return {
    version: 2,
    providers: [provider],
    text: {
      providerId: provider.id,
      model: String(raw.textModel || process.env.FORMA_TEXT_MODEL || 'gpt-4.1'),
    },
    image: {
      providerId: provider.id,
      model: String(raw.imageModel || process.env.FORMA_IMAGE_MODEL || 'gpt-image-1'),
    },
  };
}

/**
 * 检查模型绑定是否指向可用连接，决定界面能否启动对应生成任务。
 *
 * @param provider - 当前上游连接配置。
 * @param model - 发送给上游的模型标识。
 * @param channel - 文字或图片任务通道。
 * @returns 该绑定是否已配置就绪。
 */
function ready(provider: PrivateProvider | undefined, model: string, channel: 'text' | 'image') {
  return Boolean(
    provider &&
      model &&
      provider[channel === 'text' ? 'textProtocol' : 'imageProtocol'] !== 'none' &&
      (provider.auth === 'none' || provider.apiKey || Object.keys(provider.headers).length),
  );
}
/**
 * 将供应商私有配置转换为公开摘要，隐藏 API Key 和私有请求头值。
 *
 * @param settings - 当前生效的设置。
 * @returns 可返回给浏览器的供应商设置。
 */
function publicSettings(settings: StoredSettings): ProviderSettings {
  const text = settings.providers.find(
    /** 检查当前项的标识等于 settings 的文字内容的供应商标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (p) => p.id === settings.text.providerId,
  );
  const image = settings.providers.find(
    /** 检查当前项的标识等于 settings 的image的供应商标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (p) => p.id === settings.image.providerId,
  );
  return {
    providers: settings.providers.map(
      /**
       * 转换 publicSettings 中的集合条目，供后续处理或展示。
       *
       * @param options - 按字段解构的输入，字段用途见对应类型定义。
       * @param options.apiKey - 服务端保存的供应商密钥，禁止作为公开配置返回。
       * @param options.headers - 发给供应商的额外请求头，可能包含私密认证值。
       * @returns 当前条目转换后的结果。
       */
      ({ apiKey, headers, ...provider }) => ({
        ...provider,
        hasApiKey: Boolean(apiKey),
        headerNames: Object.keys(headers),
      }),
    ),
    text: settings.text,
    image: settings.image,
    configured: ready(text, settings.text.model, 'text'),
    imageConfigured: ready(image, settings.image.model, 'image'),
    baseUrl: text?.baseUrl || '',
    textModel: settings.text.model,
    imageModel: settings.image.model,
  };
}
/**
 * 读取并转换供应商配置，确保客户端只拿到公开字段。
 * @returns 公开的模型连接设置。
 */
export async function getProviderSettings() {
  return publicSettings(await readSettings());
}

/**
 * 校验连接地址、协议和限制参数，阻止无效配置进入持久化存储。
 *
 * @param input - 当前步骤需要处理的输入。
 * @param current - 更新前的当前值。
 * @returns 规范化后的供应商配置。
 */
export function validateProvider(
  input: Record<string, unknown>,
  current?: PrivateProvider,
): PrivateProvider {
  const next: PrivateProvider = {
    ...defaults,
    ...current,
    id: current?.id || randomUUID(),
  };
  for (const key of [
    'name',
    'baseUrl',
    'modelsPath',
    'textPath',
    'imagePath',
    'imageEditPath',
    'imageSize',
  ] as const) {
    if (input[key] === undefined) continue;
    requireValue(typeof input[key] === 'string' && input[key].length <= 1000, `${key} 格式无效。`);
    next[key] = input[key].trim();
  }
  requireValue(next.name.length > 0 && next.baseUrl.length > 0, '供应商名称和服务地址不能为空。');
  let base: URL;
  try {
    base = new URL(next.baseUrl);
  } catch {
    throw new ApiError(400, 'API Base URL 格式无效。');
  }
  requireValue(
    !base.username && !base.password && !base.search && !base.hash,
    '服务地址不能包含凭据、查询参数或片段。',
  );
  requireValue(
    base.protocol === 'https:' ||
      (base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)),
    'API 服务必须使用 HTTPS，本地服务可使用 HTTP。',
  );
  next.baseUrl = next.baseUrl.replace(/\/+$/, '');
  for (const [key, allowed] of [
    ['textProtocol', ['openai', 'openai-responses', 'anthropic', 'gemini', 'none']],
    ['imageProtocol', ['openai-images', 'gemini', 'imagen', 'none']],
    ['auth', ['auto', 'bearer', 'api-key', 'none']],
  ] as const) {
    if (input[key] === undefined) continue;
    requireValue(
      typeof input[key] === 'string' && (allowed as readonly string[]).includes(input[key]),
      `${key} 不受支持。`,
    );
    Object.assign(next, { [key]: input[key] });
  }
  requireValue(
    next.textProtocol !== 'none' || next.imageProtocol !== 'none',
    '至少启用文本或图片中的一种能力。',
  );
  for (const key of ['modelsPath', 'textPath', 'imagePath', 'imageEditPath'] as const) {
    // Paths stay on the configured host; credentials never follow redirects to another host.
    requireValue(
      !next[key] ||
        (/^[a-zA-Z0-9_/{}/:.-]+$/.test(next[key]!) &&
          !next[key]!.includes('..') &&
          !next[key]!.includes('://') &&
          !next[key]!.startsWith('//')),
      `${key} 必须是相对接口路径，可包含 {model}。`,
    );
  }
  for (const [key, min, max] of [
    ['timeoutMs', 1000, 600000],
    ['maxOutputTokens', 128, 131072],
  ] as const) {
    if (input[key] === undefined) continue;
    requireValue(
      typeof input[key] === 'number' &&
        Number.isInteger(input[key]) &&
        input[key] >= min &&
        input[key] <= max,
      `${key} 必须位于 ${min}–${max}。`,
    );
    next[key] = input[key];
  }
  if (input.jsonMode !== undefined) {
    requireValue(typeof input.jsonMode === 'boolean', 'JSON 模式必须是布尔值。');
    next.jsonMode = input.jsonMode;
  }
  if (input.clearApiKey === true) next.apiKey = '';
  if (input.apiKey !== undefined) {
    requireValue(
      typeof input.apiKey === 'string' &&
        input.apiKey.length <= 8192 &&
        !/[\r\n]/.test(input.apiKey),
      'API Key 格式无效。',
    );
    if (input.apiKey.trim()) next.apiKey = input.apiKey.trim();
  }
  if (input.headers !== undefined) {
    requireValue(
      isRecord(input.headers) && Object.keys(input.headers).length <= 20,
      '自定义请求头必须是最多 20 项的 JSON 对象。',
    );
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.headers)) {
      requireValue(
        /^[a-zA-Z0-9-]+$/.test(key) &&
          !['host', 'content-length', 'connection', 'transfer-encoding', 'cookie'].includes(
            key.toLowerCase(),
          ),
        '包含不支持的请求头名称。',
      );
      requireValue(
        typeof value === 'string' && value.length <= 8192 && !/[\r\n]/.test(value),
        '请求头值必须是单行字符串。',
      );
      headers[key.toLowerCase()] = value;
    }
    next.headers = headers;
  }
  return next;
}

/**
 * 校验模型绑定与供应商能力是否匹配。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param providers - 可供选择的供应商连接。
 * @param channel - 文字或图片任务通道。
 * @returns 通过校验的模型绑定。
 */
function binding(
  value: unknown,
  providers: PrivateProvider[],
  channel: 'text' | 'image',
): ModelBinding {
  requireValue(
    isRecord(value) && typeof value.providerId === 'string' && typeof value.model === 'string',
    '模型选择格式无效。',
  );
  const model = value.model.trim();
  requireValue(model.length <= 300 && !/[\r\n]/.test(model), '模型 ID 格式无效。');
  if (!value.providerId) {
    requireValue(!model, '请先选择供应商。');
    return emptyBinding();
  }
  const provider = providers.find(
    /** 检查当前项的标识等于取值的供应商标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (p) => p.id === value.providerId,
  );
  requireValue(provider, '选择的供应商不存在。');
  requireValue(
    provider[channel === 'text' ? 'textProtocol' : 'imageProtocol'] !== 'none',
    `该供应商未启用${channel === 'text' ? '文本' : '生图'}能力。`,
  );
  return { providerId: provider.id, model };
}

/**
 * 保存文字和图片模型的选择，让两类任务使用各自的连接。
 *
 * @param input - 当前步骤需要处理的输入。
 * @returns 更新后的公开设置。
 */
export function saveModelBindings(input: Record<string, unknown>) {
  return transact(
    /**
     * 在串行事务内完成 saveModelBindings 的状态修改，避免并发写入覆盖彼此。
     * @returns 当前步骤的处理结果。
     */
    async () => {
      const settings = await readSettings();
      for (const channel of ['text', 'image'] as const)
        if (input[channel] !== undefined)
          settings[channel] = binding(input[channel], settings.providers, channel);
      await writeJson(settingsPath, settings);
      return publicSettings(settings);
    },
  );
}
/**
 * 新增或更新供应商连接，并保留未主动替换的私密配置。
 *
 * @param input - 当前步骤需要处理的输入。
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @returns 更新后的公开设置。
 */
export function saveProvider(input: Record<string, unknown>, id?: string) {
  return transact(
    /**
     * 在串行事务内完成 saveProvider 的状态修改，避免并发写入覆盖彼此。
     * @returns 当前步骤的处理结果。
     */
    async () => {
      const settings = await readSettings();
      const current = id
        ? settings.providers.find(
            /** 检查当前项的标识等于标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
            (p) => p.id === id,
          )
        : undefined;
      if (id) requireValue(current, '供应商不存在。', 404);
      const next = validateProvider(input, current);
      settings.providers = current
        ? settings.providers.map(
            /** 转换 saveProvider 中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
            (p) => (p.id === id ? next : p),
          )
        : [...settings.providers, next];
      for (const channel of ['text', 'image'] as const) {
        if (
          settings[channel].providerId === next.id &&
          next[channel === 'text' ? 'textProtocol' : 'imageProtocol'] === 'none'
        )
          settings[channel] = emptyBinding();
      }
      await writeJson(settingsPath, settings);
      return publicSettings(settings);
    },
  );
}
/**
 * 移除供应商并清理相关绑定，避免继续引用已删除的连接。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @returns 删除后的公开设置。
 */
export function deleteProvider(id: string) {
  return transact(
    /**
     * 在串行事务内完成 deleteProvider 的状态修改，避免并发写入覆盖彼此。
     * @returns 当前步骤的处理结果。
     */
    async () => {
      const settings = await readSettings();
      requireValue(
        settings.providers.some(
          /** 检查当前项的标识等于标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (p) => p.id === id,
        ),
        '供应商不存在。',
        404,
      );
      settings.providers = settings.providers.filter(
        /** 检查当前项的标识不等于标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (p) => p.id !== id,
      );
      for (const channel of ['text', 'image'] as const)
        if (settings[channel].providerId === id) settings[channel] = emptyBinding();
      await writeJson(settingsPath, settings);
      return publicSettings(settings);
    },
  );
}
/**
 * 在服务端获取含认证信息的连接，供实际发送上游请求使用。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @returns 指定供应商的私有配置。
 */
export async function getPrivateProvider(id: string) {
  const settings = await readSettings();
  const provider = settings.providers.find(
    /** 检查当前项的标识等于标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (p) => p.id === id,
  );
  requireValue(provider, '供应商不存在。', 404);
  return provider;
}
/**
 * 根据任务类型解析当前模型和供应商，统一处理未配置的情况。
 *
 * @param channel - 文字或图片任务通道。
 * @returns 可用于请求的供应商及模型名称。
 */
export async function resolveModel(channel: 'text' | 'image') {
  const settings = await readSettings();
  const selected = settings[channel];
  const provider = settings.providers.find(
    /** 检查当前项的标识等于 selected 的供应商标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (p) => p.id === selected.providerId,
  );
  requireValue(
    ready(provider, selected.model, channel),
    `请先配置${channel === 'text' ? '文本 / 视觉' : '图片生成'}供应商和模型，并设置 API Key（本地服务可选择无需密钥）。`,
  );
  return { provider: provider!, model: selected.model };
}

// Preserve the old settings endpoint for existing local clients.
/**
 * 适配旧版设置入口，使已有客户端仍能保存模型配置。
 *
 * @param input - 当前步骤需要处理的输入。
 * @returns 保存后的公开设置。
 */
export function saveProviderSettings(input: Record<string, unknown>) {
  if ('text' in input || 'image' in input) return saveModelBindings(input);
  return transact(
    /**
     * 在串行事务内完成 saveProviderSettings 的状态修改，避免并发写入覆盖彼此。
     * @returns 当前步骤的处理结果。
     */
    async () => {
      const settings = await readSettings();
      const current =
        settings.providers.find(
          /** 检查当前项的标识等于 settings 的文字内容的供应商标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (p) => p.id === settings.text.providerId,
        ) || settings.providers[0];
      const next = validateProvider(input, current);
      settings.providers = current
        ? settings.providers.map(
            /** 转换 saveProviderSettings 中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
            (p) => (p.id === current.id ? next : p),
          )
        : [next];
      for (const channel of ['text', 'image'] as const) {
        const key = channel === 'text' ? 'textModel' : 'imageModel';
        if (input[key] !== undefined) {
          requireValue(
            typeof input[key] === 'string' && input[key].trim().length > 0,
            `${key} 不能为空。`,
          );
          settings[channel] = binding(
            { providerId: next.id, model: input[key] },
            settings.providers,
            channel,
          );
        }
      }
      await writeJson(settingsPath, settings);
      return publicSettings(settings);
    },
  );
}
