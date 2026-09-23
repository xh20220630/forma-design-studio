import { chmod, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = path.resolve(packageRoot, '../..');
const outputRoot = path.join(packageRoot, 'dist');
const webSource = path.join(repositoryRoot, 'apps/ai-design-workbench/dist');
const skillSource = path.join(repositoryRoot, 'packages/forma-ai-ui-designer/skills/forma-ai-ui-designer');

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await build({
  entryPoints: [path.join(packageRoot, 'src/cli.ts')],
  outfile: path.join(outputRoot, 'cli.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  legalComments: 'none',
});
await chmod(path.join(outputRoot, 'cli.js'), 0o755);
await cp(webSource, path.join(outputRoot, 'web'), { recursive: true });
await cp(skillSource, path.join(outputRoot, 'skills/forma-ai-ui-designer'), { recursive: true });
