import type { ValidationIssue } from '@forma/schema/workbench';

/** 把校验问题连同文件位置收集起来，让用户一次看到多个问题。 */
export function issue(
  issues: ValidationIssue[],
  severity: 'error' | 'warning',
  code: string,
  file: string,
  message: string,
) {
  issues.push({ severity, code, path: file, message });
}
