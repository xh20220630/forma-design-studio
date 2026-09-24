import type { ProviderModel } from '@forma/schema';
import type { ChatMessage } from './types.ts';
import type { PrivateProvider } from './provider-settings.ts';
import { ApiError, isRecord, requireValue } from './errors.ts';

/**
 * 从上游错误文本中移除密钥等敏感内容，避免错误提示泄露凭据。
 *
 * @param provider - 当前上游连接配置。
 * @param value - 当前字段、模式或控件的取值。
 * @returns 可用于错误提示的脱敏文本。
 */
function redact(provider: PrivateProvider, value: string) {
  let result = value;
  for (const secret of [provider.apiKey, ...Object.values(provider.headers)].filter(Boolean))
    result = result.replaceAll(secret, '[REDACTED]');
  return result;
}
/**
 * 按供应商基地址拼接接口路径，统一处理自定义端点。
 *
 * @param provider - 当前上游连接配置。
 * @param route - 要请求的接口路径。
 * @returns 最终的上游请求 URL。
 */
function routeUrl(provider: PrivateProvider, route: string) {
  return new URL(`${provider.baseUrl}/${route.replace(/^\/+/, '')}`);
}
/**
 * 统一发送不同协议的上游请求，处理认证、超时、响应解析和错误脱敏。
 *
 * @param provider - 当前上游连接配置。
 * @param protocol - 当前供应商采用的交互协议。
 * @param route - 要请求的接口路径。
 * @param body - 请求正文或文档内容。
 * @param query - 搜索条件或查询文本。
 * @returns 上游返回的 JSON 对象。
 */
export async function providerRequest(
  provider: PrivateProvider,
  protocol: string,
  route: string,
  body?: unknown,
  query?: Record<string, string>,
) {
  const url = routeUrl(provider, route);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
  const multipart = body instanceof FormData;
  const headers = new Headers(multipart ? {} : { 'content-type': 'application/json' });
  if (protocol === 'anthropic') headers.set('anthropic-version', '2023-06-01');
  if (provider.apiKey && provider.auth !== 'none') {
    const keyHeader =
      provider.auth === 'api-key'
        ? 'api-key'
        : provider.auth === 'bearer'
          ? 'authorization'
          : protocol === 'anthropic'
            ? 'x-api-key'
            : ['gemini', 'imagen'].includes(protocol)
              ? 'x-goog-api-key'
              : 'authorization';
    headers.set(
      keyHeader,
      keyHeader === 'authorization' ? `Bearer ${provider.apiKey}` : provider.apiKey,
    );
  }
  for (const [name, value] of Object.entries(provider.headers)) headers.set(name, value);
  if (multipart) headers.delete('content-type');
  const timeoutMs = body === undefined ? Math.min(provider.timeoutMs, 30000) : provider.timeoutMs;
  const signal = AbortSignal.timeout(timeoutMs);
  const started = performance.now();
  /**
   * 计算请求已经消耗的时间，供超时提示说明等待时长。
   * @returns 已等待的时间。
   */
  const elapsed = () => ((performance.now() - started) / 1000).toFixed(1);
  /**
   * 生成带等待时长的超时错误，帮助用户区分慢响应与配置问题。
   *
   * @param stage - 当前渲染区域或请求执行阶段。
   * @returns 描述本次超时的 API 错误。
   */
  const deadlineError = (stage: string) =>
    new ApiError(
      502,
      `${stage}时达到本地 ${timeoutMs / 1000} 秒超时上限（已等待 ${elapsed()} 秒），请求已中止。可在供应商高级设置中调整超时，或缩小本次生成范围。`,
    );
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
      redirect: 'error',
      signal,
    });
  } catch {
    if (signal.aborted) throw deadlineError('等待上游响应');
    throw new ApiError(502, `无法连接模型服务（已等待 ${elapsed()} 秒），请检查地址、协议和网络。`);
  }
  if ([408, 504, 524].includes(response.status)) {
    await response.body?.cancel();
    throw new ApiError(
      502,
      `上游模型服务返回超时（HTTP ${response.status}，已等待 ${elapsed()} 秒）。请稍后重试或联系供应商。`,
    );
  }
  let raw: string;
  try {
    raw = await response.text();
  } catch {
    if (signal.aborted) throw deadlineError('接收响应内容');
    throw new ApiError(502, `读取模型服务响应失败（已等待 ${elapsed()} 秒），请检查网络或重试。`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    const endpoint = redact(provider, url.pathname);
    const html =
      /\btext\/html\b/i.test(response.headers.get('content-type') || '') ||
      /^\s*(?:<!doctype\s+html|<html\b)/i.test(raw);
    throw new ApiError(
      502,
      html
        ? `模型接口 ${endpoint} 返回了网页（HTTP ${response.status}），不是 API JSON。请检查 API Base URL 是否缺少 /v1 等版本前缀，以及自定义接口路径是否正确；模型目录可访问不代表聊天接口可用。`
        : `模型接口 ${endpoint} 返回非 JSON 数据（HTTP ${response.status}），请检查供应商协议和接口路径。`,
    );
  }
  if (!response.ok) {
    const message = isRecord(payload)
      ? (isRecord(payload.error) ? payload.error.message : payload.error) || payload.message
      : undefined;
    throw new ApiError(
      502,
      `模型服务请求失败（HTTP ${response.status}）：${redact(provider, String(message || '未知错误')).slice(0, 700)}`,
    );
  }
  requireValue(isRecord(payload), '模型服务返回的数据结构无效。', 502);
  return payload;
}

