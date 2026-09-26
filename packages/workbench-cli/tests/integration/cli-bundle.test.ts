import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const run = promisify(execFile);

test(
  'bundled CLI initializes, validates, exports and serves assets from its installed location',
  { timeout: 20000 },
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'forma-cli-bundle-'));
    let child: ReturnType<typeof spawn> | undefined;
    let closed: Promise<void> | undefined;
    try {
      const entry = path.join(directory, 'dist', 'cli.js');
      const projectRoot = path.join(directory, 'project');
      const env = { ...process.env, CODEX_HOME: path.join(directory, 'codex') };
      await writeFile(path.join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
      await build({
        entryPoints: [fileURLToPath(new URL('../../src/cli.ts', import.meta.url))],
        outfile: entry,
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node22',
        legalComments: 'none',
      });
      const initialized = JSON.parse(
        (
          await run(process.execPath, [entry, 'init', projectRoot, '--skill=skip', '--json'], {
            env,
            timeout: 5000,
          })
        ).stdout,
      );
      assert.equal(initialized.designRoot, path.join(projectRoot, 'design'));
      const designRoot = initialized.designRoot as string;
      const validation = JSON.parse(
        (
          await run(process.execPath, [entry, 'validate', designRoot, '--json'], {
            env,
            timeout: 5000,
          })
        ).stdout,
      );
      assert.equal(validation.valid, true);
      const review = path.join(directory, 'review.html');
      await run(process.execPath, [entry, 'export-html', designRoot, '--output', review], {
        env,
        timeout: 5000,
      });
      assert.match(await readFile(review, 'utf8'), /<!doctype html>/);
      const staticRoot = path.join(directory, 'dist', 'web');
      await mkdir(staticRoot, { recursive: true });
      await writeFile(path.join(staticRoot, 'index.html'), '<title>Packaged workbench</title>');
      child = spawn(
        process.execPath,
        [entry, 'open', designRoot, '--port=0', '--no-open', '--json'],
        { env, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      closed = new Promise((resolve) => child!.once('close', () => resolve()));
      let stderr = '';
      child.stderr!.setEncoding('utf8').on('data', (chunk) => {
        stderr += chunk;
      });
      const address = await new Promise<{ url: string }>((resolve, reject) => {
        let stdout = '';
        const timer = setTimeout(() => reject(new Error(`CLI startup timed out: ${stderr}`)), 5000);
        child!.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child!.once('close', (code) => {
          clearTimeout(timer);
          reject(new Error(`CLI exited with ${code}: ${stderr}`));
        });
        child!.stdout!.setEncoding('utf8').on('data', (chunk) => {
          stdout += chunk;
          if (!stdout.endsWith('}\n')) return;
          clearTimeout(timer);
          try {
            resolve(JSON.parse(stdout));
          } catch (error) {
            reject(error);
          }
        });
      });
      assert.equal(await (await fetch(address.url)).text(), '<title>Packaged workbench</title>');
      const document = (await (await fetch(`${address.url}/api/document`)).json()) as {
        revision: number;
        flows: unknown[];
      };
      assert.equal(document.revision, 0);
      assert.deepEqual(document.flows, []);
    } finally {
      child?.kill();
      await closed;
      await rm(directory, { recursive: true, force: true });
    }
  },
);
