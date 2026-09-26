/**
 * 根据输出模式显示人类可读信息或 JSON，兼顾终端使用和脚本集成。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param asJson - 是否输出机器可读的 JSON。
 * @returns 无返回值；写入标准输出。
 */
export function print(value: unknown, asJson: boolean) {
  process.stdout.write(`${asJson ? JSON.stringify(value, null, 2) : String(value)}\n`);
}

/**
 * 输出可用命令和参数说明，帮助用户选择工作台操作。
 * @returns 无返回值；写入帮助文本。
 */
export function help() {
  return (
    `Forma AI Design Workbench\n\n` +
    `  init [project-root] [--skill=project|global|skip] [--yes]\n` +
    `  open [design-root] [--port=4311] [--no-open]\n` +
    `  validate [design-root] [--json]\n` +
    `  export-html [design-root] [--output=review.html]\n` +
    `  skill status [project-root] [--json]\n` +
    `  skill install [project-root] --scope=project|global\n`
  );
}
