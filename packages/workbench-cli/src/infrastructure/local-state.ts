import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { skillId } from '@forma/ai-ui-designer-plugin';
import type { SkillInstallation } from '../types/skills.ts';

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
