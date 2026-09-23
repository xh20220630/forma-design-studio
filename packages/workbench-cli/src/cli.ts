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

function flags(values: string[]) {
  const positional: string[] = [];
  const options = new Map<string, string | true>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) { positional.push(value); continue; }
    const [name, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) options.set(name, inline);
    else if (values[index + 1] && !values[index + 1].startsWith('--')) options.set(name, values[++index]);
    else options.set(name, true);
  }
  return { positional, options };
}

async function configuredDesignRoot(projectRoot: string) {
  try {
    const config: unknown = JSON.parse(await readFile(path.join(projectRoot, 'forma.config.json'), 'utf8'));
    if (config && typeof config === 'object' && !Array.isArray(config) && typeof (config as { designRoot?: unknown }).designRoot === 'string') return path.resolve(projectRoot, (config as { designRoot: string }).designRoot);
  } catch { /* use default */ }
  return path.join(projectRoot, 'design');
}

function openBrowser(url: string) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.once('error', () => { /* headless environment: keep the printed URL usable */ });
  child.unref();
}

function print(value: unknown, asJson: boolean) {
  process.stdout.write(`${asJson ? JSON.stringify(value, null, 2) : String(value)}\n`);
}

function help() {
  return `Forma AI Design Workbench\n\n` +
    `  init [project-root] [--skill=project|global|skip] [--yes]\n` +
    `  open [design-root] [--port=4311] [--no-open]\n` +
    `  validate [design-root] [--json]\n` +
    `  export-html [design-root] [--output=review.html]\n` +
    `  skill status [project-root] [--json]\n` +
    `  skill install [project-root] --scope=project|global\n`;
}

export async function main(argv = process.argv.slice(2)) {
  const [command = 'help', ...rest] = argv;
  const parsed = flags(rest);
  const cwd = process.cwd();
  const asJson = parsed.options.has('json');
  if (command === 'help' || command === '--help' || command === '-h') { print(help(), false); return; }
  if (command === 'init') {
    const projectRoot = path.resolve(parsed.positional[0] || cwd);
    const skillOption = parsed.options.get('skill');
    if (skillOption && !['project', 'global', 'skip'].includes(String(skillOption))) throw new Error('--skill 必须是 project、global 或 skip。');
    const selectedSkill = skillOption || (parsed.options.has('yes') ? 'project' : undefined);
    const result = await initializeProject({ projectRoot, ...(selectedSkill ? { skill: selectedSkill as SkillScope | 'skip' } : {}) });
    print(asJson ? result : `已初始化 ${result.designRoot}${result.skill ? `\nSkill：${result.skill.scope} · ${result.skill.path}` : '\nSkill：跳过'}`, asJson);
    return;
  }
  if (command === 'validate') {
    const root = path.resolve(parsed.positional[0] || await configuredDesignRoot(cwd));
    const report = await (await openDesignWorkspace({ root })).validate();
    print(asJson ? report : report.valid ? '设计资产有效。' : report.issues.map(item => `${item.severity.toUpperCase()} ${item.path} ${item.message}`).join('\n'), asJson);
    if (!report.valid) process.exitCode = 1;
    return;
  }
  if (command === 'export-html') {
    const root = path.resolve(parsed.positional[0] || await configuredDesignRoot(cwd));
    const outputOption = parsed.options.get('output');
    const output = await exportStaticReview({ designRoot: root, ...(typeof outputOption === 'string' ? { output: path.resolve(outputOption) } : {}) });
    print(asJson ? { output } : `已导出 ${output}`, asJson); return;
  }
  if (command === 'skill') {
    const [action = 'status', projectArg] = parsed.positional;
    const projectRoot = path.resolve(projectArg || cwd);
    if (action === 'status') { const result = await inspectSkills(projectRoot); print(asJson ? result : result.map(item => `${item.scope}: ${item.installed ? `${item.version || 'unmanaged'}${item.compatible ? ' compatible' : ''}` : 'not installed'} · ${item.path}`).join('\n'), asJson); return; }
    if (action === 'install') {
      const scope = parsed.options.get('scope');
      if (scope !== 'project' && scope !== 'global') throw new Error('--scope 必须是 project 或 global。');
      const result = await installSkill(projectRoot, scope); print(asJson ? result : `${result.action}: ${result.path}`, asJson); return;
    }
    throw new Error(`未知 skill 操作：${action}`);
  }
  if (command === 'open') {
    const root = path.resolve(parsed.positional[0] || await configuredDesignRoot(cwd));
    const portValue = parsed.options.get('port');
    const port = typeof portValue === 'string' ? Number(portValue) : undefined;
    if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) throw new Error('--port 必须是有效端口。');
    const packageRoot = fileURLToPath(new URL('../', import.meta.url));
    const workspaceRoot = path.resolve(packageRoot, '../..');
    const candidates = [path.join(packageRoot, 'dist/web'), path.join(workspaceRoot, 'apps/ai-design-workbench/dist')];
    let staticRoot: string | undefined;
    for (const candidate of candidates) {
      try { await readFile(path.join(candidate, 'index.html')); staticRoot = candidate; break; } catch { /* try next */ }
    }
    if (!staticRoot) throw new Error('工作台前端尚未构建，请先运行 pnpm --filter @forma/ai-design-workbench-ui build。');
    const server = await createWorkbenchServer({ designRoot: root, staticRoot, ...(port === undefined ? {} : { port }) });
    print(asJson ? { url: server.url, designRoot: root } : `Forma AI Design Workbench：${server.url}\n设计目录：${root}`, asJson);
    if (!parsed.options.has('no-open')) openBrowser(server.url);
    const stop = async () => { await server.close(); process.exit(0); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    await new Promise(() => {});
  }
  throw new Error(`未知命令：${command}\n\n${help()}`);
}

export function isDirectExecution(argvPath = process.argv[1], moduleUrl = import.meta.url) {
  if (!argvPath) return false;
  const executableName = path.basename(argvPath).replace(/\.cmd$/i, '');
  if (executableName === 'forma-design') return true;
  const modulePath = fileURLToPath(moduleUrl);
  try { return realpathSync(argvPath) === realpathSync(modulePath); }
  catch { return path.resolve(argvPath) === path.resolve(modulePath); }
}

if (isDirectExecution()) {
  main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
