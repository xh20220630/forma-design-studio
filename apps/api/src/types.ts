import type { Project } from '@forma/schema';
import type { AgentSession, AgentActionType, AgentSyncPreview } from '@forma/schema/agent';

/** 一个待导出文件的相对路径和完整内容。 */
export interface ExportFile {
  /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
  path: string;
  /** 文件、消息或编辑文档的正文。 */
  content: string;
}

/** 上次同步的文件摘要与设计版本，用于区分本地编辑和生成器变化。 */
export interface ExportManifest {
  /** 数据结构版本，用于兼容不同年代的文件格式。 */
  schemaVersion: number;
  /** 动作、会话或记录所属项目的标识。 */
  projectId: string;
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
  /** 当前操作涉及的文件或文件摘要集合。 */
  files: Record<string, string>;
}

/** 预览时各文件的内容摘要；null 表示文件当时不存在。 */
export type SyncBaselines = Record<string, string | null>;
/** 服务端同步预览，可额外保存用于后续一致性核验的基线。 */
export interface SyncPreview extends Omit<AgentSyncPreview, 'previewId'> {
  /** 预览时记录的文件基线，供应用时检查是否发生本地变化。 */
  baselines?: SyncBaselines;
}

/** 代码同步结果，允许设计保存成功但附带自动同步失败提示。 */
export interface SyncResult {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /** 当前操作涉及的文件或文件摘要集合。 */
  files?: SyncPreview['files'];
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision?: number;
  /** 设计已保留但自动同步未完成时的提示。 */
  syncWarning?: string;
}

/** 用户审查时的同步凭据，绑定项目、目录、版本和文件摘要。 */
export interface SyncReview {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 动作、会话或记录所属项目的标识。 */
  projectId: string;
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
  /** 代码同步目标及同步偏好。 */
  workspace: string;
  /** 当前操作涉及的文件或文件摘要集合。 */
  files: {
    /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
    path: string;
    /** 内容摘要，用于低成本比较文件变化。 */
    hash: string;
  }[];
  /** 预览时记录的文件基线，供应用时检查是否发生本地变化。 */
  baselines?: SyncBaselines;
  /** 审查凭据是否已经消费，防止重复应用。 */
  used: boolean;
}

/** 附带内部审查凭据的持久化会话；返回客户端前需移除私有部分。 */
export interface StoredAgentSession extends AgentSession {
  /** 等待人工确认的服务端同步凭据。 */
  pendingReviews: SyncReview[];
}

// Model payload fields remain unknown until each action's runtime validation.
/** 模型规划的动作；参数在执行前保持 unknown，必须按动作逐项校验。 */
export type AgentAction = Record<string, unknown> & {
  /** 用于区分数据形态或行为分支的类型。 */
  type: AgentActionType;
};
/** 模型提出的说明与待执行动作；不能把计划当作已成功执行。 */
export interface AgentPlan {
  /** 面向用户或调用方的说明消息。 */
  message: string;
  /** 待执行动作或已执行动作的结果集合。 */
  actions: AgentAction[];
}

/** 模型传输层使用的通用消息，兼容纯文本与图片内容块。 */
export interface ChatMessage {
  /** 消息发送者的角色，影响界面呈现和模型上下文。 */
  role: string;
  /** 文件、消息或编辑文档的正文。 */
  content:
    | string
    | (
        | {
            /** 用于区分数据形态或行为分支的类型。取值：text（文字）。 */
            type: 'text';
            /** 需要展示或编辑的文字内容。 */
            text: string;
          }
        | {
            /** 用于区分数据形态或行为分支的类型。取值：image_url。 */
            type: 'image_url';
            /** 通用模型消息中的图片地址结构。 */
            image_url: {
              /** 资源或服务的访问地址。 */
              url: string;
            };
          }
      )[];
}
