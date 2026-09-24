import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Folder,
  FolderGit2,
  FolderOpen,
  Frame,
  Github,
  LayoutGrid,
  Link2,
  LoaderCircle,
  MessageSquare,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  SwatchBook,
  Workflow,
  X,
} from 'lucide-react';
import type { View } from './types';
import type { DesignTemplate, Project, ProviderSettings } from '@forma/schema';
import { createProject, seedProjects, seedTemplates } from './lib/seed';
import { api, downloadJson } from './lib/api';
import { useStudioMotion } from './lib/motion';
import { useStudioTheme } from './theme/StudioTheme';
import Brand from './components/Brand';
import ProjectMark from './components/ProjectMark';
import { RinAvatar, RinIcon, RinIllustration } from './components/brand/RinBrand';
import Modal from './components/Modal';
import WorkspaceHome from './components/WorkspaceHome';
import ProjectOverview from './components/ProjectOverview';
import AgentChatPanel from './components/AgentChatPanel';
import './pearl-studio.css';
import './studio-motion-v5.css';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@forma/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@forma/ui/popover';
import { Separator } from '@forma/ui/separator';
import { AgentDialog, AgentsView, SettingsView, SyncView } from './components/WorkflowViews';

const DesignEditor = lazy(
  /** 执行 App 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
  () => import('./components/DesignEditor'),
);
const ThemeStudio = lazy(
  /** 执行 App 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
  () => import('./components/ThemeStudio'),
);
const ComponentsView = lazy(
  /**
   * 执行 App 传入的局部处理步骤，使调用处能够控制结果如何更新。
   * @returns 当前步骤的处理结果。
   */
  () =>
    import('./components/LibraryViews').then(
      /** 在 App 的异步步骤结束后处理结果。 @param module - 按需加载的模块对象。 @returns 当前步骤的处理结果。 */
      (module) => ({
        default: module.ComponentsView,
      }),
    ),
);
const TemplatesView = lazy(
  /**
   * 执行 App 传入的局部处理步骤，使调用处能够控制结果如何更新。
   * @returns 当前步骤的处理结果。
   */
  () =>
    import('./components/LibraryViews').then(
      /** 在 App 的异步步骤结束后处理结果。 @param module - 按需加载的模块对象。 @returns 当前步骤的处理结果。 */
      (module) => ({
        default: module.TemplatesView,
      }),
    ),
);
const TokensView = lazy(
  /**
   * 执行 App 传入的局部处理步骤，使调用处能够控制结果如何更新。
   * @returns 当前步骤的处理结果。
   */
  () =>
    import('./components/LibraryViews').then(
      /** 在 App 的异步步骤结束后处理结果。 @param module - 按需加载的模块对象。 @returns 当前步骤的处理结果。 */
      (module) => ({
        default: module.TokensView,
      }),
    ),
);

const labels: Record<View, string> = {
  projects: '项目',
  project: '项目概览',
  templates: '模板库',
  components: '组件库',
  tokens: '设计变量',
  agents: '助手与接入',
  sync: '设计同步',
  settings: '设置',
  theme: 'Rin 主题工作室',
  editor: '设计画布',
};
const storageKey = 'forma-projects-v1';
const projectViews: View[] = ['project', 'editor', 'components', 'tokens', 'sync', 'agents'];
/**
 * 从浏览器地址恢复当前视图，让刷新和历史导航保留页面位置。
 * @returns 当前路由信息。
 */
