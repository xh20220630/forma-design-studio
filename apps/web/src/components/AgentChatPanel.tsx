import { ReferenceImagePreview } from './ReferenceImagePreview';
import { ReconstructionProgress } from './ReconstructionProgress';
import type { View } from '../types';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStudioMotion } from '../lib/motion';
import { RinAvatar, RinIcon, RinIllustration, type RinIconKind } from './brand/RinBrand';
import { RinTaskActivity } from './motion/RinMotion';
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
} from 'lucide-react';
import { Button } from '@forma/ui/button';
import { Textarea } from '@forma/ui/textarea';
import { Badge } from '@forma/ui/badge';
import { Checkbox } from '@forma/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@forma/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@forma/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@forma/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@forma/ui/tooltip';
import type { Project, ProviderSettings } from '@forma/schema';
import type {
  AgentActionResult,
  AgentMessage,
  AgentReviewAction,
  AgentSession,
  AgentSessionSummary,
  AgentTurnRequest,
  AgentTurnResponse,
} from '@forma/schema/agent';
import './agent-chat.css';
import { ModelSwitcher } from './ProviderConnections';

/** AgentChatPanel 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 当前设计项目或工作空间项目元信息。 */
  project?: Project;
  /** 当前生效的设置。 */
  settings: ProviderSettings;
  /** 是否隐藏当前内容。 */
  hidden?: boolean;
  /** 等待填入输入框的草稿请求。 */
  draftRequest?: {
    /** 唯一标识，用于查找、更新和建立引用。 */
    id: number;
    /** 需要展示或编辑的文字内容。 */
    text: string;
  };
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在设置时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSettings: () => void;
  /**
   * 在供应商设置变化时通知调用方，由外层决定如何更新业务状态。
   * @param settings - 当前生效的设置。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onProviderSettings: (settings: ProviderSettings) => void;
  /**
   * 在项目变化时通知调用方，由外层决定如何更新业务状态。
   * @param project - 当前设计项目或工作空间项目元信息。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onProject: (project: Project) => void;
  /**
   * 重新读取最新数据的入口。
   * @param result - 上一步操作得到的结果。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  refresh: (result?: {
    /** 当前设计项目或工作空间项目元信息。 */
    project?: Project;
  }) => Promise<void>;
  /**
   * 等待尚未完成的保存落地，避免后续操作使用旧版本。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  flush: () => Promise<void>;
  /**
   * 在导航时通知调用方，由外层决定如何更新业务状态。
   * @param view - 当前视图或画布相机参数。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onNavigate: (view: View) => void;
  /**
   * 在忙碌状态变化时通知调用方，由外层决定如何更新业务状态。
   * @param projectId - 动作、会话或记录所属项目的标识。
   * @param busy - 是否有操作进行中，用于阻止重复提交。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onBusyChange?: (projectId: string | undefined, busy: boolean) => void;
}
/** 一个全局或项目会话范围的界面状态，使草稿与列表互不混用。 */
interface ScopeState {
  /** 当前范围内的对话会话集合。 */
  sessions: AgentSessionSummary[];
  /** 当前激活对象的标识。 */
  activeId?: string;
  /** 尚未提交的编辑内容或待组装的设计草稿。 */
  draft: string;
  /** 是否正在等待异步数据。 */
  loading: boolean;
  /** 当前操作的失败信息，供界面反馈或重试判断。 */
  error: string;
}
/** 当前操作的状态记录，帮助界面识别异步请求的归属。 */
interface Operation {
  /** 面向用户显示的简短标签。 */
  label: string;
  /** 当前是否仍有待处理的操作。 */
  pending?: AgentMessage;
  /** 当前操作的失败信息，供界面反馈或重试判断。 */
  error?: string;
}
/** 用户审查时的同步凭据，绑定项目、目录、版本和文件摘要。 */
interface SyncReview {
  /** 当前要执行的操作或操作结果分类。 */
  action: AgentActionResult;
  /** 目标会话的标识。 */
  sessionId: string;
  /** 当前数据或操作生效的范围。 */
  scope: string;
  /** 需要读取、写入或导入的文件。 */
  file: string;
  /** 复选控件当前是否选中。 */
  checked: boolean;
}
/**
 * 为全局或项目会话创建独立初始状态，防止不同范围共用输入草稿。
 * @returns 空会话范围状态。
 */
const emptyScope = (): ScopeState => ({
  sessions: [],
  draft: '',
  loading: false,
  error: '',
});
const actionBrandIcons: Record<AgentActionResult['type'], RinIconKind> = {
  create_project: 'projects',
  update_tokens: 'tokens',
  create_variables: 'tokens',
  create_component: 'components',
  generate_image: 'canvas',
  approve_image: 'canvas',
  reconstruct_design: 'canvas',
  preview_sync: 'sync',
  apply_sync: 'sync',
};
/** 集中维护 statusLabels 的约定值或当前状态，供相关分支保持一致。 */
const statusLabels = {
  completed: '已完成',
  'awaiting-approval': '待确认',
  failed: '未完成',
};

/**
 * 发送当前模块的 JSON 请求，并将服务端失败转换为可展示错误。
 *
 * @param path - 文件路径或矢量路径内容，具体格式由所属对象约定。
 * @param body - 请求正文或文档内容。
 * @returns 解析后的响应数据。
 */
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(
    /** 处理 request 中的异步失败，按当前流程决定回退或继续抛出。 @returns 当前步骤的处理结果。 */
    () => ({ error: `服务响应异常 (${response.status})` }),
  );
  if (!response.ok && !result.session)
    throw new Error(result.error ?? `请求失败 (${response.status})`);
  return result as T;
}
/**
 * 将完整会话压缩为列表摘要，避免侧栏重复保存全部消息。
 *
 * @param options - 按字段解构的输入，字段用途见对应类型定义。
 * @param options.messages - 按会话顺序保存的消息列表。
 * @returns 附带消息数量的会话摘要。
 */
const summaryOf = ({ messages, ...session }: AgentSession): AgentSessionSummary => ({
  ...session,
  messageCount: messages.length,
});
/**
 * 按版本合并会话摘要并重新排序，防止慢响应覆盖较新的本地记录。
 *
 * @param current - 更新前的当前值。
 * @param incoming - 新收到并准备合并的数据。
 * @returns 按更新时间降序排列的会话摘要。
 */
