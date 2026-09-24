import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { checksumDirectory } from '@forma/design-workspace-sdk';
import { skillId, skillSourceDirectory, skillVersion } from '@forma/ai-ui-designer-plugin';

/**
 * 技能安装范围，集中定义允许的分支以保持调用方一致。
 * 取值：project（当前项目）、global（全局范围）。
 */
export type SkillScope = 'project' | 'global';

/** 技能安装位置、版本与完整性结果，用于决定复用、更新或报错。 */
export interface SkillInstallation {
  /** 当前数据或操作生效的范围。 */
  scope: SkillScope;
  /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
  path: string;
  /** 目标路径是否已有安装内容。 */
  installed: boolean;
  /** 安装是否带有有效 Forma 管理标记。 */
  managed: boolean;
  /** 规范或安装内容的版本标识。 */
  version?: string;
  /** 安装目录内容摘要，用于检测手动修改或损坏。 */
  checksum?: string;
  /** 版本和内容是否满足当前工具的使用条件。 */
  compatible: boolean;
}

/** Forma 管理的技能安装标记，避免覆盖用户手动维护的目录。 */
interface ManagedMarker {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 规范或安装内容的版本标识。 */
  version: string;
  /** 写入管理标记的工具名称。 */
  installedBy: string;
  /** 安装目录内容摘要，用于检测手动修改或损坏。 */
  checksum: string;
}

/**
 * 提取主版本号，作为技能安装兼容性与降级判断的依据。
 *
 * @param version - 规范或安装内容的版本标识。
 * @returns 版本号的第一段数值。
 */
function major(version: string) {
  return Number(version.split('.')[0]);
}

/**
 * 根据项目或全局范围定位技能目录，并尊重自定义 Codex 根目录。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @param scope - 当前数据或操作生效的范围。
 * @returns 技能的安装路径。
 */
function targetFor(projectRoot: string, scope: SkillScope) {
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
async function exists(file: string) {
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
async function readMarker(target: string): Promise<ManagedMarker | undefined> {
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

/**
 * 将安装信息写入项目本地状态，保留其他本地偏好字段。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @param skill - 配套技能的安装信息或安装范围。
 * @returns 无返回值；记录保存后结束。
 */
export async function recordSkillInstallation(
  projectRoot: string,
  skill: Pick<SkillInstallation, 'scope' | 'path' | 'version' | 'checksum'>,
) {
  const stateFile = path.join(projectRoot, '.forma', 'local-state.json');
  let state: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(stateFile, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      state = parsed as Record<string, unknown>;
  } catch {
    /* create state */
  }
  const existingSkills =
    state.skills && typeof state.skills === 'object' && !Array.isArray(state.skills)
      ? (state.skills as Record<string, unknown>)
      : {};
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(
    stateFile,
    `${JSON.stringify(
      {
        ...state,
        schemaVersion: 1,
        skills: {
          ...existingSkills,
          [skillId]: {
            scope: skill.scope,
            version: skill.version,
            path: skill.path,
            checksum: skill.checksum,
          },
        },
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
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
