import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
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
} from "lucide-react";
import type { DesignTemplate, Project, ProviderSettings, View } from "./types";
import { createProject, seedProjects, seedTemplates } from "./lib/seed";
import { api, downloadJson } from "./lib/api";
import { useStudioMotion } from "./lib/motion";
import { useStudioTheme } from "./theme/StudioTheme";
import Brand from "./components/Brand";
import ProjectMark from "./components/ProjectMark";
import { RinAvatar, RinIcon, RinIllustration } from "./components/brand/RinBrand";
import Modal from "./components/Modal";
import WorkspaceHome from "./components/WorkspaceHome";
import ProjectOverview from "./components/ProjectOverview";
import AgentChatPanel from "./components/AgentChatPanel";
import "./pearl-studio.css";
import "./studio-motion-v5.css";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { Separator } from "./components/ui/separator";
import {
  AgentDialog,
  AgentsView,
  SettingsView,
  SyncView,
} from "./components/WorkflowViews";

const DesignEditor = lazy(() => import("./components/DesignEditor"));
const ThemeStudio = lazy(() => import("./components/ThemeStudio"));
const ComponentsView = lazy(() =>
  import("./components/LibraryViews").then((module) => ({
    default: module.ComponentsView,
  })),
);
const TemplatesView = lazy(() =>
  import("./components/LibraryViews").then((module) => ({
    default: module.TemplatesView,
  })),
);
const TokensView = lazy(() =>
  import("./components/LibraryViews").then((module) => ({
    default: module.TokensView,
  })),
);

const labels: Record<View, string> = {
  projects: "项目",
  project: "项目概览",
  templates: "模板库",
  components: "组件库",
  tokens: "设计变量",
  agents: "助手与接入",
  sync: "设计同步",
  settings: "设置",
  theme: "Rin 主题工作室",
  editor: "设计画布",
};
const storageKey = "forma-projects-v1";
const projectViews: View[] = [
  "project",
  "editor",
  "components",
  "tokens",
  "sync",
  "agents",
];
function currentRoute(): { view: View; projectId?: string } {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/");
  if (parts[0] === "project" && parts[1]) {
    return {
      projectId: parts[1],
      view: projectViews.includes(parts[2] as View)
        ? (parts[2] as View)
        : "project",
    };
  }
  return {
    view: ["templates", "settings", "theme"].includes(parts[0])
      ? (parts[0] as View)
      : "projects",
  };
}
let bootPromise: Promise<{ projects: Project[]; online: boolean }> | undefined;

function boot() {
  if (!bootPromise)
    bootPromise = (async () => {
      try {
        const state = await api<{ projects: Project[] }>("/state");
        if (state.projects.length)
          return { projects: state.projects, online: true };
        let cached: Project[] | undefined;
        try {
          cached = JSON.parse(localStorage.getItem(storageKey) || "null");
        } catch {
          /* A damaged browser cache must not prevent opening the workspace. */
        }
        const projects: Project[] = [];
        for (const project of cached ?? seedProjects)
          projects.push(
            await api<Project>(`/projects/${project.id}`, project, "PUT"),
          );
        return { projects, online: true };
      } catch {
        try {
          return {
            projects:
              JSON.parse(localStorage.getItem(storageKey) || "null") ??
              seedProjects,
            online: false,
          };
        } catch {
          return { projects: seedProjects, online: false };
        }
      }
    })();
  return bootPromise;
}

