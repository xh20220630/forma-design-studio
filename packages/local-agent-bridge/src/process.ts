import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { executableCommand } from './discovery.ts';
import { terminateProcessTree } from './lifecycle.ts';
import { LocalAgentRequestError } from './errors.ts';

export class AgentProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly closed: Promise<void>;
  private failure?: Error;
  private stderr = '';
  private pending = new Map<
    number,
    { resolve: (result: any) => void; reject: (error: Error) => void }
  >();
  private requestId = 0;
  private stopPromise?: Promise<void>;
  onMessage: (message: any) => void = () => {};

  private constructor(command: string, args: string[], cwd: string, maxOutputBytes: number) {
    const env = { ...process.env };
    // Claude rejects nested launches when a client itself was started by Claude Code.
    delete env.CLAUDECODE;
    this.child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: 'pipe',
    });
    this.child.stdin.on('error', (error) => this.fail(error));
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.stderr = (this.stderr + chunk.toString('utf8')).slice(-4096);
    });
    const decoder = new StringDecoder('utf8');
    let buffer = '';
    let bytes = 0;
    const consume = (text: string) => {
      buffer += text;
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line) continue;
        try {
          const message = JSON.parse(line);
          if (
            message &&
            !message.method &&
            typeof message.id === 'number' &&
            this.pending.has(message.id)
          ) {
            const waiting = this.pending.get(message.id)!;
            this.pending.delete(message.id);
            if (message.error) waiting.reject(new LocalAgentRequestError(message.error));
            else waiting.resolve(message.result);
          } else this.onMessage(message);
        } catch (error) {
          this.fail(new Error(`CLI 输出流无效：${(error as Error).message.slice(0, 180)}`));
        }
      }
    };
    this.child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes) this.fail(new Error('CLI 输出超过大小限制。'));
      else consume(decoder.write(chunk));
    });
    this.closed = new Promise<void>((resolve, reject) => {
      this.child.once('error', (error) => {
        this.failure = error;
      });
      this.child.once('close', (code) => {
        consume(decoder.end() + (buffer.trim() ? '\n' : ''));
        const error =
          this.failure ||
          (code !== 0 && !this.stopPromise
            ? new Error(`CLI 执行失败（退出码 ${code}）。${this.stderr.trim().slice(-1200)}`)
            : undefined);
        for (const waiting of this.pending.values())
          waiting.reject(error || new Error('CLI 在返回 ACP 响应前退出。'));
        this.pending.clear();
        if (error) reject(error);
        else resolve();
      });
    });
    // ACP processes can exit while the caller awaits a request rather than closed.
    void this.closed.catch(() => {});
  }

  static async start(
    executable: string,
    args: string[],
    cwd: string,
    maxOutputBytes = 16 * 1024 * 1024,
  ) {
    const launch = await executableCommand(executable);
    return new AgentProcess(launch.command, [...launch.args, ...args], cwd, maxOutputBytes);
  }

  send(message: unknown) {
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }

  request(method: string, params: unknown): Promise<any> {
    if (this.failure || this.child.exitCode !== null)
      return Promise.reject(this.failure || new Error('CLI 已退出。'));
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  fail(error: Error) {
    this.failure ||= error;
    for (const waiting of this.pending.values()) waiting.reject(this.failure);
    this.pending.clear();
    void this.stop();
  }

  stop(): Promise<void> {
    this.stopPromise ||= terminateProcessTree(this.child);
    return this.stopPromise;
  }
}
