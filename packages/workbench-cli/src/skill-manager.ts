import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { checksumDirectory } from '@forma/design-workspace-sdk';
import { skillId, skillSourceDirectory, skillVersion } from '@forma/ai-ui-designer-plugin';

export type SkillScope = 'project' | 'global';

export interface SkillInstallation {
  scope: SkillScope;
  path: string;
  installed: boolean;
  managed: boolean;
  version?: string;
  checksum?: string;
  compatible: boolean;
}

interface ManagedMarker {
  id: string;
  version: string;
  installedBy: string;
  checksum: string;
}

function major(version: string) {
  return Number(version.split('.')[0]);
}

function targetFor(projectRoot: string, scope: SkillScope) {
  if (scope === 'project') return path.join(projectRoot, '.agents', 'skills', skillId);
  const codexRoot = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(os.homedir(), '.codex');
  return path.join(codexRoot, 'skills', skillId);
}

async function exists(file: string) {
  try { await stat(file); return true; } catch { return false; }
}

async function readMarker(target: string): Promise<ManagedMarker | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(path.join(target, '.forma-skill.json'), 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const marker = value as Partial<ManagedMarker>;
    if (marker.id === skillId && typeof marker.version === 'string' && typeof marker.checksum === 'string' && marker.installedBy === '@forma/ai-design-workbench') return marker as ManagedMarker;
  } catch { return; }
}

export async function recordSkillInstallation(projectRoot: string, skill: Pick<SkillInstallation, 'scope' | 'path' | 'version' | 'checksum'>) {
  const stateFile = path.join(projectRoot, '.forma', 'local-state.json');
  let state: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(stateFile, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) state = parsed as Record<string, unknown>;
  } catch { /* create state */ }
  const existingSkills = state.skills && typeof state.skills === 'object' && !Array.isArray(state.skills) ? state.skills as Record<string, unknown> : {};
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify({ ...state, schemaVersion: 1, skills: { ...existingSkills, [skillId]: {
    scope: skill.scope, version: skill.version, path: skill.path, checksum: skill.checksum,
  } } }, null, 2)}\n`, { mode: 0o600 });
}

export async function inspectSkill(projectRoot: string, scope: SkillScope): Promise<SkillInstallation> {
  const target = targetFor(projectRoot, scope);
  const installed = await exists(target);
  const marker = installed ? await readMarker(target) : undefined;
  let checksum: string | undefined;
  if (marker) {
    try { checksum = await checksumDirectory(target); } catch { /* an unreadable installation is incompatible */ }
  }
  return {
    scope, path: target, installed, managed: Boolean(marker), version: marker?.version, checksum,
    compatible: Boolean(marker && checksum === marker.checksum && major(marker.version) >= major(skillVersion)),
  };
}

export async function inspectSkills(projectRoot: string) {
  return Promise.all([inspectSkill(projectRoot, 'project'), inspectSkill(projectRoot, 'global')]);
}

export async function installSkill(projectRoot: string, scope: SkillScope) {
  const current = await inspectSkill(projectRoot, scope);
  const sourceChecksum = await checksumDirectory(skillSourceDirectory);
  if (current.managed && current.version && major(current.version) > major(skillVersion)) {
    if (!current.compatible) throw new Error(`检测到损坏的更高版本 Skill，拒绝降级覆盖：${current.path}`);
    const result = { ...current, action: 'kept-newer' as const };
    await recordSkillInstallation(projectRoot, result);
    return result;
  }
  if (current.managed && current.version === skillVersion && current.checksum === sourceChecksum) {
    const result = { ...current, compatible: true, action: 'reused' as const };
    await recordSkillInstallation(projectRoot, result);
    return result;
  }
  if (current.installed && !current.managed) throw new Error(`目标目录已存在且不由 Forma 管理：${current.path}`);

  const parent = path.dirname(current.path);
  await mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.${skillId}.${randomUUID()}.tmp`);
  const backup = path.join(parent, `.${skillId}.${randomUUID()}.backup`);
  await cp(skillSourceDirectory, temporary, { recursive: true, errorOnExist: true });
  await writeFile(path.join(temporary, '.forma-skill.json'), `${JSON.stringify({
    id: skillId, version: skillVersion, installedBy: '@forma/ai-design-workbench', checksum: sourceChecksum,
  }, null, 2)}\n`);
  let backedUp = false;
  try {
    if (current.installed) { await rename(current.path, backup); backedUp = true; }
    await rename(temporary, current.path);
    if (backedUp) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (backedUp && !(await exists(current.path))) await rename(backup, current.path);
    throw error;
  }
  const result = { ...(await inspectSkill(projectRoot, scope)), action: current.installed ? 'updated' as const : 'installed' as const };
  await recordSkillInstallation(projectRoot, result);
  return result;
}
