import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDirectExecution } from '../src/cli.ts';

test('recognizes direct execution through a workspace bin symlink', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'forma-cli-entry-'));
  try {
    const target = path.join(directory, 'cli.js');
    const linkedDirectory = path.join(directory, 'workspace-link');
    const linkedEntry = path.join(linkedDirectory, 'cli.js');
    await writeFile(target, '#!/usr/bin/env node\n');
    await symlink(directory, linkedDirectory, 'dir');
    assert.equal(isDirectExecution(linkedEntry, pathToFileURL(target).href), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