function mergeSummaries(current: AgentSessionSummary[], incoming: AgentSessionSummary[]) {
  const map = new Map(
    current.map(
      /** 转换 mergeSummaries 中的集合条目，供后续处理或展示。 @param session - 本轮操作对应的完整会话。 @returns 当前条目转换后的结果。 */
      (session) => [session.id, session],
    ),
  );
  for (const session of incoming)
    if (!map.has(session.id) || map.get(session.id)!.revision <= session.revision)
      map.set(session.id, session);
  return [...map.values()].sort(
    /** 比较 mergeSummaries 中的两个条目，确定它们的先后顺序。 @param a - 第一个比较或计算对象。 @param b - 第二个比较或计算对象。 @returns 负数、零或正数，分别表示前排、相同顺序或后排。 */
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
}
/**
 * 呈现消息行内文本，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.text - 需要展示或编辑的文字内容。
 * @returns 供 React 渲染的界面内容。
 */
function InlineText({
  text,
}: {
  /** 需要展示或编辑的文字内容。 */
  text: string;
}) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map(
        /**
         * 转换消息行内文本中的集合条目，供后续处理或展示。
         *
         * @param part - 当前处理的消息内容块。
         * @param index - 空间查询索引或当前条目的位置。
         * @returns 当前条目转换后的结果。
         */
        (part, index) => {
          if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={index}>{part.slice(2, -2)}</strong>;
          if (part.startsWith('`') && part.endsWith('`'))
            return <code key={index}>{part.slice(1, -1)}</code>;
          const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
          if (link)
            return (
              <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">
                {link[1]}
              </a>
            );
          return part;
        },
      )}
    </>
  );
}
/**
 * 呈现消息正文，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.content - 文件、消息或编辑文档的正文。
 * @returns 供 React 渲染的界面内容。
 */
