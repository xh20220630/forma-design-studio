import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { dataRoot } from './store.mjs';
import { ApiError, requireValue } from './errors.mjs';
import { validateWorkspacePath } from './exporter.mjs';

const run = promisify(execFile);

export async function bindWorkspace(project, input) {
  if (input.kind === 'local') return { kind: 'local', path: await validateWorkspacePath(input.path), autoSync: false };
  requireValue(input.kind === 'github', '工作空间类型必须是 local 或 github。');
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(input.repo || '');
  requireValue(match && !['.', '..'].includes(match[1]) && !['.', '..'].includes(match[2]), '请输入有效的 GitHub HTTPS 仓库 URL。');
  const branch = input.branch?.trim();
  requireValue(!branch || (/^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,150}$/.test(branch) && !branch.includes('..') && !branch.endsWith('/')), '分支名称无效。');
  const root = path.join(dataRoot, 'workspaces'); await mkdir(root, { recursive: true });
  const destination = path.join(root, project.id);
  try { await lstat(destination); throw new ApiError(409, '该项目的克隆目录已存在；请改用本地目录绑定以保留已有文件。'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const repo = `https://github.com/${match[1]}/${match[2]}.git`;
  try {
    await run('git', ['-c', 'core.hooksPath=', 'clone', '--depth', '1', ...(branch ? ['--branch', branch] : []), '--', repo, destination], { windowsHide: true, timeout: 120000, maxBuffer: 100000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
  } catch (error) { throw new ApiError(400, `GitHub 克隆失败，请确认 Git 已安装且仓库、分支可访问。${String(error.stderr || error.message).slice(0, 500)}`); }
  return { kind: 'github', path: await validateWorkspacePath(destination), repo, ...(branch ? { branch } : {}), autoSync: false };
}