/**
 * 按连接配置查询模型列表，并转换为界面通用的选项结构。
 *
 * @param provider - 当前上游连接配置。
 * @returns 可供选择的模型列表。
 */
export async function listProviderModels(provider: PrivateProvider): Promise<{
  /** 供应商提供的模型选项。 */
  models: ProviderModel[];
}> {
  const protocol =
    provider.textProtocol !== 'none' ? provider.textProtocol : provider.imageProtocol;
  const results = new Map<string, ProviderModel>();
  const seen = new Set<string>();
  let cursor = '';
  for (let page = 0; page < 20; page++) {
    const query: Record<string, string> =
      protocol === 'anthropic'
        ? { limit: '1000', ...(cursor ? { after_id: cursor } : {}) }
        : ['gemini', 'imagen'].includes(protocol)
          ? { pageSize: '1000', ...(cursor ? { pageToken: cursor } : {}) }
          : cursor
            ? { after: cursor }
            : {};
    const payload = await providerRequest(
      provider,
      protocol,
      provider.modelsPath || 'models',
      undefined,
      query,
    );
    const items = Array.isArray(payload.data) ? payload.data : payload.models;
    requireValue(
      Array.isArray(items),
      '上游没有返回模型列表；可在模型选择中手动填写模型 ID。',
      502,
    );
    for (const item of items) {
      if (!isRecord(item)) continue;
      const id =
        typeof item.id === 'string'
          ? item.id
          : typeof item.name === 'string'
            ? item.name.replace(/^models\//, '')
            : undefined;
      if (!id) continue;
      const name =
        typeof item.display_name === 'string'
          ? item.display_name
          : typeof item.displayName === 'string'
            ? item.displayName
            : id;
      results.set(id, {
        id: redact(provider, id),
        name: redact(provider, name),
      });
    }
    const next =
      typeof payload.nextPageToken === 'string'
        ? payload.nextPageToken
        : payload.has_more === true && typeof payload.last_id === 'string'
          ? payload.last_id
          : '';
    if (!next)
      return {
        models: [...results.values()].sort(
          /** 比较 listProviderModels 中的两个条目，确定它们的先后顺序。 @param a - 第一个比较或计算对象。 @param b - 第二个比较或计算对象。 @returns 负数、零或正数，分别表示前排、相同顺序或后排。 */
          (a, b) => a.id.localeCompare(b.id),
        ),
      };
    requireValue(!seen.has(next), '上游模型列表分页重复，未能读取完整列表。', 502);
    seen.add(next);
    cursor = next;
  }
  throw new ApiError(502, '上游模型列表超过分页限制，请手动填写模型 ID。');
}

/**
 * 将纯文本消息转换为内容分块，使不同上游协议共用转换逻辑。
 *
 * @param message - 面向用户或调用方的说明消息。
 * @returns 消息的文本和图片分块。
 */
function parts(message: ChatMessage) {
  return typeof message.content === 'string'
    ? [{ type: 'text' as const, text: message.content }]
    : message.content;
}
/**
 * 解析图片数据地址，供需要内联图片字节的模型协议使用。
 *
 * @param url - 资源或服务的访问地址。
 * @returns 图片 MIME 类型和 Base64 内容。
 */
function inlineImage(url: string) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([\s\S]+)$/.exec(url);
  requireValue(match, '当前协议的视觉输入需要本地图片。');
  return { mimeType: match[1], data: match[2] };
}
/**
 * 将通用聊天消息转换为 Gemini 的系统说明与内容分块。
 *
 * @param messages - 按会话顺序保存的消息列表。
 * @returns Gemini 请求使用的消息字段。
 */
