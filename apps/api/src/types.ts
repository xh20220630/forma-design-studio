import type { Project } from '@forma/schema';
import type { AgentSession, AgentActionType, AgentSyncPreview } from '@forma/schema/agent';

export interface ExportFile {
  path: string;
  content: string;
}

export interface ExportManifest {
  schemaVersion: number;
  projectId: string;
  revision: number;
  files: Record<string, string>;
}

export type SyncBaselines = Record<string, string | null>;
export interface SyncPreview extends Omit<AgentSyncPreview, 'previewId'> {
  baselines?: SyncBaselines;
}

export interface SyncResult {
  project: Project;
  files?: SyncPreview['files'];
  revision?: number;
  syncWarning?: string;
}

export interface SyncReview {
  id: string;
  projectId: string;
  revision: number;
  workspace: string;
  files: { path: string; hash: string }[];
  baselines?: SyncBaselines;
  used: boolean;
}

export interface StoredAgentSession extends AgentSession {
  pendingReviews: SyncReview[];
}

// Model payload fields remain unknown until each action's runtime validation.
export type AgentAction = Record<string, unknown> & { type: AgentActionType };
export interface AgentPlan {
  message: string;
  actions: AgentAction[];
}

export interface ChatMessage {
  role: string;
  content: string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
}
