import type { AnnotationNode } from './flow.ts';
import type { WorkspaceDocument } from './document.ts';

/** 工作空间支持的修改操作，集中定义允许的分支以保持调用方一致。 */
export type WorkspaceOperation =
  | {
      /** 用于区分数据形态或行为分支的类型。取值：set-component-spec（保存组件规范）。 */
      type: 'set-component-spec';
      /** 引用的组件母版标识。 */
      componentId: string;
      /** 规范或安装内容的版本标识。 */
      version: string;
      /** 文件、消息或编辑文档的正文。 */
      content: string;
      /** 编辑开始时的原文，用于检测提交前是否已发生变化。 */
      expectedContent: string;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：set-flow-brief（保存流程简报）。 */
      type: 'set-flow-brief';
      /** 目标流程的唯一标识。 */
      flowId: string;
      /** 文件、消息或编辑文档的正文。 */
      content: string;
      /** 编辑开始时的原文，用于检测提交前是否已发生变化。 */
      expectedContent: string;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：update-annotation（更新定位标注）。 */
      type: 'update-annotation';
      /** 目标流程的唯一标识。 */
      flowId: string;
      /** 目标页面的唯一标识。 */
      pageId: string;
      /** 待保存的定位标注。 */
      annotation: AnnotationNode;
      /** 编辑开始时的标注，用于防止覆盖别人的新修改。 */
      expectedAnnotation: AnnotationNode;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：set-node-position（移动流程页面）。 */
      type: 'set-node-position';
      /** 目标流程的唯一标识。 */
      flowId: string;
      /** 目标页面的唯一标识。 */
      pageId: string;
      /** 水平方向的位置。 */
      x: number;
      /** 垂直方向的位置。 */
      y: number;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：set-default-viewport（保存共享默认视口）。 */
      type: 'set-default-viewport';
      /** 目标流程的唯一标识。 */
      flowId: string;
      /** 水平方向的位置。 */
      x: number;
      /** 垂直方向的位置。 */
      y: number;
      /** 缩放倍率，1 表示原始尺寸。 */
      zoom: number;
    };

/** 基于某个修订版本提交的一批操作，服务端可据此检测并发冲突。 */
export interface WorkspaceChangeSet {
  /** 本次变更基于的修订号，提交时必须仍与当前文档一致。 */
  baseRevision: number;
  /** 按顺序应用的一组工作空间操作。 */
  operations: WorkspaceOperation[];
}

/** 变更提交后的修订号、最新文档及受影响文件。 */
export interface ApplyResult {
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
  /** 解析后的完整工作空间文档。 */
  document: WorkspaceDocument;
  /** 本次提交实际涉及的文件路径。 */
  changedFiles: string[];
}