function geminiMessages(messages: ChatMessage[]) {
  return {
    systemInstruction: {
      parts: messages
        .filter(
          /** 检查 m 的角色等于“system”，供集合筛选或定位使用。 @param m - 当前变换矩阵或消息。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (m) => m.role === 'system',
        )
        .flatMap(
          /**
           * 转换 geminiMessages 中的集合条目并展开结果，供后续处理或展示。
           *
           * @param m - 当前变换矩阵或消息。
           * @returns 当前条目展开后的结果。
           */
          (m) =>
            parts(m)
              .filter(
                /** 检查当前项的类型等于“text”，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                (p) => p.type === 'text',
              )
              .map(
                /** 转换 geminiMessages 中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
                (p) => ({ text: p.text }),
              ),
        ),
    },
    contents: messages
      .filter(
        /** 检查 m 的角色不等于“system”，供集合筛选或定位使用。 @param m - 当前变换矩阵或消息。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (m) => m.role !== 'system',
      )
      .map(
        /**
         * 转换 geminiMessages 中的集合条目，供后续处理或展示。
         *
         * @param m - 当前变换矩阵或消息。
         * @returns 当前条目转换后的结果。
         */
        (m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: parts(m).map(
            /** 转换 geminiMessages 中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
            (p) =>
              p.type === 'text' ? { text: p.text } : { inlineData: inlineImage(p.image_url.url) },
          ),
        }),
      ),
  };
}
/**
 * 替换路径中的模型占位符，支持按模型名称路由的供应商。
 *
 * @param path - 文件路径或矢量路径内容，具体格式由所属对象约定。
 * @param model - 发送给上游的模型标识。
 * @returns 替换模型名称后的接口路径。
 */
const modelRoute = (path: string, model: string) =>
  path.replaceAll('{model}', encodeURIComponent(model.replace(/^models\//, '')));
/**
 * 提取 Gemini 候选回答中的内容块，屏蔽协议嵌套层级。
 *
 * @param response - 上游或本地服务的响应。
 * @returns 可供文字或图片解析的内容块列表。
 */
function geminiParts(response: Record<string, unknown>) {
  const candidate: unknown = Array.isArray(response.candidates)
    ? response.candidates[0]
    : undefined;
  return isRecord(candidate) &&
    isRecord(candidate.content) &&
    Array.isArray(candidate.content.parts)
    ? candidate.content.parts.filter(isRecord)
    : [];
}

/**
 * 按供应商协议转换消息并提取回复，让业务层无需处理各家响应格式。
 *
 * @param provider - 当前上游连接配置。
 * @param model - 发送给上游的模型标识。
 * @param messages - 按会话顺序保存的消息列表。
 * @returns 模型回复的文字内容。
 */
export async function requestText(
  provider: PrivateProvider,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const protocol = provider.textProtocol;
  requireValue(protocol !== 'none', '此供应商不支持文本请求。');
  let response: Record<string, unknown>;
  if (protocol === 'anthropic') {
    response = await providerRequest(
      provider,
      protocol,
      modelRoute(provider.textPath || 'messages', model),
      {
        model,
        max_tokens: provider.maxOutputTokens,
        system: messages
          .filter(
            /** 检查 m 的角色等于“system”，供集合筛选或定位使用。 @param m - 当前变换矩阵或消息。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
            (m) => m.role === 'system',
          )
          .flatMap(
            /**
             * 转换 requestText 中的集合条目并展开结果，供后续处理或展示。
             *
             * @param m - 当前变换矩阵或消息。
             * @returns 当前条目展开后的结果。
             */
            (m) =>
              parts(m)
                .filter(
                  /** 检查当前项的类型等于“text”，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                  (p) => p.type === 'text',
                )
                .map(
                  /** 提取当前项的文字内容，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的文字内容。 */
                  (p) => p.text,
                ),
          )
          .join('\n'),
        messages: messages
          .filter(
            /** 检查 m 的角色不等于“system”，供集合筛选或定位使用。 @param m - 当前变换矩阵或消息。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
            (m) => m.role !== 'system',
          )
          .map(
            /**
             * 转换 requestText 中的集合条目，供后续处理或展示。
             *
             * @param m - 当前变换矩阵或消息。
             * @returns 当前条目转换后的结果。
             */
            (m) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: parts(m).map(
                /**
                 * 转换 requestText 中的集合条目，供后续处理或展示。
                 *
                 * @param p - 当前坐标点或内容片段。
                 * @returns 当前条目转换后的结果。
                 */
                (p) => {
                  if (p.type === 'text') return p;
                  const image = inlineImage(p.image_url.url);
                  return {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: image.mimeType,
                      data: image.data,
                    },
                  };
                },
              ),
            }),
          ),
      },
    );
    return Array.isArray(response.content)
      ? response.content
          .filter(isRecord)
          .filter(
            /** 检查当前项的类型等于“text”，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
            (p) => p.type === 'text',
          )
          .map(
            /** 提取当前项的文字内容，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的文字内容。 */
            (p) => p.text,
          )
          .join('')
      : '';
  }
  if (protocol === 'gemini') {
    response = await providerRequest(
      provider,
      protocol,
      modelRoute(provider.textPath || 'models/{model}:generateContent', model),
      {
        ...geminiMessages(messages),
        generationConfig: {
          maxOutputTokens: provider.maxOutputTokens,
          ...(provider.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      },
    );
    return geminiParts(response)
      .filter(
        /** 判断 requestText 中的条目是否符合保留条件。 @param p - 当前坐标点或内容片段。 @returns 该条目是否符合条件。 */
        (p) => typeof p.text === 'string' && p.thought !== true,
      )
      .map(
        /** 提取当前项的文字内容，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的文字内容。 */
        (p) => p.text,
      )
      .join('');
  }
  if (protocol === 'openai-responses') {
    response = await providerRequest(
      provider,
      protocol,
      modelRoute(provider.textPath || 'responses', model),
      {
        model,
        store: false,
        max_output_tokens: provider.maxOutputTokens,
        input: messages.map(
          /**
           * 转换 requestText 中的集合条目，供后续处理或展示。
           *
           * @param m - 当前变换矩阵或消息。
           * @returns 当前条目转换后的结果。
           */
          (m) => ({
            role: m.role,
            content:
              typeof m.content === 'string'
                ? m.content
                : m.content.map(
                    /** 转换 requestText 中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
                    (p) =>
                      p.type === 'text'
                        ? { type: 'input_text', text: p.text }
                        : { type: 'input_image', image_url: p.image_url.url },
                  ),
          }),
        ),
        ...(provider.jsonMode ? { text: { format: { type: 'json_object' } } } : {}),
      },
    );
    if (typeof response.output_text === 'string') return response.output_text;
    return Array.isArray(response.output)
      ? response.output
          .filter(isRecord)
          .flatMap(
            /** 转换 requestText 中的集合条目并展开结果，供后续处理或展示。 @param item - 当前遍历的条目。 @returns 当前条目展开后的结果。 */
            (item) => (Array.isArray(item.content) ? item.content.filter(isRecord) : []),
          )
          .filter(
            /** 检查当前项的类型等于“output_text”，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
            (p) => p.type === 'output_text',
          )
          .map(
            /** 提取当前项的文字内容，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的文字内容。 */
            (p) => p.text,
          )
          .join('')
      : '';
  }
  response = await providerRequest(
    provider,
    protocol,
    modelRoute(provider.textPath || 'chat/completions', model),
    {
      model,
      messages,
      ...(provider.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    },
  );
  const choice: unknown = Array.isArray(response.choices) ? response.choices[0] : undefined;
  const content = isRecord(choice) && isRecord(choice.message) ? choice.message.content : undefined;
  return typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .filter(isRecord)
          .map(
            /** 提取当前项的文字内容或“”，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的文字内容或“”。 */
            (p) => p.text || '',
          )
          .join('')
      : '';
}

/**
 * 按图片协议提交生成或参考图编辑请求，并统一提取图片结果。
 *
 * @param provider - 当前上游连接配置。
 * @param model - 发送给上游的模型标识。
 * @param prompt - 发送给模型的生成要求。
 * @param reference - 供模型参考的图片内容及背景要求。
 * @returns Base64 图片内容或上游图片地址。
 */
export async function requestImage(
  provider: PrivateProvider,
  model: string,
  prompt: string,
  reference?: {
    /** 图片或文件的原始字节。 */
    bytes: Uint8Array;
    /** 图片或文件的 MIME 类型。 */
    mime: string;
    /** 背景颜色或背景类型。取值：transparent（透明背景）、opaque（不透明背景）。 */
    background?: 'transparent' | 'opaque';
  },
): Promise<{
  /** 上游直接返回的 Base64 图片内容。 */
  b64_json?: string;
  /** 资源或服务的访问地址。 */
  url?: string;
}> {
  const protocol = provider.imageProtocol;
  requireValue(protocol !== 'none', '此供应商未启用图片生成。');
  if (protocol === 'gemini') {
    const response = await providerRequest(
      provider,
      protocol,
      modelRoute(provider.imagePath || 'models/{model}:generateContent', model),
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...(reference
                ? [
                    {
                      inlineData: {
                        mimeType: reference.mime,
                        data: Buffer.from(reference.bytes).toString('base64'),
                      },
                    },
                  ]
                : []),
            ],
          },
        ],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      },
    );
    const image = geminiParts(response)
      .map(
        /** 提取当前项的inlineData或当前项的inline_data，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的inlineData或当前项的inline_data。 */
        (p) => p.inlineData || p.inline_data,
      )
      .find(isRecord);
    requireValue(
      image && typeof image.data === 'string',
      '模型没有返回图片，请选择支持生图的 Gemini 模型。',
      502,
    );
    return { b64_json: image.data };
  }
  if (protocol === 'imagen') {
    requireValue(
      !reference,
      'Imagen 当前连接不支持参考图素材重建，请为生图选择支持图片输入的 OpenAI Images 或 Gemini 模型。',
      400,
    );
    const response = await providerRequest(
      provider,
      protocol,
      modelRoute(provider.imagePath || 'models/{model}:predict', model),
      {
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      },
    );
    const image: unknown = Array.isArray(response.predictions)
      ? response.predictions[0]
      : undefined;
    requireValue(
      isRecord(image) && typeof image.bytesBase64Encoded === 'string',
      'Imagen 没有返回图片。',
      502,
    );
    return { b64_json: image.bytesBase64Encoded };
  }
  let body: FormData | Record<string, unknown> = { model, prompt, n: 1 };
  if (reference) {
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', prompt);
    form.set('n', '1');
    form.set(
      'image',
      new Blob([new Uint8Array(reference.bytes)], { type: reference.mime }),
      `reference.${reference.mime.split('/')[1]}`,
    );
    if (reference.background === 'transparent') form.set('background', 'transparent');
    body = form;
  }
  // Let the upstream choose a supported size. UI references and regenerated assets
  // must never inherit the old fixed landscape size.
  const response = await providerRequest(
    provider,
    protocol,
    modelRoute(
      reference
        ? provider.imageEditPath || 'images/edits'
        : provider.imagePath || 'images/generations',
      model,
    ),
    body,
  );

  const result: unknown = Array.isArray(response.data) ? response.data[0] : undefined;
  requireValue(
    isRecord(result) && (typeof result.b64_json === 'string' || typeof result.url === 'string'),
    '模型没有返回图片，请确认模型支持 Images API。',
    502,
  );
  return {
    ...(typeof result.b64_json === 'string' ? { b64_json: result.b64_json } : {}),
    ...(typeof result.url === 'string' ? { url: result.url } : {}),
  };
}