export default function App() {
  const { reduced, expressive, transition } = useStudioMotion();
  const { settings: appearance, presets, updateSettings } = useStudioTheme();
  const [themeMenu, setThemeMenu] = useState(false);
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const projectsRef = useRef(projects);
  const [templates, setTemplates] = useState<DesignTemplate[]>(() => {
    try {
      return [
        ...seedTemplates,
        ...JSON.parse(localStorage.getItem("forma-custom-templates") || "[]"),
      ];
    } catch {
      return seedTemplates;
    }
  });
  const [view, setView] = useState<View>(() => currentRoute().view);
  const [agentOpen, setAgentOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agentDraftRequest, setAgentDraftRequest] = useState<{
    id: number;
    text: string;
  }>();
  const [initialPageId, setInitialPageId] = useState<string>();
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [busyProjectIds, setBusyProjectIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(
    () => currentRoute().projectId ?? seedProjects[0]?.id ?? "",
  );
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(false);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "pending" | "error"
  >("saved");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const [modal, setModal] = useState<
    | "create"
    | "bind"
    | "agent"
    | "guide"
    | "search"
    | "delete"
    | "rename"
    | null
  >(null);
  const [newTemplate, setNewTemplate] = useState<DesignTemplate | undefined>();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("recent");
  const [notifications, setNotifications] = useState(false);
  const [events, setEvents] = useState<string[]>([
    "欢迎来到 Forma。选择示例项目，即可体验可编辑画布。",
  ]);
  const [settings, setSettings] = useState<ProviderSettings>({
    configured: false,
    baseUrl: "https://api.openai.com/v1",
    textModel: "",
    imageModel: "",
  });
  const pending = useRef(new Map<string, Project>());
  const revisions = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const running = useRef(new Map<string, Promise<void>>());
  const agentBusyProjects = useRef(new Set<string>());
  const onAgentBusyChange = useCallback(
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
    projects.find((p) => p.id === selectedId) ??
    (!inProject ? projects[0] : undefined);
  useEffect(() => {
    if (!ready) return;
    if (inProject && !project) return;
    const hash =
      inProject && project ? `#/project/${project.id}/${view}` : `#/${view}`;
    window.history.replaceState(null, "", hash);
  }, [ready, inProject, project?.id, view]);
  useEffect(() => {
    const restore = () => {
      const route = currentRoute();
      setView(route.view);
      if (route.projectId) setSelectedId(route.projectId);
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    if (!error) setEvents((previous) => [text, ...previous].slice(0, 12));
  }, []);
  useEffect(() => {
    if (ready && inProject && !project) {
      setView("projects");
      notify("该项目不存在或已被删除，请选择一个项目。", true);
    }
  }, [ready, inProject, project?.id, notify]);

  const replaceProjects = useCallback((next: Project[]) => {
    projectsRef.current = next;
    setProjects(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Large image documents can exceed the optional browser cache; server storage remains authoritative. */
    }
  }, []);
  const acceptProject = useCallback(
    (next: Project) => {
      if (pending.current.has(next.id) || running.current.has(next.id)) return;
      if ((revisions.current.get(next.id) ?? -1) > next.revision) return;
      if (
        revisions.current.has(next.id) &&
        revisions.current.get(next.id) !== next.revision
      )
        setEditorEpoch((value) => value + 1);
      revisions.current.set(next.id, next.revision);
      replaceProjects(
        projectsRef.current.some((p) => p.id === next.id)
          ? projectsRef.current.map((p) => (p.id === next.id ? next : p))
          : [next, ...projectsRef.current],
      );
    },
    [replaceProjects],
  );

  useEffect(() => {
    let active = true;
    boot().then((state) => {
      if (!active) return;
      replaceProjects(state.projects);
      for (const item of state.projects)
        revisions.current.set(item.id, item.revision);
      setSelectedId((previous) =>
        state.projects.some((p) => p.id === previous)
          ? previous
          : currentRoute().projectId
            ? previous
            : (state.projects[0]?.id ?? ""),
      );
      setOnline(state.online);
      setReady(true);
    });
    api<ProviderSettings>("/settings")
      .then(setSettings)
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [replaceProjects]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !document.querySelector(".design-editor") &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setModal("search");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (pending.current.size || running.current.size) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const timer = setInterval(async () => {
      if (pending.current.size || running.current.size || document.hidden)
        return;
      try {
        const state = await api<{ projects: Project[] }>("/state");
        if (!active || pending.current.size || running.current.size) return;
        setOnline(true);
        const changed =
          state.projects.length !== projectsRef.current.length ||
          state.projects.some((item) => {
            const current = projectsRef.current.find((p) => p.id === item.id);
            return (
              !current ||
              current.revision !== item.revision ||
              current.lastSyncedRevision !== item.lastSyncedRevision
            );
          });
        if (changed) {
          if (
            state.projects.some(
              (item) =>
                revisions.current.has(item.id) &&
                item.revision > (revisions.current.get(item.id) ?? 0),
            )
          )
            setEditorEpoch((value) => value + 1);
          for (const item of state.projects)
            revisions.current.set(item.id, item.revision);
          replaceProjects(state.projects);
        }
      } catch {
        if (active) setOnline(false);
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ready, replaceProjects]);

  const persist = useCallback(
    async (id: string) => {
      if (running.current.has(id)) return running.current.get(id)!;
      const work = (async () => {
        while (pending.current.has(id)) {
          const next = pending.current.get(id)!;
          pending.current.delete(id);
          setSaveState("saving");
          try {
            const saved = await api<Project & { syncWarning?: string }>(
              `/projects/${id}`,
              { ...next, revision: revisions.current.get(id) ?? next.revision },
              "PUT",
            );
            revisions.current.set(id, saved.revision);
            replaceProjects(
              projectsRef.current.map((p) =>
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
            setSaveState("saved");
            if (saved.syncWarning) notify(saved.syncWarning, true);
          } catch (error) {
            if (!pending.current.has(id)) pending.current.set(id, next);
            setSaveState("error");
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
    (next: Project) => {
      if (agentBusyProjects.current.has(next.id)) {
        notify("Agent 正在更新此项目，请等待当前步骤完成后再编辑。", true);
        return;
      }
      const changed = {
        ...next,
        updatedAt: new Date().toISOString(),
        status: "in-progress" as const,
      };
      replaceProjects(
        projectsRef.current.map((p) => (p.id === next.id ? changed : p)),
      );
      pending.current.set(next.id, changed);
      setSaveState("pending");
      clearTimeout(timers.current.get(next.id));
      timers.current.set(
        next.id,
        setTimeout(() => {
          void persist(next.id).catch(() => undefined);
        }, 650),
      );
    },
    [persist, replaceProjects, notify],
  );

  const flush = useCallback(async () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    await Promise.all(
      [...new Set([...pending.current.keys(), ...running.current.keys()])].map(
        (id) => persist(id),
      ),
    );
  }, [persist]);
  const refreshProject = useCallback(
    async (response?: { project?: Project }) => {
      if (response?.project) {
        acceptProject(response.project);
        return;
      }
      const state = await api<{ projects: Project[] }>("/state");
      for (const item of state.projects)
        revisions.current.set(item.id, item.revision);
      replaceProjects(state.projects);
    },
    [acceptProject, replaceProjects],
  );

  const navigate = (next: View) => {
    setView(next);
    setNotifications(false);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  };
  const openProject = (item: Project) => {
    setSelectedId(item.id);
    navigate("project");
  };
  const openCanvas = (pageId?: string) => {
    setInitialPageId(pageId);
    navigate("editor");
  };
  const newProject = (template?: DesignTemplate) => {
    setNewTemplate(template);
    setModal("create");
  };
  const openAgent = () => {
    setAgentOpen(true);
  };
  const promptAgent = (text?: string) => {
    setAgentOpen(true);
    if (text?.trim())
      setAgentDraftRequest({ id: Date.now(), text: text.trim() });
  };
  const addTemplate = (template: DesignTemplate) => {
    const next = [...templates, template];
    setTemplates(next);
    localStorage.setItem(
      "forma-custom-templates",
      JSON.stringify(
        next.filter((t) => !seedTemplates.some((s) => s.id === t.id)),
      ),
    );
    notify("新主题已加入你的模板库");
  };

  const duplicate = async (item: Project) => {
    try {
      const copy = {
        ...structuredClone(item),
        id: crypto.randomUUID(),
        name: `${item.name} 副本`,
        workspace: undefined,
        lastSyncedRevision: undefined,
        status: "draft" as const,
        revision: 0,
        generation: undefined,
        updatedAt: new Date().toISOString(),
      };
      acceptProject(await api<Project>(`/projects/${copy.id}`, copy, "PUT"));
      notify("项目副本已创建");
    } catch (error) {
      notify((error as Error).message, true);
    }
  };

  const importFile = async (file: File) => {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("文件不能超过 20 MB");
      const data = JSON.parse(await file.text());
      const documents = Array.isArray(data.projects) ? data.projects : [data];
      if (!documents.length || documents.length > 50)
        throw new Error("每次可以导入 1–50 个项目");
      for (const source of documents) {
        const copy = {
          ...source,
          id: crypto.randomUUID(),
          name: source.name + "（导入）",
          workspace: undefined,
          generation: undefined,
          revision: 0,
          lastSyncedRevision: undefined,
          status: "draft",
          updatedAt: new Date().toISOString(),
        };
        acceptProject(await api<Project>(`/projects/${copy.id}`, copy, "PUT"));
      }
      notify(`已导入 ${documents.length} 个项目`);
    } catch (error) {
      notify((error as Error).message, true);
    }
  };
  const fileAction = (item: Project, action: "rename" | "bind" | "delete") => {
    setSelectedId(item.id);
    setModal(action);
  };
  const navigation = (id: View, Icon: typeof Folder, badge?: number) => (
    <Button
      key={id}
      variant="ghost"
      className={`nav-item ${view === id ? "active" : ""}`}
      aria-label={labels[id]}
      title={sidebarCollapsed ? labels[id] : undefined}
      aria-current={view === id ? "page" : undefined}
      onClick={() => navigate(id)}
    >
      <Icon size={17} />
      <span>{labels[id]}</span>
      {badge !== undefined && <span className="nav-count">{badge}</span>}
    </Button>
  );

  return (
    <div
      className={`workspace-root ${agentOpen ? "agent-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      {view === "editor" && project ? (
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
            onBack={() => navigate("project")}
            onNavigate={navigate}
            onOpenAgent={openAgent}
            onSync={() => navigate("sync")}
            onTheme={() => navigate("theme")}
          />
        </Suspense>
      ) : (
        <div className="app-shell">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <button
                onClick={() => navigate("projects")}
                aria-label="Forma 首页"
              >
                <Brand small={sidebarCollapsed} />
              </button>
              <button
                className="sidebar-collapse"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label={sidebarCollapsed ? "展开导航" : "折叠导航"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen size={17} />
                ) : (
                  <PanelLeftClose size={17} />
                )}
              </button>
            </div>
            <Button
              variant="ghost"
              className="workspace-switch"
              aria-label="我的工作空间"
              title={sidebarCollapsed ? "我的工作空间" : undefined}
              onClick={() => navigate("projects")}
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
              title={sidebarCollapsed ? "搜索所有内容 · Ctrl K" : undefined}
              onClick={() => setModal("search")}
            >
              <Search size={16} />
              <span>搜索所有内容</span>
              <kbd>Ctrl K</kbd>
            </Button>
            <nav aria-label="主导航">
              <div className="workspace-navigation">
                <Button
                  variant="ghost"
                  className={`nav-item ${view === "projects" && tab === "recent" ? "active" : ""}`}
                  aria-label="所有项目"
                  title={sidebarCollapsed ? "所有项目" : undefined}
                  onClick={() => {
                    setTab("recent");
                    navigate("projects");
                  }}
                >
                  <RinIcon kind="projects" />
                  <span>所有项目</span>
                  <span className="nav-count">{projects.length}</span>
                </Button>
                <Button
                  variant="ghost"
                  className={`nav-item ${view === "projects" && tab === "favorites" ? "active" : ""}`}
                  aria-label="收藏项目"
                  title={sidebarCollapsed ? "收藏项目" : undefined}
                  onClick={() => {
                    setTab("favorites");
                    navigate("projects");
                  }}
                >
                  <Star />
                  <span>收藏项目</span>
                </Button>
                {navigation("templates", LayoutGrid)}
              </div>
              <Separator className="sidebar-divider" />
              <div className="sidebar-projects">
                <div className="nav-section-label">
                  我的项目
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="新建项目"
                    onClick={() => newProject()}
                  >
                    <Plus />
                  </Button>
                </div>
                <div className="project-tree">
                  {projects.map((p) => (
                    <div className="project-tree-item" key={p.id}>
                      <Button
                        variant="ghost"
                        className={`nav-file ${inProject && project?.id === p.id ? "project-active" : ""}`}
                        aria-label={p.name}
                        aria-current={inProject && project?.id === p.id ? "page" : undefined}
                        title={sidebarCollapsed ? p.name : undefined}
                        onClick={() => openProject(p)}
                      >
                        <ProjectMark project={p} size={23} />
                        <span>{p.name}</span>
                      </Button>
                    </div>
                  ))}
                  {!projects.length && (
                    <p className="sidebar-empty">
                      创建项目后，在其中管理页面、组件和 Tokens。
                    </p>
                  )}
                </div>
              </div>
            </nav>
            <div className="sidebar-bottom">
              {navigation("theme", Palette)}
              {navigation("settings", Settings2)}
              <Button
                variant="ghost"
                className="nav-item"
                aria-label="帮助与快捷键"
                title={sidebarCollapsed ? "帮助与快捷键" : undefined}
                onClick={() => setModal("guide")}
              >
                <CircleHelp />
                <span>帮助与快捷键</span>
              </Button>
              <Separator />
              <button
                className="account-row"
                onClick={openAgent}
                aria-label="与凛 Rin 对话"
              >
                <RinAvatar size={36} />
                <span>
                  <strong>凛 Rin</strong>
                  <small>
                    <span
                      className={`connection-dot ${online ? "online" : ""}`}
                    />
                    {online ? "你的设计伙伴" : "服务离线"}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div className="breadcrumbs">
                <button onClick={() => navigate("projects")}>工作空间</button>
                <ChevronRight size={14} />
                {inProject && project && (
                  <>
                    <Select value={project.id} onValueChange={setSelectedId}>
                      <SelectTrigger
                        className="breadcrumb-project"
                        aria-label="当前设计项目"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {!inProject && <strong>{labels[view]}</strong>}
              </div>
              <div className="topbar-actions">
                <button className="topbar-search" onClick={() => setModal("search")} aria-label="搜索工作空间"><Search size={15} /><span>搜索文件、模板或灵感…</span><kbd>Ctrl K</kbd></button>
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
                      {presets.map((preset) => (
                        <button
                          key={preset.id}
                          aria-pressed={appearance.preset === preset.id}
                          onClick={() => updateSettings({ preset: preset.id })}
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
                          {appearance.preset === preset.id && (
                            <Check size={12} />
                          )}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setThemeMenu(false);
                        navigate("theme");
                      }}
                    >
                      打开 Rin 主题工作室 <ArrowUpRight size={14} />
                    </Button>
                  </PopoverContent>
                </Popover>
                <Button
                  variant={agentOpen ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setAgentOpen(!agentOpen)}
                  aria-label={agentOpen ? "收起 Agent 聊天" : "打开 Agent 聊天"}
                  className={`rin-toggle ${agentOpen ? "is-open" : ""}`}
                  aria-pressed={agentOpen}
                >
                  <RinIcon kind="agent" size={15} />
                  Rin
                </Button>
                <span className="topbar-local">
                  <span
                    className={`connection-dot ${online ? "online" : ""}`}
                  />
                  {online ? "本地已连接" : "正在连接"}
                </span>

                <Popover open={notifications} onOpenChange={setNotifications}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="工作空间动态"
                    >
                      <Bell />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="workspace-events">
                    <h3>工作空间动态</h3>
                    {events.map((event, i) => (
                      <p key={i}>
                        <span className="connection-dot online" />
                        {event}
                      </p>
                    ))}
                  </PopoverContent>
                </Popover>

              </div>
            </header>
            {inProject && project && (
              <nav className="project-view-tabs" aria-label="项目导航">
                {(
                  [
                    ["project", "页面"],
                    ["editor", "画布"],
                    ["components", "组件库"],
                    ["tokens", "设计变量"],
                    ["sync", "代码同步"],
                    ["agents", "助手与接入"],
                  ] as [View, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={view === id ? "is-active" : ""}
                    aria-current={view === id ? "page" : undefined}
                    onClick={() =>
                      id === "editor" ? openCanvas() : navigate(id)
                    }
                  >
                    {label}
                    {view === id && (
                      <motion.span
                        layoutId="project-navigation-indicator"
                        className="project-tab-indicator"
                        transition={{
                          type: "spring",
                          stiffness: 440,
                          damping: 38,
                          ...(reduced ? { duration: 0 } : {}),
                        }}
                      />
                    )}
                  </button>
                ))}
                <span className="project-tabs-revision">
                  v{project.revision}
                </span>
              </nav>
            )}
            {!online && ready && (
              <div className="connection-banner">
                本地服务未连接。更改保存在浏览器缓存，重新连接后请重试保存。
              </div>
            )}
            <main className={`content content-${view}`}>
              <motion.div
                key={`${view}:${inProject ? project?.id : "workspace"}`}
                className="workspace-view"
                initial={
                  reduced ? false : { opacity: 0, y: expressive ? 10 : 3 }
                }
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
                  {view === "projects" && (
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
                      onTemplates={() => navigate("templates")}
                      onTheme={() => navigate("theme")}
                      onBind={(p) => fileAction(p, "bind")}
                      onRename={(p) => fileAction(p, "rename")}
                      onDelete={(p) => fileAction(p, "delete")}
                      onDuplicate={(p) => void duplicate(p)}
                      onExport={(p) => downloadJson(`${p.name}.forma.json`, p)}
                      onImport={importFile}
                    />
                  )}
                  {view === "templates" && (
                    <TemplatesView
                      templates={templates}
                      onUse={newProject}
                      onGenerate={() => {
                        setModal("agent");
                        setNewTemplate(undefined);
                      }}
                    />
                  )}
                  {view === "project" && project && (
                    <ProjectOverview
                      key={project.id}
                      project={project}
                      onOpenPage={openCanvas}
                      onNavigate={navigate}
                      onChange={updateProject}
                      onAgent={promptAgent}
                      onBind={() => setModal("bind")}
                      onTheme={() => navigate("theme")}
                    />
                  )}
                  {view === "components" && project && (
                    <ComponentsView
                      key={project.id}
                      project={project}
                      onChange={updateProject}
                    />
                  )}
                  {view === "tokens" && project && (
                    <TokensView
                      key={project.id}
                      project={project}
                      onChange={updateProject}
                      templates={templates}
                    />
                  )}
                  {view === "agents" && (
                    <AgentsView
                      settings={settings}
                      project={project}
                      onSettings={() => navigate("settings")}
                      onStart={openAgent}
                      notify={notify}
                    />
                  )}
                  {view === "sync" && project && (
                    <SyncView
                      key={project.id}
                      project={project}
                      onChange={updateProject}
                      onBind={() => setModal("bind")}
                      flush={flush}
                      refresh={refreshProject}
                      notify={notify}
                    />
                  )}
                  {view === "theme" && <ThemeStudio />}
                  {view === "settings" && (
                    <SettingsView
                      settings={settings}
                      onSettings={setSettings}
                      notify={notify}
                      projects={projects}
                      onExport={() =>
                        downloadJson("forma-workspace.json", {
                          projects,
                          templates,
                        })
                      }
                    />
                  )}
                  {["project", "tokens", "components", "sync"].includes(view) &&
                    !project && (
                      <div className="file-empty">
                        <RinIllustration state="empty" size={96} />
                        <h3>先创建一个项目</h3>
                        <Button onClick={() => newProject()}>新建项目</Button>
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
        onClose={() => setAgentOpen(false)}
        onSettings={() => navigate("settings")}
        onProject={(next) => {
          acceptProject(next);
          openProject(next);
        }}
        refresh={refreshProject}
        flush={flush}
        onNavigate={navigate}
        onBusyChange={onAgentBusyChange}
      />
      {modal === "create" && (
        <CreateProjectModal
          template={newTemplate}
          templates={templates}
          onClose={() => setModal(null)}
          onCreate={async (name, description, template) => {
            const next = createProject(name, template, description);
            if (!template)
              next.pages = [
                {
                  id: crypto.randomUUID(),
                  name: "页面 1",
                  width: 1440,
                  height: 900,
                  nodes: [],
                },
              ];
            const saved = await api<Project>(
              `/projects/${next.id}`,
              next,
              "PUT",
            );
            acceptProject(saved);
            setModal(null);
            openProject(saved);
            notify("项目已创建，页面、组件库和 Tokens 已就绪");
          }}
        />
      )}
      {modal === "bind" && project && (
        <BindModal
          project={project}
          onClose={() => setModal(null)}
          onBind={async (body) => {
            if (agentBusyProjects.current.has(project.id))
              throw new Error(
                "Agent 正在操作此项目，请等待完成后再更改工作空间。",
              );
            await flush();
            const response = await api<{
              workspace: Project["workspace"];
              project?: Project;
            }>("/workspace/bind", { projectId: project.id, ...body });
            await refreshProject(response);
            setModal(null);
            notify("工作空间已连接，可以预览并同步设计");
          }}
        />
      )}
      {modal === "agent" && (
        <AgentDialog
          project={project}
          settings={settings}
          mode={view === "templates" ? "theme" : "design"}
          flush={flush}
          refresh={refreshProject}
          onTemplate={addTemplate}
          onClose={() => setModal(null)}
          onSettings={() => {
            setModal(null);
            navigate("settings");
          }}
          onOpenCanvas={() => {
            setModal(null);
            if (project) openCanvas();
          }}
          notify={notify}
        />
      )}
      {modal === "guide" && (
        <Modal
          title="工作空间指南"
          subtitle="设计、原型与代码交付"
          onClose={() => setModal(null)}
        >
          <div className="guide-content">
            {[
              [
                Palette,
                "设计系统",
                "先选择主题，再使用统一的 Token、变量和组件建立页面。",
              ],
              [
                Sparkles,
                "AI 设计流程",
                "描述需求 → 生成设计图 → 审核通过 → 生成可编辑画布。",
              ],
              [
                Boxes,
                "画布编辑",
                "使用图层、绘图工具、对齐分组、布局和属性检查器编辑设计。",
              ],
              [
                Workflow,
                "代码同步",
                "关联文件夹或 GitHub，预览代码差异后同步，也可开启自动同步。",
              ],
            ].map(([Icon, title, detail]) => {
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
            })}
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
      {modal === "search" && (
        <Modal
          title="搜索工作空间"
          onClose={() => {
            setModal(null);
            setQuery("");
          }}
        >
          <div className="search-modal-content">
            <div className="search-dialog-input">
              <Search size={18} />
              <Input
                autoFocus
                placeholder="搜索项目或功能…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <p className="search-category">项目</p>
            {projects
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .map((p) => (
                <Button
                  variant="ghost"
                  className="search-result"
                  key={p.id}
                  onClick={() => {
                    setModal(null);
                    setQuery("");
                    openProject(p);
                  }}
                >
                  <Frame />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.pages.length} 个页面</small>
                  </span>
                  <ArrowUpRight />
                </Button>
              ))}
            <p className="search-category">功能</p>
            {(Object.entries(labels) as [View, string][])
              .filter(
                ([id, label]) =>
                  id !== "editor" &&
                  (inProject ||
                    ![
                      "project",
                      "components",
                      "tokens",
                      "sync",
                      "agents",
                    ].includes(id)) &&
                  label.toLowerCase().includes(query.toLowerCase()),
              )
              .map(([id, label]) => (
                <Button
                  variant="ghost"
                  className="search-result"
                  key={id}
                  onClick={() => {
                    setModal(null);
                    setQuery("");
                    navigate(id);
                  }}
                >
                  <LayoutGrid />
                  <span>{label}</span>
                  <ArrowRight />
                </Button>
              ))}
          </div>
        </Modal>
      )}
      {modal === "delete" && project && (
        <Modal
          title="删除项目？"
          subtitle={`「${project.name}」的画布与设计数据将被删除。已经同步到工作空间的代码会保留。`}
          onClose={() => setModal(null)}
        >
          <div className="modal-footer">
            <Button variant="outline" onClick={() => setModal(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  if (agentBusyProjects.current.has(project.id))
                    throw new Error(
                      "Agent 正在操作此项目，请等待完成后再删除。",
                    );
                  await flush();
                  await api(`/projects/${project.id}`, undefined, "DELETE");
                  replaceProjects(
                    projectsRef.current.filter((p) => p.id !== project.id),
                  );
                  setModal(null);
                  navigate("projects");
                  notify("项目已删除");
                } catch (error) {
                  notify((error as Error).message, true);
                }
              }}
            >
              删除项目
            </Button>
          </div>
        </Modal>
      )}
      {modal === "rename" && project && (
        <RenameModal
          project={project}
          onClose={() => setModal(null)}
          onSave={(name, description) => {
            updateProject({ ...project, name, description });
            setModal(null);
          }}
        />
      )}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.text}
            className={`toast ${toast.error ? "toast-error" : ""}`}
            role={toast.error ? "alert" : "status"}
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
              onClick={() => setToast(null)}
            >
              <X />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateProjectModal({
  templates,
  template,
  onClose,
  onCreate,
}: {
  templates: DesignTemplate[];
  template?: DesignTemplate;
  onClose: () => void;
  onCreate: (
    name: string,
    description: string,
    template?: DesignTemplate,
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [themeId, setThemeId] = useState(template?.id ?? "blank");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="新建项目"
      subtitle="为你的下一个想法，建立一个创作空间。"
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onCreate(
              name.trim(),
              description.trim(),
              templates.find((t) => t.id === themeId),
            );
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <div className="form-body">
          <label className="field-label">
            项目名称
            <Input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：客户管理平台"
            />
          </label>
          <label className="field-label">
            描述<span>可选</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这个产品要解决什么问题？"
              rows={2}
            />
          </label>
          <div className="field-label">起始模板</div>
          <div className="theme-options">
            <Button
              type="button"
              variant="outline"
              className={`theme-option ${themeId === "blank" ? "selected" : ""}`}
              onClick={() => setThemeId("blank")}
            >
              <Frame />
              <span>空白项目</span>
              {themeId === "blank" && <Check size={14} />}
            </Button>
            {templates.map((t) => (
              <Button
                type="button"
                variant="outline"
                className={`theme-option ${themeId === t.id ? "selected" : ""}`}
                key={t.id}
                onClick={() => setThemeId(t.id)}
              >
                <span className="theme-option-colors">
                  {[t.tokens.primary, t.tokens.background, t.tokens.text].map(
                    (c, i) => (
                      <i key={i} style={{ background: c }} />
                    ),
                  )}
                </span>
                <span>{t.name.split(" / ")[0]}</span>
                {themeId === t.id && <Check size={14} />}
              </Button>
            ))}
          </div>
          {error && <p className="inline-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button variant="outline" type="button" onClick={onClose}>
            取消
          </Button>
          <Button
            className="blue-button"
            disabled={busy || !name.trim()}
            type="submit"
          >
            {busy ? <LoaderCircle className="spin" /> : <Plus />}创建项目
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function BindModal({
  project,
  onClose,
  onBind,
}: {
  project: Project;
  onClose: () => void;
  onBind: (body: {
    kind: "local" | "github";
    path?: string;
    repo?: string;
    branch?: string;
  }) => Promise<void>;
}) {
  const [kind, setKind] = useState<"local" | "github">(
    project.workspace?.kind ?? "local",
  );
  const [path, setPath] = useState(project.workspace?.path ?? "");
  const [repo, setRepo] = useState(project.workspace?.repo ?? "");
  const [branch, setBranch] = useState(project.workspace?.branch ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="连接工作空间"
      subtitle={`为「${project.name}」绑定本地项目或 GitHub 仓库。`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onBind({
              kind,
              ...(kind === "local"
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
        }}
      >
        <div className="form-body">
          <div className="binding-kind">
            <Button
              type="button"
              variant="outline"
              className={kind === "local" ? "active" : ""}
              onClick={() => setKind("local")}
            >
              <FolderOpen />
              <strong>本地文件夹</strong>
              <span>连接已有 Web 项目</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={kind === "github" ? "active" : ""}
              onClick={() => setKind("github")}
            >
              <Github />
              <strong>GitHub 仓库</strong>
              <span>克隆到本地工作空间</span>
            </Button>
          </div>
          {kind === "local" ? (
            <label className="field-label">
              文件夹绝对路径
              <Input
                required
                value={path}
                onChange={(e) => setPath(e.target.value)}
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
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="https://github.com/username/repository"
                />
              </label>
              <label className="field-label">
                分支<span>留空使用默认分支</span>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                />
              </label>
              <p className="form-hint">
                私有仓库使用系统 Git 凭据。同步后可自行审阅、提交与推送。
              </p>
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
            {busy ? "正在连接…" : "连接工作空间"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function RenameModal({
  project,
  onClose,
  onSave,
}: {
  project: Project;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  return (
    <Modal title="文件设置" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim(), description.trim());
        }}
      >
        <div className="form-body">
          <label className="field-label">
            项目名称
            <Input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field-label">
            描述
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
