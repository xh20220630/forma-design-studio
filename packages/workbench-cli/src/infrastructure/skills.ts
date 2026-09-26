import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { skillId } from '@forma/ai-ui-designer-plugin';
import type { SkillScope, ManagedMarker } from '../types/skills.ts';

/**
 * 根据项目或全局范围定位技能目录，并尊重自定义 Codex 根目录。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @param scope - 当前数据或操作生效的范围。
 * @returns 技能的安装路径。
 */
export function targetFor(projectRoot: string, scope: SkillScope) {
  if (scope === 'project') return path.join(projectRoot, '.agents', 'skills', skillId);
  const codexRoot = process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), '.codex');
  return path.join(codexRoot, 'skills', skillId);
}

/**
 * 检查目标路径是否可读取元信息，为安装流程提供存在性判断。
 *
 * @param file - 需要读取、写入或导入的文件。
 * @returns 是否能成功读取路径状态。
 */
export async function exists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取并核验 Forma 的管理标记，防止覆盖不属于本工具的目录。
 *
 * @param target - 操作作用的目标。
 * @returns 有效安装标记；未识别时返回 undefined。
 */
export async function readMarker(target: string): Promise<ManagedMarker | undefined> {
  try {
    const value: unknown = JSON.parse(
      await readFile(path.join(target, '.forma-skill.json'), 'utf8'),
    );
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const marker = value as Partial<ManagedMarker>;
    if (
      marker.id === skillId &&
      typeof marker.version === 'string' &&
      typeof marker.checksum === 'string' &&
      marker.installedBy === '@forma/ai-design-workbench'
    )
      return marker as ManagedMarker;
  } catch {
    return;
  }
}
