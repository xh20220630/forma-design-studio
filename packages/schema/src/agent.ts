import type { Project } from './design.ts';

/**
 * 助手支持的动作类型，集中定义允许的分支以保持调用方一致。
 * 取值：create_project（创建项目）、update_tokens（更新主题 Token）、create_variables（创建变量集合）、create_component（创建组件）、generate_image（生成参考图）、reconstruct_design（还原可编辑设计）、preview_sync（预览代码变更）、approve_image（用户确认参考图）、apply_sync（用户确认后写入代码）。
 */
export type AgentActionType =
  | 'create_project'
  | 'update_tokens'
  | 'create_variables'
  | 'create_component'
  | 'generate_image'
  | 'reconstruct_design'
  | 'preview_sync'
  | 'approve_image'
  | 'apply_sync';
/** 等待用户审查的代码变更，绑定预览 ID 与设计版本以防误用旧结果。 */
export interface AgentSyncPreview {
  /** 同步预览的审查凭据标识，确认时需与版本一起核验。 */
  previewId: string;
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
  /** 当前操作涉及的文件或文件摘要集合。 */
  files: {
    /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
    path: string;
    /** 文件、消息或编辑文档的正文。 */
    content: string;
    /** 对象当前所处状态，决定后续可执行操作。取值：added（新增）、modified（已修改）、unchanged（未变化）、conflict（存在本地冲突）。 */
    status: 'added' | 'modified' | 'unchanged' | 'conflict';
  }[];
  /** 阻止直接写入的本地冲突列表。 */
  conflicts: string[];
}
/** 动作真实执行后的结果，区分完成、待确认和失败。 */
export interface AgentActionResult {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 用于区分数据形态或行为分支的类型。 */
  type: AgentActionType;
  /** 界面显示的标题。 */
  title: string;
  /** 对象当前所处状态，决定后续可执行操作。取值：completed（已完成）、awaiting-approval（等待人工确认）、failed（失败）。 */
  status: 'completed' | 'awaiting-approval' | 'failed';
  /** 执行结果的简短说明。 */
  summary: string;
  /** 动作、会话或记录所属项目的标识。 */
  projectId?: string;
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision?: number;
  /** 生成图片的访问地址。 */
  imageUrl?: string;
  /** 等待审查或展示的代码同步预览。 */
  syncPreview?: AgentSyncPreview;
  /** 同步预览的审查凭据标识，确认时需与版本一起核验。 */
  previewId?: string;
  /** 当前操作的失败信息，供界面反馈或重试判断。 */
  error?: string;
  /** 设计已保留但自动同步未完成时的提示。 */
  syncWarning?: string;
  /** 本次设计修改是否已经自动同步成功。 */
  autoSynced?: boolean;
}
/** 会话中的一条消息，可附带动作执行结果供界面展示。 */
export interface AgentMessage {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 消息发送者的角色，影响界面呈现和模型上下文。取值：user（用户）、assistant（助手）。 */
  role: 'user' | 'assistant';
  /** 文件、消息或编辑文档的正文。 */
  content: string;
  /** 创建时间，使用可序列化的时间字符串。 */
  createdAt: string;
  /** 对象当前所处状态，决定后续可执行操作。取值：pending（等待处理）、completed（已完成）、failed（失败）。 */
  status?: 'pending' | 'completed' | 'failed';
  /** 待执行动作或已执行动作的结果集合。 */
  actions?: AgentActionResult[];
}
/** 全局或项目范围的对话记录，用修订号识别并发请求。 */
export interface AgentSession {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 界面显示的标题。 */
  title: string;
  /** 当前数据或操作生效的范围。取值：global（全局范围）、project（当前项目）。 */
  scope: 'global' | 'project';
  /** 动作、会话或记录所属项目的标识。 */
  projectId?: string;
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
  /** 创建时间，使用可序列化的时间字符串。 */
  createdAt: string;
  /** 最近更新时间，用于排序和展示。 */
  updatedAt: string;
  /** 按会话顺序保存的消息列表。 */
  messages: AgentMessage[];
}
/** 会话列表使用的轻量摘要，用消息数量代替完整消息内容。 */
export type AgentSessionSummary = Omit<AgentSession, 'messages'> & {
  /** 摘要中用于展示的消息总数。 */
  messageCount: number;
};
/** 需要用户主动触发的审查动作，集中定义允许的分支以保持调用方一致。 */
export type AgentReviewAction =
  | {
      /** 用于区分数据形态或行为分支的类型。取值：approve_image（用户确认参考图）。 */
      type: 'approve_image';
      /** 动作、会话或记录所属项目的标识。 */
      projectId: string;
      /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
      revision: number;
      /** 生成图片的访问地址。 */
      imageUrl: string;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：reconstruct_design（还原可编辑设计）。 */
      type: 'reconstruct_design';
      /** 动作、会话或记录所属项目的标识。 */
      projectId: string;
      /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
      revision: number;
      /** 生成图片的访问地址。 */
      imageUrl: string;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：apply_sync（用户确认后写入代码）。 */
      type: 'apply_sync';
      /** 动作、会话或记录所属项目的标识。 */
      projectId: string;
      /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
      revision: number;
      /** 同步预览的审查凭据标识，确认时需与版本一起核验。 */
      previewId: string;
    };
/** 一次聊天或人工审查请求，同时携带版本信息避免过期操作。 */
export interface AgentTurnRequest {
  /** 文件、消息或编辑文档的正文。 */
  content?: string;
  /** 客户端看到的会话版本，用于检测并发会话更新。 */
  sessionRevision?: number;
  /** 客户端看到的设计版本，用于阻止过期操作。 */
  projectRevision?: number;
  /** 当前要执行的操作或操作结果分类。 */
  action?: AgentReviewAction;
}
/** 一轮执行后的会话、消息及可能变化的项目数据。 */
export interface AgentTurnResponse {
  /** 本轮操作对应的完整会话。 */
  session: AgentSession;
  /** 面向用户或调用方的说明消息。 */
  message: AgentMessage;
  /** 当前设计项目或工作空间项目元信息。 */
  project?: Project;
  /** 等待审查或展示的代码同步预览。 */
  syncPreview?: AgentSyncPreview;
  /** 当前操作的失败信息，供界面反馈或重试判断。 */
  error?: string;
}
