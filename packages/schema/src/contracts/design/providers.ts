/**
 * 文字模型协议，集中定义允许的分支以保持调用方一致。
 * 取值：openai、openai-responses、anthropic、gemini、local-agent（本机 CLI）、none（不启用）。
 */
export type TextProtocol =
  | 'openai'
  | 'openai-responses'
  | 'anthropic'
  | 'gemini'
  | 'local-agent'
  | 'none';

export type LocalAgentId = 'codex' | 'claude' | 'kimi';

export interface LocalAgentConnection {
  agentId: LocalAgentId;
  /** 网页 Codex 文本任务覆盖 CLI 配置；default 表示沿用 CLI。 */
  reasoningEffort?: 'default' | 'low' | 'medium' | 'high' | 'xhigh';
  /** 仅参考图分析使用此毫秒上限，普通对话与生图仍使用连接 timeoutMs。 */
  reconstructionTimeoutMs?: number;
}

export interface LocalAgentInfo {
  id: LocalAgentId;
  name: string;
  installed: boolean;
  available: boolean;
  executable?: string;
  version?: string;
  error?: string;
  transport: 'jsonl' | 'stream-json' | 'acp';
}

/**
 * 图片模型协议，集中定义允许的分支以保持调用方一致。
 * 本地 Codex 使用内置生图，其余连接按供应商图片协议调用。
 */
export type ImageProtocol = 'openai-images' | 'gemini' | 'imagen' | 'local-agent' | 'none';

/**
 * 供应商认证方式，集中定义允许的分支以保持调用方一致。
 * 取值：auto（按协议选择）、bearer（Bearer 令牌）、api-key（API Key 请求头）、none（不启用）。
 */
export type ProviderAuth = 'auto' | 'bearer' | 'api-key' | 'none';

/** 把一种生成任务关联到指定供应商及其模型。 */
export interface ModelBinding {
  /** 模型绑定所属供应商的标识。 */
  providerId: string;
  /** 发送给上游的模型标识。 */
  model: string;
}

/** 客户端可见的模型连接配置；密钥仅以是否存在的标记表示。 */
export interface ModelProvider {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 供应商 API 的基础地址。 */
  baseUrl: string;
  /** 文字任务使用的请求与响应协议。 */
  textProtocol: TextProtocol;
  /** Local CLI connections use the API host's installed agent and existing login. */
  localAgent?: LocalAgentConnection;
  /** 图片任务使用的请求与响应协议。 */
  imageProtocol: ImageProtocol;
  /** 连接采用的认证方式。 */
  auth: ProviderAuth;
  /** 是否已保存密钥；不向浏览器暴露密钥内容。 */
  hasApiKey: boolean;
  /** 已配置的额外请求头名称，不包含对应私密值。 */
  headerNames: string[];
  /** 查询模型列表的接口路径。 */
  modelsPath: string;
  /** 文字生成接口路径，可按协议替换模型占位符。 */
  textPath: string;
  /** 图片生成接口路径。 */
  imagePath: string;
  /** 带参考图的图片编辑接口路径。 */
  imageEditPath?: string;
  /** 上游请求允许等待的时间，单位为毫秒。 */
  timeoutMs: number;
  /** 文字任务允许生成的最大 Token 数量。 */
  maxOutputTokens: number;
  /** 是否要求模型使用结构化 JSON 输出。 */
  jsonMode: boolean;
  /** 保存的图片尺寸配置；实际请求是否采用由传输层决定。 */
  imageSize: string;
}

/** 模型列表中的可选项，分开保存请求用 ID 与展示名称。 */
export interface ProviderModel {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  isDefault?: boolean;
}

export interface ProviderModelCatalog {
  models: ProviderModel[];
  source?: 'cli' | 'default-only';
  agent?: LocalAgentInfo;
}

/** Snapshot of the failing request; later settings changes must not rewrite this record. */
export interface ModelRequestDiagnostic {
  id: string;
  code: 'model_unavailable' | 'invalid_request' | 'request_timeout' | 'request_failed';
  providerId: string;
  providerName: string;
  model: string;
  channel: 'text' | 'image';
  upstreamStatus?: number;
  upstreamCode?: string;
  localAgentId?: LocalAgentId;
  occurredAt: string;
  detail: string;
  operation?: 'chat' | 'reconstruction' | 'image';
  timeoutMs?: number;
}

/** 公开的供应商列表及文字、图片任务的模型选择。 */
export interface ProviderSettings {
  /** 文字模型是否已经配置就绪。 */
  configured: boolean;
  /** 图片模型是否已经配置就绪。 */
  imageConfigured: boolean;
  /** 可供选择的供应商连接。 */
  providers: ModelProvider[];
  /** 需要展示或编辑的文字内容。 */
  text: ModelBinding;
  /** 图片数据、图片模型绑定或页面图片节点。 */
  image: ModelBinding;
  /** 自动复用文本 Agent 时保留原始选择，并单独公开实际生图连接。 */
  effectiveImage?: ModelBinding;
  imageFollowsText?: boolean;

  /** 供应商 API 的基础地址。 */
  baseUrl: string;
  /** 兼容旧客户端的当前文字模型摘要。 */
  textModel: string;
  /** 兼容旧客户端的当前图片模型摘要。 */
  imageModel: string;
}
