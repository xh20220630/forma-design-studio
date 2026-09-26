import type { Project } from '@forma/schema';
import { seedProjects } from '../../../entities/project/model/seed';
import { api } from '../../../shared/api/client';

export const storageKey = 'forma-projects-v1';

let bootPromise:
  | Promise<{
      /** 当前保存或展示的项目集合。 */
      projects: Project[];
      /** 后端服务当前是否可访问。 */
      online: boolean;
    }>
  | undefined;

// 复用启动 Promise，避免 StrictMode 重挂载时重复迁移缓存和写入种子项目。
export function boot() {
  if (!bootPromise)
    bootPromise = (async () => {
      try {
        const state = await api<{
          /** 当前保存或展示的项目集合。 */
          projects: Project[];
        }>('/state');
        if (state.projects.length) return { projects: state.projects, online: true };
        let cached: Project[] | undefined;
        try {
          cached = JSON.parse(localStorage.getItem(storageKey) || 'null');
        } catch {
          /* A damaged browser cache must not prevent opening the workspace. */
        }
        const projects: Project[] = [];
        for (const project of cached ?? seedProjects)
          projects.push(await api<Project>(`/projects/${project.id}`, project, 'PUT'));
        return { projects, online: true };
      } catch {
        try {
          return {
            projects: JSON.parse(localStorage.getItem(storageKey) || 'null') ?? seedProjects,
            online: false,
          };
        } catch {
          return { projects: seedProjects, online: false };
        }
      }
    })();
  return bootPromise;
}
