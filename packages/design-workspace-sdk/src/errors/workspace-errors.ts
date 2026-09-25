import type { ValidationReport } from '@forma/schema/workbench';

/** 完整设计未通过校验时抛出的错误，同时携带所有问题。 */
export class WorkspaceValidationError extends Error {
  /** 包含所有校验问题的完整报告。 */
  readonly report: ValidationReport;

  constructor(report: ValidationReport) {
    super(
      report.issues.find((issue) => issue.severity === 'error')?.message || '设计资产校验失败。',
    );
    this.name = 'WorkspaceValidationError';
    this.report = report;
  }
}

/** 提交基线已过期或编辑内容发生变化时抛出的冲突错误。 */
export class WorkspaceConflictError extends Error {
  /** 发生冲突时服务端当前的文档版本。 */
  readonly currentRevision?: number;

  /** 用于定位失败或冲突的附加信息。 */
  readonly details?: {
    /** 本次变更基于的修订号，提交时必须仍与当前文档一致。 */
    baseRevision: number;
    /** 发生冲突时服务端当前的文档版本。 */
    currentRevision: number;
    /** 本次提交实际涉及的文件路径。 */
    changedFiles: string[];
  };

  constructor(
    message: string,
    currentRevision?: number,
    details?: {
      /** 本次变更基于的修订号，提交时必须仍与当前文档一致。 */
      baseRevision: number;
      /** 发生冲突时服务端当前的文档版本。 */
      currentRevision: number;
      /** 本次提交实际涉及的文件路径。 */
      changedFiles: string[];
    },
  ) {
    super(message);
    this.name = 'WorkspaceConflictError';
    this.currentRevision = currentRevision;
    this.details = details;
  }
}

/** 单次操作输入无效时抛出的错误，与整个文档校验失败区分。 */
export class WorkspaceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceInputError';
  }
}
