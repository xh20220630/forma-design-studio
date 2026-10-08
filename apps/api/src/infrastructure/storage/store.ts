import { dataRoot } from '../../config/runtime.ts';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError, errorProperty } from '../../shared/errors.ts';
import type { Project } from '@forma/schema';
import { migrateBrandDesign } from '../../domain/brand-design.ts';

export { dataRoot };
/** 集中维护 queue 的串行写入顺序，防止多个请求覆盖同一状态。 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * 读取 UTF-8 JSON；只在文件不存在时采用回退值，损坏内容和权限错误继续抛出。
 *
 * @param file - 要读取的 JSON 文件路径。
 * @param fallback - 仅当文件不存在（ENOENT）时采用的默认数据。
 * @returns 解析后的数据；文件不存在时返回 fallback。
 */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (error) {
    if (errorProperty(error, 'code') === 'ENOENT') return fallback;
    throw error;
  }
}

/**
 * 先写入同目录临时文件再重命名，避免中途退出留下半份 JSON。
 *
 * @param file - 目标 JSON 文件路径。
 * @param value - 要序列化并持久化的数据。
 * @returns 无返回值；写入完成后结束。
 */
export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

/**
 * 把状态修改串行排队，并隔离上一次失败，避免并发读写丢失更新。
 *
 * @param operation - 本次要执行的操作。
 * @returns 本次操作的结果；失败会继续向调用方抛出。
 */
export function transact<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation, operation);
  queue = next.catch(() => {});
  return next;
}

/**
 * 读取项目集合，尚未创建数据文件时使用空集合。
 * @returns 包含所有项目的持久化状态。
 */
export async function getState() {
  const state = await readJson<{
    /** 当前保存或展示的项目集合。 */
    projects: Project[];
  }>(path.join(dataRoot, 'projects.json'), { projects: [] });
  for (const project of state.projects) {
    if (project.brandDesign && !Array.isArray(project.brandDesign.artifacts))
      project.brandDesign = migrateBrandDesign(project.brandDesign);
  }
  return state;
}
/**
 * 按 ID 查找项目，统一把不存在的项目转换为 404 错误。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @returns 目标项目。
 */
export async function findProject(id: string): Promise<Project> {
  const project = (await getState()).projects.find((item) => item.id === id);
  if (!project) throw new ApiError(404, '项目不存在。');
  return project;
}

/**
 * 项目更新函数；创建时允许没有旧项目，普通修改必须已有项目。
 * @param current - 调用方传入的值。
 * @returns 回调约定的结果，异步实现返回 Promise。
 */
type ProjectUpdate<T> = (current: T) => Project | Promise<Project>;
/**
 * 在串行事务中创建或更新项目，统一维护版本号与更新时间。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @param update - 根据旧值计算新值的更新函数。
 * @param options - 本次操作的配置选项。
 * @returns 已保存且递增版本后的项目。
 */
export function mutateProject(
  id: string,
  update: ProjectUpdate<Project | undefined>,
  options: {
    /** 是否允许目标不存在时创建，普通更新不应隐式新增项目。 */
    create: true;
  },
): Promise<Project>;
/**
 * 在串行事务中创建或更新项目，统一维护版本号与更新时间。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @param update - 根据旧值计算新值的更新函数。
 * @param options - 本次操作的配置选项。
 * @returns 已保存且递增版本后的项目。
 */
export function mutateProject(
  id: string,
  update: ProjectUpdate<Project>,
  options?: {
    /** 是否允许目标不存在时创建，普通更新不应隐式新增项目。 */
    create?: false;
  },
): Promise<Project>;
/**
 * 在串行事务中创建或更新项目，统一维护版本号与更新时间。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @param update - 根据旧值计算新值的更新函数。
 * @param arg3 - 按字段解构的输入，字段用途见对应类型定义。
 * @param arg3.create - 是否允许目标不存在时创建，普通更新不应隐式新增项目。
 * @returns 已保存且递增版本后的项目。
 */
export function mutateProject(
  id: string,
  update: ProjectUpdate<Project> | ProjectUpdate<Project | undefined>,
  { create = false } = {},
): Promise<Project> {
  return transact(async () => {
    const state = await getState();
    const index = state.projects.findIndex((project) => project.id === id);
    if (index < 0 && !create) throw new ApiError(404, '项目不存在。');
    const current = index < 0 ? undefined : state.projects[index];
    // The create overload explicitly allows an absent project; ordinary updates reject it above.
    const next = current
      ? await update(current)
      : await (update as ProjectUpdate<undefined>)(undefined);
    next.id = id;
    next.revision = (current?.revision || 0) + 1;
    next.updatedAt = new Date().toISOString();
    if (index < 0) state.projects.unshift(next);
    else state.projects[index] = next;
    await writeJson(path.join(dataRoot, 'projects.json'), state);
    return next;
  });
}

/**
 * 在串行事务中移除项目记录，避免与其他保存操作互相覆盖。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @returns 无返回值；删除完成后结束。
 */
export function removeProject(id: string) {
  return transact(async () => {
    const state = await getState();
    state.projects = state.projects.filter((project) => project.id !== id);
    await writeJson(path.join(dataRoot, 'projects.json'), state);
  });
}
