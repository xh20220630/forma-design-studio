/**
 * 解析命令行选项和值，给各子命令提供统一参数入口。
 *
 * @param values - 各模式或选项对应的实际取值。
 * @returns 解析后的命令行参数。
 */
export function flags(values: string[]) {
  const positional: string[] = [];
  const options = new Map<string, string | true>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const [name, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) options.set(name, inline);
    else if (values[index + 1] && !values[index + 1].startsWith('--'))
      options.set(name, values[++index]);
    else options.set(name, true);
  }
  return { positional, options };
}
export interface CommandContext {
  parsed: ReturnType<typeof flags>;
  cwd: string;
  asJson: boolean;
}
