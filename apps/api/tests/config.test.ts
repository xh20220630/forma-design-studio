import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const configUrl = new URL('../src/config.ts', import.meta.url).href;

/**
 * 验证API paths stay rooted in the repository when pnpm changes the working directory。
 * @returns 完成当前检查或生命周期操作。
 */
test('API paths stay rooted in the repository when pnpm changes the working directory', async () => {
  for (const cwd of [root, path.join(root, 'apps/api'), os.tmpdir()]) {
    for (const dataDirectory of ['', '.data/custom', path.join(os.tmpdir(), 'forma-custom-data')]) {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `const { dataRoot, webDist } = await import(${JSON.stringify(configUrl)}); console.log(JSON.stringify({ dataRoot, webDist }));`,
        ],
        { cwd, env: { ...process.env, FORMA_DATA_DIR: dataDirectory } },
      );
      assert.deepEqual(JSON.parse(stdout), {
        dataRoot: path.resolve(root, dataDirectory || '.data'),
        webDist: path.join(root, 'apps/web/dist'),
      });
    }
  }
});
