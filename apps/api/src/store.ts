import { dataRoot } from './config.ts';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.ts';
import { errorProperty } from './errors.ts';
import type { Project } from '@forma/schema';

export { dataRoot };
let queue: Promise<unknown> = Promise.resolve();

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; }
  catch (error) { if (errorProperty(error, 'code') === 'ENOENT') return fallback; throw error; }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

export function transact<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation, operation); queue = next.catch(() => {}); return next;
}

export async function getState() { return readJson<{ projects: Project[] }>(path.join(dataRoot, 'projects.json'), { projects: [] }); }
export async function findProject(id: string): Promise<Project> {
  const project = (await getState()).projects.find(item => item.id === id);
  if (!project) throw new ApiError(404, '项目不存在。');
  return project;
}

type ProjectUpdate<T> = (current: T) => Project | Promise<Project>;
export function mutateProject(id: string, update: ProjectUpdate<Project | undefined>, options: { create: true }): Promise<Project>;
export function mutateProject(id: string, update: ProjectUpdate<Project>, options?: { create?: false }): Promise<Project>;
export function mutateProject(id: string, update: ProjectUpdate<Project> | ProjectUpdate<Project | undefined>, { create = false } = {}): Promise<Project> {
  return transact(async () => {
    const state = await getState(); const index = state.projects.findIndex(project => project.id === id);
    if (index < 0 && !create) throw new ApiError(404, '项目不存在。');
    const current = index < 0 ? undefined : state.projects[index];
    // The create overload explicitly allows an absent project; ordinary updates reject it above.
    const next = current ? await update(current) : await (update as ProjectUpdate<undefined>)(undefined);
    next.id = id; next.revision = (current?.revision || 0) + 1; next.updatedAt = new Date().toISOString();
    if (index < 0) state.projects.unshift(next); else state.projects[index] = next;
    await writeJson(path.join(dataRoot, 'projects.json'), state); return next;
  });
}

export function removeProject(id: string) {
  return transact(async () => {
    const state = await getState(); state.projects = state.projects.filter(project => project.id !== id);
    await writeJson(path.join(dataRoot, 'projects.json'), state);
  });
}
