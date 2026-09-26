import { createProjectFiles } from '../templates/project.ts';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { inspectSkills, installSkill } from './skills.ts';
import { recordSkillInstallation } from '../infrastructure/local-state.ts';
import type { SkillScope } from '../types/skills.ts';
import { writeIfMissing, ensureGitignore } from '../infrastructure/files.ts';

/**
 * 补齐设计目录和必要配置，并按选择处理配套技能安装。
 *
 * @param options - 本次操作的配置选项。
 * @returns 初始化目录、变更文件和技能安装信息。
 */
export async function initializeProject(options: {
  /** 执行初始化或安装的项目根目录。 */
  projectRoot: string;
  /** 配套技能的安装信息或安装范围。取值：skip（跳过安装）。 */
  skill?: SkillScope | 'skip';
  /** 未指定范围且无可复用安装时调用；命令层负责终端交互。 */
  chooseSkillScope?: () => Promise<SkillScope | 'skip'>;
}) {
  const projectRoot = path.resolve(options.projectRoot);
  const designRoot = path.join(projectRoot, 'design');
  await mkdir(designRoot, { recursive: true });
  const created: string[] = [];
  const files = createProjectFiles(projectRoot);
  for (const [relative, content] of files)
    if (await writeIfMissing(path.join(projectRoot, relative), content)) created.push(relative);
  const gitignore = await ensureGitignore(projectRoot);
  if (gitignore === 'created') created.push('.gitignore');

  const installations = await inspectSkills(projectRoot);
  const compatible = installations.find((item) => item.compatible);
  let skill = compatible;
  if (!compatible) {
    const scope = options.skill || (await options.chooseSkillScope?.()) || 'skip';
    if (scope !== 'skip') skill = await installSkill(projectRoot, scope);
  }
  if (skill) await recordSkillInstallation(projectRoot, skill);
  return {
    projectRoot,
    designRoot,
    created,
    updated: gitignore === 'updated' ? ['.gitignore'] : [],
    skill,
  };
}
