/**
 * 校验问题等级，集中定义允许的分支以保持调用方一致。
 * 取值：error（阻断错误）、warning（提醒问题）。
 */
export type ValidationSeverity = 'error' | 'warning';

/** 一条可定位的校验问题，供界面和命令行使用相同诊断格式。 */
export interface ValidationIssue {
  /** 校验问题等级：error 阻止有效性成立，warning 提醒复核。 */
  severity: ValidationSeverity;
  /** 稳定的问题代码或异常代码，供调用方识别错误类别。 */
  code: string;
  /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
  path: string;
  /** 面向用户或调用方的说明消息。 */
  message: string;
}

/** 完整校验结果；保留全部问题以便一次修正多处数据。 */
export interface ValidationReport {
  /** 是否未发现阻断性的校验错误。 */
  valid: boolean;
  /** 完整的问题列表，包含警告和错误。 */
  issues: ValidationIssue[];
}
