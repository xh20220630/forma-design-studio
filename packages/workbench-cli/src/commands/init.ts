import { chooseScope } from '../cli/prompts.ts';
import path from 'node:path';
import { initializeProject } from '../services/initialize-project.ts';
import type { SkillScope } from '../types/skills.ts';
import type { CommandContext } from '../cli/arguments.ts';
import { print } from '../cli/output.ts';

export async function runInit({ parsed, cwd, asJson }: CommandContext) {
  const projectRoot = path.resolve(parsed.positional[0] || cwd);
  const skillOption = parsed.options.get('skill');
  if (skillOption && !['project', 'global', 'skip'].includes(String(skillOption)))
    throw new Error('--skill 必须是 project、global 或 skip。');
  const selectedSkill = skillOption || (parsed.options.has('yes') ? 'project' : undefined);
  const result = await initializeProject({
    projectRoot,
    chooseSkillScope: chooseScope,
    ...(selectedSkill ? { skill: selectedSkill as SkillScope | 'skip' } : {}),
  });
  print(
    asJson
      ? result
      : `已初始化 ${result.designRoot}${result.skill ? `\nSkill：${result.skill.scope} · ${result.skill.path}` : '\nSkill：跳过'}`,
    asJson,
  );
  return;
}
