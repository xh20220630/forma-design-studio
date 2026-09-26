import { createInterface } from 'node:readline/promises';
import type { SkillScope } from '../types/skills.ts';

/**
 * 在交互终端询问技能安装范围，非交互环境直接跳过以避免挂起。
 * @returns 项目、全局或跳过安装的选择。
 */
export async function chooseScope(): Promise<SkillScope | 'skip'> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return 'skip';
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (
      await prompt.question(
        '安装 Forma AI UI Designer Skill？[P] 当前项目（推荐）/[G] 全局/[S] 跳过：',
      )
    )
      .trim()
      .toLowerCase();
    if (answer === 'g' || answer === 'global') return 'global';
    if (answer === 's' || answer === 'skip') return 'skip';
    return 'project';
  } finally {
    prompt.close();
  }
}
