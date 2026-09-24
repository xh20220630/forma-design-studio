#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { openDesignWorkspace } from '@forma/design-workspace-sdk';
import { createWorkbenchServer } from '@forma/design-workspace-sdk/server';
import { exportStaticReview } from '@forma/design-workspace-sdk/static-review';
import { initializeProject } from './init.ts';
import { inspectSkills, installSkill, type SkillScope } from './skill-manager.ts';

/**
 * 解析命令行选项和值，给各子命令提供统一参数入口。
 *
 * @param values - 各模式或选项对应的实际取值。
 * @returns 解析后的命令行参数。
 */
function flags(values: string[]) {
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

/**
 * 优先读取项目配置中的设计目录，让命令行与工作台使用相同数据源。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @returns 解析后的设计目录。
 */
async function configuredDesignRoot(projectRoot: string) {
  try {
    const config: unknown = JSON.parse(
      await readFile(path.join(projectRoot, 'forma.config.json'), 'utf8'),
    );
    if (
      config &&
      typeof config === 'object' &&
      !Array.isArray(config) &&
      typeof (
        config as {
          /** 设计文档与素材所在的根目录。 */
          designRoot?: unknown;
        }
      ).designRoot === 'string'
    )
      return path.resolve(
        projectRoot,
        (
          config as {
            /** 设计文档与素材所在的根目录。 */
            designRoot: string;
          }
        ).designRoot,
      );
  } catch {
    /* use default */
  }
  return path.join(projectRoot, 'design');
}

/**
 * 按操作系统选择打开方式，在本地浏览器中展示工作台。
 *
 * @param url - 资源或服务的访问地址。
 * @returns 浏览器启动操作的结果。
 */
function openBrowser(url: string) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.once(
    'error',
    /**
     * 响应 error 事件，推进 openBrowser 的状态更新。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      /* headless environment: keep the printed URL usable */
    },
  );
  child.unref();
}

/**
 * 根据输出模式显示人类可读信息或 JSON，兼顾终端使用和脚本集成。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param asJson - 是否输出机器可读的 JSON。
 * @returns 无返回值；写入标准输出。
 */
function print(value: unknown, asJson: boolean) {
  process.stdout.write(`${asJson ? JSON.stringify(value, null, 2) : String(value)}\n`);
}

/**
 * 输出可用命令和参数说明，帮助用户选择工作台操作。
 * @returns 无返回值；写入帮助文本。
 */
function help() {
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

/**
 * 分发工作台子命令并统一处理退出状态，集中维护命令行入口。
 *
 * @param argv - 当前命令行参数数组。
 * @returns 命令执行完成后的结果。
 */
export async function main(argv = process.argv.slice(2)) {
  const [command = 'help', ...rest] = argv;
  const parsed = flags(rest);
  const cwd = process.cwd();
  const asJson = parsed.options.has('json');
  if (command === 'help' || command === '--help' || command === '-h') {
    print(help(), false);
    return;
  }
  if (command === 'init') {
    const projectRoot = path.resolve(parsed.positional[0] || cwd);
    const skillOption = parsed.options.get('skill');
    if (skillOption && !['project', 'global', 'skip'].includes(String(skillOption)))
      throw new Error('--skill 必须是 project、global 或 skip。');
    const selectedSkill = skillOption || (parsed.options.has('yes') ? 'project' : undefined);
    const result = await initializeProject({
      projectRoot,
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
  if (command === 'validate') {
    const root = path.resolve(parsed.positional[0] || (await configuredDesignRoot(cwd)));
    const report = await (await openDesignWorkspace({ root })).validate();
    print(
      asJson
        ? report
        : report.valid
          ? '设计资产有效。'
          : report.issues
              .map(
                /** 转换 main 中的集合条目，供后续处理或展示。 @param item - 当前遍历的条目。 @returns 当前条目转换后的结果。 */
                (item) => `${item.severity.toUpperCase()} ${item.path} ${item.message}`,
              )
              .join('\n'),
      asJson,
    );
    if (!report.valid) process.exitCode = 1;
    return;
  }
  if (command === 'export-html') {
    const root = path.resolve(parsed.positional[0] || (await configuredDesignRoot(cwd)));
    const outputOption = parsed.options.get('output');
    const output = await exportStaticReview({
      designRoot: root,
      ...(typeof outputOption === 'string' ? { output: path.resolve(outputOption) } : {}),
    });
    print(asJson ? { output } : `已导出 ${output}`, asJson);
    return;
  }
  if (command === 'skill') {
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
                /** 转换 main 中的集合条目，供后续处理或展示。 @param item - 当前遍历的条目。 @returns 当前条目转换后的结果。 */
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
  if (command === 'open') {
    const root = path.resolve(parsed.positional[0] || (await configuredDesignRoot(cwd)));
    const portValue = parsed.options.get('port');
    const port = typeof portValue === 'string' ? Number(portValue) : undefined;
    if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535))
      throw new Error('--port 必须是有效端口。');
    const packageRoot = fileURLToPath(new URL('../', import.meta.url));
    const workspaceRoot = path.resolve(packageRoot, '../..');
    const candidates = [
      path.join(packageRoot, 'dist/web'),
      path.join(workspaceRoot, 'apps/ai-design-workbench/dist'),
    ];
    let staticRoot: string | undefined;
    for (const candidate of candidates) {
      try {
        await readFile(path.join(candidate, 'index.html'));
        staticRoot = candidate;
        break;
      } catch {
        /* try next */
      }
    }
    if (!staticRoot)
      throw new Error(
        '工作台前端尚未构建，请先运行 pnpm --filter @forma/ai-design-workbench-ui build。',
      );
    const server = await createWorkbenchServer({
      designRoot: root,
      staticRoot,
      ...(port === undefined ? {} : { port }),
    });
    print(
      asJson
        ? { url: server.url, designRoot: root }
        : `Forma AI Design Workbench：${server.url}\n设计目录：${root}`,
      asJson,
    );
    if (!parsed.options.has('no-open')) openBrowser(server.url);
    /**
     * 关闭当前服务并结束相关资源，避免退出后仍占用端口。
     * @returns 清理操作的结果。
     */
    const stop = async () => {
      await server.close();
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    await new Promise(
      /**
       * 把 main 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
       * @returns 无返回值；通过 resolve 或 reject 结束等待。
       */
      () => {},
    );
  }
  throw new Error(`未知命令：${command}\n\n${help()}`);
}

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
  main().catch(
    /**
     * 处理 cli 中的异步失败，按当前流程决定回退或继续抛出。
     *
     * @param error - 当前操作的失败信息，供界面反馈或重试判断。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
