import type { Project } from './design.ts';

export type AgentActionType = 'create_project' | 'update_tokens' | 'create_variables' | 'create_component' | 'generate_image' | 'reconstruct_design' | 'preview_sync' | 'approve_image' | 'apply_sync';
export interface AgentSyncPreview {
  previewId: string;
  revision: number;
  files: { path: string; content: string; status: 'added' | 'modified' | 'unchanged' | 'conflict' }[];
  conflicts: string[];
}
export interface AgentActionResult {
  id: string;
  type: AgentActionType;
  title: string;
  status: 'completed' | 'awaiting-approval' | 'failed';
  summary: string;
  projectId?: string;
  revision?: number;
  imageUrl?: string;
  syncPreview?: AgentSyncPreview;
  previewId?: string;
  error?: string;
  syncWarning?: string;
  autoSynced?: boolean;
}
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: 'pending' | 'completed' | 'failed';
  actions?: AgentActionResult[];
}
export interface AgentSession {
  id: string;
  title: string;
  scope: 'global' | 'project';
  projectId?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  messages: AgentMessage[];
}
export type AgentSessionSummary = Omit<AgentSession, 'messages'> & { messageCount: number };
export type AgentReviewAction =
  | { type: 'approve_image'; projectId: string; revision: number; imageUrl: string }
  | { type: 'reconstruct_design'; projectId: string; revision: number; imageUrl: string }
  | { type: 'apply_sync'; projectId: string; revision: number; previewId: string };
export interface AgentTurnRequest {
  content?: string;
  sessionRevision?: number;
  projectRevision?: number;
  action?: AgentReviewAction;
}
export interface AgentTurnResponse {
  session: AgentSession;
  message: AgentMessage;
  project?: Project;
  syncPreview?: AgentSyncPreview;
  error?: string;
}
