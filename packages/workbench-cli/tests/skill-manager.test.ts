import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initializeProject } from '../src/init.ts';
import { inspectSkill, installSkill } from '../src/skill-manager.ts';

test('installs the bundled skill at project scope and reuses an identical installation', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'forma-cli-skill-'));
  try {
    const installed = await installSkill(projectRoot, 'project');
    assert.equal(installed.action, 'installed');
    assert.equal(installed.compatible, true);
    assert.equal((await readFile(path.join(installed.path, 'SKILL.md'), 'utf8')).includes('Forma 本地设计工作台'), true);
    const directInstallState = JSON.parse(await readFile(path.join(projectRoot, '.forma/local-state.json'), 'utf8')) as { skills: { 'forma-ai-ui-designer': { scope: string } } };
    assert.equal(directInstallState.skills['forma-ai-ui-designer'].scope, 'project');
    const reused = await installSkill(projectRoot, 'project');
    assert.equal(reused.action, 'reused');
    assert.equal((await inspectSkill(projectRoot, 'project')).managed, true);
    await writeFile(path.join(installed.path, 'SKILL.md'), '# Locally modified');
    const repaired = await installSkill(projectRoot, 'project');
    assert.equal(repaired.action, 'updated');
    assert.equal((await readFile(path.join(installed.path, 'SKILL.md'), 'utf8')).includes('Forma 本地设计工作台'), true);
    await initializeProject({ projectRoot, skill: 'project' });
    const localState = JSON.parse(await readFile(path.join(projectRoot, '.forma/local-state.json'), 'utf8')) as { skills: { 'forma-ai-ui-designer': { scope: string; version: string } } };
    assert.deepEqual(localState.skills['forma-ai-ui-designer'], { scope: 'project', version: '2.0.0', path: installed.path, checksum: repaired.checksum });
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('keeps an intact newer major and refuses to overwrite it when corrupted', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'forma-cli-newer-skill-'));
  try {
    const installed = await installSkill(projectRoot, 'project');
    const markerFile = path.join(installed.path, '.forma-skill.json');
    const marker = JSON.parse(await readFile(markerFile, 'utf8')) as { version: string };
    await writeFile(markerFile, JSON.stringify({ ...marker, version: '3.0.0' }));
    assert.equal((await installSkill(projectRoot, 'project')).action, 'kept-newer');
    await writeFile(path.join(installed.path, 'SKILL.md'), '# Corrupted newer skill');
    await assert.rejects(() => installSkill(projectRoot, 'project'), /损坏的更高版本/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('refuses to replace an unmanaged skill directory', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'forma-cli-unmanaged-'));
  try {
    const target = path.join(projectRoot, '.agents/skills/forma-ai-ui-designer');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'SKILL.md'), '# User-owned skill');
    await assert.rejects(() => installSkill(projectRoot, 'project'), /Forma 管理/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('initializes a minimal project without overwriting existing files', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'forma-cli-init-'));
  try {
    await writeFile(path.join(projectRoot, '.gitignore'), 'user-entry\n');
    const first = await initializeProject({ projectRoot, skill: 'skip' });
    assert.equal(first.created.includes('design/project.json'), true);
    assert.equal(first.created.includes('.gitignore'), false);
    assert.equal(await readFile(path.join(projectRoot, '.gitignore'), 'utf8'), 'user-entry\n.forma/\n');
    assert.deepEqual(first.updated, ['.gitignore']);
    const second = await initializeProject({ projectRoot, skill: 'skip' });
    assert.deepEqual(second.created, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
