export type LocalAgentId = 'codex' | 'claude' | 'kimi';

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

export interface AgentMessage {
  role: string;
  content:
    | string
    | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
}

export type BridgeEvent =
  | { type: 'started'; runId: string; agentId: LocalAgentId }
  | { type: 'text'; runId: string; text: string }
  | { type: 'completed'; runId: string }
  | { type: 'error'; runId: string; message: string };

/** Each run owns a child process and a temporary directory; clients must retain the AbortSignal to cancel it. */
export interface AgentRunOptions {
  agentId: LocalAgentId;
  messages: AgentMessage[];
  /** 'default' keeps the CLI's configured model. */
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  task?: 'text' | 'image';
  transparentBackground?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: (event: BridgeEvent) => void;
}

export interface AgentRunResult {
  runId: string;
  agentId: LocalAgentId;
  text: string;
  images?: { base64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }[];
}

export interface AgentModelCatalog {
  models: { id: string; name: string; isDefault?: boolean }[];
  source: 'cli' | 'default-only';
}

/** Explicit executable overrides are for the embedding host, never accepted from HTTP clients. */
export interface BridgeOptions {
  executables?: Partial<Record<LocalAgentId, string>>;
  maxConcurrentRuns?: number;
}
