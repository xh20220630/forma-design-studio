import path from 'node:path';
import os from 'node:os';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { terminateProcessTree } from './lifecycle.ts';
import type { LocalAgentId, LocalAgentInfo, BridgeOptions } from './types.ts';

export const agentDefinitions = [
  { id: 'codex', name: 'Codex', transport: 'jsonl' },
  { id: 'claude', name: 'Claude Code', transport: 'stream-json' },
  { id: 'kimi', name: 'Kimi Code', transport: 'acp' },
] as const;

export async function findExecutable(id: LocalAgentId, override?: string) {
  const directories = [
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean),
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.kimi-code', 'bin'),
    path.join(os.homedir(), '.cargo', 'bin'),
    ...(process.env.APPDATA ? [path.join(process.env.APPDATA, 'npm')] : []),
  ];
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.ps1', ''] : [''];
  const candidates = override
    ? [path.resolve(override)]
    : directories.flatMap((directory) => extensions.map((ext) => path.join(directory, id + ext)));
  for (const candidate of candidates) {
    try {
      await access(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return undefined;
}

/** Resolve npm's Windows launcher to its JS entry; prompts never pass through cmd.exe or shell interpolation. */
export async function executableCommand(
  executable: string,
): Promise<{ command: string; args: string[] }> {
  if (/\.[cm]?js$/i.test(executable)) return { command: process.execPath, args: [executable] };
  if (process.platform === 'win32' && /\.cmd$/i.test(executable)) {
    const shim = await readFile(executable, 'utf8');
    const entry = /"%dp0%\\([^"\r\n]+\.[cm]?js)"/i.exec(shim)?.[1];
    if (!entry) throw new Error('此 CMD 启动器不受支持，请安装原生 CLI 或配置其 JS 入口。');
    const script = path.resolve(path.dirname(executable), entry);
    await access(script);
    return { command: process.execPath, args: [script] };
  }
  if (process.platform === 'win32' && /\.ps1$/i.test(executable)) {
    return {
      command: path.join(
        process.env.SystemRoot || 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      ),
      args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', executable],
    };
  }
  return { command: executable, args: [] };
}

export async function discoverAgents(options: BridgeOptions = {}): Promise<LocalAgentInfo[]> {
  return Promise.all(
    agentDefinitions.map(async (definition) => {
      const executable = await findExecutable(definition.id, options.executables?.[definition.id]);
      if (!executable) return { ...definition, installed: false, available: false };
      try {
        const launch = await executableCommand(executable);
        const version = await new Promise<string>((resolve, reject) => {
          const child = spawn(launch.command, [...launch.args, '--version'], {
            windowsHide: true,
            detached: process.platform !== 'win32',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let output = '';
          const timer = setTimeout(() => {
            void terminateProcessTree(child).finally(() => reject(new Error('CLI 版本检测超时。')));
          }, 5000);
          child.stdout.on('data', (chunk: Buffer) => {
            output = (output + chunk.toString('utf8')).slice(0, 4096);
          });
          child.stderr.resume();
          child.once('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.once('close', (code) => {
            clearTimeout(timer);
            if (code === 0) resolve(output.trim());
            else reject(new Error(`CLI 版本检测失败（退出码 ${code}）。`));
          });
        });
        return { ...definition, installed: true, available: true, executable, version };
      } catch (error) {
        return {
          ...definition,
          installed: true,
          available: false,
          executable,
          error: (error as Error).message,
        };
      }
    }),
  );
}
