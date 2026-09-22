import './config.mjs';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';

export const dataRoot = path.resolve(process.env.FORMA_DATA_DIR || '.data');
let queue = Promise.resolve();

export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

export function transact(operation) {
  const next = queue.then(operation, operation); queue = next.catch(() => {}); return next;
}

export async function getState() { return readJson(path.join(dataRoot, 'projects.json'), { projects: [] }); }
export async function findProject(id) {
  const project = (await getState()).projects.find(item => item.id === id);
  if (!project) throw new ApiError(404, '项目不存在。');
  return project;
}

export function mutateProject(id, update, { create = false } = {}) {
  return transact(async () => {
    const state = await getState(); const index = state.projects.findIndex(project => project.id === id);
    if (index < 0 && !create) throw new ApiError(404, '项目不存在。');
    const current = index < 0 ? undefined : state.projects[index];
    const next = await update(current);
    next.id = id; next.revision = (current?.revision || 0) + 1; next.updatedAt = new Date().toISOString();
    if (index < 0) state.projects.unshift(next); else state.projects[index] = next;
    await writeJson(path.join(dataRoot, 'projects.json'), state); return next;
  });
}

export function removeProject(id) {
  return transact(async () => {
    const state = await getState(); state.projects = state.projects.filter(project => project.id !== id);
    await writeJson(path.join(dataRoot, 'projects.json'), state);
  });
}
