import type { View } from "../types";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStudioMotion } from "../lib/motion";
import { RinAvatar, RinIcon, RinIllustration, type RinIconKind } from "./brand/RinBrand";
import { RinTaskActivity } from "./motion/RinMotion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  FileCode2,
  History,
  FolderOpen,
  SwatchBook,
  Workflow,
  Frame,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@forma/ui/button";
import { Textarea } from "@forma/ui/textarea";
import { Badge } from "@forma/ui/badge";
import { Checkbox } from "@forma/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@forma/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@forma/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@forma/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@forma/ui/tooltip";
import type { Project, ProviderSettings } from "@forma/schema";
import type {
  AgentActionResult,
  AgentMessage,
  AgentReviewAction,
  AgentSession,
  AgentSessionSummary,
  AgentTurnRequest,
  AgentTurnResponse,
} from "@forma/schema/agent";
import "./agent-chat.css";
import { ModelSwitcher } from "./ProviderConnections";

interface Props {
  project?: Project;
  settings: ProviderSettings;
  hidden?: boolean;
  draftRequest?: { id: number; text: string };
  onClose: () => void;
  onSettings: () => void;
  onProviderSettings: (settings: ProviderSettings) => void;
  onProject: (project: Project) => void;
  refresh: (result?: { project?: Project }) => Promise<void>;
  flush: () => Promise<void>;
  onNavigate: (view: View) => void;
  onBusyChange?: (projectId: string | undefined, busy: boolean) => void;
}
interface ScopeState {
  sessions: AgentSessionSummary[];
  activeId?: string;
  draft: string;
  loading: boolean;
  error: string;
}
interface Operation {
  label: string;
  pending?: AgentMessage;
  error?: string;
}
interface SyncReview {
  action: AgentActionResult;
  sessionId: string;
  scope: string;
  file: string;
  checked: boolean;
}
const emptyScope = (): ScopeState => ({
  sessions: [],
  draft: "",
  loading: false,
  error: "",
});
const actionBrandIcons: Record<AgentActionResult["type"], RinIconKind> = {
  create_project: "projects",
  update_tokens: "tokens",
  create_variables: "tokens",
  create_component: "components",
  generate_image: "canvas",
  approve_image: "canvas",
  reconstruct_design: "canvas",
  preview_sync: "sync",
  apply_sync: "sync",
};
const statusLabels = {
  completed: "已完成",
  "awaiting-approval": "待确认",
  failed: "未完成",
};

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response
    .json()
    .catch(() => ({ error: `服务响应异常 (${response.status})` }));
  if (!response.ok && !result.session)
    throw new Error(result.error ?? `请求失败 (${response.status})`);
  return result as T;
}
const summaryOf = ({
  messages,
  ...session
}: AgentSession): AgentSessionSummary => ({
  ...session,
  messageCount: messages.length,
});
function mergeSummaries(
  current: AgentSessionSummary[],
  incoming: AgentSessionSummary[],
) {
  const map = new Map(current.map((session) => [session.id, session]));
  for (const session of incoming)
    if (
      !map.has(session.id) ||
      map.get(session.id)!.revision <= session.revision
    )
      map.set(session.id, session);
  return [...map.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
function InlineText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g)
        .map((part, index) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={index}>{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={index}>{part.slice(1, -1)}</code>;
          const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
          if (link)
            return (
              <a
                key={index}
                href={link[2]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link[1]}
              </a>
            );
          return part;
        })}
    </>
  );
}
function MessageText({ content }: { content: string }) {
  return (
    <div className="ac-message-text">
      {content
        .split(/(```[\s\S]*?```)/g)
        .filter(Boolean)
        .map((block, index) => {
          if (block.startsWith("```")) {
            const match = block.match(/^```([^\n]*)\n?([\s\S]*?)```$/);
            return (
              <div className="ac-code-block" key={index}>
                {match?.[1] && <span>{match[1]}</span>}
                <pre>
                  <code>{match?.[2] ?? block.slice(3, -3)}</code>
                </pre>
              </div>
            );
          }
          return (
            <div key={index}>
              {block.split("\n").map((line, lineIndex) => {
                if (!line.trim())
                  return <div className="ac-message-spacer" key={lineIndex} />;
                if (/^#{1,4}\s/.test(line))
                  return (
                    <p className="ac-message-heading" key={lineIndex}>
                      <InlineText text={line.replace(/^#{1,4}\s+/, "")} />
                    </p>
                  );
                const list = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
                return (
                  <p
                    className={list ? "ac-message-bullet" : ""}
                    key={lineIndex}
                  >
                    <InlineText text={list?.[1] ?? line} />
                  </p>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}
function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function AgentChatPanel({
  project,
  settings,
  hidden = false,
  draftRequest,
  onClose,
  onSettings,
  onProviderSettings,
  onProject,
  refresh,
  flush,
  onNavigate,
  onBusyChange,
}: Props) {
  const {
    reduced: reducedMotion,
    expressive,
    transition: uiTransition,
  } = useStudioMotion();
  const [switchingModel, setSwitchingModel] = useState(false);
  const scope = project ? `project:${project.id}` : "global";
  const [scopes, setScopes] = useState<Record<string, ScopeState>>({});
  const [sessions, setSessions] = useState<Record<string, AgentSession>>({});
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [operations, setOperations] = useState<Record<string, Operation>>({});
  const [creatingScopes, setCreatingScopes] = useState<Set<string>>(new Set());
  const [review, setReview] = useState<SyncReview>();
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    title: string;
  }>();
  const [toast, setToast] = useState("");
  const [pickedPrompt, setPickedPrompt] = useState("");
  const [hasScroll, setHasScroll] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    if (!pickedPrompt) return;
    const timer = window.setTimeout(() => setPickedPrompt(""), 1800);
    return () => window.clearTimeout(timer);
  }, [pickedPrompt]);
  const scopesRef = useRef(scopes),
    sessionsRef = useRef(sessions),
    scopeRef = useRef(scope);
  scopesRef.current = scopes;
  sessionsRef.current = sessions;
  scopeRef.current = scope;
  const callbacks = useRef({
    refresh,
    flush,
    onProject,
    onNavigate,
    onBusyChange,
  });
  callbacks.current = { refresh, flush, onProject, onNavigate, onBusyChange };
  const requestScopes = useRef(new Set<string>()),
    busySessions = useRef(new Set<string>()),
    busyTargets = useRef(new Set<string>()),
    loadIds = useRef<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null),
    composerRef = useRef<HTMLTextAreaElement>(null);
  const followBottom = useRef(true);
  const appliedDraftRequest = useRef<number | null>(null);
  const current = scopes[scope] ?? emptyScope();
  const session = current.activeId ? sessions[current.activeId] : undefined;
  const operation = current.activeId ? operations[current.activeId] : undefined;
  const busy = !!operation?.label || creatingScopes.has(scope);
  const subjectId = session?.projectId ?? project?.id;
  const subject =
    project?.id === subjectId
      ? project
      : subjectId
        ? projects[subjectId]
        : undefined;
  const messages = session?.messages ?? [];
  const pending =
    operation?.pending &&
    !messages.some((message) => message.id === operation.pending!.id)
      ? operation.pending
      : undefined;
  const renderedMessages = pending ? [...messages, pending] : messages;
  const mutateScope = (
    key: string,
    update: (state: ScopeState) => ScopeState,
  ) =>
    setScopes((states) => {
      const next = { ...states, [key]: update(states[key] ?? emptyScope()) };
      scopesRef.current = next;
      return next;
    });
  const cacheSession = (value: AgentSession, key: string) => {
    setSessions((current) => {
      const existing = current[value.id];
      if (existing && existing.revision > value.revision) return current;
      const next = { ...current, [value.id]: value };
      sessionsRef.current = next;
      return next;
    });
    mutateScope(key, (state) => ({
      ...state,
      sessions: mergeSummaries(state.sessions, [summaryOf(value)]),
    }));
  };
  const cacheProject = (value: Project) =>
    setProjects((current) =>
      !current[value.id] || current[value.id].revision <= value.revision
        ? { ...current, [value.id]: value }
        : current,
    );
  const loadSession = async (id: string, key: string) => {
    const value = await request<AgentSession>(`/agent/sessions/${id}`);
    cacheSession(value, key);
    return value;
  };
  const loadScope = async (key: string, projectId?: string) => {
    const loadId = (loadIds.current[key] ?? 0) + 1;
    loadIds.current[key] = loadId;
    mutateScope(key, (state) => ({ ...state, loading: true, error: "" }));
    try {
      const response = await request<{ sessions: AgentSessionSummary[] }>(
        `/agent/sessions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
      );
      if (loadIds.current[key] !== loadId) return;
      const all = mergeSummaries(
        scopesRef.current[key]?.sessions ?? [],
        response.sessions,
      );
      const activeId = scopesRef.current[key]?.activeId ?? all[0]?.id;
      mutateScope(key, (state) => ({
        ...state,
        sessions: all,
        activeId,
        loading: false,
      }));
      if (activeId) await loadSession(activeId, key);
    } catch (error) {
      if (loadIds.current[key] === loadId)
        mutateScope(key, (state) => ({
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : "会话加载失败",
        }));
    }
  };
  const createSession = async (
    key: string,
    projectId?: string,
    select = true,
  ) => {
    const value = await request<AgentSession>("/agent/sessions", {
      ...(projectId ? { projectId } : {}),
    });
    cacheSession(value, key);
    if (select)
      mutateScope(key, (state) => ({
        ...state,
        activeId: value.id,
        error: "",
      }));
    return value;
  };
  const newChat = async () => {
    const originScope = scope,
      projectId = project?.id;
    if (requestScopes.current.has(originScope)) return;
    requestScopes.current.add(originScope);
    setCreatingScopes((current) => new Set(current).add(originScope));
    try {
      await createSession(originScope, projectId);
      mutateScope(originScope, (state) => ({ ...state, draft: "" }));
      if (scopeRef.current === originScope) composerRef.current?.focus();
    } catch (error) {
      mutateScope(originScope, (state) => ({
        ...state,
        error: error instanceof Error ? error.message : "无法新建会话",
      }));
    } finally {
      requestScopes.current.delete(originScope);
      setCreatingScopes((current) => {
        const next = new Set(current);
        next.delete(originScope);
        return next;
      });
    }
  };
  const selectSession = async (id: string) => {
    const key = scope;
    mutateScope(key, (state) => ({
      ...state,
      activeId: id,
      draft: "",
      error: "",
    }));
    followBottom.current = true;
    try {
      await loadSession(id, key);
    } catch (error) {
      mutateScope(key, (state) => ({
        ...state,
        error: error instanceof Error ? error.message : "会话加载失败",
      }));
    }
  };
  const run = async (
    content?: string,
    action?: AgentReviewAction,
    target?: { sessionId: string; scope: string },
  ) => {
    const originScope = target?.scope ?? scope,
      originProjectId = originScope.startsWith("project:")
        ? originScope.slice(8)
        : undefined;
    const activeId =
      target?.sessionId ?? scopesRef.current[originScope]?.activeId;
    if (
      requestScopes.current.has(originScope) ||
      (activeId && busySessions.current.has(activeId))
    )
      return;
    const text = content?.trim();
    if (!text && !action) return;
    requestScopes.current.add(originScope);
    setCreatingScopes((current) => new Set(current).add(originScope));
    let capturedBusyTarget: string | undefined;
    let acquiredLock = false;
    let sentId = activeId;
    let serverReturned = false;
    const label =
      action?.type === "approve_image"
        ? "正在确认设计图"
        : action?.type === "reconstruct_design"
          ? "正在还原可编辑画布"
          : action?.type === "apply_sync"
            ? "正在同步已确认的代码"
            : "Agent 正在处理";
    try {
      const activeSession = activeId
        ? await loadSession(activeId, originScope)
        : await createSession(originScope, originProjectId);
      sentId = activeSession.id;
      const targetId =
        action?.projectId ?? activeSession.projectId ?? originProjectId;
      if (targetId && busyTargets.current.has(targetId)) {
        throw new Error("该项目的另一项 Agent 请求正在执行，请等待完成。");
      }
      capturedBusyTarget = targetId;
      if (targetId) busyTargets.current.add(targetId);
      acquiredLock = true;
      callbacks.current.onBusyChange?.(targetId, true);
      busySessions.current.add(sentId);
      setOperations((current) => ({
        ...current,
        [sentId!]: { label: "正在保存当前设计" },
      }));
      await callbacks.current.flush();
      const optimistic: AgentMessage | undefined = text
        ? {
            id: `pending-${crypto.randomUUID()}`,
            role: "user",
            content: text,
            createdAt: new Date().toISOString(),
            status: "pending",
          }
        : undefined;
      setOperations((current) => ({
        ...current,
        [sentId!]: { label, pending: optimistic },
      }));
      if (!action)
        mutateScope(originScope, (state) => ({
          ...state,
          draft: "",
          error: "",
        }));
      if (scopeRef.current === originScope) followBottom.current = true;
      let latestProject: Project | undefined;
      if (targetId) {
        latestProject = await request<Project>(`/projects/${targetId}`);
        cacheProject(latestProject);
      }
      const body: AgentTurnRequest = {
        ...(text ? { content: text } : {}),
        ...(action ? { action } : {}),
        sessionRevision: activeSession.revision,
        ...(latestProject ? { projectRevision: latestProject.revision } : {}),
      };
      const response = await request<AgentTurnResponse>(
        `/agent/sessions/${sentId}/messages`,
        body,
      );
      serverReturned = true;
      cacheSession(response.session, originScope);
      let refreshError = "";
      if (response.project) {
        try {
          const latest = response.error
            ? await request<Project>(`/projects/${response.project.id}`)
            : response.project;
          cacheProject(latest);
          await callbacks.current.refresh({ project: latest });
        } catch (error) {
          refreshError = `会话结果已保存，但工作台刷新失败：${error instanceof Error ? error.message : "请刷新项目"}`;
        }
      }
      if (response.error || refreshError)
        setOperations((current) => ({
          ...current,
          [sentId!]: { label: "", error: response.error || refreshError },
        }));
      else
        setOperations((current) => ({ ...current, [sentId!]: { label: "" } }));
      if (
        review?.sessionId === sentId &&
        action?.type === "apply_sync" &&
        !response.error
      )
        setReview(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "请求未完成，请重试。";
      if (sentId) {
        if (!serverReturned) {
          await loadSession(sentId, originScope).catch(() => undefined);
        }
        setOperations((current) => ({
          ...current,
          [sentId!]: { label: "", error: message },
        }));
      } else
        mutateScope(originScope, (state) => ({ ...state, error: message }));
      if (text)
        mutateScope(originScope, (state) => ({
          ...state,
          draft: state.draft || text,
        }));
    } finally {
      requestScopes.current.delete(originScope);
      if (sentId) busySessions.current.delete(sentId);
      if (capturedBusyTarget) busyTargets.current.delete(capturedBusyTarget);
      if (acquiredLock)
        callbacks.current.onBusyChange?.(capturedBusyTarget, false);
      setCreatingScopes((current) => {
        const next = new Set(current);
        next.delete(originScope);
        return next;
      });
    }
  };
  const openProject = async (id: string, view?: View) => {
    try {
      await callbacks.current.flush();
      const latest = await request<Project>(`/projects/${id}`);
      cacheProject(latest);
      callbacks.current.onProject(latest);
      if (view) callbacks.current.onNavigate(view);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "项目加载失败");
    }
  };
  const setPrompt = (text: string) => {
    mutateScope(scope, (state) => ({ ...state, draft: text }));
    requestAnimationFrame(() => composerRef.current?.focus());
  };
  useEffect(() => {
    if (
      !draftRequest ||
      hidden ||
      busy ||
      appliedDraftRequest.current === draftRequest.id
    )
      return;
    appliedDraftRequest.current = draftRequest.id;
    setPrompt(draftRequest.text);
  }, [draftRequest?.id, busy, hidden, scope]);
  useEffect(() => {
    if (!hidden) void loadScope(scope, project?.id);
  }, [scope, hidden]);
  useEffect(() => {
    setHistoryOpen(false);
    setImagePreview(undefined);
    setReview(undefined);
  }, [scope, hidden]);
  useEffect(() => {
    if (project) cacheProject(project);
  }, [project]);
  useEffect(() => {
    if (subjectId && !subject)
      request<Project>(`/projects/${subjectId}`)
        .then(cacheProject)
        .catch(() => {});
  }, [subjectId, subject]);
  useEffect(() => {
    if (hidden) return;
    const empty = renderedMessages.length === 0;
    if (empty) {
      followBottom.current = true;
      setHasScroll(false);
    }
    if (!empty && !followBottom.current) return;
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = empty
          ? 0
          : scrollRef.current.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [
    scope,
    current.activeId,
    renderedMessages.length,
    operation?.label,
    session?.revision,
    hidden,
  ]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const input = composerRef.current;
    if (input) {
      input.style.height = "auto";
      input.style.height = `${Math.min(160, Math.max(54, input.scrollHeight))}px`;
    }
  }, [current.draft]);

  const imageActions = messages
    .flatMap((message) => message.actions ?? [])
    .filter(
      (action) =>
        ["generate_image", "approve_image", "reconstruct_design"].includes(
          action.type,
        ) && action.status !== "failed",
    );
  const latestImageAction = (action: AgentActionResult) =>
    [...imageActions]
      .reverse()
      .find((item) => item.projectId === action.projectId)?.id === action.id;
  const appliedPreviewIds = new Set(
    messages
      .flatMap((message) => message.actions ?? [])
      .filter(
        (action) =>
          action.type === "apply_sync" && action.status === "completed",
      )
      .map((action) => action.previewId)
      .filter(Boolean),
  );
  const actionProject = (action: AgentActionResult) =>
    project?.id === action.projectId
      ? project
      : action.projectId
        ? projects[action.projectId]
        : undefined;
  const isStale = (action: AgentActionResult) => {
    const value = actionProject(action);
    return (
      !!value &&
      action.revision !== undefined &&
      value.revision !== action.revision
    );
  };
  const renderAction = (action: AgentActionResult) => {
    const stale = isStale(action),
      latest = latestImageAction(action),
      isImage =
        !!action.imageUrl &&
        ["generate_image", "approve_image"].includes(action.type);
    const canApprove =
      action.type === "generate_image" &&
      action.status === "awaiting-approval" &&
      latest;
    const canReconstruct =
      action.type === "approve_image" &&
      action.status === "completed" &&
      latest;
    const sync = action.syncPreview;
    const applied = !!sync && appliedPreviewIds.has(sync.previewId);
    const imageApproved =
      action.type === "generate_image" &&
      imageActions.some(
        (item) =>
          item.type === "approve_image" &&
          item.projectId === action.projectId &&
          item.imageUrl === action.imageUrl,
      );
    const imageReplaced =
      action.type === "generate_image" && !latest && !imageApproved;
    const displayedStatus =
      applied || imageApproved || imageReplaced ? "completed" : action.status;
    const displayedLabel = applied
      ? "已同步"
      : imageApproved
        ? "已确认"
        : imageReplaced
          ? "历史方案"
          : statusLabels[action.status];
    return (
      <motion.div
        className={`ac-action ac-action-${displayedStatus}`}
        key={action.id}
        layout={reducedMotion ? false : "position"}
        initial={{
          opacity: reducedMotion ? 1 : 0,
          y: reducedMotion ? 0 : expressive ? 10 : 2,
        }}
        animate={{ opacity: 1, y: 0 }}
        transition={uiTransition}
      >
        <header>
          <span className="ac-action-icon">
            <RinIcon
              kind={actionBrandIcons[action.type] ?? "agent"}
              size={16}
            />
          </span>
          <strong>{action.title}</strong>
          <span className="ac-action-status">
            {displayedStatus === "completed" ? (
              <Check size={11} />
            ) : action.status === "failed" ? (
              <CircleAlert size={11} />
            ) : null}
            {displayedLabel}
          </span>
        </header>
        {action.summary && (
          <p>
            {applied
              ? "这份已审查的预览已同步到绑定工作空间。"
              : imageApproved
                ? "这张设计图已确认，后续还原结果见下方记录。"
                : imageReplaced
                  ? "此方案已被后续设计图替代。"
                  : action.summary}
          </p>
        )}
        {action.error && <p className="ac-action-error">{action.error}</p>}
        {isImage && (
          <button
            className="ac-generated-image"
            aria-label="查看完整设计图"
            onClick={() =>
              setImagePreview({ url: action.imageUrl!, title: action.title })
            }
          >
            <img src={action.imageUrl} alt="Agent 生成的 UI 设计图" />
            <span>
              查看设计图
              <ImageIcon size={12} />
            </span>
          </button>
        )}
        {(canApprove || canReconstruct) &&
          action.projectId &&
          action.revision !== undefined &&
          action.imageUrl && (
            <div className="ac-image-next">
              <p>
                {stale
                  ? "项目已发生变化，此方案的操作已失效。"
                  : canApprove
                    ? "确认这张设计图后，才能还原为可编辑 UI。"
                    : "设计图已确认。还原后可在画布中继续编辑。"}
              </p>
              <Button
                disabled={
                  busy || stale || (canReconstruct && !settings.configured)
                }
                onClick={() =>
                  run(undefined, {
                    type: canApprove ? "approve_image" : "reconstruct_design",
                    projectId: action.projectId!,
                    revision: action.revision!,
                    imageUrl: action.imageUrl!,
                  })
                }
              >
                {canApprove ? <Check size={13} /> : <Layers3 size={13} />}
                {canApprove ? "确认这张设计图" : "还原可编辑画布"}
              </Button>
              {stale && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setPrompt(
                      "请根据项目当前主题和组件，重新生成刚才的 UI 设计图。",
                    )
                  }
                >
                  重新描述需求
                  <ArrowRight size={12} />
                </Button>
              )}
            </div>
          )}
        {sync && (
          <div className="ac-sync-summary">
            <div>
              <FileCode2 size={14} />
              <span>
                {
                  sync.files.filter((file) => file.status !== "unchanged")
                    .length
                }{" "}
                个变更
              </span>
              <code>v{sync.revision}</code>
            </div>
            <div className="ac-file-previews">
              {sync.files
                .filter((file) => file.status !== "unchanged")
                .slice(0, 3)
                .map((file) => (
                  <div key={file.path}>
                    <span className={`ac-file-status ${file.status}`}>
                      {file.status === "added"
                        ? "A"
                        : file.status === "conflict"
                          ? "!"
                          : "M"}
                    </span>
                    <span>{file.path}</span>
                  </div>
                ))}
            </div>
            {sync.conflicts.length > 0 && (
              <p className="ac-action-error">
                {sync.conflicts.length} 个冲突需要先处理。
              </p>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                setReview({
                  action,
                  sessionId: session!.id,
                  scope,
                  file: sync.files[0]?.path ?? "",
                  checked: false,
                })
              }
            >
              检查生成文件
              <ArrowRight size={12} />
            </Button>
          </div>
        )}
        {action.status === "completed" &&
          action.projectId &&
          [
            "create_project",
            "update_tokens",
            "create_variables",
            "create_component",
            "reconstruct_design",
            "apply_sync",
          ].includes(action.type) && (
            <Button
              variant="ghost"
              className="ac-result-link"
              onClick={() =>
                openProject(
                  action.projectId!,
                  action.type === "reconstruct_design"
                    ? "editor"
                    : action.type === "create_component"
                      ? "components"
                      : ["update_tokens", "create_variables"].includes(
                            action.type,
                          )
                        ? "tokens"
                        : action.type === "apply_sync"
                          ? "sync"
                          : undefined,
                )
              }
            >
              {action.type === "create_project"
                ? "打开项目"
                : ["update_tokens", "create_variables"].includes(action.type)
                  ? "查看主题与变量"
                  : action.type === "create_component"
                    ? "查看组件"
                    : action.type === "reconstruct_design"
                      ? "打开画布"
                      : "查看同步结果"}
              <ArrowRight size={12} />
            </Button>
          )}
      </motion.div>
    );
  };
  const quickPrompts: {
    kind: RinIconKind;
    title: string;
    description: string;
    prompt: string;
  }[] = project
    ? [
        {
          kind: "canvas",
          title: "设计页面",
          description: "从方案图到可编辑 UI",
          prompt:
            "基于当前项目的主题 Token 和组件，帮我设计一个新的页面。先生成 UI 设计图，等我确认后再还原。",
        },
        {
          kind: "tokens",
          title: "调整主题",
          description: "配色、字体与设计变量",
          prompt:
            "分析当前项目的主题 Token，给出一套更统一的配色、排版、圆角和间距方案，并应用到项目。",
        },
        {
          kind: "components",
          title: "构建组件",
          description: "延续项目的设计语言",
          prompt:
            "基于项目现有设计规范，创建一个可复用的卡片组件，包含标题、说明和主操作按钮。",
        },
        {
          kind: "sync",
          title: "同步代码",
          description: "先检查变更，再应用",
          prompt:
            "检查当前项目的工作空间，预览设计与代码之间的变更，让我审阅后再同步。",
        },
      ]
    : [
        {
          kind: "projects",
          title: "创建项目",
          description: "把产品想法变成起点",
          prompt: "帮我创建一个新的 Web App 设计项目：",
        },
        {
          kind: "tokens",
          title: "建立主题规范",
          description: "统一品牌与设计变量",
          prompt:
            "帮我创建一个专业 SaaS 设计项目，并建立统一的主题 Token，使用中性色和蓝色主色。",
        },
        {
          kind: "canvas",
          title: "设计界面",
          description: "先看方案，再确认实现",
          prompt:
            "创建一个项目管理 Web App 设计项目，并为仪表盘首页生成 UI 设计图，等我确认。",
        },
        {
          kind: "components",
          title: "规划组件",
          description: "搭建可复用的设计基础",
          prompt:
            "我想从零建立一个 Web App 的主题和组件系统。请先帮我梳理项目需求。",
        },
      ];
  const reviewedPreview = review?.action.syncPreview,
    reviewedFile =
      reviewedPreview?.files.find((file) => file.path === review?.file) ??
      reviewedPreview?.files[0];
  const reviewBusy = review ? !!operations[review.sessionId]?.label : false;
  const reviewApplied =
    !!reviewedPreview &&
    !!review &&
    (sessions[review.sessionId]?.messages ?? []).some((message) =>
      message.actions?.some(
        (action) =>
          action.type === "apply_sync" &&
          action.status === "completed" &&
          action.previewId === reviewedPreview.previewId,
      ),
    );
  const otherBusy = Object.entries(operations).filter(
    ([id, value]) => value.label && id !== current.activeId,
  ).length;
  return (
    <motion.aside
      className="agent-chat-panel"
      initial={false}
      animate={{ opacity: hidden ? 0 : 1, x: hidden && !reducedMotion ? 2 : 0 }}
      transition={uiTransition}
      hidden={hidden}
      aria-label="AI Agent 对话侧栏"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="ac-header">
        <div className="ac-agent-brand">
          <RinAvatar size={36} />
          <div className="ac-brand-copy">
            <strong>凛 <span>Rin</span></strong>
            <RinTaskActivity running={busy} label={busy ? "正在处理你的设计" : "你的设计搭档"} />
          </div>
        </div>
        <div>
          <IconButton label="历史对话" onClick={() => setHistoryOpen(true)}>
            <History size={15} />
          </IconButton>
          <IconButton
            label="新建对话"
            onClick={() => void newChat()}
            disabled={creatingScopes.has(scope)}
          >
            <Plus size={17} />
          </IconButton>
          <IconButton label="关闭 Agent 侧栏" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
      </header>
      <div className="ac-conversation-bar">
        <DropdownMenu open={historyOpen} onOpenChange={setHistoryOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ac-conversation-select">
              <MessageSquare size={13} />
              <span>{session?.title ?? "新对话"}</span>
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="ac-session-menu">
            <DropdownMenuLabel>
              {project ? `${project.name}的对话` : "工作空间对话"}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void newChat()}>
              <Plus size={14} />
              新建对话
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="ac-session-list">
              {current.sessions.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => void selectSession(item.id)}
                >
                  <MessageSquare size={13} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {new Date(item.updatedAt).toLocaleDateString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                      })}{" "}
                      · {item.messageCount} 条消息
                    </small>
                  </span>
                  {item.id === current.activeId && <Check size={13} />}
                </DropdownMenuItem>
              ))}
              {!current.sessions.length && <p>还没有历史对话</p>}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="ac-scope-label">
          {project ? "项目对话" : "工作空间"}
        </span>
      </div>
      {subject && (
        <button
          className="ac-project-context"
          onClick={() => void openProject(subject.id)}
        >
          <span
            className="ac-project-dot"
            style={{ background: subject.tokens.primary }}
          />
          <span>{subject.name}</span>
          <span className="ac-context-count">
            {subject.pages.length} 页 · {subject.components.length} 组件
          </span>
          <code>v{subject.revision}</code>
          <ChevronRight size={12} />
        </button>
      )}
      <div
        className="ac-scroll"
        ref={scrollRef}
        onScroll={() => {
          const element = scrollRef.current;
          if (element) {
            if (!renderedMessages.length) {
              followBottom.current = true;
              setHasScroll(false);
              return;
            }
            followBottom.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              80;
            setHasScroll(!followBottom.current);
          }
        }}
      >
        {current.loading && !session && (
          <div className="ac-loading" role="status">
            <LoaderCircle size={15} className="animate-spin" />
            正在加载对话
          </div>
        )}
        {!renderedMessages.length && !current.loading && (
          <motion.div
            className="ac-welcome"
            key={scope}
            initial={{
              opacity: reducedMotion ? 1 : 0,
              y: reducedMotion ? 0 : expressive ? 10 : 2,
            }}
            animate={{ opacity: 1, y: 0 }}
            transition={uiTransition}
          >
            <div className="ac-welcome-intro">
              <RinIllustration state="empty" size={104} />
              <h2>{project ? "和凛继续设计" : "和凛一起，从想法开始"}</h2>
              <p>{project ? "描述你想修改的页面、组件或样式。" : "创建项目、设计页面，或整理设计规范。"}</p>
            </div>
            <div className="ac-quick-prompts">
              {quickPrompts.map((item, index) => (
                <motion.button
                  key={item.title}
                  className={
                    pickedPrompt === item.title ? "is-picked" : undefined
                  }
                  onClick={() => {
                    setPrompt(item.prompt);
                    setPickedPrompt(item.title);
                  }}
                  initial={
                    reducedMotion
                      ? false
                      : { opacity: 0, y: expressive ? 10 : 2 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...uiTransition,
                    delay: reducedMotion
                      ? 0
                      : index * (expressive ? 0.045 : 0.02),
                  }}
                  whileHover={
                    reducedMotion ? undefined : { y: expressive ? -3 : -1 }
                  }
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                >
                  <AnimatePresence>
                    {pickedPrompt === item.title && (
                      <motion.span
                        className="ac-task-pick"
                        initial={
                          reducedMotion ? false : { opacity: 0, scale: 0.7 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={uiTransition}
                      >
                        <Check size={10} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="ac-task-icon">
                    <RinIcon kind={item.kind} size={24} />
                  </span>
                  <strong>{item.title}</strong>
                  <span className="ac-task-description">
                    {item.description}
                  </span>
                  <ArrowRight size={13} />
                </motion.button>
              ))}
            </div>
            <div className="ac-workflow-note">
              <ImageIcon size={12} />
              <span>生成设计图</span>
              <ChevronRight size={11} />
              <span>你来确认</span>
              <ChevronRight size={11} />
              <span>还原 UI</span>
            </div>
          </motion.div>
        )}
        <div className="ac-messages" aria-live="polite">
          {renderedMessages.map((message) => (
            <motion.article
              key={message.id}
              className={`ac-message ac-message-${message.role} ${message.status === "failed" ? "is-failed" : ""}`}
              initial={{
                opacity: reducedMotion ? 1 : 0,
                y: reducedMotion ? 0 : expressive ? 10 : 2,
              }}
              animate={{ opacity: 1, y: 0 }}
              transition={uiTransition}
            >
              <div className="ac-message-author">
                {message.role === "assistant" ? (
                  <RinAvatar size={24} className="ac-assistant-mark" />
                ) : (
                  <span className="ac-user-mark">我</span>
                )}
                <strong>{message.role === "assistant" ? "凛" : "你"}</strong>
                <time>
                  {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                {message.status === "pending" && (
                  <span className="ac-message-pending">发送中</span>
                )}
              </div>
              {message.content && <MessageText content={message.content} />}
              {!!message.actions?.length && (
                <div className="ac-action-timeline" aria-label="执行记录">
                  {message.actions.map(renderAction)}
                </div>
              )}
              {message.role === "assistant" && message.content && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="ac-message-copy"
                  aria-label="复制回答"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(message.content)
                      .then(() => setToast("回答已复制"))
                      .catch(() => setToast("无法访问剪贴板"))
                  }
                >
                  <Copy size={12} />
                </Button>
              )}
            </motion.article>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {busy && (
            <motion.div
              className="ac-working"
              role="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={uiTransition}
            >
              <span className="ac-working-indicator" />
              <RinIllustration state="thinking" size={48} />
              <div>
                <strong>
                  {operation?.label ??
                    (otherBusy ? "另一个对话正在处理" : "正在准备对话")}
                </strong>
                <span>请求完成后会在这里显示结果</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {(current.error || operation?.error) && (
          <div className="ac-error" role="alert">
            <RinIllustration state="error" size={42} />
            <div>
              <strong>需要处理</strong>
              <p>{operation?.error ?? current.error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (current.activeId)
                    void loadSession(current.activeId, scope)
                      .then(() => {
                        const id = current.activeId!;
                        setOperations((states) => ({
                          ...states,
                          [id]: { label: "" },
                        }));
                        mutateScope(scope, (state) => ({
                          ...state,
                          error: "",
                        }));
                        setToast("会话已刷新");
                      })
                      .catch((error) => setToast(error.message));
                  else void loadScope(scope, project?.id);
                }}
              >
                刷新会话
                <RefreshCw size={12} />
              </Button>
            </div>
          </div>
        )}
        {otherBusy > 0 && (
          <div className="ac-other-busy">
            <LoaderCircle size={12} className="animate-spin" />
            {otherBusy} 个其他对话正在处理
          </div>
        )}
      </div>
      {hasScroll && (
        <Button
          variant="outline"
          size="icon"
          className="ac-scroll-bottom"
          aria-label="回到最新消息"
          onClick={() => {
            followBottom.current = true;
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: reducedMotion ? "instant" : "smooth",
            });
          }}
        >
          <ArrowDown size={14} />
        </Button>
      )}
      <footer className="ac-footer">
        {!settings.configured && (
          <div className="ac-config-notice">
            <Settings2 size={14} />
            <span>连接模型，开始和凛协作</span>
            <Button variant="ghost" onClick={onSettings}>
              配置
              <ArrowRight size={11} />
            </Button>
          </div>
        )}
        <motion.div
          className={`ac-composer ${busy ? "is-busy" : ""}`}
          transition={uiTransition}
        >
          <Textarea
            ref={composerRef}
            aria-label="发送给凛的消息"
            placeholder={
              project ? "描述需要修改的内容…" : "描述你的任务…"
            }
            value={current.draft}
            onChange={(event) =>
              mutateScope(scope, (state) => ({
                ...state,
                draft: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              event.stopPropagation();
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (!busy && settings.configured && current.draft.trim())
                  void run(current.draft);
              }
            }}
          />
          <div className="ac-composer-toolbar">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="ac-context-button">
                  <span className="ac-context-symbol">@</span>
                  {subject ? "项目上下文" : "工作空间"}
                  <ChevronDown size={10} />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="ac-context-popover"
              >
                <h4>{subject?.name ?? "工作空间上下文"}</h4>
                {subject ? (
                  <>
                    <p>每次请求读取当前保存的设计数据。</p>
                    <dl>
                      <dt>设计版本</dt>
                      <dd>v{subject.revision}</dd>
                      <dt>主题 Token</dt>
                      <dd>{Object.keys(subject.tokens).length} 项</dd>
                      <dt>组件</dt>
                      <dd>{subject.components.length} 个</dd>
                      <dt>页面 / 图层</dt>
                      <dd>
                        {subject.pages.length} /{" "}
                        {subject.pages.reduce(
                          (sum, p) => sum + p.nodes.length,
                          0,
                        )}
                      </dd>
                      <dt>工作空间</dt>
                      <dd>
                        {subject.workspace?.kind === "github"
                          ? "GitHub"
                          : subject.workspace
                            ? "本地目录"
                            : "未绑定"}
                      </dd>
                    </dl>
                  </>
                ) : (
                  <p>可以创建项目。创建后，这段对话会继续围绕该项目工作。</p>
                )}
                <div className="ac-context-help">
                  图片生成后等待确认，代码同步前展示文件供检查。
                </div>
              </PopoverContent>
            </Popover>
            <div className="ac-send-tools">
              <span>{busy ? "处理中" : "↵ 发送"}</span>
              <Button
                className="ac-send"
                size="icon"
                aria-label="发送消息"
                disabled={!settings.configured || busy || !current.draft.trim()}
                onClick={() => void run(current.draft)}
              >
                {busy ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <ArrowUp size={16} />
                )}
              </Button>
            </div>
          </div>
        </motion.div>
        <div className="ac-footer-meta">
          <button onClick={() => setSwitchingModel(true)} disabled={busy} title={settings.textModel || "选择模型"}>
            更换模型 ·
            <span className={settings.configured ? "connected" : ""} />
            {settings.configured
              ? settings.textModel || "已连接模型"
              : "模型未连接"}
            <ChevronDown size={10} />
          </button>
          <span>
            <kbd>Enter</kbd> 发送 · <kbd>Shift ↵</kbd> 换行
          </span>
        </div>
      </footer>
      {switchingModel && <ModelSwitcher settings={settings} onSettings={onProviderSettings} onClose={() => setSwitchingModel(false)} onManage={() => { setSwitchingModel(false); onSettings(); }} />}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="ac-toast"
            role="status"
            key={toast}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={uiTransition}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <Dialog
        open={!!imagePreview}
        onOpenChange={(open) => !open && setImagePreview(undefined)}
      >
        <DialogContent className="ac-image-dialog">
          <DialogHeader>
            <DialogTitle>{imagePreview?.title}</DialogTitle>
            <DialogDescription>
              检查布局、视觉层次和项目风格是否一致。
            </DialogDescription>
          </DialogHeader>
          {imagePreview && (
            <img src={imagePreview.url} alt="UI 设计图完整预览" />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(open) => !open && !reviewBusy && setReview(undefined)}
      >
        <DialogContent className="ac-review-dialog">
          <DialogHeader>
            <DialogTitle>检查代码同步</DialogTitle>
            <DialogDescription>
              设计 v{reviewedPreview?.revision} · 仅写入绑定工作空间中的
              forma-generated/ 目录
            </DialogDescription>
          </DialogHeader>
          {reviewedPreview && (
            <>
              <div className="ac-review-layout">
                <nav>
                  {reviewedPreview.files.map((file) => (
                    <button
                      key={file.path}
                      className={
                        reviewedFile?.path === file.path ? "selected" : ""
                      }
                      onClick={() =>
                        setReview((current) =>
                          current ? { ...current, file: file.path } : current,
                        )
                      }
                    >
                      <span className={`ac-file-status ${file.status}`}>
                        {
                          (
                            {
                              added: "A",
                              modified: "M",
                              unchanged: "–",
                              conflict: "!",
                            } as const
                          )[file.status]
                        }
                      </span>
                      <span>{file.path}</span>
                    </button>
                  ))}
                </nav>
                <div className="ac-review-code">
                  <header>
                    <code>{reviewedFile?.path}</code>
                    <Badge variant="secondary">生成内容</Badge>
                  </header>
                  <pre>
                    <code>{reviewedFile?.content}</code>
                  </pre>
                </div>
              </div>
              {reviewApplied ? (
                <div className="ac-review-check">
                  <CheckCheck size={15} />
                  这份预览已经同步，可继续查看生成文件。
                </div>
              ) : reviewedPreview.conflicts.length > 0 ? (
                <div className="ac-review-warning">
                  <CircleAlert size={15} />
                  存在 {reviewedPreview.conflicts.length}{" "}
                  个冲突，请在同步工作台处理后重新预览。
                </div>
              ) : review && isStale(review.action) ? (
                <div className="ac-review-warning">
                  <CircleAlert size={15} />
                  项目版本已变化，请重新生成同步预览。
                </div>
              ) : (
                <label className="ac-review-check">
                  <Checkbox
                    checked={!!review?.checked}
                    onCheckedChange={(checked) =>
                      setReview((current) =>
                        current
                          ? { ...current, checked: checked === true }
                          : current,
                      )
                    }
                  />
                  <span>
                    我已检查 v{reviewedPreview.revision}{" "}
                    的生成文件，同意同步这些更改。
                  </span>
                </label>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={reviewBusy}
                  onClick={() => setReview(undefined)}
                >
                  取消
                </Button>
                <Button
                  disabled={
                    reviewBusy ||
                    reviewApplied ||
                    !review?.checked ||
                    reviewedPreview.conflicts.length > 0 ||
                    !review ||
                    isStale(review.action) ||
                    reviewedPreview.files.every(
                      (file) => file.status === "unchanged",
                    )
                  }
                  onClick={() => {
                    if (review?.action.projectId)
                      void run(
                        undefined,
                        {
                          type: "apply_sync",
                          projectId: review.action.projectId,
                          revision: reviewedPreview.revision,
                          previewId: reviewedPreview.previewId,
                        },
                        { sessionId: review.sessionId, scope: review.scope },
                      );
                  }}
                >
                  {reviewBusy ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {reviewApplied
                    ? "已同步"
                    : `确认同步 v${reviewedPreview.revision}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.aside>
  );
}
