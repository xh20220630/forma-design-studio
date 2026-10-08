import { spawn, type ChildProcess } from 'node:child_process';

export async function terminateProcessTree(child: ChildProcess) {
  const pid = child.pid;
  if (!pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.once('error', () => {
        child.kill();
        resolve();
      });
      killer.once('close', () => resolve());
    });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}
