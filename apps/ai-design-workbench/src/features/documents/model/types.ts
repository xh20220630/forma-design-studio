import type { WorkspaceChangeSet, WorkspaceDocument } from '@forma/schema/workbench';

/** 正在编辑的规范或简报位置，确保保存回正确文档。 */
export type DocumentTarget =
  | {
      type: 'component';
      id: string;
      version: string;
    }
  | {
      type: 'brief';
      flowId: string;
    };

/** 正在编辑的页面标注位置，确保保存回正确流程和页面。 */
export type AnnotationTarget = {
  flowId: string;
  pageId: string;
  annotationId: string;
};

export type EditorProps = {
  document: WorkspaceDocument;
  onSave: (change: WorkspaceChangeSet) => Promise<void>;
  onClose: () => void;
};
