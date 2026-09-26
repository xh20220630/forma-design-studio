import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createWorkbenchServer } from '@forma/design-workspace-sdk/server';
import { configuredDesignRoot } from '../infrastructure/project-config.ts';
import { openBrowser } from '../infrastructure/browser.ts';
import { packageRoot } from '../paths.ts';
import type { CommandContext } from '../cli/arguments.ts';
import { print } from '../cli/output.ts';

export async function runOpen({ parsed, cwd, asJson }: CommandContext) {
  const root = path.resolve(parsed.positional[0] || (await configuredDesignRoot(cwd)));
  const portValue = parsed.options.get('port');
  const port = typeof portValue === 'string' ? Number(portValue) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535))
    throw new Error('--port 必须是有效端口。');

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
  const stop = async () => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await new Promise(() => {});
}
