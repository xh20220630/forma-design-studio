#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from './cli/main.ts';

export { main } from './cli/main.ts';

/**
 * 区分命令行直接运行与模块导入，避免被导入时意外启动服务。
 *
 * @param argvPath - 命令行入口文件的路径。
 * @param moduleUrl - 当前模块的 URL，用于判断是否直接执行。
 * @returns 当前文件是否为直接执行的入口。
 */
export function isDirectExecution(argvPath = process.argv[1], moduleUrl = import.meta.url) {
  if (!argvPath) return false;
  const executableName = path.basename(argvPath).replace(/\.cmd$/i, '');
  if (executableName === 'forma-design') return true;
  const modulePath = fileURLToPath(moduleUrl);
  try {
    return realpathSync(argvPath) === realpathSync(modulePath);
  } catch {
    return path.resolve(argvPath) === path.resolve(modulePath);
  }
}

if (isDirectExecution()) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
