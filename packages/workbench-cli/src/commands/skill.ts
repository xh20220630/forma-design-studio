import path from 'node:path';
import { inspectSkills, installSkill } from '../services/skills.ts';
import type { CommandContext } from '../cli/arguments.ts';
import { print } from '../cli/output.ts';

export async function runSkill({ parsed, cwd, asJson }: CommandContext) {
  /** 集中维护 [action = 'status', projectArg] 的约定值或当前状态，供相关分支保持一致。 */
  const [action = 'status', projectArg] = parsed.positional;
  const projectRoot = path.resolve(projectArg || cwd);
  if (action === 'status') {
    const result = await inspectSkills(projectRoot);
    print(
      asJson
        ? result
        : result
            .map(
              (item) =>
                `${item.scope}: ${item.installed ? `${item.version || 'unmanaged'}${item.compatible ? ' compatible' : ''}` : 'not installed'} · ${item.path}`,
            )
            .join('\n'),
      asJson,
    );
    return;
  }
  if (action === 'install') {
    const scope = parsed.options.get('scope');
    if (scope !== 'project' && scope !== 'global')
      throw new Error('--scope 必须是 project 或 global。');
    const result = await installSkill(projectRoot, scope);
    print(asJson ? result : `${result.action}: ${result.path}`, asJson);
    return;
  }
  throw new Error(`未知 skill 操作：${action}`);
}
