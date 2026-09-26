import { spawn } from 'node:child_process';

/**
 * 按操作系统选择打开方式，在本地浏览器中展示工作台。
 *
 * @param url - 资源或服务的访问地址。
 * @returns 浏览器启动操作的结果。
 */
export function openBrowser(url: string) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.once('error', () => {
    /* headless environment: keep the printed URL usable */
  });
  child.unref();
}