function currentRoute(): {
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
let bootPromise:
  | Promise<{
      /** 当前保存或展示的项目集合。 */
      projects: Project[];
      /** 后端服务当前是否可访问。 */
      online: boolean;
    }>
  | undefined;

/**
 * 准备应用启动所需的项目与设置数据，统一初始化来源。
 * @returns 应用启动数据。
 */
function boot() {
  if (!bootPromise)
    bootPromise =
      /**
       * 执行 boot 传入的局部处理步骤，使调用处能够控制结果如何更新。
       * @returns 当前步骤的处理结果。
       */
      (async () => {
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

/**
 * 呈现应用主界面，将展示与交互入口放在同一个组件中维护。
 * @returns 供 React 渲染的界面内容。
 */
export default function App() {
  const { reduced, expressive, transition } = useStudioMotion();
  const { settings: appearance, presets, updateSettings } = useStudioTheme();
  /** 界面状态：是否展开主题选择菜单。通过状态更新驱动界面刷新。 */
  const [themeMenu, setThemeMenu] = useState(false);
  /** 界面状态：当前保存或展示的项目集合。通过状态更新驱动界面刷新。 */
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const projectsRef = useRef(projects);
  /** 界面状态：可供选择的设计模板集合。通过状态更新驱动界面刷新。 */
  const [templates, setTemplates] = useState<DesignTemplate[]>(
    /**
     * 在应用主界面首次挂载时建立初始状态，避免每次渲染重复初始化。
     * @returns 初始状态值。
     */
    () => {
      try {
        return [
          ...seedTemplates,
          ...JSON.parse(localStorage.getItem('forma-custom-templates') || '[]'),
        ];
      } catch {
        return seedTemplates;
      }
    },
  );
  /** 界面状态：当前视图或画布相机参数。通过状态更新驱动界面刷新。 */
  const [view, setView] = useState<View>(
    /** 在应用主界面首次挂载时建立初始状态，避免每次渲染重复初始化。 @returns 初始状态值。 */
    () => currentRoute().view,
  );
  /** 界面状态：设计助手面板是否打开。通过状态更新驱动界面刷新。 */
  const [agentOpen, setAgentOpen] = useState(false);
  /** 界面状态：主导航侧栏是否折叠。通过状态更新驱动界面刷新。 */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /** 界面状态：等待写入助手输入区的需求草稿。通过状态更新驱动界面刷新。 */
  const [agentDraftRequest, setAgentDraftRequest] = useState<{
    /** 唯一标识，用于查找、更新和建立引用。 */
    id: number;
    /** 需要展示或编辑的文字内容。 */
    text: string;
  }>();
  /** 界面状态：首次打开编辑器时应显示的页面标识。通过状态更新驱动界面刷新。 */
  const [initialPageId, setInitialPageId] = useState<string>();
  /** 界面状态：用于主动重建编辑器实例的更新标记。通过状态更新驱动界面刷新。 */
  const [editorEpoch, setEditorEpoch] = useState(0);
  /** 界面状态：当前有异步任务执行的项目标识集合。通过状态更新驱动界面刷新。 */
  const [busyProjectIds, setBusyProjectIds] = useState<string[]>([]);
  /** 界面状态：当前选择对象的标识。通过状态更新驱动界面刷新。 */
  const [selectedId, setSelectedId] = useState(
    /** 在应用主界面首次挂载时建立初始状态，避免每次渲染重复初始化。 @returns 初始状态值。 */
    () => currentRoute().projectId ?? seedProjects[0]?.id ?? '',
  );
  /** 界面状态：当前资源或配置是否已经就绪。通过状态更新驱动界面刷新。 */
  const [ready, setReady] = useState(false);
  /** 界面状态：后端服务当前是否可访问。通过状态更新驱动界面刷新。 */
  const [online, setOnline] = useState(false);
  /** 界面状态：保存流程当前所处阶段。通过状态更新驱动界面刷新。 */
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'pending' | 'error'>('saved');
  /** 界面状态：短时展示给用户的操作提示。通过状态更新驱动界面刷新。 */
  const [toast, setToast] = useState<{
    /** 需要展示或编辑的文字内容。 */
    text: string;
    /** 当前操作的失败信息，供界面反馈或重试判断。 */
    error?: boolean;
  } | null>(null);
  /** 界面状态：当前打开的业务弹层。通过状态更新驱动界面刷新。 */
  const [modal, setModal] = useState<
    'create' | 'bind' | 'agent' | 'guide' | 'search' | 'delete' | 'rename' | null
  >(null);
  /** 界面状态：新建流程中选定的模板。通过状态更新驱动界面刷新。 */
  const [newTemplate, setNewTemplate] = useState<DesignTemplate | undefined>();
  /** 界面状态：搜索条件或查询文本。通过状态更新驱动界面刷新。 */
  const [query, setQuery] = useState('');
  /** 界面状态：当前激活的标签页。通过状态更新驱动界面刷新。 */
  const [tab, setTab] = useState('recent');
  /** 界面状态：尚待展示或处理的通知。通过状态更新驱动界面刷新。 */
  const [notifications, setNotifications] = useState(false);
  /** 界面状态：当前记录的操作事件。通过状态更新驱动界面刷新。 */
  const [events, setEvents] = useState<string[]>([
    '欢迎来到 Forma。选择示例项目，即可体验可编辑画布。',
  ]);
  /** 界面状态：当前生效的设置。通过状态更新驱动界面刷新。 */
  const [settings, setSettings] = useState<ProviderSettings>({
    configured: false,
    imageConfigured: false,
    providers: [],
    text: { providerId: '', model: '' },
    image: { providerId: '', model: '' },
    baseUrl: 'https://api.openai.com/v1',
    textModel: '',
    imageModel: '',
  });
  const pending = useRef(new Map<string, Project>());
  const revisions = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const running = useRef(new Map<string, Promise<void>>());
  const agentBusyProjects = useRef(new Set<string>());
  const onAgentBusyChange = useCallback(
    /**
     * 记录哪些项目正在执行助手任务，避免编辑器同时提交互相覆盖的修改。
     *
     * @param id - 唯一标识，用于查找、更新和建立引用。
     * @param busy - 是否有操作进行中，用于阻止重复提交。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (id: string | undefined, busy: boolean) => {
      if (!id) return;
      if (busy) agentBusyProjects.current.add(id);
      else agentBusyProjects.current.delete(id);
      setBusyProjectIds([...agentBusyProjects.current]);
    },
    [],
  );
  const inProject = projectViews.includes(view);
  const project =
    projects.find(
      /** 检查当前项的标识等于选中标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (p) => p.id === selectedId,
    ) ?? (!inProject ? projects[0] : undefined);
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (!ready) return;
      if (inProject && !project) return;
      const hash = inProject && project ? `#/project/${project.id}/${view}` : `#/${view}`;
      window.history.replaceState(null, '', hash);
    },
    [ready, inProject, project?.id, view],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      /**
       * 恢复当前界面或绘图状态，使外部变化正确反映到界面。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      const restore = () => {
        const route = currentRoute();
        setView(route.view);
        if (route.projectId) setSelectedId(route.projectId);
      };
      window.addEventListener('hashchange', restore);
      /** 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => window.removeEventListener('hashchange', restore);
    },
    [],
  );

  const notify = useCallback(
    /**
     * 集中显示操作结果与提示，让各工作视图共用反馈入口。
     *
     * @param text - 需要展示或编辑的文字内容。
     * @param error - 当前操作的失败信息，供界面反馈或重试判断。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (text: string, error = false) => {
      setToast({ text, error });
      if (!error)
        setEvents(
          /** 基于最新状态计算 Events 的下一份值，避免连续更新时读到旧状态。 @param previous - 上一次保存或计算的值。 @returns 供 React 保存的新状态。 */
          (previous) => [text, ...previous].slice(0, 12),
        );
    },
    [],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (ready && inProject && !project) {
        setView('projects');
        notify('该项目不存在或已被删除，请选择一个项目。', true);
      }
    },
    [ready, inProject, project?.id, notify],
  );

  const replaceProjects = useCallback(
    /**
     * 同时更新项目列表与最新引用，使异步保存读取到同一份状态。
     *
     * @param next - 后续值或中间件入口。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (next: Project[]) => {
      projectsRef.current = next;
      setProjects(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Large image documents can exceed the optional browser cache; server storage remains authoritative. */
      }
    },
    [],
  );
  const acceptProject = useCallback(
    /**
     * 接纳服务端返回的项目版本，并与本地待保存修改保持一致。
     *
     * @param next - 后续值或中间件入口。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (next: Project) => {
      if (pending.current.has(next.id) || running.current.has(next.id)) return;
      if ((revisions.current.get(next.id) ?? -1) > next.revision) return;
      if (revisions.current.has(next.id) && revisions.current.get(next.id) !== next.revision)
        setEditorEpoch(
          /** 基于最新状态计算 EditorEpoch 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
          (value) => value + 1,
        );
      revisions.current.set(next.id, next.revision);
      replaceProjects(
        projectsRef.current.some(
          /** 检查当前项的标识等于 next 的标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (p) => p.id === next.id,
        )
          ? projectsRef.current.map(
              /** 转换应用主界面中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
              (p) => (p.id === next.id ? next : p),
            )
          : [next, ...projectsRef.current],
      );
    },
    [replaceProjects],
  );

  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      /** 集中维护 active 的进行中任务，防止同一目标被重复执行。 */
      let active = true;
      boot().then(
        /**
         * 在应用主界面的异步步骤结束后处理结果。
         *
         * @param state - 当前操作所依赖的完整状态。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (state) => {
          if (!active) return;
          replaceProjects(state.projects);
          for (const item of state.projects) revisions.current.set(item.id, item.revision);
          setSelectedId(
            /**
             * 基于最新状态计算 SelectedId 的下一份值，避免连续更新时读到旧状态。
             *
             * @param previous - 上一次保存或计算的值。
             * @returns 供 React 保存的新状态。
             */
            (previous) =>
              state.projects.some(
                /** 检查当前项的标识等于之前的状态，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                (p) => p.id === previous,
              )
                ? previous
                : currentRoute().projectId
                  ? previous
                  : (state.projects[0]?.id ?? ''),
          );
          setOnline(state.online);
          setReady(true);
        },
      );
      api<ProviderSettings>('/settings')
        .then(setSettings)
        .catch(
          /** 处理应用主界面中的异步失败，按当前流程决定回退或继续抛出。 @returns 当前步骤的处理结果。 */
          () => undefined,
        );
      /**
       * 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      return () => {
        active = false;
      };
    },
    [replaceProjects],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      if (!toast) return;
      const id = setTimeout(
        /** 基于最新状态计算 Timeout 的下一份值，避免连续更新时读到旧状态。 @returns 供 React 保存的新状态。 */
        () => setToast(null),
        5500,
      );
      /** 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => clearTimeout(id);
    },
    [toast],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      /**
       * 响应已订阅的外部事件，更新相应状态。
       *
       * @param e - 当前事件对象。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      const handler = (e: KeyboardEvent) => {
        if (
          !document.querySelector('.design-editor') &&
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === 'k'
        ) {
          e.preventDefault();
          setModal('search');
        }
      };
      window.addEventListener('keydown', handler);
      /** 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => window.removeEventListener('keydown', handler);
    },
    [],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      /**
       * 响应已订阅的外部事件，更新相应状态。
       *
       * @param event - 当前事件及其触发位置。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      const handler = (event: BeforeUnloadEvent) => {
        if (pending.current.size || running.current.size) {
          event.preventDefault();
        }
      };
      window.addEventListener('beforeunload', handler);
      /** 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => window.removeEventListener('beforeunload', handler);
    },
    [],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      if (!ready) return;
      /** 集中维护 active 的进行中任务，防止同一目标被重复执行。 */
      let active = true;
      const timer = setInterval(
        /**
         * 基于最新状态计算 Interval 的下一份值，避免连续更新时读到旧状态。
         * @returns 供 React 保存的新状态。
         */
        async () => {
          if (pending.current.size || running.current.size || document.hidden) return;
          try {
            const state = await api<{
              /** 当前保存或展示的项目集合。 */
              projects: Project[];
            }>('/state');
            if (!active || pending.current.size || running.current.size) return;
            setOnline(true);
            const changed =
              state.projects.length !== projectsRef.current.length ||
              state.projects.some(
                /**
                 * 判断应用主界面中的条目是否符合检查条件。
                 *
                 * @param item - 当前遍历的条目。
                 * @returns 该条目是否符合条件。
                 */
                (item) => {
                  const current = projectsRef.current.find(
                    /** 检查当前项的标识等于条目的标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                    (p) => p.id === item.id,
                  );
                  return (
                    !current ||
                    current.revision !== item.revision ||
                    current.lastSyncedRevision !== item.lastSyncedRevision
                  );
                },
              );
            if (changed) {
              if (
                state.projects.some(
                  /** 判断应用主界面中的条目是否符合检查条件。 @param item - 当前遍历的条目。 @returns 该条目是否符合条件。 */
                  (item) =>
                    revisions.current.has(item.id) &&
                    item.revision > (revisions.current.get(item.id) ?? 0),
                )
              )
                setEditorEpoch(
                  /** 基于最新状态计算 EditorEpoch 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
                  (value) => value + 1,
                );
              for (const item of state.projects) revisions.current.set(item.id, item.revision);
              replaceProjects(state.projects);
            }
          } catch {
            if (active) setOnline(false);
          }
        },
        5000,
      );
      /**
       * 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      return () => {
        active = false;
        clearInterval(timer);
      };
    },
    [ready, replaceProjects],
  );

  const persist = useCallback(
    /**
     * 按项目串行消费待保存内容，复用正在执行的请求以避免并发保存覆盖。
     *
     * @param id - 唯一标识，用于查找、更新和建立引用。
     * @returns 当前步骤的处理结果。
     */
    async (id: string) => {
      if (running.current.has(id)) return running.current.get(id)!;
      const work =
        /**
         * 执行应用主界面传入的局部处理步骤，使调用处能够控制结果如何更新。
         * @returns 完成当前异步操作的 Promise，不携带业务数据。
         */
        (async () => {
          while (pending.current.has(id)) {
            const next = pending.current.get(id)!;
            pending.current.delete(id);
            setSaveState('saving');
            try {
              const saved = await api<
                Project & {
                  /** 设计已保留但自动同步未完成时的提示。 */
                  syncWarning?: string;
                }
              >(
                `/projects/${id}`,
                { ...next, revision: revisions.current.get(id) ?? next.revision },
                'PUT',
              );
              revisions.current.set(id, saved.revision);
              replaceProjects(
                projectsRef.current.map(
                  /**
                   * 转换应用主界面中的集合条目，供后续处理或展示。
                   *
                   * @param p - 当前坐标点或内容片段。
                   * @returns 当前条目转换后的结果。
                   */
                  (p) =>
                    p.id === id
                      ? {
                          ...p,
                          revision: saved.revision,
                          updatedAt: saved.updatedAt,
                          lastSyncedRevision: saved.lastSyncedRevision,
                          status: saved.status,
                          generation: saved.generation,
                        }
                      : p,
                ),
              );
              setOnline(true);
              setSaveState('saved');
              if (saved.syncWarning) notify(saved.syncWarning, true);
            } catch (error) {
              if (!pending.current.has(id)) pending.current.set(id, next);
              setSaveState('error');
              notify((error as Error).message, true);
              throw error;
            }
          }
        })();
      running.current.set(id, work);
      try {
        await work;
      } finally {
        running.current.delete(id);
      }
    },
    [notify, replaceProjects],
  );

  const updateProject = useCallback(
    /**
     * 把本地修改放入待保存队列，并立即更新界面以保持编辑响应。
     *
     * @param next - 后续值或中间件入口。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (next: Project) => {
      if (agentBusyProjects.current.has(next.id)) {
        notify('Agent 正在更新此项目，请等待当前步骤完成后再编辑。', true);
        return;
      }
      const changed = {
        ...next,
        updatedAt: new Date().toISOString(),
        status: 'in-progress' as const,
      };
      replaceProjects(
        projectsRef.current.map(
          /** 转换应用主界面中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
          (p) => (p.id === next.id ? changed : p),
        ),
      );
      pending.current.set(next.id, changed);
      setSaveState('pending');
      clearTimeout(timers.current.get(next.id));
      timers.current.set(
        next.id,
        setTimeout(
          /**
           * 基于最新状态计算 Timeout 的下一份值，避免连续更新时读到旧状态。
           * @returns 供 React 保存的新状态。
           */
          () => {
            void persist(next.id).catch(
              /** 处理应用主界面中的异步失败，按当前流程决定回退或继续抛出。 @returns 当前步骤的处理结果。 */
              () => undefined,
            );
          },
          650,
        ),
      );
    },
    [persist, replaceProjects, notify],
  );

  const flush = useCallback(
    /**
     * 等待尚未保存的设计全部落地，让生成、同步和页面切换基于最新版本。
     * @returns 完成当前异步操作的 Promise，不携带业务数据。
     */
    async () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      await Promise.all(
        [...new Set([...pending.current.keys(), ...running.current.keys()])].map(
          /** 转换应用主界面中的集合条目，供后续处理或展示。 @param id - 唯一标识，用于查找、更新和建立引用。 @returns 当前条目转换后的结果。 */
          (id) => persist(id),
        ),
      );
    },
    [persist],
  );
  const refreshProject = useCallback(
    /**
     * 重新读取目标项目，避免异步动作完成后继续展示旧版本。
     *
     * @param response - 上游或本地服务的响应。
     * @returns 完成当前异步操作的 Promise，不携带业务数据。
     */
    async (response?: {
      /** 当前设计项目或工作空间项目元信息。 */
      project?: Project;
    }) => {
      if (response?.project) {
        acceptProject(response.project);
        return;
      }
      const state = await api<{
        /** 当前保存或展示的项目集合。 */
        projects: Project[];
      }>('/state');
      for (const item of state.projects) revisions.current.set(item.id, item.revision);
      replaceProjects(state.projects);
    },
    [acceptProject, replaceProjects],
  );

  /**
   * 更新当前视图与导航状态，使界面操作和地址栏保持一致。
   *
   * @param next - 后续值或中间件入口。
   * @returns 导航操作的结果。
   */
  const navigate = (next: View) => {
    setView(next);
    setNotifications(false);
    requestAnimationFrame(
      /** 在下一帧刷新navigate，让多次界面变化合并到一次绘制。 @returns 无返回值；通过副作用完成当前操作。 */
      () => window.scrollTo(0, 0),
    );
  };
  /**
   * 切换到指定项目，并加载该项目对应的工作视图。
   *
   * @param item - 当前遍历的条目。
   * @returns 项目打开操作的结果。
   */
  const openProject = (item: Project) => {
    setSelectedId(item.id);
    navigate('project');
  };
  /**
   * 打开目标项目的画布页面，让用户直接进入设计编辑。
   *
   * @param pageId - 目标页面的唯一标识。
   * @returns 无返回值；更新当前导航与选择。
   */
  const openCanvas = (pageId?: string) => {
    setInitialPageId(pageId);
    navigate('editor');
  };
  /**
   * 创建新的设计项目，并引导用户进入对应工作区域。
   *
   * @param template - 用于创建项目的模板定义。
   * @returns 项目创建操作的结果。
   */
  const newProject = (template?: DesignTemplate) => {
    setNewTemplate(template);
    setModal('create');
  };
  /**
   * 打开设计助手面板，并保留当前项目作为对话上下文。
   * @returns 无返回值；更新助手面板状态。
   */
  const openAgent = () => {
    setAgentOpen(true);
  };
  /**
   * 把预设需求放入助手输入区，减少重复输入并保留当前项目上下文。
   *
   * @param text - 需要展示或编辑的文字内容。
   * @returns 无返回值；更新助手提示内容。
   */
  const promptAgent = (text?: string) => {
    setAgentOpen(true);
    if (text?.trim()) setAgentDraftRequest({ id: Date.now(), text: text.trim() });
  };
  /**
   * 从模板创建可独立修改的设计数据，避免直接修改模板本身。
   *
   * @param template - 用于创建项目的模板定义。
   * @returns 模板应用操作的结果。
   */
  const addTemplate = (template: DesignTemplate) => {
    const next = [...templates, template];
    setTemplates(next);
    localStorage.setItem(
      'forma-custom-templates',
      JSON.stringify(
        next.filter(
          /**
           * 检查不成立，供集合筛选或定位使用。
           *
           * @param t - 当前场景的生命周期控制对象。
           * @returns 用于判断条件的值；真值表示该条目符合条件。
           */
          (t) =>
            !seedTemplates.some(
              /** 检查 s 的标识等于 t 的标识，供集合筛选或定位使用。 @param s - 当前遍历的状态或文本片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
              (s) => s.id === t.id,
            ),
        ),
      ),
    );
    notify('新主题已加入你的模板库');
  };

  /**
   * 复制当前目标并生成独立标识，让副本可以继续单独编辑。
   *
   * @param item - 当前遍历的条目。
   * @returns 复制操作的结果。
   */
  const duplicate = async (item: Project) => {
    try {
      const copy = {
        ...structuredClone(item),
        id: crypto.randomUUID(),
        name: `${item.name} 副本`,
        workspace: undefined,
        lastSyncedRevision: undefined,
        status: 'draft' as const,
        revision: 0,
        generation: undefined,
        updatedAt: new Date().toISOString(),
      };
      acceptProject(await api<Project>(`/projects/${copy.id}`, copy, 'PUT'));
      notify('项目副本已创建');
    } catch (error) {
      notify((error as Error).message, true);
    }
  };

  /**
   * 读取用户选择的设计文件，导入到当前项目管理流程。
   *
   * @param file - 需要读取、写入或导入的文件。
   * @returns 导入操作的结果。
   */
  const importFile = async (file: File) => {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('文件不能超过 20 MB');
      const data = JSON.parse(await file.text());
      const documents = Array.isArray(data.projects) ? data.projects : [data];
      if (!documents.length || documents.length > 50) throw new Error('每次可以导入 1–50 个项目');
      for (const source of documents) {
        const copy = {
          ...source,
          id: crypto.randomUUID(),
          name: source.name + '（导入）',
          workspace: undefined,
          generation: undefined,
          revision: 0,
          lastSyncedRevision: undefined,
          status: 'draft',
          updatedAt: new Date().toISOString(),
        };
        acceptProject(await api<Project>(`/projects/${copy.id}`, copy, 'PUT'));
      }
      notify(`已导入 ${documents.length} 个项目`);
    } catch (error) {
      notify((error as Error).message, true);
    }
  };
  /**
   * 统一分发文件菜单操作，让各入口共用导入导出逻辑。
   *
   * @param item - 当前遍历的条目。
   * @param action - 当前要执行的操作或操作结果分类。
   * @returns 对应文件操作的结果。
   */
  const fileAction = (item: Project, action: 'rename' | 'bind' | 'delete') => {
    setSelectedId(item.id);
    setModal(action);
  };
  /**
   * 构建当前视图使用的导航内容，让入口随项目上下文变化。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @param Icon - 作为控件图标渲染的 React 组件。
   * @param badge - 卡片或按钮附带的状态徽标。
   * @returns 导航界面内容。
   */
  const navigation = (id: View, Icon: typeof Folder, badge?: number) => (
    <Button
      key={id}
      variant="ghost"
      className={`nav-item ${view === id ? 'active' : ''}`}
      aria-label={labels[id]}
      title={sidebarCollapsed ? labels[id] : undefined}
      aria-current={view === id ? 'page' : undefined}
      onClick={
        /** 响应 onClick 交互，将用户操作应用到navigation。 @returns 无返回值；通过副作用完成当前操作。 */
        () => navigate(id)
      }
    >
      <Icon size={17} />
      <span>{labels[id]}</span>
      {badge !== undefined && <span className="nav-count">{badge}</span>}
    </Button>
  );

  return (
    <div
      className={`workspace-root ${agentOpen ? 'agent-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      {view === 'editor' && project ? (
        <Suspense
          fallback={
            <div className="workspace-loading" role="status">
              <LoaderCircle className="spin" />
              <span>正在打开画布…</span>
            </div>
          }
        >
          <DesignEditor
            key={`${project.id}:${editorEpoch}`}
            project={project}
            chatOpen={agentOpen}
            readOnly={busyProjectIds.includes(project.id)}
            onPageChange={setInitialPageId}
            saveState={saveState}
            initialPageId={initialPageId}
            onChange={updateProject}
            onBack={
              /** 响应 onBack 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
              () => navigate('project')
            }
            onNavigate={navigate}
            onOpenAgent={openAgent}
            onSync={
              /** 响应 onSync 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
              () => navigate('sync')
            }
            onTheme={
              /** 响应 onTheme 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
              () => navigate('theme')
            }
          />
        </Suspense>
      ) : (
        <div className="app-shell">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <button
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                  () => navigate('projects')
                }
                aria-label="Forma 首页"
              >
                <Brand small={sidebarCollapsed} />
              </button>
              <button
                className="sidebar-collapse"
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                  () => setSidebarCollapsed(!sidebarCollapsed)
                }
                aria-label={sidebarCollapsed ? '展开导航' : '折叠导航'}
              >
                {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              </button>
            </div>
            <Button
              variant="ghost"
              className="workspace-switch"
              aria-label="我的工作空间"
              title={sidebarCollapsed ? '我的工作空间' : undefined}
              onClick={
                /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                () => navigate('projects')
              }
            >
              <span className="workspace-avatar">F</span>
              <span>
                <strong>我的工作空间</strong>
              </span>
              <span className="workspace-local-label">本地</span>
            </Button>
            <Button
              variant="ghost"
              className="sidebar-search"
              aria-label="搜索所有内容"
              title={sidebarCollapsed ? '搜索所有内容 · Ctrl K' : undefined}
              onClick={
                /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                () => setModal('search')
              }
            >
              <Search size={16} />
              <span>搜索所有内容</span>
              <kbd>Ctrl K</kbd>
            </Button>
            <nav aria-label="主导航">
              <div className="workspace-navigation">
                <Button
                  variant="ghost"
                  className={`nav-item ${view === 'projects' && tab === 'recent' ? 'active' : ''}`}
                  aria-label="所有项目"
                  title={sidebarCollapsed ? '所有项目' : undefined}
                  onClick={
                    /**
                     * 响应 onClick 交互，将用户操作应用到应用主界面。
                     * @returns 无返回值；通过副作用完成当前操作。
                     */
                    () => {
                      setTab('recent');
                      navigate('projects');
                    }
                  }
                >
                  <RinIcon kind="projects" />
                  <span>所有项目</span>
                  <span className="nav-count">{projects.length}</span>
                </Button>
                <Button
                  variant="ghost"
                  className={`nav-item ${view === 'projects' && tab === 'favorites' ? 'active' : ''}`}
                  aria-label="收藏项目"
                  title={sidebarCollapsed ? '收藏项目' : undefined}
                  onClick={
                    /**
                     * 响应 onClick 交互，将用户操作应用到应用主界面。
                     * @returns 无返回值；通过副作用完成当前操作。
                     */
                    () => {
                      setTab('favorites');
                      navigate('projects');
                    }
                  }
                >
                  <Star />
                  <span>收藏项目</span>
                </Button>
                {navigation('templates', LayoutGrid)}
              </div>
              <Separator className="sidebar-divider" />
              <div className="sidebar-projects">
                <div className="nav-section-label">
                  我的项目
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="新建项目"
                    onClick={
                      /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                      () => newProject()
                    }
                  >
                    <Plus />
                  </Button>
                </div>
                <div className="project-tree">
                  {projects.map(
                    /**
                     * 转换应用主界面中的集合条目，供后续处理或展示。
                     *
                     * @param p - 当前坐标点或内容片段。
                     * @returns 当前条目转换后的结果。
                     */
                    (p) => (
                      <div className="project-tree-item" key={p.id}>
                        <Button
                          variant="ghost"
                          className={`nav-file ${inProject && project?.id === p.id ? 'project-active' : ''}`}
                          aria-label={p.name}
                          aria-current={inProject && project?.id === p.id ? 'page' : undefined}
                          title={sidebarCollapsed ? p.name : undefined}
                          onClick={
                            /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                            () => openProject(p)
                          }
                        >
                          <ProjectMark project={p} size={23} />
                          <span>{p.name}</span>
                        </Button>
                      </div>
                    ),
                  )}
                  {!projects.length && (
                    <p className="sidebar-empty">创建项目后，在其中管理页面、组件和 Tokens。</p>
                  )}
                </div>
              </div>
            </nav>
            <div className="sidebar-bottom">
              {navigation('theme', Palette)}
              {navigation('settings', Settings2)}
              <Button
                variant="ghost"
                className="nav-item"
                aria-label="帮助与快捷键"
                title={sidebarCollapsed ? '帮助与快捷键' : undefined}
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                  () => setModal('guide')
                }
              >
                <CircleHelp />
                <span>帮助与快捷键</span>
              </Button>
              <Separator />
              <button className="account-row" onClick={openAgent} aria-label="与凛 Rin 对话">
                <RinAvatar size={36} />
                <span>
                  <strong>凛 Rin</strong>
                  <small>
                    <span className={`connection-dot ${online ? 'online' : ''}`} />
                    {online ? '你的设计伙伴' : '服务离线'}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div className="breadcrumbs">
                <button
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => navigate('projects')
                  }
                >
                  工作空间
                </button>
                <ChevronRight size={14} />
                {inProject && project && (
                  <>
                    <Select value={project.id} onValueChange={setSelectedId}>
                      <SelectTrigger className="breadcrumb-project" aria-label="当前设计项目">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(
                          /** 转换应用主界面中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
                          (p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {!inProject && <strong>{labels[view]}</strong>}
              </div>
              <div className="topbar-actions">
                <button
                  className="topbar-search"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                    () => setModal('search')
                  }
                  aria-label="搜索工作空间"
                >
                  <Search size={15} />
                  <span>搜索文件、模板或灵感…</span>
                  <kbd>Ctrl K</kbd>
                </button>
                <Popover open={themeMenu} onOpenChange={setThemeMenu}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="切换 Rin 主题"
                      className="theme-quick-trigger"
                    >
                      <Palette size={16} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="theme-quick-menu">
                    <div className="theme-quick-heading">
                      <RinAvatar size={32} />
                      <span>
                        <strong>Rin 主题</strong>
                        <small>选择适合你的显示模式</small>
                      </span>
                    </div>
                    <div className="theme-quick-options">
                      {presets.map(
                        /**
                         * 转换应用主界面中的集合条目，供后续处理或展示。
                         *
                         * @param preset - 工作室基础配色预设。
                         * @returns 当前条目转换后的结果。
                         */
                        (preset) => (
                          <button
                            key={preset.id}
                            aria-pressed={appearance.preset === preset.id}
                            onClick={
                              /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                              () => updateSettings({ preset: preset.id })
                            }
                          >
                            <span
                              className="theme-quick-sample"
                              style={{
                                background: preset.colors.background,
                                color: preset.colors.foreground,
                                borderColor: preset.colors.border,
                              }}
                            >
                              <i style={{ background: preset.colors.accent }} />
                              <span>Aa</span>
                            </span>
                            <span>{preset.name}</span>
                            {appearance.preset === preset.id && <Check size={12} />}
                          </button>
                        ),
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={
                        /**
                         * 响应 onClick 交互，将用户操作应用到应用主界面。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        () => {
                          setThemeMenu(false);
                          navigate('theme');
                        }
                      }
                    >
                      打开 Rin 主题工作室 <ArrowUpRight size={14} />
                    </Button>
                  </PopoverContent>
                </Popover>
                <Button
                  variant={agentOpen ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                    () => setAgentOpen(!agentOpen)
                  }
                  aria-label={agentOpen ? '收起 Agent 聊天' : '打开 Agent 聊天'}
                  className={`rin-toggle ${agentOpen ? 'is-open' : ''}`}
                  aria-pressed={agentOpen}
                >
                  <RinIcon kind="agent" size={15} />
                  Rin
                </Button>
                <span className="topbar-local">
                  <span className={`connection-dot ${online ? 'online' : ''}`} />
                  {online ? '本地已连接' : '正在连接'}
                </span>

                <Popover open={notifications} onOpenChange={setNotifications}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="工作空间动态">
                      <Bell />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="workspace-events">
                    <h3>工作空间动态</h3>
                    {events.map(
                      /**
                       * 转换应用主界面中的集合条目，供后续处理或展示。
                       *
                       * @param event - 当前事件及其触发位置。
                       * @param i - 当前循环位置，从 0 开始。
                       * @returns 当前条目转换后的结果。
                       */
                      (event, i) => (
                        <p key={i}>
                          <span className="connection-dot online" />
                          {event}
                        </p>
                      ),
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </header>
            {inProject && project && (
              <nav className="project-view-tabs" aria-label="项目导航">
                {(
                  [
                    ['project', '页面'],
                    ['editor', '画布'],
                    ['components', '组件库'],
                    ['tokens', '设计变量'],
                    ['sync', '代码同步'],
                    ['agents', '助手与接入'],
                  ] as [View, string][]
                ).map(
                  /**
                   * 转换应用主界面中的集合条目，供后续处理或展示。
                   *
                   * @param options - 按顺序解构的当前条目。
                   * @param options.id - 唯一标识，用于查找、更新和建立引用。
                   * @param options.label - 面向用户显示的简短标签。
                   * @returns 当前条目转换后的结果。
                   */
                  ([id, label]) => (
                    <button
                      key={id}
                      className={view === id ? 'is-active' : ''}
                      aria-current={view === id ? 'page' : undefined}
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => (id === 'editor' ? openCanvas() : navigate(id))
                      }
                    >
                      {label}
                      {view === id && (
                        <motion.span
                          layoutId="project-navigation-indicator"
                          className="project-tab-indicator"
                          transition={{
                            type: 'spring',
                            stiffness: 440,
                            damping: 38,
                            ...(reduced ? { duration: 0 } : {}),
                          }}
                        />
                      )}
                    </button>
                  ),
                )}
                <span className="project-tabs-revision">v{project.revision}</span>
              </nav>
            )}
            {!online && ready && (
              <div className="connection-banner">
                本地服务未连接。更改保存在浏览器缓存，重新连接后请重试保存。
              </div>
            )}
            <main className={`content content-${view}`}>
              <motion.div
                key={`${view}:${inProject ? project?.id : 'workspace'}`}
                className="workspace-view"
                initial={reduced ? false : { opacity: 0, y: expressive ? 10 : 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transition}
              >
                <Suspense
                  fallback={
                    <div className="file-empty" role="status">
                      <RinAvatar size={32} />
                      正在加载…
                    </div>
                  }
                >
                  {view === 'projects' && (
                    <WorkspaceHome
                      projects={projects}
                      templates={templates}
                      online={online}
                      ready={ready}
                      saveState={saveState}
                      query={query}
                      onQuery={setQuery}
                      tab={tab}
                      onTab={setTab}
                      onCreate={newProject}
                      onOpen={openProject}
                      onAgent={promptAgent}
                      onTemplates={
                        /** 响应 onTemplates 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => navigate('templates')
                      }
                      onTheme={
                        /** 响应 onTheme 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => navigate('theme')
                      }
                      onBind={
                        /** 响应 onBind 交互，将用户操作应用到应用主界面。 @param p - 当前坐标点或内容片段。 @returns 无返回值；通过副作用完成当前操作。 */
                        (p) => fileAction(p, 'bind')
                      }
                      onRename={
                        /** 响应 onRename 交互，将用户操作应用到应用主界面。 @param p - 当前坐标点或内容片段。 @returns 无返回值；通过副作用完成当前操作。 */
                        (p) => fileAction(p, 'rename')
                      }
                      onDelete={
                        /** 响应 onDelete 交互，将用户操作应用到应用主界面。 @param p - 当前坐标点或内容片段。 @returns 无返回值；通过副作用完成当前操作。 */
                        (p) => fileAction(p, 'delete')
                      }
                      onDuplicate={
                        /** 响应 onDuplicate 交互，将用户操作应用到应用主界面。 @param p - 当前坐标点或内容片段。 @returns 当前步骤的处理结果。 */
                        (p) => void duplicate(p)
                      }
                      onExport={
                        /** 响应 onExport 交互，将用户操作应用到应用主界面。 @param p - 当前坐标点或内容片段。 @returns 无返回值；通过副作用完成当前操作。 */
                        (p) => downloadJson(`${p.name}.forma.json`, p)
                      }
                      onImport={importFile}
                    />
                  )}
                  {view === 'templates' && (
                    <TemplatesView
                      templates={templates}
                      onUse={newProject}
                      onGenerate={
                        /**
                         * 响应 onGenerate 交互，将用户操作应用到应用主界面。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        () => {
                          setModal('agent');
                          setNewTemplate(undefined);
                        }
                      }
                    />
                  )}
                  {view === 'project' && project && (
                    <ProjectOverview
                      key={project.id}
                      project={project}
                      onOpenPage={openCanvas}
                      onNavigate={navigate}
                      onChange={updateProject}
                      onAgent={promptAgent}
                      onBind={
                        /** 响应 onBind 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                        () => setModal('bind')
                      }
                      onTheme={
                        /** 响应 onTheme 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => navigate('theme')
                      }
                    />
                  )}
                  {view === 'components' && project && (
                    <ComponentsView key={project.id} project={project} onChange={updateProject} />
                  )}
                  {view === 'tokens' && project && (
                    <TokensView
                      key={project.id}
                      project={project}
                      onChange={updateProject}
                      templates={templates}
                    />
                  )}
                  {view === 'agents' && (
                    <AgentsView
                      settings={settings}
                      project={project}
                      onSettings={
                        /** 响应 onSettings 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => navigate('settings')
                      }
                      onStart={openAgent}
                      notify={notify}
                    />
                  )}
                  {view === 'sync' && project && (
                    <SyncView
                      key={project.id}
                      project={project}
                      onChange={updateProject}
                      onBind={
                        /** 响应 onBind 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                        () => setModal('bind')
                      }
                      flush={flush}
                      refresh={refreshProject}
                      notify={notify}
                    />
                  )}
                  {view === 'theme' && <ThemeStudio />}
                  {view === 'settings' && (
                    <SettingsView
                      settings={settings}
                      onSettings={setSettings}
                      notify={notify}
                      projects={projects}
                      onExport={
                        /** 响应 onExport 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                        () =>
                          downloadJson('forma-workspace.json', {
                            projects,
                            templates,
                          })
                      }
                    />
                  )}
                  {['project', 'tokens', 'components', 'sync'].includes(view) && !project && (
                    <div className="file-empty">
                      <RinIllustration state="empty" size={96} />
                      <h3>先创建一个项目</h3>
                      <Button
                        onClick={
                          /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                          () => newProject()
                        }
                      >
                        新建项目
                      </Button>
                    </div>
                  )}
                </Suspense>
              </motion.div>
            </main>
          </div>
        </div>
      )}
      <AgentChatPanel
        draftRequest={agentDraftRequest}
        hidden={!agentOpen}
        project={inProject ? project : undefined}
        settings={settings}
        onClose={
          /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
          () => setAgentOpen(false)
        }
        onSettings={
          /**
           * 响应 onSettings 交互，将用户操作应用到应用主界面。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          () => {
            setAgentOpen(false);
            navigate('settings');
          }
        }
        onProviderSettings={setSettings}
        onProject={
          /**
           * 响应 onProject 交互，将用户操作应用到应用主界面。
           *
           * @param next - 后续值或中间件入口。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          (next) => {
            acceptProject(next);
            openProject(next);
          }
        }
        refresh={refreshProject}
        flush={flush}
        onNavigate={navigate}
        onBusyChange={onAgentBusyChange}
      />
      {modal === 'create' && (
        <CreateProjectModal
          template={newTemplate}
          templates={templates}
          onClose={
            /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
            () => setModal(null)
          }
          onCreate={
            /**
             * 响应 onCreate 交互，将用户操作应用到应用主界面。
             *
             * @param name - 面向用户展示的名称。
             * @param description - 用于解释内容或用途的说明文字。
             * @param template - 用于创建项目的模板定义。
             * @returns 完成当前异步操作的 Promise，不携带业务数据。
             */
            async (name, description, template) => {
              const next = createProject(name, template, description);
              if (!template)
                next.pages = [
                  {
                    id: crypto.randomUUID(),
                    name: '页面 1',
                    width: 1440,
                    height: 900,
                    nodes: [],
                  },
                ];
              const saved = await api<Project>(`/projects/${next.id}`, next, 'PUT');
              acceptProject(saved);
              setModal(null);
              openProject(saved);
              notify('项目已创建，页面、组件库和 Tokens 已就绪');
            }
          }
        />
      )}
      {modal === 'bind' && project && (
        <BindModal
          project={project}
          onClose={
            /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
            () => setModal(null)
          }
          onBind={
            /**
             * 响应 onBind 交互，将用户操作应用到应用主界面。
             *
             * @param body - 请求正文或文档内容。
             * @returns 完成当前异步操作的 Promise，不携带业务数据。
             */
            async (body) => {
              if (agentBusyProjects.current.has(project.id))
                throw new Error('Agent 正在操作此项目，请等待完成后再更改工作空间。');
              await flush();
              const response = await api<{
                /** 代码同步目标及同步偏好。 */
                workspace: Project['workspace'];
                /** 当前设计项目或工作空间项目元信息。 */
                project?: Project;
              }>('/workspace/bind', { projectId: project.id, ...body });
              await refreshProject(response);
              setModal(null);
              notify('工作空间已连接，可以预览并同步设计');
            }
          }
        />
      )}
      {modal === 'agent' && (
        <AgentDialog
          project={project}
          settings={settings}
          mode={view === 'templates' ? 'theme' : 'design'}
          flush={flush}
          refresh={refreshProject}
          onTemplate={addTemplate}
          onClose={
            /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
            () => setModal(null)
          }
          onSettings={
            /**
             * 响应 onSettings 交互，将用户操作应用到应用主界面。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {
              setModal(null);
              navigate('settings');
            }
          }
          onOpenCanvas={
            /**
             * 响应 onOpenCanvas 交互，将用户操作应用到应用主界面。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {
              setModal(null);
              if (project) openCanvas();
            }
          }
          notify={notify}
        />
      )}
      {modal === 'guide' && (
        <Modal
          title="工作空间指南"
          subtitle="设计、原型与代码交付"
          onClose={
            /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
            () => setModal(null)
          }
        >
          <div className="guide-content">
            {[
              [Palette, '设计系统', '先选择主题，再使用统一的 Token、变量和组件建立页面。'],
              [Sparkles, 'AI 设计流程', '描述需求 → 生成设计图 → 审核通过 → 生成可编辑画布。'],
              [Boxes, '画布编辑', '使用图层、绘图工具、对齐分组、布局和属性检查器编辑设计。'],
              [Workflow, '代码同步', '关联文件夹或 GitHub，预览代码差异后同步，也可开启自动同步。'],
            ].map(
              /**
               * 转换应用主界面中的集合条目，供后续处理或展示。
               *
               * @param options - 按顺序解构的当前条目。
               * @param options.Icon - 作为控件图标渲染的 React 组件。
               * @param options.title - 界面显示的标题。
               * @param options.detail - 对当前条目的补充说明。
               * @returns 当前条目转换后的结果。
               */
              ([Icon, title, detail]) => {
                const I = Icon as typeof Palette;
                return (
                  <div className="guide-step" key={String(title)}>
                    <span>
                      <I size={20} />
                    </span>
                    <div>
                      <h3>{String(title)}</h3>
                      <p>{String(detail)}</p>
                    </div>
                  </div>
                );
              },
            )}
            <div className="shortcut-row">
              <span>
                搜索<kbd>Ctrl K</kbd>
              </span>
              <span>
                撤销<kbd>Ctrl Z</kbd>
              </span>
              <span>
                复制图层<kbd>Ctrl D</kbd>
              </span>
            </div>
          </div>
        </Modal>
      )}
      {modal === 'search' && (
        <Modal
          title="搜索工作空间"
          onClose={
            /**
             * 响应 onClose 交互，将用户操作应用到应用主界面。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {
              setModal(null);
              setQuery('');
            }
          }
        >
          <div className="search-modal-content">
            <div className="search-dialog-input">
              <Search size={18} />
              <Input
                autoFocus
                placeholder="搜索项目或功能…"
                value={query}
                onChange={
                  /** 响应 onChange 交互，将用户操作应用到应用主界面。 @param e - 当前事件对象。 @returns 当前步骤的处理结果。 */
                  (e) => setQuery(e.target.value)
                }
              />
            </div>
            <p className="search-category">项目</p>
            {projects
              .filter(
                /** 检查将当前项的名称转为小写包含将query转为小写，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                (p) => p.name.toLowerCase().includes(query.toLowerCase()),
              )
              .map(
                /**
                 * 转换应用主界面中的集合条目，供后续处理或展示。
                 *
                 * @param p - 当前坐标点或内容片段。
                 * @returns 当前条目转换后的结果。
                 */
                (p) => (
                  <Button
                    variant="ghost"
                    className="search-result"
                    key={p.id}
                    onClick={
                      /**
                       * 响应 onClick 交互，将用户操作应用到应用主界面。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      () => {
                        setModal(null);
                        setQuery('');
                        openProject(p);
                      }
                    }
                  >
                    <Frame />
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.pages.length} 个页面</small>
                    </span>
                    <ArrowUpRight />
                  </Button>
                ),
              )}
            <p className="search-category">功能</p>
            {(Object.entries(labels) as [View, string][])
              .filter(
                /**
                 * 检查标识不等于“editor”且inProject或包含标识不成立且将label转为小写包含将query转为小写，供集合筛选或定位使用。
                 *
                 * @param options - 按顺序解构的当前条目。
                 * @param options.id - 唯一标识，用于查找、更新和建立引用。
                 * @param options.label - 面向用户显示的简短标签。
                 * @returns 用于判断条件的值；真值表示该条目符合条件。
                 */
                ([id, label]) =>
                  id !== 'editor' &&
                  (inProject ||
                    !['project', 'components', 'tokens', 'sync', 'agents'].includes(id)) &&
                  label.toLowerCase().includes(query.toLowerCase()),
              )
              .map(
                /**
                 * 转换应用主界面中的集合条目，供后续处理或展示。
                 *
                 * @param options - 按顺序解构的当前条目。
                 * @param options.id - 唯一标识，用于查找、更新和建立引用。
                 * @param options.label - 面向用户显示的简短标签。
                 * @returns 当前条目转换后的结果。
                 */
                ([id, label]) => (
                  <Button
                    variant="ghost"
                    className="search-result"
                    key={id}
                    onClick={
                      /**
                       * 响应 onClick 交互，将用户操作应用到应用主界面。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      () => {
                        setModal(null);
                        setQuery('');
                        navigate(id);
                      }
                    }
                  >
                    <LayoutGrid />
                    <span>{label}</span>
                    <ArrowRight />
                  </Button>
                ),
              )}
          </div>
        </Modal>
      )}
      {modal === 'delete' && project && (
        <Modal
          title="删除项目？"
          subtitle={`「${project.name}」的画布与设计数据将被删除。已经同步到工作空间的代码会保留。`}
          onClose={
            /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
            () => setModal(null)
          }
        >
          <div className="modal-footer">
            <Button
              variant="outline"
              onClick={
                /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                () => setModal(null)
              }
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={
                /**
                 * 响应 onClick 交互，将用户操作应用到应用主界面。
                 * @returns 完成当前异步操作的 Promise，不携带业务数据。
                 */
                async () => {
                  try {
                    if (agentBusyProjects.current.has(project.id))
                      throw new Error('Agent 正在操作此项目，请等待完成后再删除。');
                    await flush();
                    await api(`/projects/${project.id}`, undefined, 'DELETE');
                    replaceProjects(
                      projectsRef.current.filter(
                        /** 检查当前项的标识不等于项目的标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                        (p) => p.id !== project.id,
                      ),
                    );
                    setModal(null);
                    navigate('projects');
                    notify('项目已删除');
                  } catch (error) {
                    notify((error as Error).message, true);
                  }
                }
              }
            >
              删除项目
            </Button>
          </div>
        </Modal>
      )}
      {modal === 'rename' && project && (
        <RenameModal
          project={project}
          onClose={
            /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
            () => setModal(null)
          }
          onSave={
            /**
             * 响应 onSave 交互，将用户操作应用到应用主界面。
             *
             * @param name - 面向用户展示的名称。
             * @param description - 用于解释内容或用途的说明文字。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            (name, description) => {
              updateProject({ ...project, name, description });
              setModal(null);
            }
          }
        />
      )}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.text}
            className={`toast ${toast.error ? 'toast-error' : ''}`}
            role={toast.error ? 'alert' : 'status'}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={transition}
          >
            {toast.error ? <CircleHelp size={18} /> : <CheckCheck size={18} />}
            <span>{toast.text}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="关闭提示"
              onClick={
                /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                () => setToast(null)
              }
            >
              <X />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 呈现新建项目对话框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.templates - 可供选择的设计模板集合。
 * @param props.template - 用于创建项目的模板定义。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onCreate - 在创建时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
function CreateProjectModal({
  templates,
  template,
  onClose,
  onCreate,
}: {
  /** 可供选择的设计模板集合。 */
  templates: DesignTemplate[];
  /** 用于创建项目的模板定义。 */
  template?: DesignTemplate;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在创建时通知调用方，由外层决定如何更新业务状态。
   * @param name - 面向用户展示的名称。
   * @param description - 用于解释内容或用途的说明文字。
   * @param template - 用于创建项目的模板定义。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  onCreate: (name: string, description: string, template?: DesignTemplate) => Promise<void>;
}) {
  /** 界面状态：面向用户展示的名称。通过状态更新驱动界面刷新。 */
  const [name, setName] = useState('');
  /** 界面状态：用于解释内容或用途的说明文字。通过状态更新驱动界面刷新。 */
  const [description, setDescription] = useState('');
  /** 界面状态：项目采用的主题标识。通过状态更新驱动界面刷新。 */
  const [themeId, setThemeId] = useState(template?.id ?? 'blank');
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState(false);
  /** 界面状态：当前操作的失败信息，供界面反馈或重试判断。通过状态更新驱动界面刷新。 */
  const [error, setError] = useState('');
  return (
    <Modal title="新建项目" subtitle="为你的下一个想法，建立一个创作空间。" onClose={onClose}>
      <form
        onSubmit={
          /**
           * 响应 onSubmit 交互，将用户操作应用到新建项目对话框。
           *
           * @param e - 当前事件对象。
           * @returns 完成当前异步操作的 Promise，不携带业务数据。
           */
          async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await onCreate(
                name.trim(),
                description.trim(),
                templates.find(
                  /** 检查 t 的标识等于themeId，供集合筛选或定位使用。 @param t - 当前场景的生命周期控制对象。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                  (t) => t.id === themeId,
                ),
              );
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
            }
          }
        }
      >
        <div className="form-body">
          <label className="field-label">
            项目名称
            <Input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={
                /** 响应 onChange 交互，将用户操作应用到新建项目对话框。 @param e - 当前事件对象。 @returns 当前步骤的处理结果。 */
                (e) => setName(e.target.value)
              }
              placeholder="例如：客户管理平台"
            />
          </label>
          <label className="field-label">
            描述<span>可选</span>
            <Textarea
              value={description}
              onChange={
                /** 响应 onChange 交互，将用户操作应用到新建项目对话框。 @param e - 当前事件对象。 @returns 当前步骤的处理结果。 */
                (e) => setDescription(e.target.value)
              }
              placeholder="这个产品要解决什么问题？"
              rows={2}
            />
          </label>
          <div className="field-label">起始模板</div>
          <div className="theme-options">
            <Button
              type="button"
              variant="outline"
              className={`theme-option ${themeId === 'blank' ? 'selected' : ''}`}
              onClick={
                /** 响应 onClick 交互，将用户操作应用到新建项目对话框。 @returns 当前步骤的处理结果。 */
                () => setThemeId('blank')
              }
            >
              <Frame />
              <span>空白项目</span>
              {themeId === 'blank' && <Check size={14} />}
            </Button>
            {templates.map(
              /**
               * 转换新建项目对话框中的集合条目，供后续处理或展示。
               *
               * @param t - 当前场景的生命周期控制对象。
               * @returns 当前条目转换后的结果。
               */
              (t) => (
                <Button
                  type="button"
                  variant="outline"
                  className={`theme-option ${themeId === t.id ? 'selected' : ''}`}
                  key={t.id}
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到新建项目对话框。 @returns 当前步骤的处理结果。 */
                    () => setThemeId(t.id)
                  }
                >
                  <span className="theme-option-colors">
                    {[t.tokens.primary, t.tokens.background, t.tokens.text].map(
                      /** 转换新建项目对话框中的集合条目，供后续处理或展示。 @param c - 当前循环中的组件、颜色通道或条目。 @param i - 当前循环位置，从 0 开始。 @returns 当前条目转换后的结果。 */
                      (c, i) => (
                        <i key={i} style={{ background: c }} />
                      ),
                    )}
                  </span>
                  <span>{t.name.split(' / ')[0]}</span>
                  {themeId === t.id && <Check size={14} />}
                </Button>
              ),
            )}
          </div>
          {error && <p className="inline-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button variant="outline" type="button" onClick={onClose}>
            取消
          </Button>
          <Button className="blue-button" disabled={busy || !name.trim()} type="submit">
            {busy ? <LoaderCircle className="spin" /> : <Plus />}创建项目
          </Button>
        </div>
      </form>
    </Modal>
  );
}
/**
 * 呈现工作空间绑定对话框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onBind - 在绑定时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
function BindModal({
  project,
  onClose,
  onBind,
}: {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在绑定时通知调用方，由外层决定如何更新业务状态。
   * @param body - 请求正文或文档内容。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  onBind: (body: {
    /** 用于决定展示或处理分支的类别。取值：local（本地目录）、github（GitHub 仓库）。 */
    kind: 'local' | 'github';
    /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
    path?: string;
    /** 关联的 GitHub 仓库地址。 */
    repo?: string;
    /** 使用的 Git 分支名称。 */
    branch?: string;
  }) => Promise<void>;
}) {
  /** 界面状态：用于决定展示或处理分支的类别。通过状态更新驱动界面刷新。 */
  const [kind, setKind] = useState<'local' | 'github'>(project.workspace?.kind ?? 'local');
  /** 界面状态：文件路径或矢量路径内容，具体格式由所属对象约定。通过状态更新驱动界面刷新。 */
  const [path, setPath] = useState(project.workspace?.path ?? '');
  /** 界面状态：关联的 GitHub 仓库地址。通过状态更新驱动界面刷新。 */
  const [repo, setRepo] = useState(project.workspace?.repo ?? '');
  /** 界面状态：使用的 Git 分支名称。通过状态更新驱动界面刷新。 */
  const [branch, setBranch] = useState(project.workspace?.branch ?? '');
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState(false);
  /** 界面状态：当前操作的失败信息，供界面反馈或重试判断。通过状态更新驱动界面刷新。 */
  const [error, setError] = useState('');
  return (
    <Modal
      title="连接工作空间"
      subtitle={`为「${project.name}」绑定本地项目或 GitHub 仓库。`}
      onClose={onClose}
    >
      <form
        onSubmit={
          /**
           * 响应 onSubmit 交互，将用户操作应用到工作空间绑定对话框。
           *
           * @param e - 当前事件对象。
           * @returns 完成当前异步操作的 Promise，不携带业务数据。
           */
          async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await onBind({
                kind,
                ...(kind === 'local'
                  ? { path }
                  : {
                      repo,
                      ...(branch.trim() ? { branch: branch.trim() } : {}),
                    }),
              });
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
            }
          }
        }
      >
        <div className="form-body">
          <div className="binding-kind">
            <Button
              type="button"
              variant="outline"
              className={kind === 'local' ? 'active' : ''}
              onClick={
                /** 响应 onClick 交互，将用户操作应用到工作空间绑定对话框。 @returns 当前步骤的处理结果。 */
                () => setKind('local')
              }
            >
              <FolderOpen />
              <strong>本地文件夹</strong>
              <span>连接已有 Web 项目</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={kind === 'github' ? 'active' : ''}
              onClick={
                /** 响应 onClick 交互，将用户操作应用到工作空间绑定对话框。 @returns 当前步骤的处理结果。 */
                () => setKind('github')
              }
            >
              <Github />
              <strong>GitHub 仓库</strong>
              <span>克隆到本地工作空间</span>
            </Button>
          </div>
          {kind === 'local' ? (
            <label className="field-label">
              文件夹绝对路径
              <Input
                required
                value={path}
                onChange={
                  /** 响应 onChange 交互，将用户操作应用到工作空间绑定对话框。 @param e - 当前事件对象。 @returns 当前步骤的处理结果。 */
                  (e) => setPath(e.target.value)
                }
                placeholder="D:\\projects\\my-web-app"
              />
              <small>目录需已存在；设计代码写入 forma-generated 文件夹。</small>
            </label>
          ) : (
            <>
              <label className="field-label">
                GitHub 仓库地址
                <Input
                  required
                  type="url"
                  value={repo}
                  onChange={
                    /** 响应 onChange 交互，将用户操作应用到工作空间绑定对话框。 @param e - 当前事件对象。 @returns 当前步骤的处理结果。 */
                    (e) => setRepo(e.target.value)
                  }
                  placeholder="https://github.com/username/repository"
                />
              </label>
              <label className="field-label">
                分支<span>留空使用默认分支</span>
                <Input
                  value={branch}
                  onChange={
                    /** 响应 onChange 交互，将用户操作应用到工作空间绑定对话框。 @param e - 当前事件对象。 @returns 当前步骤的处理结果。 */
                    (e) => setBranch(e.target.value)
                  }
                  placeholder="main"
                />
              </label>
              <p className="form-hint">私有仓库使用系统 Git 凭据。同步后可自行审阅、提交与推送。</p>
            </>
          )}
          {error && <p className="inline-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" className="blue-button" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : <Link2 />}
            {busy ? '正在连接…' : '连接工作空间'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
/**
 * 呈现项目重命名对话框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onSave - 在保存时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
function RenameModal({
  project,
  onClose,
  onSave,
}: {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在保存时通知调用方，由外层决定如何更新业务状态。
   * @param name - 面向用户展示的名称。
   * @param description - 用于解释内容或用途的说明文字。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSave: (name: string, description: string) => void;
}) {
  /** 界面状态：面向用户展示的名称。通过状态更新驱动界面刷新。 */
  const [name, setName] = useState(project.name);
  /** 界面状态：用于解释内容或用途的说明文字。通过状态更新驱动界面刷新。 */
  const [description, setDescription] = useState(project.description);
  return (
    <Modal title="文件设置" onClose={onClose}>
      <form
        onSubmit={
          /**
           * 响应 onSubmit 交互，将用户操作应用到项目重命名对话框。
           *
           * @param e - 当前事件对象。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          (e) => {
            e.preventDefault();
            if (name.trim()) onSave(name.trim(), description.trim());
          }
        }
      >
        <div className="form-body">
          <label className="field-label">
            项目名称
            <Input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={
                /** 响应 onChange 交互，将用户操作应用到项目重命名对话框。 @param e - 当前事件对象。 @returns 当前步骤的处理结果。 */
                (e) => setName(e.target.value)
              }
            />
          </label>
          <label className="field-label">
            描述
            <Textarea
              rows={3}
              value={description}
              onChange={
                /** 响应 onChange 交互，将用户操作应用到项目重命名对话框。 @param e - 当前事件对象。 @returns 当前步骤的处理结果。 */
                (e) => setDescription(e.target.value)
              }
            />
          </label>
        </div>
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button className="blue-button" type="submit">
            保存修改
          </Button>
        </div>
      </form>
    </Modal>
  );
}
