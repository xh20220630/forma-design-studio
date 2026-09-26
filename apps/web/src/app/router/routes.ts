import type { View } from '../../shared/types/navigation';

export const labels: Record<View, string> = {
  projects: '项目',
  project: '项目概览',
  templates: '模板库',
  components: '组件库',
  tokens: '设计变量',
  agents: '助手与接入',
  sync: '设计同步',
  settings: '设置',
  theme: '凛的主题工作室',
  editor: '设计画布',
};

export const projectViews: View[] = ['project', 'editor', 'components', 'tokens', 'sync', 'agents'];

/**
 * 从浏览器地址恢复当前视图，让刷新和历史导航保留页面位置。
 * @returns 当前路由信息。
 */
export function currentRoute(): {
  /** 当前视图或画布相机参数。 */
  view: View;
  /** 动作、会话或记录所属项目的标识。 */
  projectId?: string;
} {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'project' && parts[1]) {
    return {
      projectId: parts[1],
      view: projectViews.includes(parts[2] as View) ? (parts[2] as View) : 'project',
    };
  }
  return {
    view: ['templates', 'settings', 'theme'].includes(parts[0]) ? (parts[0] as View) : 'projects',
  };
}
