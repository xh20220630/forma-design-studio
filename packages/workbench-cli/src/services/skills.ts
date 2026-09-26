import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { checksumDirectory } from '@forma/design-workspace-sdk';
import { skillId, skillSourceDirectory, skillVersion } from '@forma/ai-ui-designer-plugin';
import type { SkillScope, SkillInstallation } from '../types/skills.ts';
import { targetFor, exists, readMarker } from '../infrastructure/skills.ts';
import { recordSkillInstallation } from '../infrastructure/local-state.ts';

/**
 * 提取主版本号，作为技能安装兼容性与降级判断的依据。
 *
 * @param version - 规范或安装内容的版本标识。
 * @returns 版本号的第一段数值。
 */
export function major(version: string) {
  return Number(version.split('.')[0]);
}

/**
 * 核对安装标记、内容摘要和主版本，判断当前技能是否兼容且完整。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @param scope - 当前数据或操作生效的范围。
 * @returns 指定范围的技能安装状态。
 */
export async function inspectSkill(
  projectRoot: string,
  scope: SkillScope,
): Promise<SkillInstallation> {
  const target = targetFor(projectRoot, scope);
  const installed = await exists(target);
  const marker = installed ? await readMarker(target) : undefined;
  let checksum: string | undefined;
  if (marker) {
    try {
      checksum = await checksumDirectory(target);
    } catch {
      /* an unreadable installation is incompatible */
    }
  }
  return {
    scope,
    path: target,
    installed,
    managed: Boolean(marker),
    version: marker?.version,
    checksum,
    compatible: Boolean(
      marker && checksum === marker.checksum && major(marker.version) >= major(skillVersion),
    ),
  };
}

/**
 * 同时读取项目和全局安装状态，供初始化选择可复用的技能。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @returns 两种范围的安装状态列表。
 */
export async function inspectSkills(projectRoot: string) {
  return Promise.all([inspectSkill(projectRoot, 'project'), inspectSkill(projectRoot, 'global')]);
}

/**
 * 用临时目录和备份替换托管安装，复用相同版本并避免降级覆盖。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @param scope - 当前数据或操作生效的范围。
 * @returns 最终安装状态与本次处理动作。
 */
export async function installSkill(projectRoot: string, scope: SkillScope) {
  const current = await inspectSkill(projectRoot, scope);
  const sourceChecksum = await checksumDirectory(skillSourceDirectory);
  if (current.managed && current.version && major(current.version) > major(skillVersion)) {
    if (!current.compatible)
      throw new Error(`检测到损坏的更高版本 Skill，拒绝降级覆盖：${current.path}`);
    const result = { ...current, action: 'kept-newer' as const };
    await recordSkillInstallation(projectRoot, result);
    return result;
  }
  if (current.managed && current.version === skillVersion && current.checksum === sourceChecksum) {
    const result = { ...current, compatible: true, action: 'reused' as const };
    await recordSkillInstallation(projectRoot, result);
    return result;
  }
  if (current.installed && !current.managed)
    throw new Error(`目标目录已存在且不由 Forma 管理：${current.path}`);

  const parent = path.dirname(current.path);
  await mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.${skillId}.${randomUUID()}.tmp`);
  const backup = path.join(parent, `.${skillId}.${randomUUID()}.backup`);
  await cp(skillSourceDirectory, temporary, { recursive: true, errorOnExist: true });
  await writeFile(
    path.join(temporary, '.forma-skill.json'),
    `${JSON.stringify(
      {
        id: skillId,
        version: skillVersion,
        installedBy: '@forma/ai-design-workbench',
        checksum: sourceChecksum,
      },
      null,
      2,
    )}\n`,
  );
  let backedUp = false;
  try {
    if (current.installed) {
      await rename(current.path, backup);
      backedUp = true;
    }
    await rename(temporary, current.path);
    if (backedUp) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (backedUp && !(await exists(current.path))) await rename(backup, current.path);
    throw error;
  }
  const result = {
    ...(await inspectSkill(projectRoot, scope)),
    action: current.installed ? ('updated' as const) : ('installed' as const),
  };
  await recordSkillInstallation(projectRoot, result);
  return result;
}
