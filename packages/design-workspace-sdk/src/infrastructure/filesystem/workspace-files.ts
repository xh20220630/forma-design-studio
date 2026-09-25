import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { ValidationIssue } from '@forma/schema/workbench';
import { issue } from '../../utils/validation.ts';
import { readJson } from './json.ts';

/** 拒绝绝对路径、上级跳转和不规范分隔符，限制文件访问范围。 */
function normalizeRelativePath(value: string): string | undefined {
  if (
    !value ||
    path.isAbsolute(value) ||
    value.includes('\\') ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  )
    return;
  const normalized = path.posix.normalize(value);
  if (normalized.startsWith('../') || normalized === '..') return;
  return normalized;
}

export class WorkspaceFiles {
  readonly root: string;

  private constructor(root: string) {
    this.root = root;
  }

  static async open(root: string) {
    return new WorkspaceFiles(await realpath(path.resolve(root)));
  }

  /** 只检查相对路径；已有素材需通过 resolveAsset 校验真实路径。 */
  async safeFile(relativePath: string, issues?: ValidationIssue[], code = 'invalid-path') {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) {
      if (issues)
        issue(
          issues,
          'error',
          code,
          relativePath || '<empty>',
          '路径必须是设计根目录内的安全相对路径。',
        );
      throw new Error('路径必须是设计根目录内的安全相对路径。');
    }
    const file = path.resolve(this.root, ...normalized.split('/'));
    const relative = path.relative(this.root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('路径越出设计根目录。');
    return { file, normalized };
  }

  /** 拒绝通过符号链接访问根目录外的素材。 */
  async resolveAsset(relativePath: string) {
    const { file } = await this.safeFile(relativePath);
    const resolved = await realpath(file);
    const relative = path.relative(this.root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('资源通过符号链接越出设计根目录。');
    return resolved;
  }

  async readJson(relativePath: string, issues?: ValidationIssue[]) {
    return readJson((await this.safeFile(relativePath, issues)).file);
  }

  async readBytes(relativePath: string, issues?: ValidationIssue[]) {
    return readFile((await this.safeFile(relativePath, issues)).file);
  }

  async readAssetText(relativePath: string) {
    return readFile(await this.resolveAsset(relativePath), 'utf8');
  }

  async readAssetJson(relativePath: string) {
    return readJson(await this.resolveAsset(relativePath));
  }
}