function MessageText({
  content,
}: {
  /** 文件、消息或编辑文档的正文。 */
  content: string;
}) {
  return (
    <div className="ac-message-text">
      {content
        .split(/(```[\s\S]*?```)/g)
        .filter(Boolean)
        .map(
          /**
           * 转换消息正文中的集合条目，供后续处理或展示。
           *
           * @param block - 当前处理的文本或代码块。
           * @param index - 空间查询索引或当前条目的位置。
           * @returns 当前条目转换后的结果。
           */
          (block, index) => {
            if (block.startsWith('```')) {
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
                {block.split('\n').map(
                  /**
                   * 转换消息正文中的集合条目，供后续处理或展示。
                   *
                   * @param line - 当前文本行或线段。
                   * @param lineIndex - 当前文本行的位置，从 0 开始。
                   * @returns 当前条目转换后的结果。
                   */
                  (line, lineIndex) => {
                    if (!line.trim()) return <div className="ac-message-spacer" key={lineIndex} />;
                    if (/^#{1,4}\s/.test(line))
                      return (
                        <p className="ac-message-heading" key={lineIndex}>
                          <InlineText text={line.replace(/^#{1,4}\s+/, '')} />
                        </p>
                      );
                    const list = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
                    return (
                      <p className={list ? 'ac-message-bullet' : ''} key={lineIndex}>
                        <InlineText text={list?.[1] ?? line} />
                      </p>
                    );
                  },
                )}
              </div>
            );
          },
        )}
    </div>
  );
}
/**
 * 呈现图标按钮，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.label - 面向用户显示的简短标签。
 * @param props.children - 由调用方放入组件的子内容。
 * @param props.onClick - 在点击时通知调用方，由外层决定如何更新业务状态。
 * @param props.disabled - 是否禁止用户操作。
 * @returns 供 React 渲染的界面内容。
 */
function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  /** 面向用户显示的简短标签。 */
  label: string;
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
  /**
   * 在点击时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClick: () => void;
  /** 是否禁止用户操作。 */
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

/**
 * 呈现设计助手对话面板，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.settings - 当前生效的设置。
 * @param props.hidden - 是否隐藏当前内容。
 * @param props.draftRequest - 等待填入输入框的草稿请求。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onSettings - 在设置时通知调用方，由外层决定如何更新业务状态。
 * @param props.onProviderSettings - 在供应商设置变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.onProject - 在项目变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.refresh - 重新读取最新数据的入口。
 * @param props.flush - 等待尚未完成的保存落地，避免后续操作使用旧版本。
 * @param props.onNavigate - 在导航时通知调用方，由外层决定如何更新业务状态。
 * @param props.onBusyChange - 在忙碌状态变化时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
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
  const { reduced: reducedMotion, expressive, transition: uiTransition } = useStudioMotion();
  /** 界面状态：是否正在切换模型绑定。通过状态更新驱动界面刷新。 */
  const [switchingModel, setSwitchingModel] = useState(false);
  const scope = project ? `project:${project.id}` : 'global';
  /** 界面状态：按全局或项目范围分别维护的对话状态。通过状态更新驱动界面刷新。 */
  const [scopes, setScopes] = useState<Record<string, ScopeState>>({});
  /** 界面状态：当前范围内的对话会话集合。通过状态更新驱动界面刷新。 */
  const [sessions, setSessions] = useState<Record<string, AgentSession>>({});
  /** 界面状态：当前保存或展示的项目集合。通过状态更新驱动界面刷新。 */
  const [projects, setProjects] = useState<Record<string, Project>>({});
  /** 界面状态：按顺序应用的一组工作空间操作。通过状态更新驱动界面刷新。 */
  const [operations, setOperations] = useState<Record<string, Operation>>({});
  /** 界面状态：正在创建会话的范围集合，防止重复创建。通过状态更新驱动界面刷新。 */
  const [creatingScopes, setCreatingScopes] = useState<Set<string>>(new Set());
  /** 界面状态：是否由用户审查入口触发；模型规划不能自行取得该权限。通过状态更新驱动界面刷新。 */
  const [review, setReview] = useState<SyncReview>();
  /** 界面状态：当前放大预览的图片信息。通过状态更新驱动界面刷新。 */
  const [imagePreview, setImagePreview] = useState<{
    /** 资源或服务的访问地址。 */
    url: string;
    /** 界面显示的标题。 */
    title: string;
  }>();
  /** 界面状态：短时展示给用户的操作提示。通过状态更新驱动界面刷新。 */
  const [toast, setToast] = useState('');
  /** 界面状态：用户选中的快捷提示词。通过状态更新驱动界面刷新。 */
  const [pickedPrompt, setPickedPrompt] = useState('');
  /** 界面状态：当前消息区域是否出现可滚动内容。通过状态更新驱动界面刷新。 */
  const [hasScroll, setHasScroll] = useState(false);
  /** 界面状态：会话历史面板是否打开。通过状态更新驱动界面刷新。 */
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      if (!pickedPrompt) return;
      const timer = window.setTimeout(
        /** 基于最新状态计算 Timeout 的下一份值，避免连续更新时读到旧状态。 @returns 供 React 保存的新状态。 */
        () => setPickedPrompt(''),
        1800,
      );
      /** 结束设计助手对话面板当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => window.clearTimeout(timer);
    },
    [pickedPrompt],
  );
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
  const subject = project?.id === subjectId ? project : subjectId ? projects[subjectId] : undefined;
  const messages = session?.messages ?? [];
  const pending =
    operation?.pending &&
    !messages.some(
      /** 检查消息的标识等于 operation 的pending的标识，供集合筛选或定位使用。 @param message - 面向用户或调用方的说明消息。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (message) => message.id === operation.pending!.id,
    )
      ? operation.pending
      : undefined;
  const renderedMessages = pending ? [...messages, pending] : messages;
  /**
   * 只更新指定会话范围，同时同步引用以供异步回调读取最新状态。
   *
   * @param key - 要访问或更新的字段名。
   * @param update - 根据旧值计算新值的更新函数。
   * @returns 无返回值；更新范围状态。
   */
  const mutateScope = (key: string, update: (state: ScopeState) => ScopeState) =>
    setScopes(
      /**
       * 基于最新状态计算 Scopes 的下一份值，避免连续更新时读到旧状态。
       *
       * @param states - 按标识索引的状态集合。
       * @returns 供 React 保存的新状态。
       */
      (states) => {
        const next = { ...states, [key]: update(states[key] ?? emptyScope()) };
        scopesRef.current = next;
        return next;
      },
    );
  /**
   * 仅接纳不早于缓存版本的会话，避免并行请求造成消息回退。
   *
   * @param value - 当前字段、模式或控件的取值。
   * @param key - 要访问或更新的字段名。
   * @returns 无返回值；更新会话缓存和摘要。
   */
  const cacheSession = (value: AgentSession, key: string) => {
    setSessions(
      /**
       * 基于最新状态计算 Sessions 的下一份值，避免连续更新时读到旧状态。
       *
       * @param current - 更新前的当前值。
       * @returns 供 React 保存的新状态。
       */
      (current) => {
        const existing = current[value.id];
        if (existing && existing.revision > value.revision) return current;
        const next = { ...current, [value.id]: value };
        sessionsRef.current = next;
        return next;
      },
    );
    mutateScope(
      key,
      /** 执行 cacheSession 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
      (state) => ({
        ...state,
        sessions: mergeSummaries(state.sessions, [summaryOf(value)]),
      }),
    );
  };
  /**
   * 按修订版本更新项目缓存，防止旧动作结果覆盖新设计。
   *
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；更新项目缓存。
   */
  const cacheProject = (value: Project) =>
    setProjects(
      /** 基于最新状态计算 Projects 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
      (current) =>
        !current[value.id] || current[value.id].revision <= value.revision
          ? { ...current, [value.id]: value }
          : current,
    );
  /**
   * 读取完整会话并更新缓存，供选中对话后展示消息。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @param key - 要访问或更新的字段名。
   * @returns 加载的会话。
   */
  const loadSession = async (id: string, key: string) => {
    const value = await request<AgentSession>(`/agent/sessions/${id}`);
    cacheSession(value, key);
    return value;
  };
  /**
   * 加载指定范围的会话列表，并丢弃被后续请求取代的响应。
   *
   * @param key - 要访问或更新的字段名。
   * @param projectId - 动作、会话或记录所属项目的标识。
   * @returns 无返回值；更新列表、加载状态或错误信息。
   */
  const loadScope = async (key: string, projectId?: string) => {
    const loadId = (loadIds.current[key] ?? 0) + 1;
    loadIds.current[key] = loadId;
    mutateScope(
      key,
      /** 执行 loadScope 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
      (state) => ({ ...state, loading: true, error: '' }),
    );
    try {
      const response = await request<{
        /** 当前范围内的对话会话集合。 */
        sessions: AgentSessionSummary[];
      }>(`/agent/sessions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`);
      if (loadIds.current[key] !== loadId) return;
      const all = mergeSummaries(scopesRef.current[key]?.sessions ?? [], response.sessions);
      const activeId = scopesRef.current[key]?.activeId ?? all[0]?.id;
      mutateScope(
        key,
        /** 执行 loadScope 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
        (state) => ({
          ...state,
          sessions: all,
          activeId,
          loading: false,
        }),
      );
      if (activeId) await loadSession(activeId, key);
    } catch (error) {
      if (loadIds.current[key] === loadId)
        mutateScope(
          key,
          /** 执行 loadScope 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
          (state) => ({
            ...state,
            loading: false,
            error: error instanceof Error ? error.message : '会话加载失败',
          }),
        );
    }
  };
  /**
   * 在指定范围创建会话，可按调用需要立即切换到新会话。
   *
   * @param key - 要访问或更新的字段名。
   * @param projectId - 动作、会话或记录所属项目的标识。
   * @param select - 是否在创建完成后立即选中新对象。
   * @returns 新建的完整会话。
   */
  const createSession = async (key: string, projectId?: string, select = true) => {
    const value = await request<AgentSession>('/agent/sessions', {
      ...(projectId ? { projectId } : {}),
    });
    cacheSession(value, key);
    if (select)
      mutateScope(
        key,
        /** 执行 createSession 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
        (state) => ({
          ...state,
          activeId: value.id,
          error: '',
        }),
      );
    return value;
  };
  /**
   * 为当前范围创建新对话，并阻止重复点击造成并发创建。
   * @returns 无返回值；更新会话与输入框状态。
   */
  const newChat = async () => {
    const originScope = scope,
      projectId = project?.id;
    if (requestScopes.current.has(originScope)) return;
    requestScopes.current.add(originScope);
    setCreatingScopes(
      /** 基于最新状态计算 CreatingScopes 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
      (current) => new Set(current).add(originScope),
    );
    try {
      await createSession(originScope, projectId);
      mutateScope(
        originScope,
        /** 执行 newChat 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
        (state) => ({ ...state, draft: '' }),
      );
      if (scopeRef.current === originScope) composerRef.current?.focus();
    } catch (error) {
      mutateScope(
        originScope,
        /** 执行 newChat 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
        (state) => ({
          ...state,
          error: error instanceof Error ? error.message : '无法新建会话',
        }),
      );
    } finally {
      requestScopes.current.delete(originScope);
      setCreatingScopes(
        /**
         * 基于最新状态计算 CreatingScopes 的下一份值，避免连续更新时读到旧状态。
         *
         * @param current - 更新前的当前值。
         * @returns 供 React 保存的新状态。
         */
        (current) => {
          const next = new Set(current);
          next.delete(originScope);
          return next;
        },
      );
    }
  };
  /**
   * 切换会话并加载历史消息，同时清理上一个会话的输入状态。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @returns 无返回值；更新当前会话。
   */
  const selectSession = async (id: string) => {
    const key = scope;
    mutateScope(
      key,
      /** 执行 selectSession 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
      (state) => ({
        ...state,
        activeId: id,
        draft: '',
        error: '',
      }),
    );
    followBottom.current = true;
    try {
      await loadSession(id, key);
    } catch (error) {
      mutateScope(
        key,
        /** 执行 selectSession 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
        (state) => ({
          ...state,
          error: error instanceof Error ? error.message : '会话加载失败',
        }),
      );
    }
  };
  /**
   * 记录请求所属会话范围，等待保存后发送消息或确认动作，再按版本更新缓存。
   *
   * @param content - 文件、消息或编辑文档的正文。
   * @param action - 当前要执行的操作或操作结果分类。
   * @param target - 操作作用的目标。
   * @returns 完成本轮消息处理的 Promise；界面通过会话、忙碌状态和提示更新。
   */
  const run = async (
    content?: string,
    action?: AgentReviewAction,
    target?: {
      /** 目标会话的标识。 */
      sessionId: string;
      /** 当前数据或操作生效的范围。 */
      scope: string;
    },
  ) => {
    const originScope = target?.scope ?? scope,
      originProjectId = originScope.startsWith('project:') ? originScope.slice(8) : undefined;
    const activeId = target?.sessionId ?? scopesRef.current[originScope]?.activeId;
    if (requestScopes.current.has(originScope) || (activeId && busySessions.current.has(activeId)))
      return;
    const text = content?.trim();
    if (!text && !action) return;
    requestScopes.current.add(originScope);
    setCreatingScopes(
      /** 基于最新状态计算 CreatingScopes 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
      (current) => new Set(current).add(originScope),
    );
    let capturedBusyTarget: string | undefined;
    let acquiredLock = false;
    let sentId = activeId;
    let serverReturned = false;
    const label =
      action?.type === 'approve_image'
        ? '正在确认设计图'
        : action?.type === 'reconstruct_design'
          ? '正在分析参考图并重建素材'
          : action?.type === 'apply_sync'
            ? '正在同步已确认的代码'
            : 'Agent 正在处理';
    try {
      const activeSession = activeId
        ? await loadSession(activeId, originScope)
        : await createSession(originScope, originProjectId);
      sentId = activeSession.id;
      const targetId = action?.projectId ?? activeSession.projectId ?? originProjectId;
      if (targetId && busyTargets.current.has(targetId)) {
        throw new Error('该项目的另一项 Agent 请求正在执行，请等待完成。');
      }
      capturedBusyTarget = targetId;
      if (targetId) busyTargets.current.add(targetId);
      acquiredLock = true;
      callbacks.current.onBusyChange?.(targetId, true);
      busySessions.current.add(sentId);
      setOperations(
        /** 基于最新状态计算 Operations 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
        (current) => ({
          ...current,
          [sentId!]: { label: '正在保存当前设计' },
        }),
      );
      await callbacks.current.flush();
      const optimistic: AgentMessage | undefined = text
        ? {
            id: `pending-${crypto.randomUUID()}`,
            role: 'user',
            content: text,
            createdAt: new Date().toISOString(),
            status: 'pending',
          }
        : undefined;
      setOperations(
        /** 基于最新状态计算 Operations 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
        (current) => ({
          ...current,
          [sentId!]: { label, pending: optimistic },
        }),
      );
      if (!action)
        mutateScope(
          originScope,
          /** 执行 run 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
          (state) => ({
            ...state,
            draft: '',
            error: '',
          }),
        );
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
      const response = await request<AgentTurnResponse>(`/agent/sessions/${sentId}/messages`, body);
      serverReturned = true;
      cacheSession(response.session, originScope);
      let refreshError = '';
      if (response.project) {
        try {
          const latest = response.error
            ? await request<Project>(`/projects/${response.project.id}`)
            : response.project;
          cacheProject(latest);
          await callbacks.current.refresh({ project: latest });
        } catch (error) {
          refreshError = `会话结果已保存，但工作台刷新失败：${error instanceof Error ? error.message : '请刷新项目'}`;
        }
      }
      if (response.error || refreshError)
        setOperations(
          /** 基于最新状态计算 Operations 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
          (current) => ({
            ...current,
            [sentId!]: { label: '', error: response.error || refreshError },
          }),
        );
      else
        setOperations(
          /** 基于最新状态计算 Operations 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
          (current) => ({ ...current, [sentId!]: { label: '' } }),
        );
      if (review?.sessionId === sentId && action?.type === 'apply_sync' && !response.error)
        setReview(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求未完成，请重试。';
      if (sentId) {
        if (!serverReturned) {
          await loadSession(sentId, originScope).catch(
            /** 处理 run 中的异步失败，按当前流程决定回退或继续抛出。 @returns 当前步骤的处理结果。 */
            () => undefined,
          );
        }
        setOperations(
          /** 基于最新状态计算 Operations 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
          (current) => ({
            ...current,
            [sentId!]: { label: '', error: message },
          }),
        );
      } else
        mutateScope(
          originScope,
          /** 执行 run 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
          (state) => ({ ...state, error: message }),
        );
      if (text)
        mutateScope(
          originScope,
          /** 执行 run 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
          (state) => ({
            ...state,
            draft: state.draft || text,
          }),
        );
    } finally {
      requestScopes.current.delete(originScope);
      if (sentId) busySessions.current.delete(sentId);
      if (capturedBusyTarget) busyTargets.current.delete(capturedBusyTarget);
      if (acquiredLock) callbacks.current.onBusyChange?.(capturedBusyTarget, false);
      setCreatingScopes(
        /**
         * 基于最新状态计算 CreatingScopes 的下一份值，避免连续更新时读到旧状态。
         *
         * @param current - 更新前的当前值。
         * @returns 供 React 保存的新状态。
         */
        (current) => {
          const next = new Set(current);
          next.delete(originScope);
          return next;
        },
      );
    }
  };
  /**
   * 切换到指定项目，并加载该项目对应的工作视图。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @param view - 当前视图或画布相机参数。
   * @returns 项目打开操作的结果。
   */
  const openProject = async (id: string, view?: View) => {
    try {
      await callbacks.current.flush();
      const latest = await request<Project>(`/projects/${id}`);
      cacheProject(latest);
      callbacks.current.onProject(latest);
      if (view) callbacks.current.onNavigate(view);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '项目加载失败');
    }
  };
  /**
   * 更新当前范围的输入草稿并聚焦输入框，方便接着编辑。
   *
   * @param text - 需要展示或编辑的文字内容。
   * @returns 无返回值；更新草稿与焦点。
   */
  const setPrompt = (text: string) => {
    mutateScope(
      scope,
      /** 执行 setPrompt 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
      (state) => ({ ...state, draft: text }),
    );
    requestAnimationFrame(
      /** 在下一帧刷新setPrompt，让多次界面变化合并到一次绘制。 @returns 当前步骤的处理结果。 */
      () => composerRef.current?.focus(),
    );
  };
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (!draftRequest || hidden || busy || appliedDraftRequest.current === draftRequest.id)
        return;
      appliedDraftRequest.current = draftRequest.id;
      setPrompt(draftRequest.text);
    },
    [draftRequest?.id, busy, hidden, scope],
  );
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (!hidden) void loadScope(scope, project?.id);
    },
    [scope, hidden],
  );
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      setHistoryOpen(false);
      setImagePreview(undefined);
      setReview(undefined);
    },
    [scope, hidden],
  );
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (project) cacheProject(project);
    },
    [project],
  );
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (subjectId && !subject)
        request<Project>(`/projects/${subjectId}`)
          .then(cacheProject)
          .catch(
            /**
             * 处理设计助手对话面板中的异步失败，按当前流程决定回退或继续抛出。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {},
          );
    },
    [subjectId, subject],
  );
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      if (hidden) return;
      const empty = renderedMessages.length === 0;
      if (empty) {
        followBottom.current = true;
        setHasScroll(false);
      }
      if (!empty && !followBottom.current) return;
      const frame = requestAnimationFrame(
        /**
         * 在下一帧刷新设计助手对话面板，让多次界面变化合并到一次绘制。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        () => {
          if (scrollRef.current)
            scrollRef.current.scrollTop = empty ? 0 : scrollRef.current.scrollHeight;
        },
      );
      /** 结束设计助手对话面板当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => cancelAnimationFrame(frame);
    },
    [scope, current.activeId, renderedMessages.length, operation?.label, session?.revision, hidden],
  );
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      if (!toast) return;
      const timer = setTimeout(
        /** 基于最新状态计算 Timeout 的下一份值，避免连续更新时读到旧状态。 @returns 供 React 保存的新状态。 */
        () => setToast(''),
        3000,
      );
      /** 结束设计助手对话面板当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => clearTimeout(timer);
    },
    [toast],
  );
  useEffect(
    /**
     * 在设计助手对话面板的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      const input = composerRef.current;
      if (input) {
        input.style.height = 'auto';
        input.style.height = `${Math.min(160, Math.max(54, input.scrollHeight))}px`;
      }
    },
    [current.draft],
  );

  const imageActions = messages
    .flatMap(
      /** 转换设计助手对话面板中的集合条目并展开结果，供后续处理或展示。 @param message - 面向用户或调用方的说明消息。 @returns 当前条目展开后的结果。 */
      (message) => message.actions ?? [],
    )
    .filter(
      /** 检查包含 action 的类型且 action 的状态不等于“failed”，供集合筛选或定位使用。 @param action - 当前要执行的操作或操作结果分类。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (action) =>
        ['generate_image', 'approve_image', 'reconstruct_design'].includes(action.type) &&
        action.status !== 'failed',
    );
  /**
   * 识别同一项目的最新图片动作，避免用户确认已被替换的参考图。
   *
   * @param action - 当前要执行的操作或操作结果分类。
   * @returns 该动作是否为项目最新图片动作。
   */
  const latestImageAction = (action: AgentActionResult) =>
    [...imageActions].reverse().find(
      /** 检查条目的项目标识等于 action 的项目标识，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (item) => item.projectId === action.projectId,
    )?.id === action.id;
  const appliedPreviewIds = new Set(
    messages
      .flatMap(
        /** 转换设计助手对话面板中的集合条目并展开结果，供后续处理或展示。 @param message - 面向用户或调用方的说明消息。 @returns 当前条目展开后的结果。 */
        (message) => message.actions ?? [],
      )
      .filter(
        /** 检查 action 的类型等于“apply_sync”且 action 的状态等于“completed”，供集合筛选或定位使用。 @param action - 当前要执行的操作或操作结果分类。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (action) => action.type === 'apply_sync' && action.status === 'completed',
      )
      .map(
        /** 提取 action 的previewId，供后续计算或展示使用。 @param action - 当前要执行的操作或操作结果分类。 @returns action的previewId。 */
        (action) => action.previewId,
      )
      .filter(Boolean),
  );
  /**
   * 取得动作所属项目，用其当前版本判断动作是否仍可执行。
   *
   * @param action - 当前要执行的操作或操作结果分类。
   * @returns 对应的项目；尚未加载时返回 undefined。
   */
  const actionProject = (action: AgentActionResult) =>
    project?.id === action.projectId
      ? project
      : action.projectId
        ? projects[action.projectId]
        : undefined;
  /**
   * 比较动作产生时与当前项目的版本，防止继续应用过期操作。
   *
   * @param action - 当前要执行的操作或操作结果分类。
   * @returns 动作是否已过期。
   */
  const isStale = (action: AgentActionResult) => {
    const value = actionProject(action);
    return !!value && action.revision !== undefined && value.revision !== action.revision;
  };
  /**
   * 根据动作结果和当前项目状态显示确认、还原或同步入口。
   *
   * @param action - 当前要执行的操作或操作结果分类。
   * @returns 动作结果卡片。
   */
  const renderAction = (action: AgentActionResult) => {
    const stale = isStale(action),
      latest = latestImageAction(action),
      isImage = !!action.imageUrl && ['generate_image', 'approve_image'].includes(action.type);
    const canApprove =
      action.type === 'generate_image' && action.status === 'awaiting-approval' && latest;
    const canReconstruct =
      action.type === 'approve_image' && action.status === 'completed' && latest;
    const sync = action.syncPreview;
    const applied = !!sync && appliedPreviewIds.has(sync.previewId);
    const imageApproved =
      action.type === 'generate_image' &&
      imageActions.some(
        /** 检查条目的类型等于“approve_image”且条目的项目标识等于 action 的项目标识且条目的图片地址等于 action 的图片地址，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) =>
          item.type === 'approve_image' &&
          item.projectId === action.projectId &&
          item.imageUrl === action.imageUrl,
      );
    const imageReplaced = action.type === 'generate_image' && !latest && !imageApproved;
    /** 集中维护 displayedStatus 的约定值或当前状态，供相关分支保持一致。 */
    const displayedStatus = applied || imageApproved || imageReplaced ? 'completed' : action.status;
    const displayedLabel = applied
      ? '已同步'
      : imageApproved
        ? '已确认'
        : imageReplaced
          ? '历史方案'
          : statusLabels[action.status];
    return (
      <motion.div
        className={`ac-action ac-action-${displayedStatus}`}
        key={action.id}
        layout={reducedMotion ? false : 'position'}
        initial={{
          opacity: reducedMotion ? 1 : 0,
          y: reducedMotion ? 0 : expressive ? 10 : 2,
        }}
        animate={{ opacity: 1, y: 0 }}
        transition={uiTransition}
      >
        <header>
          <span className="ac-action-icon">
            <RinIcon kind={actionBrandIcons[action.type] ?? 'agent'} size={16} />
          </span>
          <strong>{action.title}</strong>
          <span className="ac-action-status">
            {displayedStatus === 'completed' ? (
              <Check size={11} />
            ) : action.status === 'failed' ? (
              <CircleAlert size={11} />
            ) : null}
            {displayedLabel}
          </span>
        </header>
        {action.summary && (
          <p>
            {applied
              ? '这份已审查的预览已同步到绑定工作空间。'
              : imageApproved
                ? '这张设计图已确认，后续还原结果见下方记录。'
                : imageReplaced
                  ? '此方案已被后续设计图替代。'
                  : action.summary}
          </p>
        )}
        {action.error && <p className="ac-action-error">{action.error}</p>}
        {isImage && (
          <button
            className="ac-generated-image"
            aria-label="查看完整设计图"
            onClick={
              /** 响应 onClick 交互，将用户操作应用到renderAction。 @returns 当前步骤的处理结果。 */
              () => setImagePreview({ url: action.imageUrl!, title: action.title })
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
                  ? '项目已发生变化，此方案的操作已失效。'
                  : canApprove
                    ? '确认这张设计图后，才能还原为可编辑 UI。'
                    : '设计图已确认。还原后可在画布中继续编辑。'}
              </p>
              <Button
                disabled={busy || stale || (canReconstruct && !settings.configured)}
                onClick={
                  /**
                   * 响应 onClick 交互，将用户操作应用到renderAction。
                   * @returns 完成当前异步操作的 Promise，不携带业务数据。
                   */
                  () =>
                    run(undefined, {
                      type: canApprove ? 'approve_image' : 'reconstruct_design',
                      projectId: action.projectId!,
                      revision: action.revision!,
                      imageUrl: action.imageUrl!,
                    })
                }
              >
                {canApprove ? <Check size={13} /> : <Layers3 size={13} />}
                {canApprove ? '确认这张设计图' : '还原可编辑画布'}
              </Button>
              {stale && (
                <Button
                  variant="ghost"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到renderAction。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => setPrompt('请根据项目当前主题和组件，重新生成刚才的 UI 设计图。')
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
                  sync.files.filter(
                    /** 检查 file 的状态不等于“unchanged”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                    (file) => file.status !== 'unchanged',
                  ).length
                }{' '}
                个变更
              </span>
              <code>v{sync.revision}</code>
            </div>
            <div className="ac-file-previews">
              {sync.files
                .filter(
                  /** 检查 file 的状态不等于“unchanged”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                  (file) => file.status !== 'unchanged',
                )
                .slice(0, 3)
                .map(
                  /**
                   * 转换 renderAction 中的集合条目，供后续处理或展示。
                   *
                   * @param file - 需要读取、写入或导入的文件。
                   * @returns 当前条目转换后的结果。
                   */
                  (file) => (
                    <div key={file.path}>
                      <span className={`ac-file-status ${file.status}`}>
                        {file.status === 'added' ? 'A' : file.status === 'conflict' ? '!' : 'M'}
                      </span>
                      <span>{file.path}</span>
                    </div>
                  ),
                )}
            </div>
            {sync.conflicts.length > 0 && (
              <p className="ac-action-error">{sync.conflicts.length} 个冲突需要先处理。</p>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={
                /**
                 * 响应 onClick 交互，将用户操作应用到renderAction。
                 * @returns 当前步骤的处理结果。
                 */
                () =>
                  setReview({
                    action,
                    sessionId: session!.id,
                    scope,
                    file: sync.files[0]?.path ?? '',
                    checked: false,
                  })
              }
            >
              检查生成文件
              <ArrowRight size={12} />
            </Button>
          </div>
        )}
        {action.status === 'completed' &&
          action.projectId &&
          [
            'create_project',
            'update_tokens',
            'create_variables',
            'create_component',
            'reconstruct_design',
            'apply_sync',
          ].includes(action.type) && (
            <Button
              variant="ghost"
              className="ac-result-link"
              onClick={
                /**
                 * 响应 onClick 交互，将用户操作应用到renderAction。
                 * @returns 完成当前异步操作的 Promise，不携带业务数据。
                 */
                () =>
                  openProject(
                    action.projectId!,
                    action.type === 'reconstruct_design'
                      ? 'editor'
                      : action.type === 'create_component'
                        ? 'components'
                        : ['update_tokens', 'create_variables'].includes(action.type)
                          ? 'tokens'
                          : action.type === 'apply_sync'
                            ? 'sync'
                            : undefined,
                  )
              }
            >
              {action.type === 'create_project'
                ? '打开项目'
                : ['update_tokens', 'create_variables'].includes(action.type)
                  ? '查看主题与变量'
                  : action.type === 'create_component'
                    ? '查看组件'
                    : action.type === 'reconstruct_design'
                      ? '打开画布'
                      : '查看同步结果'}
              <ArrowRight size={12} />
            </Button>
          )}
      </motion.div>
    );
  };
  const quickPrompts: {
    /** 用于决定展示或处理分支的类别。 */
    kind: RinIconKind;
    /** 界面显示的标题。 */
    title: string;
    /** 用于解释内容或用途的说明文字。 */
    description: string;
    /** 发送给模型的生成要求。 */
    prompt: string;
  }[] = project
    ? [
        {
          kind: 'canvas',
          title: '设计页面',
          description: '从方案图到可编辑 UI',
          prompt:
            '基于当前项目的主题 Token 和组件，帮我设计一个新的页面。先生成 UI 设计图，等我确认后再还原。',
        },
        {
          kind: 'tokens',
          title: '调整主题',
          description: '配色、字体与设计变量',
          prompt:
            '分析当前项目的主题 Token，给出一套更统一的配色、排版、圆角和间距方案，并应用到项目。',
        },
        {
          kind: 'components',
          title: '构建组件',
          description: '延续项目的设计语言',
          prompt: '基于项目现有设计规范，创建一个可复用的卡片组件，包含标题、说明和主操作按钮。',
        },
        {
          kind: 'sync',
          title: '同步代码',
          description: '先检查变更，再应用',
          prompt: '检查当前项目的工作空间，预览设计与代码之间的变更，让我审阅后再同步。',
        },
      ]
    : [
        {
          kind: 'projects',
          title: '创建项目',
          description: '把产品想法变成起点',
          prompt: '帮我创建一个新的 Web App 设计项目：',
        },
        {
          kind: 'tokens',
          title: '建立主题规范',
          description: '统一品牌与设计变量',
          prompt: '帮我创建一个专业 SaaS 设计项目，并建立统一的主题 Token，使用中性色和蓝色主色。',
        },
        {
          kind: 'canvas',
          title: '设计界面',
          description: '先看方案，再确认实现',
          prompt: '创建一个项目管理 Web App 设计项目，并为仪表盘首页生成 UI 设计图，等我确认。',
        },
        {
          kind: 'components',
          title: '规划组件',
          description: '搭建可复用的设计基础',
          prompt: '我想从零建立一个 Web App 的主题和组件系统。请先帮我梳理项目需求。',
        },
      ];
  const reviewedPreview = review?.action.syncPreview,
    reviewedFile =
      reviewedPreview?.files.find(
        /** 检查 file 的路径等于 review 的file，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (file) => file.path === review?.file,
      ) ?? reviewedPreview?.files[0];
  const reviewBusy = review ? !!operations[review.sessionId]?.label : false;
  const reviewApplied =
    !!reviewedPreview &&
    !!review &&
    (sessions[review.sessionId]?.messages ?? []).some(
      /**
       * 判断设计助手对话面板中的条目是否符合检查条件。
       *
       * @param message - 面向用户或调用方的说明消息。
       * @returns 该条目是否符合条件。
       */
      (message) =>
        message.actions?.some(
          /** 判断设计助手对话面板中的条目是否符合检查条件。 @param action - 当前要执行的操作或操作结果分类。 @returns 该条目是否符合条件。 */
          (action) =>
            action.type === 'apply_sync' &&
            action.status === 'completed' &&
            action.previewId === reviewedPreview.previewId,
        ),
    );
  const otherBusy = Object.entries(operations).filter(
    /**
     * 检查取值的label且标识不等于当前值的activeId，供集合筛选或定位使用。
     *
     * @param options - 按顺序解构的当前条目。
     * @param options.id - 唯一标识，用于查找、更新和建立引用。
     * @param options.value - 当前字段、模式或控件的取值。
     * @returns 用于判断条件的值；真值表示该条目符合条件。
     */
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
      onKeyDown={
        /** 响应 onKeyDown 交互，将用户操作应用到设计助手对话面板。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
        (event) => event.stopPropagation()
      }
    >
      <header className="ac-header">
        <div className="ac-agent-brand">
          <RinAvatar size={36} />
          <div className="ac-brand-copy">
            <strong>
              凛 <span>Rin</span>
            </strong>
            <RinTaskActivity running={busy} label={busy ? '正在处理你的设计' : '你的设计搭档'} />
          </div>
        </div>
        <div>
          <IconButton
            label="历史对话"
            onClick={
              /** 响应 onClick 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
              () => setHistoryOpen(true)
            }
          >
            <History size={15} />
          </IconButton>
          <IconButton
            label="新建对话"
            onClick={
              /** 响应 onClick 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
              () => void newChat()
            }
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
              <span>{session?.title ?? '新对话'}</span>
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="ac-session-menu">
            <DropdownMenuLabel>
              {project ? `${project.name}的对话` : '工作空间对话'}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={
                /** 响应 onSelect 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
                () => void newChat()
              }
            >
              <Plus size={14} />
              新建对话
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="ac-session-list">
              {current.sessions.map(
                /**
                 * 转换设计助手对话面板中的集合条目，供后续处理或展示。
                 *
                 * @param item - 当前遍历的条目。
                 * @returns 当前条目转换后的结果。
                 */
                (item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={
                      /** 响应 onSelect 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
                      () => void selectSession(item.id)
                    }
                  >
                    <MessageSquare size={13} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {new Date(item.updatedAt).toLocaleDateString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                        })}{' '}
                        · {item.messageCount} 条消息
                      </small>
                    </span>
                    {item.id === current.activeId && <Check size={13} />}
                  </DropdownMenuItem>
                ),
              )}
              {!current.sessions.length && <p>还没有历史对话</p>}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="ac-scope-label">{project ? '项目对话' : '工作空间'}</span>
      </div>
      {subject && (
        <button
          className="ac-project-context"
          onClick={
            /** 响应 onClick 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
            () => void openProject(subject.id)
          }
        >
          <span className="ac-project-dot" style={{ background: subject.tokens.primary }} />
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
        onScroll={
          /**
           * 响应 onScroll 交互，将用户操作应用到设计助手对话面板。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          () => {
            const element = scrollRef.current;
            if (element) {
              if (!renderedMessages.length) {
                followBottom.current = true;
                setHasScroll(false);
                return;
              }
              followBottom.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < 80;
              setHasScroll(!followBottom.current);
            }
          }
        }
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
              <h2>{project ? '和凛继续设计' : '和凛一起，从想法开始'}</h2>
              <p>
                {project
                  ? '描述你想修改的页面、组件或样式。'
                  : '创建项目、设计页面，或整理设计规范。'}
              </p>
            </div>
            <div className="ac-quick-prompts">
              {quickPrompts.map(
                /**
                 * 转换设计助手对话面板中的集合条目，供后续处理或展示。
                 *
                 * @param item - 当前遍历的条目。
                 * @param index - 空间查询索引或当前条目的位置。
                 * @returns 当前条目转换后的结果。
                 */
                (item, index) => (
                  <motion.button
                    key={item.title}
                    className={pickedPrompt === item.title ? 'is-picked' : undefined}
                    onClick={
                      /**
                       * 响应 onClick 交互，将用户操作应用到设计助手对话面板。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      () => {
                        setPrompt(item.prompt);
                        setPickedPrompt(item.title);
                      }
                    }
                    initial={reducedMotion ? false : { opacity: 0, y: expressive ? 10 : 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...uiTransition,
                      delay: reducedMotion ? 0 : index * (expressive ? 0.045 : 0.02),
                    }}
                    whileHover={reducedMotion ? undefined : { y: expressive ? -3 : -1 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  >
                    <AnimatePresence>
                      {pickedPrompt === item.title && (
                        <motion.span
                          className="ac-task-pick"
                          initial={reducedMotion ? false : { opacity: 0, scale: 0.7 }}
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
                    <span className="ac-task-description">{item.description}</span>
                    <ArrowRight size={13} />
                  </motion.button>
                ),
              )}
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
          {renderedMessages.map(
            /**
             * 转换设计助手对话面板中的集合条目，供后续处理或展示。
             *
             * @param message - 面向用户或调用方的说明消息。
             * @returns 当前条目转换后的结果。
             */
            (message) => (
              <motion.article
                key={message.id}
                className={`ac-message ac-message-${message.role} ${message.status === 'failed' ? 'is-failed' : ''}`}
                initial={{
                  opacity: reducedMotion ? 1 : 0,
                  y: reducedMotion ? 0 : expressive ? 10 : 2,
                }}
                animate={{ opacity: 1, y: 0 }}
                transition={uiTransition}
              >
                <div className="ac-message-author">
                  {message.role === 'assistant' ? (
                    <RinAvatar size={24} className="ac-assistant-mark" />
                  ) : (
                    <span className="ac-user-mark">我</span>
                  )}
                  <strong>{message.role === 'assistant' ? '凛' : '你'}</strong>
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  {message.status === 'pending' && (
                    <span className="ac-message-pending">发送中</span>
                  )}
                </div>
                {message.content && <MessageText content={message.content} />}
                {!!message.actions?.length && (
                  <div className="ac-action-timeline" aria-label="执行记录">
                    {message.actions.map(renderAction)}
                  </div>
                )}
                {message.role === 'assistant' && message.content && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ac-message-copy"
                    aria-label="复制回答"
                    onClick={
                      /**
                       * 响应 onClick 交互，将用户操作应用到设计助手对话面板。
                       * @returns 当前步骤的处理结果。
                       */
                      () =>
                        navigator.clipboard
                          .writeText(message.content)
                          .then(
                            /** 在设计助手对话面板的异步步骤结束后处理结果。 @returns 当前步骤的处理结果。 */
                            () => setToast('回答已复制'),
                          )
                          .catch(
                            /** 处理设计助手对话面板中的异步失败，按当前流程决定回退或继续抛出。 @returns 当前步骤的处理结果。 */
                            () => setToast('无法访问剪贴板'),
                          )
                    }
                  >
                    <Copy size={12} />
                  </Button>
                )}
              </motion.article>
            ),
          )}
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
                  {operation?.label ?? (otherBusy ? '另一个对话正在处理' : '正在准备对话')}
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
                onClick={
                  /**
                   * 响应 onClick 交互，将用户操作应用到设计助手对话面板。
                   * @returns 无返回值；通过副作用完成当前操作。
                   */
                  () => {
                    if (current.activeId)
                      void loadSession(current.activeId, scope)
                        .then(
                          /**
                           * 在设计助手对话面板的异步步骤结束后处理结果。
                           * @returns 无返回值；通过副作用完成当前操作。
                           */
                          () => {
                            const id = current.activeId!;
                            setOperations(
                              /** 基于最新状态计算 Operations 的下一份值，避免连续更新时读到旧状态。 @param states - 按标识索引的状态集合。 @returns 供 React 保存的新状态。 */
                              (states) => ({
                                ...states,
                                [id]: { label: '' },
                              }),
                            );
                            mutateScope(
                              scope,
                              /** 执行设计助手对话面板传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
                              (state) => ({
                                ...state,
                                error: '',
                              }),
                            );
                            setToast('会话已刷新');
                          },
                        )
                        .catch(
                          /** 处理设计助手对话面板中的异步失败，按当前流程决定回退或继续抛出。 @param error - 当前操作的失败信息，供界面反馈或重试判断。 @returns 当前步骤的处理结果。 */
                          (error) => setToast(error.message),
                        );
                    else void loadScope(scope, project?.id);
                  }
                }
              >
                刷新会话
                <RefreshCw size={12} />
              </Button>
            </div>
          </div>
        )}
        {subject?.generation?.imageUrl && (
          <ReconstructionProgress
            projectId={subject.id}
            sourceImageUrl={subject.generation.imageUrl}
            active={busy}
          />
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
          onClick={
            /**
             * 响应 onClick 交互，将用户操作应用到设计助手对话面板。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {
              followBottom.current = true;
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: reducedMotion ? 'instant' : 'smooth',
              });
            }
          }
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
        <motion.div className={`ac-composer ${busy ? 'is-busy' : ''}`} transition={uiTransition}>
          <Textarea
            ref={composerRef}
            aria-label="发送给凛的消息"
            placeholder={project ? '描述需要修改的内容…' : '描述你的任务…'}
            value={current.draft}
            onChange={
              /**
               * 响应 onChange 交互，将用户操作应用到设计助手对话面板。
               *
               * @param event - 当前事件及其触发位置。
               * @returns 当前步骤的处理结果。
               */
              (event) =>
                mutateScope(
                  scope,
                  /** 执行设计助手对话面板传入的局部处理步骤，使调用处能够控制结果如何更新。 @param state - 当前操作所依赖的完整状态。 @returns 当前步骤的处理结果。 */
                  (state) => ({
                    ...state,
                    draft: event.target.value,
                  }),
                )
            }
            onKeyDown={
              /**
               * 响应 onKeyDown 交互，将用户操作应用到设计助手对话面板。
               *
               * @param event - 当前事件及其触发位置。
               * @returns 无返回值；通过副作用完成当前操作。
               */
              (event) => {
                event.stopPropagation();
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (!busy && settings.configured && current.draft.trim()) void run(current.draft);
                }
              }
            }
          />
          <div className="ac-composer-toolbar">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="ac-context-button">
                  <span className="ac-context-symbol">@</span>
                  {subject ? '项目上下文' : '工作空间'}
                  <ChevronDown size={10} />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="ac-context-popover">
                <h4>{subject?.name ?? '工作空间上下文'}</h4>
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
                        {subject.pages.length} /{' '}
                        {subject.pages.reduce(
                          /** 累积设计助手对话面板中的条目结果，供后续计算使用。 @param sum - 累加到当前项之前的结果。 @param p - 当前坐标点或内容片段。 @returns 纳入当前条目后的累计结果。 */
                          (sum, p) => sum + p.nodes.length,
                          0,
                        )}
                      </dd>
                      <dt>工作空间</dt>
                      <dd>
                        {subject.workspace?.kind === 'github'
                          ? 'GitHub'
                          : subject.workspace
                            ? '本地目录'
                            : '未绑定'}
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
              <span>{busy ? '处理中' : '↵ 发送'}</span>
              <Button
                className="ac-send"
                size="icon"
                aria-label="发送消息"
                disabled={!settings.configured || busy || !current.draft.trim()}
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
                  () => void run(current.draft)
                }
              >
                {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowUp size={16} />}
              </Button>
            </div>
          </div>
        </motion.div>
        <div className="ac-footer-meta">
          <button
            onClick={
              /** 响应 onClick 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
              () => setSwitchingModel(true)
            }
            disabled={busy}
            title={settings.textModel || '选择模型'}
          >
            <span className={settings.configured ? 'connected' : ''} />
            更换模型
            <em>{settings.configured ? settings.textModel : '未连接'}</em>
            <ChevronDown size={10} />
          </button>
          <span>
            <kbd>Enter</kbd> 发送 · <kbd>Shift ↵</kbd> 换行
          </span>
        </div>
      </footer>
      {switchingModel && (
        <ModelSwitcher
          settings={settings}
          onSettings={onProviderSettings}
          onClose={
            /** 响应 onClose 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
            () => setSwitchingModel(false)
          }
          onManage={
            /**
             * 响应 onManage 交互，将用户操作应用到设计助手对话面板。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {
              setSwitchingModel(false);
              onSettings();
            }
          }
        />
      )}
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
      <ReferenceImagePreview
        image={imagePreview}
        onClose={
          /** 响应 onClose 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
          () => setImagePreview(undefined)
        }
      />
      <Dialog
        open={!!review}
        onOpenChange={
          /** 响应 onOpenChange 交互，将用户操作应用到设计助手对话面板。 @param open - 弹层或面板当前是否打开。 @returns 当前步骤的处理结果。 */
          (open) => !open && !reviewBusy && setReview(undefined)
        }
      >
        <DialogContent className="ac-review-dialog">
          <DialogHeader>
            <DialogTitle>检查代码同步</DialogTitle>
            <DialogDescription>
              设计 v{reviewedPreview?.revision} · 仅写入绑定工作空间中的 forma-generated/ 目录
            </DialogDescription>
          </DialogHeader>
          {reviewedPreview && (
            <>
              <div className="ac-review-layout">
                <nav>
                  {reviewedPreview.files.map(
                    /**
                     * 转换设计助手对话面板中的集合条目，供后续处理或展示。
                     *
                     * @param file - 需要读取、写入或导入的文件。
                     * @returns 当前条目转换后的结果。
                     */
                    (file) => (
                      <button
                        key={file.path}
                        className={reviewedFile?.path === file.path ? 'selected' : ''}
                        onClick={
                          /**
                           * 响应 onClick 交互，将用户操作应用到设计助手对话面板。
                           * @returns 当前步骤的处理结果。
                           */
                          () =>
                            setReview(
                              /** 基于最新状态计算 Review 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
                              (current) => (current ? { ...current, file: file.path } : current),
                            )
                        }
                      >
                        <span className={`ac-file-status ${file.status}`}>
                          {
                            (
                              {
                                added: 'A',
                                modified: 'M',
                                unchanged: '–',
                                conflict: '!',
                              } as const
                            )[file.status]
                          }
                        </span>
                        <span>{file.path}</span>
                      </button>
                    ),
                  )}
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
                  存在 {reviewedPreview.conflicts.length} 个冲突，请在同步工作台处理后重新预览。
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
                    onCheckedChange={
                      /**
                       * 响应 onCheckedChange 交互，将用户操作应用到设计助手对话面板。
                       *
                       * @param checked - 复选控件当前是否选中。
                       * @returns 当前步骤的处理结果。
                       */
                      (checked) =>
                        setReview(
                          /** 基于最新状态计算 Review 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
                          (current) =>
                            current ? { ...current, checked: checked === true } : current,
                        )
                    }
                  />
                  <span>我已检查 v{reviewedPreview.revision} 的生成文件，同意同步这些更改。</span>
                </label>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={reviewBusy}
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到设计助手对话面板。 @returns 当前步骤的处理结果。 */
                    () => setReview(undefined)
                  }
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
                      /** 检查 file 的状态等于“unchanged”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                      (file) => file.status === 'unchanged',
                    )
                  }
                  onClick={
                    /**
                     * 响应 onClick 交互，将用户操作应用到设计助手对话面板。
                     * @returns 无返回值；通过副作用完成当前操作。
                     */
                    () => {
                      if (review?.action.projectId)
                        void run(
                          undefined,
                          {
                            type: 'apply_sync',
                            projectId: review.action.projectId,
                            revision: reviewedPreview.revision,
                            previewId: reviewedPreview.previewId,
                          },
                          { sessionId: review.sessionId, scope: review.scope },
                        );
                    }
                  }
                >
                  {reviewBusy ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {reviewApplied ? '已同步' : `确认同步 v${reviewedPreview.revision}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.aside>
  );
}
