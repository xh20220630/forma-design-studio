import type { View } from '../../../shared/types/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatePresence, motion } from 'motion/react';
import { useStudioMotion } from '../../../shared/lib/motion';
import { RinAvatar, RinIcon, RinIllustration } from '../../../shared/ui/brand/RinBrand';
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Component,
  Copy,
  Download,
  Eye,
  EyeOff,
  Frame,
  Group,
  Hand,
  History,
  ImagePlus,
  Layers,
  LockKeyhole,
  Maximize,
  MessageCircle,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  Pencil,
  Play,
  Plus,
  Redo2,
  Search,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Ungroup,
  UnlockKeyhole,
  Upload,
} from 'lucide-react';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@forma/ui/tabs';
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@forma/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@forma/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@forma/ui/tooltip';
import type { DesignComponent, DesignNode, DesignPage, NodeType, Project } from '@forma/schema';
import { getNodeStyle, getProjectTokens, NodeView, resolveNode } from '@forma/renderer';
import { CanvasRenderer, type CanvasRendererHandle } from '@forma/renderer/canvas';
import { booleanNodes, type BooleanOperation } from '@forma/editor-core/boolean';
import {
  applyAutoLayout,
  boundsOf,
  cloneNodes,
  containers,
  descendants,
  moveNodes,
  scalePath,
  resizeNodes,
  rootSelection,
  uid,
} from '@forma/editor-core/geometry';
import Inspector from './Inspector';
import PrototypePreview from './PrototypePreview';
import VirtualLayerList from './VirtualLayerList';
import CanvasRulers from './CanvasRulers';
import CanvasEmptyState from './CanvasEmptyState';
import { useCanvasViewport } from '../hooks/useCanvasViewport';
import '../styles/editor.css';
import '../styles/canvas-workspace.css';

/** DesignEditor 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /** 首次打开编辑器时应显示的页面标识。 */
  initialPageId?: string;
  /** 是否只允许浏览，禁止提交设计修改。 */
  readOnly?: boolean;
  /** 聊天面板是否打开。 */
  chatOpen?: boolean;
  /**
   * 在切换页面时通知调用方，由外层决定如何更新业务状态。
   * @param pageId - 目标页面的唯一标识。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onPageChange?: (pageId: string) => void;
  /**
   * 在导航时通知调用方，由外层决定如何更新业务状态。
   * @param view - 当前视图或画布相机参数。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onNavigate?: (view: View) => void;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param project - 当前设计项目或工作空间项目元信息。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (project: Project) => void;
  /**
   * 在返回时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onBack: () => void;
  /**
   * 在打开助手时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onOpenAgent: () => void;
  /**
   * 在同步时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSync: () => void;
  /**
   * 在主题修改时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onTheme?: () => void;
  /** 保存流程当前所处阶段。取值：saved（已保存）、saving（保存中）、pending（等待处理）、error（阻断错误）。 */
  saveState?: 'saved' | 'saving' | 'pending' | 'error';
}
/**
 * 画布工具，集中定义允许的分支以保持调用方一致。
 * 取值：select（选择工具）、hand（平移工具）、frame（画框）、section（分区）、rectangle（矩形）、ellipse（椭圆）、line（线段）、polygon（多边形）、star（星形）、pen（钢笔路径）、pencil（自由绘制）、text（文字）、button（按钮）、comment（定位评论）。
 */
type Tool =
  | 'select'
  | 'hand'
  | 'frame'
  | 'section'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'star'
  | 'pen'
  | 'pencil'
  | 'text'
  | 'button'
  | 'comment';
/** 从指针按下到释放之间的画布交互快照，避免移动时累积计算误差。 */
interface Interaction {
  /** 用于区分数据形态或行为分支的类型。取值：move（移动）、resize（调整尺寸）、pan、draw（绘制）、marquee（框选）、pencil（自由绘制）、point（路径顶点）。 */
  type: 'move' | 'resize' | 'pan' | 'draw' | 'marquee' | 'pencil' | 'point';
  /** 指针操作开始时的水平位置。 */
  startX: number;
  /** 指针操作开始时的垂直位置。 */
  startY: number;
  /** 指针操作开始前的完整设计快照。 */
  startProject: Project;
  /** 按约定顺序保存的设计节点集合。 */
  nodes: DesignNode[];
  /** 参与当前操作的对象标识集合。 */
  ids: string[];
  /** 水平方向的滚动偏移。 */
  scrollX?: number;
  /** 垂直方向的滚动偏移。 */
  scrollY?: number;
  /** 当前拖动的尺寸调整手柄。 */
  handle?: string;
  /** 本次绘制创建的临时节点。 */
  newNode?: DesignNode;
  /** 设计坐标系中的水平位置。 */
  worldX?: number;
  /** 设计坐标系中的垂直位置。 */
  worldY?: number;
  /** 当前编辑的路径顶点序号。 */
  pointIndex?: number;
  /** 本次交互中一起移动的节点标识。 */
  movingIds?: Set<string>;
  /** 吸附计算使用的候选边界或坐标。 */
  snapTargets?: {
    /** 用于布局、查询或素材定位的矩形范围。 */
    bounds: ReturnType<typeof boundsOf>;
    /** 水平方向的候选坐标集合。 */
    xs: number[];
    /** 垂直方向的候选坐标集合。 */
    ys: number[];
  };
}
const nodeNames: Record<NodeType, string> = {
  frame: '画框',
  section: '分区',
  group: '编组',
  rectangle: '矩形',
  ellipse: '椭圆',
  line: '直线',
  polygon: '多边形',
  star: '星形',
  path: '路径',
  text: '文本',
  button: '按钮',
  image: '图片',
  component: '组件',
};
const nodeIcons = {
  frame: Frame,
  section: Frame,
  group: Group,
  rectangle: Square,
  ellipse: Circle,
  line: Minus,
  polygon: Triangle,
  star: Star,
  path: PenTool,
  text: Type,
  button: Square,
  image: ImagePlus,
  component: Component,
};
/**
 * 沿父链检查锁定状态，防止通过子节点绕过父容器的锁定。
 *
 * @param node - 当前处理的设计节点。
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @returns 节点或其祖先是否被锁定。
 */
function lockedNode(node: DesignNode, nodes: DesignNode[]) {
  let current: DesignNode | undefined = node;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current.locked) return true;
    visited.add(current.id);
    current = nodes.find((item) => item.id === current!.parentId);
  }
  return false;
}
const toolInfo: {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: Tool;
  /** 当前控件使用的图标。 */
  icon: typeof Square;
  /** 面向用户展示的名称。 */
  name: string;
  /** 要访问或更新的字段名。 */
  key: string;
}[] = [
  { id: 'select', icon: MousePointer2, name: '选择', key: 'V' },
  { id: 'hand', icon: Hand, name: '移动画布', key: 'H' },
  { id: 'frame', icon: Frame, name: '画框', key: 'F' },
  { id: 'rectangle', icon: Square, name: '矩形', key: 'R' },
  { id: 'pen', icon: PenTool, name: '钢笔', key: 'P' },
  { id: 'text', icon: Type, name: '文本', key: 'T' },
  { id: 'comment', icon: MessageCircle, name: '评论', key: 'C' },
];
const alternateTools: Partial<
  Record<
    Tool,
    {
      /** 当前分组或编组节点。 */
      group: Tool;
      /** 当前控件使用的图标。 */
      icon: typeof Square;
      /** 面向用户展示的名称。 */
      name: string;
      /** 要访问或更新的字段名。 */
      key: string;
    }
  >
> = {
  ellipse: { group: 'rectangle', icon: Circle, name: '椭圆', key: 'O' },
  line: { group: 'rectangle', icon: Minus, name: '直线', key: 'L' },
  polygon: { group: 'rectangle', icon: Triangle, name: '多边形', key: '' },
  star: { group: 'rectangle', icon: Star, name: '星形', key: '' },
  button: { group: 'rectangle', icon: Square, name: '按钮', key: '' },
  section: { group: 'frame', icon: Frame, name: '分区', key: 'S' },
  pencil: { group: 'pen', icon: Pencil, name: '铅笔', key: 'Shift P' },
};
const shortcuts = [
  ['选择 / 移动画布', 'V / H / 空格'],
  ['画框 / 矩形 / 椭圆', 'F / R / O'],
  ['钢笔 / 铅笔 / 文本', 'P / Shift P / T'],
  ['添加评论', 'C'],
  ['复制 / 粘贴 / 副本', 'Ctrl C / V / D'],
  ['编组 / 取消编组', 'Ctrl G / Ctrl Shift G'],
  ['创建组件', 'Ctrl Alt K'],
  ['撤销 / 重做', 'Ctrl Z / Ctrl Shift Z'],
  ['适应画布 / 所选', 'Shift 1 / Shift 2'],
  ['显示网格 / 标尺', 'Shift G / Shift R'],
  ['锁定 / 隐藏图层', 'Ctrl Shift L / H'],
  ['微调 / 快速移动', '方向键 / Shift'],
  ['等比绘制 / 取消吸附', 'Shift / Alt'],
  ['完成钢笔路径', 'Enter / 双击'],
  ['删除 / 取消', 'Delete / Esc'],
];
/**
 * 呈现编辑器工具按钮，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.title - 界面显示的标题。
 * @param props.children - 由调用方放入组件的子内容。
 * @param props.onClick - 在点击时通知调用方，由外层决定如何更新业务状态。
 * @param props.active - 是否处于激活状态。
 * @param props.disabled - 是否禁止用户操作。
 * @returns 供 React 渲染的界面内容。
 */
function ToolButton({
  title,
  children,
  onClick,
  active,
  disabled,
}: {
  /** 界面显示的标题。 */
  title: string;
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
  /**
   * 在点击时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClick: () => void;
  /** 是否处于激活状态。 */
  active?: boolean;
  /** 是否禁止用户操作。 */
  disabled?: boolean;
}) {
  const { reduced: reducedMotion, expressive, transition: uiTransition } = useStudioMotion();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={active ? 'is-active' : ''}
          aria-label={title}
          aria-pressed={active === undefined ? undefined : active}
          onClick={onClick}
          disabled={disabled}
        >
          <AnimatePresence initial={false}>
            {active && (
              <motion.span
                className="ed-tool-active-surface"
                layoutId={reducedMotion ? undefined : 'rin-editor-tool'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={uiTransition}
              />
            )}
          </AnimatePresence>
          <motion.span
            className="ed-tool-glyph"
            whileHover={reducedMotion ? undefined : { y: expressive ? -2 : -1 }}
            whileTap={reducedMotion ? undefined : { scale: 0.9 }}
            animate={{
              scale: active && !reducedMotion ? (expressive ? 1.1 : 1.04) : 1,
            }}
            transition={uiTransition}
          >
            {children}
          </motion.span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}

/**
 * 呈现设计画布编辑器，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.initialPageId - 首次打开编辑器时应显示的页面标识。
 * @param props.readOnly - 是否只允许浏览，禁止提交设计修改。
 * @param props.chatOpen - 聊天面板是否打开。
 * @param props.onPageChange - 在切换页面时通知调用方，由外层决定如何更新业务状态。
 * @param props.onNavigate - 在导航时通知调用方，由外层决定如何更新业务状态。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.onBack - 在返回时通知调用方，由外层决定如何更新业务状态。
 * @param props.onOpenAgent - 在打开助手时通知调用方，由外层决定如何更新业务状态。
 * @param props.onSync - 在同步时通知调用方，由外层决定如何更新业务状态。
 * @param props.onTheme - 在主题修改时通知调用方，由外层决定如何更新业务状态。
 * @param props.saveState - 保存流程当前所处阶段。
 * @returns 供 React 渲染的界面内容。
 */
export default function DesignEditor({
  project: persistedProject,
  initialPageId,
  readOnly = false,
  chatOpen = false,
  onPageChange,
  onNavigate,
  onChange,
  onBack,
  onOpenAgent,
  onSync,
  onTheme,
  saveState,
}: Props) {
  /** 界面状态：正在交互中预览、尚未正式提交的项目。通过状态更新驱动界面刷新。 */
  const [draftProject, setDraftProject] = useState<Project>();
  const project = draftProject ?? persistedProject;
  const { reduced: reducedMotion, expressive, transition: uiTransition } = useStudioMotion();
  /** 界面状态：是否因可用宽度不足而采用紧凑编辑布局。通过状态更新驱动界面刷新。 */
  const [compactWorkspace, setCompactWorkspace] = useState(
    () => window.matchMedia('(max-width: 1500px)').matches,
  );
  /** 界面状态：用户对图层侧栏显示方式的偏好。通过状态更新驱动界面刷新。 */
  const [layersPreference, setLayersPreference] = useState<boolean | null>(null);
  /** 界面状态：属性检查面板是否可见。通过状态更新驱动界面刷新。 */
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const layersCollapsed = layersPreference ?? (chatOpen && compactWorkspace);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1500px)');
    const update = () => setCompactWorkspace(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  /** 界面状态：目标页面的唯一标识。通过状态更新驱动界面刷新。 */
  const [pageId, setPageId] = useState(initialPageId ?? project.pages[0]?.id ?? '');
  useEffect(() => {
    onPageChange?.(pageId);
  }, [pageId, onPageChange]);
  /** 界面状态：当前选中节点的标识列表。通过状态更新驱动界面刷新。 */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** 界面状态：当前选择的画布工具。通过状态更新驱动界面刷新。 */
  const [tool, setTool] = useState<Tool>('select');
  /** 界面状态：当前面板选中的标签。通过状态更新驱动界面刷新。 */
  const [activeTab, setActiveTab] = useState('layers');
  /** 界面状态：触发搜索框聚焦的更新标记。通过状态更新驱动界面刷新。 */
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);
  const handledSearchFocus = useRef(0);
  /** 界面状态：用于筛选列表的搜索文本。通过状态更新驱动界面刷新。 */
  const [search, setSearch] = useState('');
  /** 界面状态：已折叠的分组或节点集合。通过状态更新驱动界面刷新。 */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  /** 界面状态：可供撤销的项目快照栈。通过状态更新驱动界面刷新。 */
  const [history, setHistory] = useState<Project[]>([]);
  /** 界面状态：撤销后可供重做的项目快照栈。通过状态更新驱动界面刷新。 */
  const [future, setFuture] = useState<Project[]>([]);
  /** 界面状态：当前编辑操作的提示内容。通过状态更新驱动界面刷新。 */
  const [notice, setNotice] = useState('');
  /** 界面状态：空格键是否按住，用于临时切换平移模式。通过状态更新驱动界面刷新。 */
  const [spaceDown, setSpaceDown] = useState(false);
  /** 界面状态：是否显示画布标尺。通过状态更新驱动界面刷新。 */
  const [showRulers, setShowRulers] = useState(true);
  /** 界面状态：是否启用位置吸附。通过状态更新驱动界面刷新。 */
  const [snap, setSnap] = useState(true);
  /** 界面状态：是否显示快捷键帮助。通过状态更新驱动界面刷新。 */
  const [showShortcuts, setShowShortcuts] = useState(false);
  /** 界面状态：是否显示版本快照面板。通过状态更新驱动界面刷新。 */
  const [showVersions, setShowVersions] = useState(false);
  /** 界面状态：准备保存的设计快照名称。通过状态更新驱动界面刷新。 */
  const [snapshotName, setSnapshotName] = useState('');
  /** 界面状态：当前预览数据或原型预览状态。通过状态更新驱动界面刷新。 */
  const [preview, setPreview] = useState(false);
  const canvasRendererRef = useRef<CanvasRendererHandle>(null);
  /** 界面状态：指针悬停的图层标识。通过状态更新驱动界面刷新。 */
  const [hoveredNodeId, setHoveredNodeId] = useState<string>();
  /** 界面状态：正在通过文本编辑框修改的节点 ID。通过状态更新驱动界面刷新。 */
  const [editingText, setEditingText] = useState<string>();
  /** 界面状态：文字编辑框中尚未提交的内容。通过状态更新驱动界面刷新。 */
  const [textDraft, setTextDraft] = useState('');
  /** 界面状态：当前正在编辑顶点的矢量路径。通过状态更新驱动界面刷新。 */
  const [editingPath, setEditingPath] = useState<string>();
  /** 界面状态：正在拖动的框选区域。通过状态更新驱动界面刷新。 */
  const [marquee, setMarquee] = useState<{
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
    /** 对象的宽度。 */
    width: number;
    /** 对象的高度。 */
    height: number;
  }>();
  /** 界面状态：手动或自动生成的对齐辅助线。通过状态更新驱动界面刷新。 */
  const [guides, setGuides] = useState<
    {
      /** 辅助线或计算所沿用的坐标轴。取值：x、y。 */
      axis: 'x' | 'y';
      /** 当前字段、模式或控件的取值。 */
      value: number;
    }[]
  >([]);
  /** 界面状态：根据节点位置生成的临时对齐辅助线。通过状态更新驱动界面刷新。 */
  const [smartGuides, setSmartGuides] = useState<
    {
      /** 辅助线或计算所沿用的坐标轴。取值：x、y。 */
      axis: 'x' | 'y';
      /** 当前字段、模式或控件的取值。 */
      value: number;
    }[]
  >([]);
  /** 界面状态：钢笔工具尚未提交的点序列。通过状态更新驱动界面刷新。 */
  const [penPoints, setPenPoints] = useState<
    {
      /** 水平方向的位置。 */
      x: number;
      /** 垂直方向的位置。 */
      y: number;
    }[]
  >([]);
  /** 界面状态：准备添加评论的画布位置。通过状态更新驱动界面刷新。 */
  const [commentPoint, setCommentPoint] = useState<{
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
  }>();
  /** 界面状态：尚未提交的评论内容。通过状态更新驱动界面刷新。 */
  const [commentDraft, setCommentDraft] = useState('');
  /** 界面状态：是否显示已解决的评论。通过状态更新驱动界面刷新。 */
  const [showResolved, setShowResolved] = useState(false);
  /** 界面状态：当前正在重命名的图层及输入内容。通过状态更新驱动界面刷新。 */
  const [layerRename, setLayerRename] = useState<string>();
  const searchRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null),
    imageRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!searchFocusRequest || layersCollapsed || handledSearchFocus.current === searchFocusRequest)
      return;
    const frame = requestAnimationFrame(() => {
      searchRef.current?.focus();
      handledSearchFocus.current = searchFocusRequest;
    });
    return () => cancelAnimationFrame(frame);
  }, [searchFocusRequest, layersCollapsed]);
  const clipboard = useRef<DesignNode[]>([]),
    interaction = useRef<Interaction | undefined>(undefined),
    projectRef = useRef(project),
    changeRef = useRef(onChange);
  projectRef.current = project;
  changeRef.current = onChange;
  useLayoutEffect(() => {
    interaction.current = undefined;
    projectRef.current = persistedProject;
    setDraftProject(undefined);
  }, [persistedProject, pageId, readOnly]);
  const page = project.pages.find((item) => item.id === pageId) ?? project.pages[0];
  const {
    scrollRef,
    artboardRef,
    zoom,
    zoomTo,
    fit: fitViewport,
    viewport,
    origin,
    stageStyle,
    onScroll,
  } = useCanvasViewport({
    pageKey: `${project.id}:${page?.id ?? ''}`,
    width: page?.width ?? 1440,
    height: page?.height ?? 900,
    // 拖动期间禁止缩放，保持手势使用的坐标基准不变。
    canZoom: () => !interaction.current,
  });
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selection = page?.nodes.filter((node) => selectedIdSet.has(node.id)) ?? [],
    selected = selection[0],
    selectionBounds = boundsOf(selection),
    tokens = getProjectTokens(project);
  const saveLabel =
    saveState === 'error'
      ? '保存失败'
      : saveState === 'saving' || saveState === 'pending'
        ? '正在保存…'
        : '已保存';
  const announce = (message: string) => setNotice(message);
  const booleanOperation = (operation: BooleanOperation) => {
    try {
      const result = booleanNodes(page.nodes, selectedIds, operation, (node) =>
        resolveNode(node, project),
      );
      updatePage({ nodes: result.nodes });
      setSelectedIds([result.selectedId]);
      announce('布尔运算已完成');
    } catch (error) {
      announce(error instanceof Error ? error.message : '布尔运算失败');
    }
  };
  // 逐帧拖动只更新临时设计，结束手势时再写入撤销历史。
  const previewProject = useCallback((next: Project) => {
    projectRef.current = next;
    setDraftProject(next);
  }, []);
  const publish = useCallback((next: Project) => {
    setDraftProject(undefined);
    projectRef.current = next;
    changeRef.current(next);
  }, []);
  // 一次提交只记录一份操作前快照，让一次用户操作对应一次撤销。
  const commit = useCallback(
    (next: Project, prior = projectRef.current) => {
      if (readOnly) return;
      setHistory((items) => [...items.slice(-79), structuredClone(prior)]);
      setFuture([]);
      publish({
        ...next,
        revision: projectRef.current.revision + 1,
        updatedAt: new Date().toISOString(),
        status: 'in-progress',
      });
    },
    [publish, readOnly],
  );
  const updatePage = (patch: Partial<DesignPage>) =>
    commit({
      ...project,
      pages: project.pages.map((item) => (item.id === page.id ? { ...item, ...patch } : item)),
    });
  const updateNode = (id: string, patch: Partial<DesignNode>) => {
    let nodes = resizeNodes(page.nodes, id, patch);
    const node = nodes.find((item) => item.id === id);
    if (node?.parentId && ['width', 'height', 'visible', 'parentId'].some((key) => key in patch))
      nodes = applyAutoLayout(nodes, node.parentId);
    updatePage({ nodes });
  };
  // 旋转或翻转只作用于选区根节点，避免父子节点被重复变换。
  const updateSelected = (patch: Partial<DesignNode>) => {
    const ids = ['rotation', 'flipX', 'flipY'].some((key) => key in patch)
      ? rootSelection(page.nodes, selectedIds)
      : selectedIds;
    updatePage({
      nodes: page.nodes.map((node) => (ids.includes(node.id) ? { ...node, ...patch } : node)),
    });
  };
  const undo = () => {
    if (readOnly) return;
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((items) => [...items, structuredClone(project)]);
    setHistory((items) => items.slice(0, -1));
    publish({
      ...previous,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    setSelectedIds([]);
  };
  const redo = () => {
    if (readOnly) return;
    const next = future[future.length - 1];
    if (!next) return;
    setHistory((items) => [...items, structuredClone(project)]);
    setFuture((items) => items.slice(0, -1));
    publish({
      ...next,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    setSelectedIds([]);
  };
  // 删除时包含全部后代，避免留下指向已删除父节点的引用。
  const removeSelected = () => {
    const ids = descendants(
      page.nodes,
      selectedIds.filter((id) => !page.nodes.find((n) => n.id === id)?.locked),
    );
    if (!ids.length) return;
    updatePage({
      nodes: page.nodes.filter((node) => !ids.includes(node.id)),
    });
    setSelectedIds([]);
  };
  const duplicate = () => {
    const result = cloneNodes(page.nodes, rootSelection(page.nodes, selectedIds));
    if (!result.nodes.length) return;
    updatePage({ nodes: [...page.nodes, ...result.nodes] });
    setSelectedIds(result.ids);
  };
  const copy = () => {
    const ids = descendants(page.nodes, selectedIds);
    clipboard.current = structuredClone(page.nodes.filter((node) => ids.includes(node.id)));
    if (ids.length) announce(`已复制 ${ids.length} 个图层`);
  };
  // 粘贴时重建 ID 和父子关系，避免副本引用原节点。
  const paste = () => {
    if (!clipboard.current.length) {
      announce('请先复制画布图层');
      return;
    }
    const roots = rootSelection(
        clipboard.current,
        clipboard.current.map((n) => n.id),
      ),
      result = cloneNodes(clipboard.current, roots);
    const copiedIds = new Set(result.nodes.map((n) => n.id));
    result.nodes = result.nodes.map((n) =>
      n.parentId && !copiedIds.has(n.parentId) && !page.nodes.some((p) => p.id === n.parentId)
        ? { ...n, parentId: undefined }
        : n,
    );
    updatePage({ nodes: [...page.nodes, ...result.nodes] });
    setSelectedIds(result.ids);
    clipboard.current = result.nodes;
  };
  const group = () => {
    const ids = rootSelection(page.nodes, selectedIds),
      nodes = page.nodes.filter((n) => ids.includes(n.id));
    if (!nodes.length) return;
    const bounds = boundsOf(nodes),
      id = uid(),
      parentId = nodes.every((n) => n.parentId === nodes[0].parentId)
        ? nodes[0].parentId
        : undefined;
    const groupNode: DesignNode = {
      id,
      name: `编组 ${page.nodes.filter((n) => n.type === 'group').length + 1}`,
      type: 'group',
      ...bounds,
      parentId,
      fill: 'transparent',
    };
    updatePage({
      nodes: [
        groupNode,
        ...page.nodes.map((n) => (ids.includes(n.id) ? { ...n, parentId: id } : n)),
      ],
    });
    setSelectedIds([id]);
  };
  const ungroup = () => {
    const groups = selection.filter((n) => containers.has(n.type));
    if (!groups.length) return;
    const ids = groups.map((n) => n.id),
      children = page.nodes.filter((n) => n.parentId && ids.includes(n.parentId));
    updatePage({
      nodes: page.nodes
        .filter((n) => !ids.includes(n.id))
        .map((n) =>
          n.parentId && ids.includes(n.parentId)
            ? {
                ...n,
                parentId: groups.find((g) => g.id === n.parentId)?.parentId,
              }
            : n,
        ),
    });
    setSelectedIds(children.map((n) => n.id));
  };
  // 置顶或置底时一起移动后代，保持整棵子树的绘制顺序。
  const reorder = (front: boolean) => {
    const ids = descendants(page.nodes, selectedIds),
      picked = page.nodes.filter((n) => ids.includes(n.id)),
      other = page.nodes.filter((n) => !ids.includes(n.id));
    updatePage({
      nodes: front ? [...other, ...picked] : [...picked, ...other],
    });
  };
  const align = (mode: string) => {
    const ids = rootSelection(page.nodes, selectedIds),
      nodes = page.nodes.filter((n) => ids.includes(n.id) && !n.locked);
    if (!nodes.length) return;
    const b =
      nodes.length > 1 ? boundsOf(nodes) : { x: 0, y: 0, width: page.width, height: page.height };
    let result = page.nodes;
    if (mode.startsWith('distribute')) {
      if (nodes.length < 3) return;
      const axis = mode === 'distributeX' ? 'x' : 'y',
        size = axis === 'x' ? 'width' : 'height',
        sorted = [...nodes].sort((a, b) => a[axis] - b[axis]),
        first = sorted[0][axis],
        last = sorted[sorted.length - 1],
        gap =
          (last[axis] + last[size] - first - sorted.reduce((sum, n) => sum + n[size], 0)) /
          (sorted.length - 1);
      let cursor = first;
      for (const n of sorted) {
        result = moveNodes(
          result,
          [n.id],
          axis === 'x' ? cursor - n.x : 0,
          axis === 'y' ? cursor - n.y : 0,
        );
        cursor += n[size] + gap;
      }
    } else
      for (const n of nodes) {
        const x =
            mode === 'left'
              ? b.x
              : mode === 'center'
                ? b.x + (b.width - n.width) / 2
                : mode === 'right'
                  ? b.x + b.width - n.width
                  : n.x,
          y =
            mode === 'top'
              ? b.y
              : mode === 'middle'
                ? b.y + (b.height - n.height) / 2
                : mode === 'bottom'
                  ? b.y + b.height - n.height
                  : n.y;
        result = moveNodes(result, [n.id], x - n.x, y - n.y);
      }
    updatePage({ nodes: result });
  };
  const createComponent = () => {
    const roots = rootSelection(page.nodes, selectedIds),
      ids = descendants(page.nodes, roots),
      nodes = page.nodes.filter((n) => ids.includes(n.id));
    if (!nodes.length) return;
    const bounds = boundsOf(nodes),
      component: DesignComponent = {
        id: uid(),
        name: nodes[0].name,
        description: '从画布创建的可复用组件',
        category: '自定义',
        width: bounds.width,
        height: bounds.height,
        nodes: nodes.map((n) => ({
          ...structuredClone(n),
          x: n.x - bounds.x,
          y: n.y - bounds.y,
          parentId: n.parentId && ids.includes(n.parentId) ? n.parentId : undefined,
        })),
      };
    const instance: DesignNode = {
      id: uid(),
      name: component.name,
      type: 'component',
      ...bounds,
      componentId: component.id,
      parentId: nodes.find((n) => roots.includes(n.id))?.parentId,
    };
    commit({
      ...project,
      components: [...project.components, component],
      pages: project.pages.map((p) =>
        p.id === page.id
          ? {
              ...p,
              nodes: [...p.nodes.filter((n) => !ids.includes(n.id)), instance],
            }
          : p,
      ),
    });
    setSelectedIds([instance.id]);
    announce('已创建主组件与实例');
  };
  const addInstance = (component: DesignComponent) => {
    const node: DesignNode = {
      id: uid(),
      name: component.name,
      type: 'component',
      x: 80,
      y: 80,
      width: component.width,
      height: component.height,
      componentId: component.id,
    };
    updatePage({ nodes: [...page.nodes, node] });
    setSelectedIds([node.id]);
  };
  const detach = () => {
    if (!selected?.componentId) return;
    const component = project.components.find((c) => c.id === selected.componentId);
    if (!component) return;
    const idMap = new Map(component.nodes.map((n) => [n.id, uid()])),
      sx = selected.width / component.width,
      sy = selected.height / component.height,
      scale = Math.min(sx, sy);
    const nodes = component.nodes.map((input) => {
      const override = selected.overrides?.[input.id],
        resolved = resolveNode(input, project),
        n = { ...resolved, ...override };
      const tokenBindings = { ...n.tokenBindings },
        variableBindings = { ...n.variableBindings };
      const geometryKeys = [
        'x',
        'y',
        'width',
        'height',
        'fontSize',
        'radius',
        'strokeWidth',
        'blur',
        'padding',
        'paddingX',
        'paddingY',
        'gap',
      ];
      for (const key of [...geometryKeys, ...Object.keys(override ?? {})]) {
        delete tokenBindings[key];
        delete variableBindings[key];
      }
      return {
        ...n,
        id: idMap.get(n.id)!,
        parentId: n.parentId ? idMap.get(n.parentId) : selected.id,
        x: selected.x + n.x * sx,
        y: selected.y + n.y * sy,
        width: n.width * sx,
        height: n.height * sy,
        fontSize: n.fontSize !== undefined ? n.fontSize * scale : undefined,
        radius: n.radius !== undefined ? n.radius * scale : undefined,
        strokeWidth: n.strokeWidth !== undefined ? n.strokeWidth * scale : undefined,
        blur: n.blur !== undefined ? n.blur * scale : undefined,
        padding: n.padding !== undefined ? n.padding * scale : undefined,
        paddingX: n.paddingX !== undefined ? n.paddingX * sx : undefined,
        paddingY: n.paddingY !== undefined ? n.paddingY * sy : undefined,
        points: n.points?.map((p) => ({ x: p.x * sx, y: p.y * sy })),
        path: n.path ? scalePath(n.path, sx, sy) : undefined,
        shadow: n.shadow
          ? {
              ...n.shadow,
              x: n.shadow.x * sx,
              y: n.shadow.y * sy,
              blur: n.shadow.blur * scale,
              spread: n.shadow.spread * scale,
            }
          : undefined,
        gradient: override?.fill !== undefined ? undefined : n.gradient,
        tokenBindings,
        variableBindings,
      };
    });
    updatePage({
      nodes: page.nodes.flatMap((n) =>
        n.id === selected.id
          ? [
              {
                ...n,
                type: 'group' as const,
                componentId: undefined,
                overrides: undefined,
              },
              ...nodes,
            ]
          : [n],
      ),
    });
    announce(
      Math.abs(sx - sy) > 0.001
        ? '已分离实例；非等比缩放的文字与效果采用较小缩放比例'
        : '已分离为可编辑图层',
    );
  };
  const addPage = () => {
    const next: DesignPage = {
      id: uid(),
      name: `页面 ${project.pages.length + 1}`,
      width: 1440,
      height: 1000,
      nodes: [],
    };
    commit({ ...project, pages: [...project.pages, next] });
    setPageId(next.id);
  };
  // 复制页面时重建图层标识，避免副本和原页面共享引用。
  const duplicatePage = () => {
    const result = cloneNodes(
        page.nodes,
        rootSelection(
          page.nodes,
          page.nodes.map((n) => n.id),
        ),
        0,
      ),
      next = {
        ...structuredClone(page),
        id: uid(),
        name: `${page.name} 副本`,
        nodes: result.nodes,
      };
    commit({ ...project, pages: [...project.pages, next] });
    setPageId(next.id);
  };
  const deletePage = () => {
    if (project.pages.length < 2) {
      announce('至少保留一个页面');
      return;
    }
    const pages = project.pages.filter((p) => p.id !== page.id);
    commit({ ...project, pages });
    setPageId(pages[0].id);
  };
  const fit = (selectedOnly = false) => {
    if (interaction.current) return;
    fitViewport(selectedOnly && selection.length ? boundsOf(selection) : undefined);
  };
  const worldPoint = (clientX: number, clientY: number) => {
    const rect = artboardRef.current?.getBoundingClientRect();
    return {
      x: (clientX - (rect?.left ?? 0)) / zoom,
      y: (clientY - (rect?.top ?? 0)) / zoom,
    };
  };
  const parentAt = (x: number, y: number) =>
    [...page.nodes]
      .reverse()
      .find(
        (n) =>
          containers.has(n.type) &&
          !n.locked &&
          x >= n.x &&
          y >= n.y &&
          x <= n.x + n.width &&
          y <= n.y + n.height,
      )?.id;
  const beginPan = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = {
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      nodes: [],
      ids: [],
      startProject: project,
      scrollX: scrollRef.current?.scrollLeft ?? 0,
      scrollY: scrollRef.current?.scrollTop ?? 0,
    };
  };
  const beginMove = (event: ReactPointerEvent, input: DesignNode) => {
    let node = input;
    if (!event.ctrlKey && !event.metaKey) {
      const seen = new Set<string>();
      let parent = page.nodes.find((n) => n.id === node.parentId);
      while (parent && !seen.has(parent.id)) {
        seen.add(parent.id);
        if (parent.type === 'group') node = parent;
        parent = page.nodes.find((n) => n.id === parent?.parentId);
      }
    }
    if (tool === 'hand' || spaceDown || event.button === 1) {
      event.stopPropagation();
      beginPan(event);
      return;
    }
    if (tool !== 'select' || event.button !== 0 || editingText === node.id) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (lockedNode(node, page.nodes)) {
      setSelectedIds([node.id]);
      return;
    }
    let ids = selectedIds.includes(node.id) ? selectedIds : [node.id];
    if (event.shiftKey)
      ids = selectedIds.includes(node.id)
        ? selectedIds.filter((id) => id !== node.id)
        : [...selectedIds, node.id];
    setSelectedIds(ids);
    setEditingPath(undefined);
    interaction.current = {
      type: 'move',
      startX: event.clientX,
      startY: event.clientY,
      nodes: page.nodes,
      ids: descendants(
        page.nodes,
        rootSelection(
          page.nodes,
          ids.filter((id) => !page.nodes.find((n) => n.id === id)?.locked),
        ),
      ),
      startProject: structuredClone(project),
    };
  };
  const finishPen = (closed = false) => {
    if (penPoints.length < 2) {
      setPenPoints([]);
      return;
    }
    const x = Math.min(...penPoints.map((p) => p.x)),
      y = Math.min(...penPoints.map((p) => p.y)),
      width = Math.max(1, Math.max(...penPoints.map((p) => p.x)) - x),
      height = Math.max(1, Math.max(...penPoints.map((p) => p.y)) - y),
      node: DesignNode = {
        id: uid(),
        name: '矢量路径',
        type: 'path',
        x,
        y,
        width,
        height,
        fill: closed ? '#d9d9d9' : 'transparent',
        stroke: '#262626',
        strokeWidth: 2,
        closed,
        points: penPoints.map((p) => ({ x: p.x - x, y: p.y - y })),
      };
    updatePage({ nodes: [...page.nodes, node] });
    setSelectedIds([node.id]);
    setPenPoints([]);
    setTool('select');
  };
  const beginCanvas = (event: ReactPointerEvent) => {
    if (tool === 'hand' || spaceDown || event.button === 1) {
      beginPan(event);
      return;
    }
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = worldPoint(event.clientX, event.clientY);
    if (tool === 'comment') {
      setCommentPoint(point);
      setCommentDraft('');
      return;
    }
    if (tool === 'pen') {
      if (
        penPoints.length > 2 &&
        Math.hypot(point.x - penPoints[0].x, point.y - penPoints[0].y) < 10 / zoom
      ) {
        finishPen(true);
        return;
      }
      setPenPoints((points) => [...points, point]);
      return;
    }
    if (tool === 'select') {
      if (!event.shiftKey) setSelectedIds([]);
      setEditingPath(undefined);
      interaction.current = {
        type: 'marquee',
        startX: event.clientX,
        startY: event.clientY,
        worldX: point.x,
        worldY: point.y,
        nodes: page.nodes,
        ids: event.shiftKey ? selectedIds : [],
        startProject: project,
      };
      return;
    }
    event.preventDefault();
    const isPath = tool === 'pencil',
      type = (isPath ? 'path' : tool) as NodeType,
      node: DesignNode = {
        id: uid(),
        name: `${nodeNames[type]} ${page.nodes.filter((n) => n.type === type).length + 1}`,
        type,
        x: Math.round(point.x),
        y: Math.round(point.y),
        width: type === 'text' ? 180 : type === 'frame' ? 320 : 160,
        height: type === 'text' ? 32 : type === 'frame' ? 240 : type === 'line' ? 1 : 120,
        fill: ['line', 'path', 'section', 'text'].includes(type)
          ? 'transparent'
          : type === 'frame'
            ? '#ffffff'
            : type === 'button'
              ? tokens.primary
              : '#d9d9d9',
        color: tokens.text,
        fontSize: type === 'text' ? 24 : 14,
        text: type === 'text' ? '输入文字' : type === 'button' ? 'Button' : undefined,
        radius: type === 'button' ? 8 : 0,
        stroke: ['line', 'path', 'section'].includes(type) ? '#262626' : undefined,
        strokeWidth: ['line', 'path', 'section'].includes(type) ? 2 : undefined,
        points: isPath ? [{ x: 0, y: 0 }] : undefined,
        parentId: type === 'frame' || type === 'section' ? undefined : parentAt(point.x, point.y),
      };
    interaction.current = {
      type: isPath ? 'pencil' : 'draw',
      startX: event.clientX,
      startY: event.clientY,
      worldX: point.x,
      worldY: point.y,
      nodes: page.nodes,
      ids: [node.id],
      startProject: structuredClone(project),
      newNode: node,
    };
    previewProject({
      ...project,
      pages: project.pages.map((p) => (p.id === page.id ? { ...p, nodes: [...p.nodes, node] } : p)),
    });
    setSelectedIds([node.id]);
  };
  // 缩放始终基于手势开始时的设计快照，避免逐帧累积误差。
  const beginResize = (event: ReactPointerEvent, node: DesignNode, handle: string) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.current = {
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      nodes: page.nodes,
      ids: [node.id],
      handle,
      startProject: structuredClone(project),
    };
  };
  const finishText = () => {
    if (editingText) {
      updateNode(editingText, { text: textDraft });
      setEditingText(undefined);
    }
  };
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const exportFile = async (format: 'svg' | 'png' | 'json') => {
    try {
      if (format === 'json') {
        download(
          new Blob([JSON.stringify(project, null, 2)], {
            type: 'application/json',
          }),
          `${project.name}.forma.json`,
        );
        return;
      }
      const ids = selection.length ? new Set(descendants(page.nodes, selectedIds)) : undefined,
        nodes = ids ? page.nodes.filter((n) => ids.has(n.id)) : page.nodes,
        bounds = ids ? boundsOf(nodes) : { x: 0, y: 0, width: page.width, height: page.height },
        shifted = nodes.map((n) => ({
          ...n,
          x: n.x - bounds.x,
          y: n.y - bounds.y,
        }));
      const body = renderToStaticMarkup(
        <div
          style={{
            position: 'relative',
            width: bounds.width,
            height: bounds.height,
            background: ids ? 'transparent' : (page.background ?? tokens.background),
            overflow: 'hidden',
          }}
        >
          {shifted.map((n) => (
            <NodeView key={n.id} node={n} nodes={shifted} project={project} />
          ))}
        </div>,
      ).replace('<div ', '<div xmlns="http://www.w3.org/1999/xhtml" ');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}"><foreignObject width="100%" height="100%">${body}</foreignObject></svg>`;
      if (format === 'svg') {
        download(new Blob([svg], { type: 'image/svg+xml' }), `${page.name}.svg`);
        announce('已导出 SVG');
        return;
      }
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(bounds.width * 2));
      canvas.height = Math.max(1, Math.ceil(bounds.height * 2));
      const context = canvas.getContext('2d')!;
      context.scale(2, 2);
      context.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          download(blob, `${page.name}@2x.png`);
          announce('已导出 2× PNG');
        } else announce('PNG 导出失败');
      }, 'image/png');
    } catch {
      announce('导出失败；外部图片可能限制跨域读取，请上传本地图片后重试');
    }
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()),
        pages: DesignPage[] = Array.isArray(data.pages)
          ? data.pages
          : Array.isArray(data.nodes)
            ? [data]
            : [];
      if (
        !pages.length ||
        !pages.every(
          (p) =>
            Array.isArray(p.nodes) &&
            Number.isFinite(p.width) &&
            Number.isFinite(p.height) &&
            p.nodes.every(
              (n) =>
                typeof n.id === 'string' &&
                n.type in nodeNames &&
                [n.x, n.y, n.width, n.height].every(Number.isFinite),
            ),
        )
      )
        throw new Error();
      const imported = pages.map((p) => {
          const result = cloneNodes(
            p.nodes,
            rootSelection(
              p.nodes,
              p.nodes.map((n) => n.id),
            ),
            0,
          );
          return {
            ...p,
            id: uid(),
            name: p.name ?? '导入页面',
            nodes: result.nodes,
          };
        }),
        compIds = new Set(project.components.map((c) => c.id));
      commit({
        ...project,
        pages: [...project.pages, ...imported],
        components: [
          ...project.components,
          ...(Array.isArray(data.components)
            ? data.components.filter(
                (c: DesignComponent) =>
                  typeof c.id === 'string' && !compIds.has(c.id) && Array.isArray(c.nodes),
              )
            : []),
        ],
      });
      setPageId(imported[0].id);
      announce(`已导入 ${imported.length} 个页面`);
    } catch {
      announce('无法导入：请选择有效的 Forma 项目或页面 JSON');
    }
    if (importRef.current) importRef.current.value = '';
  };
  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      announce('请选择图片文件');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      announce('图片不能超过 12 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result),
        img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 800 / img.width),
          node: DesignNode = {
            id: uid(),
            name: file.name,
            type: 'image',
            x: 80,
            y: 80,
            width: Math.round(img.width * scale),
            height: Math.round(img.height * scale),
            src,
          };
        updatePage({ nodes: [...page.nodes, node] });
        setSelectedIds([node.id]);
      };
      img.onerror = () => announce('图片无法读取');
      img.src = src;
    };
    reader.readAsDataURL(file);
    if (imageRef.current) imageRef.current.value = '';
  };
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    setSelectedIds([]);
    setEditingText(undefined);
    setEditingPath(undefined);
    setPenPoints([]);
    setGuides([]);
  }, [project.id, pageId]);
  useEffect(() => {
    const onMove = (event: PointerEvent, pencilSamples: PointerEvent[] = [event]) => {
      /** 集中维护 active 的进行中任务，防止同一目标被重复执行。 */
      const active = interaction.current;
      if (!active) return;
      const dx = (event.clientX - active.startX) / zoom,
        dy = (event.clientY - active.startY) / zoom;
      if (active.type === 'pan') {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = (active.scrollX ?? 0) - (event.clientX - active.startX);
          scrollRef.current.scrollTop = (active.scrollY ?? 0) - (event.clientY - active.startY);
        }
        return;
      }
      if (active.type === 'marquee') {
        const box = {
          x: Math.min(active.worldX!, active.worldX! + dx),
          y: Math.min(active.worldY!, active.worldY! + dy),
          width: Math.abs(dx),
          height: Math.abs(dy),
        };
        setMarquee(box);
        const hits = canvasRendererRef.current?.query(box) ?? [];
        setSelectedIds([...new Set([...active.ids, ...hits])]);
        return;
      }
      let nodes = active.nodes;
      if (active.type === 'move') {
        let mx = dx,
          my = dy;
        const found: {
          /** 辅助线或计算所沿用的坐标轴。取值：x、y。 */
          axis: 'x' | 'y';
          /** 当前字段、模式或控件的取值。 */
          value: number;
        }[] = [];
        if (event.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) my = 0;
          else mx = 0;
        }
        if (snap && !event.altKey) {
          if (!active.snapTargets) {
            const moving = (active.movingIds ??= new Set(active.ids));
            const targets = active.nodes.filter(
              (n) => !moving.has(n.id) && canvasRendererRef.current?.entry(n.id)?.visible,
            );
            active.snapTargets = {
              bounds: boundsOf(active.nodes.filter((n) => moving.has(n.id))),
              xs: [
                0,
                page.width / 2,
                page.width,
                ...guides.filter((g) => g.axis === 'x').map((g) => g.value),
                ...targets.flatMap((n) => [n.x, n.x + n.width / 2, n.x + n.width]),
              ],
              ys: [
                0,
                page.height / 2,
                page.height,
                ...guides.filter((g) => g.axis === 'y').map((g) => g.value),
                ...targets.flatMap((n) => [n.y, n.y + n.height / 2, n.y + n.height]),
              ],
            };
          }
          const { bounds: b, xs, ys } = active.snapTargets;
          let bestX = 5 / zoom,
            bestY = 5 / zoom;
          for (const a of [b.x, b.x + b.width / 2, b.x + b.width])
            for (const t of xs) {
              const delta = t - a - dx;
              if (Math.abs(delta) < bestX) {
                bestX = Math.abs(delta);
                mx = dx + delta;
                found[0] = { axis: 'x', value: t };
              }
            }
          for (const a of [b.y, b.y + b.height / 2, b.y + b.height])
            for (const t of ys) {
              const delta = t - a - dy;
              if (Math.abs(delta) < bestY) {
                bestY = Math.abs(delta);
                my = dy + delta;
                found[1] = { axis: 'y', value: t };
              }
            }
          if (page.grid?.enabled) {
            if (!found[0]) mx = Math.round((b.x + mx) / page.grid.size) * page.grid.size - b.x;
            if (!found[1]) my = Math.round((b.y + my) / page.grid.size) * page.grid.size - b.y;
          }
          setSmartGuides(found.filter(Boolean));
        } else setSmartGuides([]);
        nodes = active.nodes.map((n) =>
          (active.movingIds ??= new Set(active.ids)).has(n.id)
            ? { ...n, x: Math.round(n.x + mx), y: Math.round(n.y + my) }
            : n,
        );
      } else if (active.type === 'resize') {
        const node = active.nodes.find((n) => n.id === active.ids[0])!,
          handle = active.handle!;
        let width = Math.max(
            1,
            node.width + (handle.includes('w') ? -dx : handle.includes('e') ? dx : 0),
          ),
          height = Math.max(
            1,
            node.height + (handle.includes('n') ? -dy : handle.includes('s') ? dy : 0),
          );
        if (event.shiftKey || node.aspectRatioLocked) {
          if (Math.abs(dx) > Math.abs(dy)) height = (width / node.width) * node.height;
          else width = (height / node.height) * node.width;
        }
        const x = handle.includes('w') ? node.x + node.width - width : node.x,
          y = handle.includes('n') ? node.y + node.height - height : node.y;
        nodes = resizeNodes(active.nodes, node.id, {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        });
      } else if (active.type === 'point') {
        nodes = active.nodes.map((n) =>
          n.id === active.ids[0]
            ? {
                ...n,
                points: n.points?.map((p, i) =>
                  i === active.pointIndex
                    ? { x: Math.round(p.x + dx), y: Math.round(p.y + dy) }
                    : p,
                ),
              }
            : n,
        );
      } else if (active.type === 'pencil' && active.newNode) {
        const origin = active.newNode;
        for (const sample of pencilSamples) {
          const point = worldPoint(sample.clientX, sample.clientY);
          const nextPoint = { x: point.x - origin.x, y: point.y - origin.y };
          const last = origin.points![origin.points!.length - 1];
          if (Math.hypot(nextPoint.x - last.x, nextPoint.y - last.y) > 2 / zoom)
            origin.points!.push(nextPoint);
        }
        const minX = Math.min(0, ...origin.points!.map((p) => p.x)),
          minY = Math.min(0, ...origin.points!.map((p) => p.y)),
          maxX = Math.max(1, ...origin.points!.map((p) => p.x)),
          maxY = Math.max(1, ...origin.points!.map((p) => p.y));
        nodes = [
          ...active.nodes,
          {
            ...origin,
            x: origin.x + minX,
            y: origin.y + minY,
            width: maxX - minX,
            height: maxY - minY,
            points: origin.points!.map((p) => ({
              x: p.x - minX,
              y: p.y - minY,
            })),
          },
        ];
      } else if (active.type === 'draw' && active.newNode) {
        const origin = active.newNode;
        let w = Math.abs(dx),
          h = Math.abs(dy);
        if (event.shiftKey) {
          w = Math.max(w, h);
          h = w;
        }
        if (origin.type === 'line') {
          const length = Math.hypot(dx, dy);
          nodes = [
            ...active.nodes,
            {
              ...origin,
              width: Math.max(1, length),
              height: 1,
              rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
              x: origin.x + (dx - length) / 2,
              y: origin.y + dy / 2,
            },
          ];
        } else
          nodes = [
            ...active.nodes,
            {
              ...origin,
              x: dx < 0 ? origin.x - w : origin.x,
              y: dy < 0 ? origin.y - h : origin.y,
              width: w > 3 ? w : origin.width,
              height: h > 3 ? h : origin.height,
            },
          ];
      }
      const current = projectRef.current;
      previewProject({
        ...current,
        pages: current.pages.map((p) => (p.id === page.id ? { ...p, nodes } : p)),
      });
    };
    let moveFrame = 0;
    let pendingMove: PointerEvent | undefined;
    let pencilSamples: PointerEvent[] = [];
    const flushMove = () => {
      cancelAnimationFrame(moveFrame);
      moveFrame = 0;
      if (pendingMove) {
        const event = pendingMove;
        pendingMove = undefined;
        onMove(event, pencilSamples.length ? pencilSamples : [event]);
        pencilSamples = [];
      }
    };
    // 将高频指针移动合并到动画帧，减少重复的状态更新。
    const scheduleMove = (event: PointerEvent) => {
      if (!interaction.current) return;
      pendingMove = event;
      if (interaction.current.type === 'pencil') {
        const samples = event.getCoalescedEvents?.();
        pencilSamples.push(...(samples?.length ? samples : [event]));
      }
      if (!moveFrame) moveFrame = requestAnimationFrame(flushMove);
    };
    const onUp = () => {
      flushMove();
      /** 集中维护 active 的进行中任务，防止同一目标被重复执行。 */
      const active = interaction.current;
      if (!active) return;
      interaction.current = undefined;
      setMarquee(undefined);
      setSmartGuides([]);
      if (active.type === 'pan' || active.type === 'marquee') return;
      const current = projectRef.current;
      if (JSON.stringify(current.pages) !== JSON.stringify(active.startProject.pages))
        commit(current, active.startProject);
      else setDraftProject(undefined);
      if (active.type === 'draw' || active.type === 'pencil') {
        setTool('select');
        if (active.newNode?.type === 'text') {
          setEditingText(active.newNode.id);
          setTextDraft(active.newNode.text ?? '');
        }
      }
    };
    const onCancel = () => {
      cancelAnimationFrame(moveFrame);
      moveFrame = 0;
      pendingMove = undefined;
      pencilSamples = [];
      /** 集中维护 active 的进行中任务，防止同一目标被重复执行。 */
      const active = interaction.current;
      if (!active) return;
      interaction.current = undefined;
      projectRef.current = active.startProject;
      setDraftProject(undefined);
      setMarquee(undefined);
      setSmartGuides([]);
      if (active.type === 'draw' || active.type === 'pencil') setSelectedIds([]);
    };
    window.addEventListener('pointermove', scheduleMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    return () => {
      cancelAnimationFrame(moveFrame);
      window.removeEventListener('pointermove', scheduleMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
    };
  }, [zoom, page?.id, page?.width, page?.height, page?.grid, snap, guides, commit, previewProject]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (readOnly) return;
      if (
        document.querySelector('[role="dialog"]') ||
        (event.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"],.agent-chat-panel',
        )
      )
        return;
      const mod = event.ctrlKey || event.metaKey,
        key = event.key.toLowerCase();
      if (event.code === 'Space') {
        event.preventDefault();
        setSpaceDown(true);
        return;
      }
      if (mod && key === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (mod && key === 'y') {
        event.preventDefault();
        redo();
      } else if (mod && key === 'd') {
        event.preventDefault();
        duplicate();
      } else if (mod && key === 'c') {
        event.preventDefault();
        copy();
      } else if (mod && key === 'v') {
        event.preventDefault();
        paste();
      } else if (mod && key === 'x') {
        event.preventDefault();
        copy();
        removeSelected();
      } else if (mod && key === 'g') {
        event.preventDefault();
        event.shiftKey ? ungroup() : group();
      } else if (mod && event.altKey && key === 'k') {
        event.preventDefault();
        createComponent();
      } else if (mod && key === 'a') {
        event.preventDefault();
        setSelectedIds(
          page.nodes
            .filter((n) => {
              const entry = canvasRendererRef.current?.entry(n.id);
              return entry?.visible && !entry.locked;
            })
            .map((n) => n.id),
        );
      } else if (mod && (key === 'f' || key === 'k')) {
        event.preventDefault();
        setLayersPreference(false);
        setSearchFocusRequest((value) => value + 1);
      } else if (mod && event.shiftKey && key === 'l') {
        event.preventDefault();
        updateSelected({ locked: !selected?.locked });
      } else if (mod && event.shiftKey && key === 'h') {
        event.preventDefault();
        updateSelected({ visible: selected?.visible === false });
      } else if (mod && key === ']') {
        event.preventDefault();
        reorder(true);
      } else if (mod && key === '[') {
        event.preventDefault();
        reorder(false);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelected();
      } else if (event.key === 'Escape') {
        interaction.current = undefined;
        projectRef.current = persistedProject;
        setDraftProject(undefined);
        setMarquee(undefined);
        setSmartGuides([]);
        setSelectedIds([]);
        setTool('select');
        setPenPoints([]);
        setEditingPath(undefined);
      } else if (event.key === 'Enter' && tool === 'pen') {
        event.preventDefault();
        finishPen();
      } else if (event.shiftKey && event.code === 'Digit1') {
        event.preventDefault();
        fit();
      } else if (event.shiftKey && event.code === 'Digit2') {
        event.preventDefault();
        fit(true);
      } else if (event.shiftKey && key === 'g') {
        event.preventDefault();
        updatePage({
          grid: { size: 8, ...page.grid, enabled: !page.grid?.enabled },
        });
      } else if (event.shiftKey && key === 'r') {
        event.preventDefault();
        setShowRulers((v) => !v);
      } else if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) &&
        selectedIds.length
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        updatePage({
          nodes: moveNodes(
            page.nodes,
            selectedIds.filter((id) => !page.nodes.find((n) => n.id === id)?.locked),
            event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
            event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
          ),
        });
      } else if (!mod) {
        const tools: Record<string, Tool> = {
          v: 'select',
          h: 'hand',
          f: 'frame',
          r: 'rectangle',
          o: 'ellipse',
          l: 'line',
          p: event.shiftKey ? 'pencil' : 'pen',
          t: 'text',
          c: 'comment',
          s: 'section',
        };
        if (tools[key]) {
          setTool(tools[key]);
          setPenPoints([]);
        }
      }
    };
    // 失焦时也清除空格键状态，防止错过 keyup 后一直处于平移模式。
    const keyup = (event: KeyboardEvent) => {
        if (event.code === 'Space') setSpaceDown(false);
      },
      blur = () => setSpaceDown(false);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
    };
  });
  if (!page)
    return (
      <div className="design-editor ed-empty">
        <Button onClick={addPage}>创建第一个页面</Button>
      </div>
    );
  const activeComments = (project.comments ?? []).filter(
    (c) => c.pageId === page.id && (showResolved || !c.resolved),
  );
  const renderLayer = ({
    node,
    depth,
    children,
  }: {
    /** 当前处理的设计节点。 */
    node: DesignNode;
    /** 当前递归层级，用于控制缩进或限制展开深度。 */
    depth: number;
    /** 由调用方放入组件的子内容。 */
    children: boolean;
  }): ReactNode => {
    const Icon = nodeIcons[node.type] ?? Square;
    return (
      <div
        className={`ed-layer ${selectedIds.includes(node.id) ? 'selected' : ''} ${node.visible === false ? 'hidden-layer' : ''} ${node.type === 'component' ? 'component-layer' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        draggable
        onDragStart={(event) => event.dataTransfer.setData('text/forma-node', node.id)}
        onDragOver={(event) => {
          if (containers.has(node.type)) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const id = event.dataTransfer.getData('text/forma-node');
          if (
            id &&
            id !== node.id &&
            !descendants(page.nodes, [id]).includes(node.id) &&
            containers.has(node.type)
          )
            updateNode(id, { parentId: node.id });
        }}
        onClick={(event) =>
          setSelectedIds(
            event.shiftKey
              ? selectedIds.includes(node.id)
                ? selectedIds.filter((id) => id !== node.id)
                : [...selectedIds, node.id]
              : [node.id],
          )
        }
        onDoubleClick={() => setLayerRename(node.id)}
      >
        <button
          className="ed-disclosure"
          aria-label={children ? '展开或收起图层' : '图层'}
          onClick={(event) => {
            event.stopPropagation();
            if (children)
              setCollapsed((current) => {
                const next = new Set(current);
                next.has(node.id) ? next.delete(node.id) : next.add(node.id);
                return next;
              });
          }}
        >
          {children &&
            (collapsed.has(node.id) ? <ChevronRight size={11} /> : <ChevronDown size={11} />)}
        </button>
        <Icon size={13} />
        {layerRename === node.id ? (
          <Input
            autoFocus
            defaultValue={node.name}
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => {
              updateNode(node.id, { name: event.target.value });
              setLayerRename(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setLayerRename(undefined);
            }}
          />
        ) : (
          <span>{node.name}</span>
        )}
        <div className="ed-layer-actions">
          <button
            title={node.locked ? '解锁' : '锁定'}
            onClick={(event) => {
              event.stopPropagation();
              updateNode(node.id, { locked: !node.locked });
            }}
          >
            {node.locked ? <LockKeyhole size={11} /> : <UnlockKeyhole size={11} />}
          </button>
          <button
            title={node.visible === false ? '显示图层' : '隐藏图层'}
            onClick={(event) => {
              event.stopPropagation();
              updateNode(node.id, { visible: node.visible === false });
            }}
          >
            {node.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
      </div>
    );
  };
  return (
    <motion.div
      className={`design-editor ${readOnly ? 'ed-agent-busy' : ''} ${chatOpen ? 'ed-with-chat' : ''} ${layersCollapsed ? 'ed-layers-collapsed' : ''}`}
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={uiTransition}
    >
      {readOnly && (
        <div className="ed-agent-busy-notice" role="status">
          <RinIllustration state="thinking" size={32} />
          凛正在更新项目，完成后可继续编辑
        </div>
      )}
      <header className="ed-header">
        <div className="ed-file-controls">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="ed-menu-button" aria-label="文件菜单">
                <RinAvatar size={28} className="ed-rin-brand-avatar" />
                <span className="ed-wordmark">Forma</span>
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="ed-dropdown">
              <DropdownMenuLabel>{project.name}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onBack}>
                <ArrowLeft />
                返回项目
              </DropdownMenuItem>
              {onNavigate && (
                <>
                  <DropdownMenuItem onSelect={() => onNavigate('components')}>
                    <RinIcon kind="components" size={16} />
                    项目组件库
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onNavigate('tokens')}>
                    <RinIcon kind="tokens" size={16} />
                    项目 Design Tokens
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => importRef.current?.click()}>
                <Upload />
                导入 Forma JSON
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportFile('json')}>
                <Download />
                导出项目 JSON
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowVersions(true)}>
                <History />
                版本历史
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>视图</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={showRulers} onCheckedChange={setShowRulers}>
                标尺<DropdownMenuShortcut>⇧ R</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={!!page.grid?.enabled}
                onCheckedChange={(enabled) =>
                  updatePage({ grid: { size: 8, ...page.grid, enabled } })
                }
              >
                布局网格<DropdownMenuShortcut>⇧ G</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={snap} onCheckedChange={setSnap}>
                智能吸附
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem onSelect={() => setGuides([])}>清除参考线</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowShortcuts(true)}>
                <CircleHelp />
                键盘快捷键
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="ed-file-title" onClick={onBack} title="返回项目概览">
            <RinIcon kind="projects" size={15} />
            <ChevronRight size={12} />
            <strong>{project.name}</strong>
            <ChevronRight size={12} />
            <span className="ed-current-page-name">{page.name}</span>
          </button>
          <span className={`ed-save-indicator ${saveState}`} title={saveLabel}>
            <Check size={12} />
          </span>
        </div>
        <div className="ed-header-middle">
          <span className="ed-file-type">
            <RinIcon kind="canvas" size={12} />
            设计画布
          </span>
        </div>
        <div className="ed-header-actions">
          {onTheme && (
            <ToolButton title="工作台外观" onClick={onTheme}>
              <Palette size={16} />
            </ToolButton>
          )}
          <ToolButton
            title={inspectorVisible ? '收起属性面板' : '展开属性面板'}
            onClick={() => setInspectorVisible((value) => !value)}
          >
            {inspectorVisible ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </ToolButton>
          <Button variant="ghost" className="ed-ai-trigger" onClick={onOpenAgent}>
            <RinAvatar size={22} />
            <span>与凛协作</span>
          </Button>
          <ToolButton title="播放原型" onClick={() => setPreview(true)}>
            <Play size={17} />
          </ToolButton>
          <Button className="ed-sync-button" onClick={onSync}>
            <RinIcon kind="sync" size={14} />
            同步代码
          </Button>
        </div>
      </header>
      <div className="ed-workspace">
        <motion.aside
          className={`ed-left-panel ${layersCollapsed ? 'is-collapsed' : ''}`}
          style={{ minWidth: 0 }}
          initial={false}
          animate={{
            width: layersCollapsed ? 44 : 220,
          }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : expressive
                ? { type: 'spring', stiffness: 360, damping: 34 }
                : uiTransition
          }
        >
          <div className="ed-layer-rail" hidden={!layersCollapsed}>
            <ToolButton title="展开图层栏" onClick={() => setLayersPreference(false)}>
              <PanelLeftOpen size={17} />
            </ToolButton>
            <span className="ed-rail-divider" />
            {[
              { id: 'layers', title: '图层与页面', icon: Layers },
              { id: 'assets', title: '组件资源', icon: Component },
              { id: 'comments', title: '项目评论', icon: MessageCircle },
            ].map((item) => (
              <ToolButton
                key={item.id}
                title={item.title}
                onClick={() => {
                  setActiveTab(item.id);
                  setLayersPreference(false);
                }}
              >
                <item.icon size={17} />
              </ToolButton>
            ))}
            <span className="ed-rail-spacer" />
            <ToolButton title="返回项目" onClick={onBack}>
              <ArrowLeft size={17} />
            </ToolButton>
          </div>
          <div className="ed-left-body" hidden={layersCollapsed}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="ed-left-tabs">
                <TabsTrigger value="layers">图层</TabsTrigger>
                <TabsTrigger value="assets">资源</TabsTrigger>
                <TabsTrigger value="comments">
                  评论
                  {activeComments.length > 0 && (
                    <span className="ed-tab-count">{activeComments.length}</span>
                  )}
                </TabsTrigger>
                <ToolButton title="收起图层栏" onClick={() => setLayersPreference(true)}>
                  <PanelLeftClose size={15} />
                </ToolButton>
              </TabsList>
              <div className="ed-search">
                <Search size={13} />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={activeTab === 'assets' ? '搜索组件' : '搜索图层'}
                  aria-label="搜索图层或组件"
                />
                <kbd>Ctrl K</kbd>
              </div>
              <TabsContent value="layers" className="ed-layers-content">
                <div className="ed-panel-heading">
                  <strong>
                    <RinIcon kind="canvas" size={14} />
                    页面
                  </strong>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="页面操作">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={duplicatePage}>
                          <Copy />
                          复制当前页面
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={deletePage} disabled={project.pages.length < 2}>
                          <Trash2 />
                          删除当前页面
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="icon" aria-label="添加页面" onClick={addPage}>
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
                <div className="ed-page-list">
                  {project.pages.map((p) => (
                    <Button
                      key={p.id}
                      variant="ghost"
                      className={`ed-page-row ${p.id === page.id ? 'active' : ''}`}
                      onClick={() => setPageId(p.id)}
                    >
                      <span>
                        {p.id === page.id ? <Check size={13} /> : <span className="ed-page-dot" />}
                      </span>
                      <span>{p.name}</span>
                      {p.prototypeStart && <Play size={10} />}
                    </Button>
                  ))}
                </div>
                <div className="ed-panel-heading ed-layers-heading">
                  <strong>图层</strong>
                  <span>{page.nodes.length}</span>
                </div>
                <VirtualLayerList
                  nodes={page.nodes}
                  collapsed={collapsed}
                  search={search}
                  pageId={page.id}
                  pinnedId={layerRename}
                  renderRow={renderLayer}
                  onRootDrop={(id) => updateNode(id, { parentId: undefined })}
                >
                  {!page.nodes.length && (
                    <div className="ed-panel-empty">
                      <RinIllustration state="empty" size={64} />
                      <strong>暂无图层</strong>
                      <p>
                        使用工具创建图层，或通过
                        <br />
                        凛生成页面。
                      </p>
                      <Button variant="secondary" onClick={onOpenAgent}>
                        <RinIcon kind="agent" size={14} />
                        与凛协作
                      </Button>
                    </div>
                  )}
                </VirtualLayerList>
              </TabsContent>
              <TabsContent value="assets" className="ed-assets-content">
                <div className="ed-panel-heading">
                  <strong>本地组件</strong>
                  <span>{project.components.length}</span>
                </div>
                <p className="ed-panel-note">点击组件，在当前页面创建实例。</p>
                <div className="ed-assets-grid">
                  {project.components
                    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                    .map((component) => (
                      <button
                        key={component.id}
                        className="ed-asset-card"
                        onClick={() => addInstance(component)}
                      >
                        <div className="ed-asset-preview">
                          <div
                            style={{
                              position: 'relative',
                              width: component.width,
                              height: component.height,
                              transform: `scale(${Math.min(104 / component.width, 68 / component.height, 0.8)})`,
                            }}
                          >
                            {component.nodes.map((n) => (
                              <NodeView
                                key={n.id}
                                node={n}
                                project={project}
                                nodes={component.nodes}
                              />
                            ))}
                          </div>
                        </div>
                        <span>
                          <Component size={12} />
                          {component.name}
                        </span>
                        {component.variantProperties && (
                          <small>{Object.values(component.variantProperties).join(' / ')}</small>
                        )}
                      </button>
                    ))}
                </div>
                {!project.components.length && (
                  <div className="ed-panel-empty">
                    <RinIcon kind="components" size={26} />
                    <p>
                      选择图层后按 Ctrl Alt K<br />
                      创建可复用组件。
                    </p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="comments" className="ed-comments-content">
                <div className="ed-panel-heading">
                  <strong>评论</strong>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="添加评论"
                    onClick={() => {
                      setTool('comment');
                      announce('点击画布添加评论');
                    }}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
                <label className="ed-show-resolved">
                  <input
                    type="checkbox"
                    checked={showResolved}
                    onChange={(event) => setShowResolved(event.target.checked)}
                  />
                  显示已解决
                </label>
                {activeComments.map((comment, index) => (
                  <article
                    className={`ed-comment-card ${comment.resolved ? 'resolved' : ''}`}
                    key={comment.id}
                  >
                    <header>
                      <span className="ed-comment-avatar">{index + 1}</span>
                      <strong>{comment.author}</strong>
                      <small>{new Date(comment.createdAt).toLocaleDateString()}</small>
                    </header>
                    <p>{comment.text}</p>
                    <footer>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          commit({
                            ...project,
                            comments: project.comments?.map((c) =>
                              c.id === comment.id ? { ...c, resolved: !c.resolved } : c,
                            ),
                          })
                        }
                      >
                        {comment.resolved ? '重新打开' : '标为已解决'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="删除评论"
                        onClick={() =>
                          commit({
                            ...project,
                            comments: project.comments?.filter((c) => c.id !== comment.id),
                          })
                        }
                      >
                        <Trash2 size={12} />
                      </Button>
                    </footer>
                  </article>
                ))}
                {!activeComments.length && (
                  <div className="ed-panel-empty">
                    <RinIllustration state="idle" size={60} />
                    <p>
                      在画布上按 C 添加评论。
                      <br />
                      评论保存在当前项目中。
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            <footer className="ed-left-footer">
              <RinAvatar size={20} />
              <span>个人工作空间</span>
              <ToolButton title="返回项目" onClick={onBack}>
                <ArrowLeft size={14} />
              </ToolButton>
            </footer>
          </div>
        </motion.aside>
        <main className="ed-canvas-main">
          <div className="ed-canvas-topbar">
            <span>
              <Frame size={12} />
              {page.name}
              <ChevronRight size={11} />
              <span>{selected ? selected.name : '画布'}</span>
            </span>
            <div>
              <ToolButton title="撤销 (Ctrl Z)" onClick={undo} disabled={!history.length}>
                <Undo2 size={14} />
              </ToolButton>
              <ToolButton title="重做 (Ctrl Shift Z)" onClick={redo} disabled={!future.length}>
                <Redo2 size={14} />
              </ToolButton>
              <i />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="ed-zoom-trigger">
                    {Math.round(zoom * 100)}%<ChevronDown size={11} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => fit()}>
                    适应画布<DropdownMenuShortcut>⇧ 1</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => fit(true)} disabled={!selection.length}>
                    适应所选<DropdownMenuShortcut>⇧ 2</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {[0.25, 0.5, 1, 2, 4].map((value) => (
                    <DropdownMenuItem
                      key={value}
                      onSelect={() => {
                        if (!interaction.current) zoomTo(value);
                      }}
                    >
                      {value * 100}%
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={snap} onCheckedChange={setSnap}>
                    智能吸附
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="ed-canvas-viewport">
            <CanvasRenderer
              ref={canvasRendererRef}
              project={project}
              page={page}
              view={{ ...viewport, zoom, x: origin.x, y: origin.y }}
              editingText={editingText}
              overlay={{
                selectedIds,
                hoverId: hoveredNodeId,
                marquee,
                guides: [...guides, ...smartGuides.map((guide) => ({ ...guide, smart: true }))],
                penPoints,
              }}
            />
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  ref={scrollRef}
                  onScroll={onScroll}
                  onPointerMove={(event) => {
                    if (tool !== 'select' || interaction.current || spaceDown) return;
                    const hit = canvasRendererRef.current?.hitTest(
                      worldPoint(event.clientX, event.clientY),
                    );
                    setHoveredNodeId(hit?.id);
                  }}
                  onPointerLeave={() => setHoveredNodeId(undefined)}
                  onContextMenu={(event) => {
                    const hit = canvasRendererRef.current?.hitTest(
                      worldPoint(event.clientX, event.clientY),
                    );
                    if (hit && !selectedIds.includes(hit.id)) setSelectedIds([hit.id]);
                  }}
                  onDoubleClick={(event) => {
                    if (tool === 'pen') {
                      finishPen();
                      return;
                    }
                    if (tool !== 'select') return;
                    const node = canvasRendererRef.current?.hitTest(
                      worldPoint(event.clientX, event.clientY),
                    );
                    if (!node || lockedNode(node, page.nodes)) return;
                    if (node.type === 'text' || node.type === 'button') {
                      setEditingText(node.id);
                      setTextDraft(node.text ?? '');
                    }
                    if (node.type === 'path') setEditingPath(node.id);
                  }}
                  className={`ed-canvas-scroll ${tool === 'hand' || spaceDown ? 'is-panning' : tool === 'select' ? '' : 'is-drawing'}`}
                  onPointerDown={(event) => {
                    if (
                      event.target === event.currentTarget ||
                      (event.target as HTMLElement).classList.contains('ed-canvas-stage')
                    ) {
                      const hit = canvasRendererRef.current?.hitTest(
                        worldPoint(event.clientX, event.clientY),
                      );
                      if (hit && (tool === 'select' || tool === 'hand' || spaceDown))
                        beginMove(event, hit);
                      else beginCanvas(event);
                    }
                  }}
                >
                  <div className="ed-canvas-stage" style={stageStyle}>
                    <div
                      className="ed-artboard-space"
                      style={{
                        width: page.width * zoom,
                        height: page.height * zoom,
                      }}
                    >
                      <div className="ed-artboard-label">
                        <Frame size={11} />
                        {page.name}
                        <span>
                          {page.width} × {page.height}
                        </span>
                      </div>
                      {!readOnly && !page.nodes.length && tool === 'select' && !spaceDown && (
                        <CanvasEmptyState
                          background={page.background ?? tokens.background}
                          onFrame={() => setTool('frame')}
                          onText={() => setTool('text')}
                          onOpenAgent={onOpenAgent}
                        />
                      )}
                      <div
                        ref={artboardRef}
                        className="ed-artboard"
                        style={{
                          width: page.width,
                          height: page.height,
                          transform: `scale(${zoom})`,
                          background: 'transparent',
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          const hit = canvasRendererRef.current?.hitTest(
                            worldPoint(event.clientX, event.clientY),
                          );
                          if (hit && (tool === 'select' || tool === 'hand' || spaceDown))
                            beginMove(event, hit);
                          else beginCanvas(event);
                        }}
                      >
                        {editingText &&
                          (() => {
                            const node = page.nodes.find((node) => node.id === editingText);
                            if (!node) return null;
                            return (
                              <div
                                className="ed-inline-editor-node"
                                style={{
                                  ...getNodeStyle(node, tokens, page.nodes, project),
                                  background: 'transparent',
                                  border: 0,
                                  outline: 0,
                                  boxShadow: 'none',
                                }}
                              >
                                <textarea
                                  autoFocus
                                  aria-label="编辑文本"
                                  className="ed-inline-editor"
                                  value={textDraft}
                                  onChange={(event) => setTextDraft(event.target.value)}
                                  onBlur={finishText}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onDoubleClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => {
                                    if (event.nativeEvent.isComposing) return;
                                    if (event.key === 'Escape') setEditingText(undefined);
                                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter')
                                      finishText();
                                  }}
                                />
                              </div>
                            );
                          })()}
                        {(selection.length === 1 ? selection : [])
                          .filter(
                            (n) => getNodeStyle(n, tokens, page.nodes, project).display !== 'none',
                          )
                          .map((node) => (
                            <div
                              key={`selection-${node.id}`}
                              className={`ed-selection ${node.type === 'component' ? 'component' : ''}`}
                              style={{
                                left: node.x,
                                top: node.y,
                                width: node.width,
                                height: node.height,
                                borderWidth: 1 / zoom,
                                transform: getNodeStyle(node, tokens, page.nodes, project)
                                  .transform,
                                borderColor: 'transparent',
                              }}
                            >
                              <span
                                className="ed-selection-name"
                                style={{ transform: `scale(${1 / zoom})` }}
                              >
                                {node.type === 'component' && <Component size={10} />}
                                {node.name}
                              </span>
                              {!lockedNode(node, page.nodes) &&
                                !editingText &&
                                selection.length === 1 &&
                                ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
                                  <button
                                    key={handle}
                                    aria-label={`调整${node.name}大小 ${handle}`}
                                    className={`ed-resize-handle ${handle}`}
                                    style={{ transform: `scale(${1 / zoom})` }}
                                    onPointerDown={(event) => beginResize(event, node, handle)}
                                  />
                                ))}
                              {selection.length === 1 && (
                                <span
                                  className="ed-selection-size"
                                  style={{
                                    transform: `translateX(-50%) scale(${1 / zoom})`,
                                  }}
                                >
                                  {Math.round(node.width)} × {Math.round(node.height)}
                                </span>
                              )}
                            </div>
                          ))}
                        {selection.length > 1 && (
                          <div
                            className="ed-multi-selection"
                            style={{
                              left: selectionBounds.x,
                              top: selectionBounds.y,
                              width: selectionBounds.width,
                              height: selectionBounds.height,
                              borderWidth: 1 / zoom,
                            }}
                          />
                        )}
                        {editingPath &&
                          selected?.points?.map((point, index) => (
                            <button
                              key={index}
                              className="ed-path-anchor"
                              aria-label={`路径锚点 ${index + 1}`}
                              style={{
                                left: selected.x + point.x,
                                top: selected.y + point.y,
                                transform: `scale(${1 / zoom})`,
                              }}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                interaction.current = {
                                  type: 'point',
                                  startX: event.clientX,
                                  startY: event.clientY,
                                  nodes: page.nodes,
                                  ids: [selected.id],
                                  pointIndex: index,
                                  startProject: structuredClone(project),
                                };
                              }}
                            />
                          ))}
                        {activeComments
                          .filter((c) => !c.resolved)
                          .map((comment, index) => (
                            <button
                              key={comment.id}
                              className="ed-comment-pin"
                              title={comment.text}
                              style={{
                                left: comment.x,
                                top: comment.y,
                                transform: `scale(${1 / zoom})`,
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => {
                                setActiveTab('comments');
                                setLayersPreference(false);
                              }}
                            >
                              {index + 1}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="ed-context-menu">
                <ContextMenuItem onSelect={copy} disabled={!selection.length}>
                  <Copy />
                  复制<ContextMenuShortcut>Ctrl C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={paste}>
                  粘贴<ContextMenuShortcut>Ctrl V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={duplicate} disabled={!selection.length}>
                  创建副本<ContextMenuShortcut>Ctrl D</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={group} disabled={!selection.length}>
                  <Group />
                  编组<ContextMenuShortcut>Ctrl G</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={ungroup}
                  disabled={!selection.some((n) => containers.has(n.type))}
                >
                  <Ungroup />
                  取消编组<ContextMenuShortcut>Ctrl ⇧ G</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={createComponent} disabled={!selection.length}>
                  <Component />
                  创建组件<ContextMenuShortcut>Ctrl Alt K</ContextMenuShortcut>
                </ContextMenuItem>
                {selected?.componentId && (
                  <ContextMenuItem onSelect={detach}>分离实例</ContextMenuItem>
                )}
                <ContextMenuSeparator />
                {(
                  [
                    ['union', '联合选区'],
                    ['difference', '减去顶层'],
                    ['intersection', '相交选区'],
                    ['xor', '排除重叠'],
                  ] as const
                ).map(([operation, label]) => (
                  <ContextMenuItem
                    key={operation}
                    disabled={selection.length < 2}
                    onSelect={() => booleanOperation(operation)}
                  >
                    {label}
                  </ContextMenuItem>
                ))}
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => reorder(true)} disabled={!selection.length}>
                  <ArrowUpToLine />
                  置于顶层
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => reorder(false)} disabled={!selection.length}>
                  <ArrowDownToLine />
                  置于底层
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => updateSelected({ locked: !selected?.locked })}
                  disabled={!selection.length}
                >
                  <LockKeyhole />
                  {selected?.locked ? '解锁' : '锁定'}
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => updateSelected({ visible: selected?.visible === false })}
                  disabled={!selection.length}
                >
                  <Eye />
                  {selected?.visible === false ? '显示' : '隐藏'}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={removeSelected} disabled={!selection.length}>
                  <Trash2 />
                  删除<ContextMenuShortcut>Delete</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => fit(true)} disabled={!selection.length}>
                  <Maximize />
                  缩放至所选
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {showRulers && (
              <CanvasRulers
                zoom={zoom}
                origin={origin}
                viewport={viewport}
                onFit={() => fit()}
                onGuide={(axis, event) => {
                  event.preventDefault();
                  const point = worldPoint(event.clientX, event.clientY);
                  setGuides((current) => [...current, { axis, value: Math.round(point[axis]) }]);
                }}
              />
            )}
          </div>
          <motion.div
            className="ed-floating-tools"
            initial={{ opacity: reducedMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: reducedMotion ? 0 : 0.18,
              delay: reducedMotion ? 0 : 0.08,
            }}
          >
            {toolInfo.map((item) => {
              const alternate = alternateTools[tool];
              const current = alternate?.group === item.id ? alternate : item;
              const Icon = current.icon;
              return (
                <div className="ed-tool-group" key={item.id}>
                  <ToolButton
                    title={current.key ? `${current.name} (${current.key})` : current.name}
                    onClick={() => {
                      setTool(alternate?.group === item.id ? tool : item.id);
                      setPenPoints([]);
                    }}
                    active={
                      tool === item.id ||
                      (item.id === 'rectangle' &&
                        ['ellipse', 'line', 'polygon', 'star', 'button'].includes(tool)) ||
                      (item.id === 'frame' && tool === 'section') ||
                      (item.id === 'pen' && tool === 'pencil')
                    }
                  >
                    <Icon size={18} />
                  </ToolButton>
                  {['rectangle', 'frame', 'pen'].includes(item.id) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="ed-tool-chevron"
                          aria-label={`${item.name}更多工具`}
                        >
                          <ChevronDown size={9} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="start">
                        {(item.id === 'rectangle'
                          ? [
                              ['rectangle', '矩形', 'R'],
                              ['ellipse', '椭圆', 'O'],
                              ['line', '直线', 'L'],
                              ['polygon', '多边形', ''],
                              ['star', '星形', ''],
                              ['button', '按钮', ''],
                            ]
                          : item.id === 'frame'
                            ? [
                                ['frame', '画框', 'F'],
                                ['section', '分区', 'S'],
                              ]
                            : [
                                ['pen', '钢笔', 'P'],
                                ['pencil', '铅笔', '⇧ P'],
                              ]
                        ).map(([id, name, key]) => (
                          <DropdownMenuItem
                            key={id}
                            onSelect={() => {
                              setTool(id as Tool);
                              setPenPoints([]);
                            }}
                          >
                            <span className="ed-tool-menu-check">
                              {tool === id && <Check size={13} />}
                            </span>
                            {name}
                            <DropdownMenuShortcut>{key}</DropdownMenuShortcut>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
            <div className="ed-tool-divider" />
            <ToolButton title="插入图片" onClick={() => imageRef.current?.click()}>
              <ImagePlus size={18} />
            </ToolButton>
            <ToolButton title="与凛协作" onClick={onOpenAgent}>
              <RinIcon kind="agent" size={19} />
            </ToolButton>
          </motion.div>
          <div className="ed-canvas-status">
            <span>
              {tool === 'pen'
                ? '点击添加锚点 · Enter 完成 · 点击首点闭合'
                : tool === 'pencil'
                  ? '按住鼠标自由绘制'
                  : tool === 'comment'
                    ? '点击画布留下评论'
                    : spaceDown
                      ? '拖动以平移画布'
                      : `${snap ? '智能吸附已开启 · ' : ''}空格拖动画布`}
            </span>
            <div>
              <span className={`ed-status-dot ${saveState}`} />
              {saveLabel}
              <ToolButton title="键盘快捷键" onClick={() => setShowShortcuts(true)}>
                <CircleHelp size={14} />
              </ToolButton>
            </div>
          </div>
          <AnimatePresence>
            {notice && (
              <motion.div
                key={notice}
                className="ed-toast"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={uiTransition}
              >
                <RinAvatar size={22} />
                {notice}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <motion.div
          className="ed-inspector-shell"
          inert={!inspectorVisible}
          aria-hidden={!inspectorVisible}
          initial={false}
          animate={{
            width: inspectorVisible ? 260 : 0,
            minWidth: inspectorVisible ? 260 : 0,
          }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : expressive
                ? { type: 'spring', stiffness: 360, damping: 34 }
                : uiTransition
          }
        >
          <Inspector
            project={project}
            page={page}
            selection={selection}
            updateNode={updateNode}
            updateSelected={updateSelected}
            updatePage={updatePage}
            commit={commit}
            align={align}
            createComponent={createComponent}
            detach={detach}
            group={group}
            ungroup={ungroup}
            duplicate={duplicate}
            remove={removeSelected}
            exportFile={exportFile}
            onSync={onSync}
            onAgent={onOpenAgent}
          />
        </motion.div>
      </div>
      <input
        type="file"
        ref={importRef}
        className="ed-hidden"
        accept="application/json,.json"
        onChange={(event) => importJson(event.target.files?.[0])}
      />
      <input
        type="file"
        ref={imageRef}
        className="ed-hidden"
        accept="image/*"
        onChange={(event) => uploadImage(event.target.files?.[0])}
      />
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="ed-dialog">
          <DialogHeader>
            <DialogTitle>键盘快捷键</DialogTitle>
            <DialogDescription>熟悉的操作，让设计保持流畅。</DialogDescription>
          </DialogHeader>
          <div className="ed-shortcut-list">
            {shortcuts.map(([name, key]) => (
              <div key={name}>
                <span>{name}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="ed-dialog">
          <DialogHeader>
            <DialogTitle>版本历史</DialogTitle>
            <DialogDescription>将当前页面、组件和主题保存为命名版本。</DialogDescription>
          </DialogHeader>
          <div className="ed-version-create">
            <Input
              aria-label="版本名称"
              value={snapshotName}
              onChange={(event) => setSnapshotName(event.target.value)}
              placeholder={`版本 ${new Date().toLocaleDateString()}`}
            />
            <Button
              onClick={() => {
                commit({
                  ...project,
                  snapshots: [
                    ...(project.snapshots ?? []),
                    {
                      id: uid(),
                      name: snapshotName.trim() || `版本 ${project.revision}`,
                      createdAt: new Date().toISOString(),
                      pages: structuredClone(project.pages),
                      components: structuredClone(project.components),
                      tokens: structuredClone(project.tokens),
                      variableCollections: structuredClone(project.variableCollections ?? []),
                      themeModes: structuredClone(project.themeModes ?? {}),
                      activeMode: project.activeMode,
                      activeVariableModes: structuredClone(project.activeVariableModes ?? {}),
                    },
                  ],
                });
                setSnapshotName('');
                announce('版本已保存');
              }}
            >
              保存版本
            </Button>
          </div>
          <div className="ed-version-list">
            {[...(project.snapshots ?? [])].reverse().map((snapshot) => (
              <div key={snapshot.id}>
                <div>
                  <strong>{snapshot.name}</strong>
                  <small>{new Date(snapshot.createdAt).toLocaleString()}</small>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    commit({
                      ...project,
                      pages: structuredClone(snapshot.pages),
                      components: structuredClone(snapshot.components),
                      tokens: structuredClone(snapshot.tokens),
                      variableCollections: structuredClone(
                        snapshot.variableCollections ?? project.variableCollections,
                      ),
                      themeModes: structuredClone(
                        snapshot.themeModes ??
                          (project.activeMode
                            ? {
                                ...project.themeModes,
                                [project.activeMode]: snapshot.tokens,
                              }
                            : project.themeModes),
                      ),
                      activeMode:
                        snapshot.themeModes !== undefined
                          ? snapshot.activeMode
                          : project.activeMode,
                      activeVariableModes: structuredClone(
                        snapshot.activeVariableModes ?? project.activeVariableModes,
                      ),
                    });
                    setPageId(snapshot.pages[0].id);
                    setShowVersions(false);
                    announce('已恢复版本，可撤销此操作');
                  }}
                >
                  恢复
                </Button>
              </div>
            ))}
            {!project.snapshots?.length && <p className="ed-muted">暂无保存的版本。</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!commentPoint} onOpenChange={(open) => !open && setCommentPoint(undefined)}>
        <DialogContent className="ed-dialog">
          <DialogHeader>
            <DialogTitle>添加评论</DialogTitle>
            <DialogDescription>评论会与当前页面的位置一起保存。</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            aria-label="评论内容"
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder="写下你的反馈…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentPoint(undefined)}>
              取消
            </Button>
            <Button
              disabled={!commentDraft.trim()}
              onClick={() => {
                if (!commentPoint) return;
                commit({
                  ...project,
                  comments: [
                    ...(project.comments ?? []),
                    {
                      id: uid(),
                      pageId: page.id,
                      ...commentPoint,
                      text: commentDraft.trim(),
                      author: '我',
                      createdAt: new Date().toISOString(),
                    },
                  ],
                });
                setCommentPoint(undefined);
                setTool('select');
                setActiveTab('comments');
                setLayersPreference(false);
              }}
            >
              添加评论
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {preview && (
        <PrototypePreview project={project} pageId={page.id} onClose={() => setPreview(false)} />
      )}
    </motion.div>
  );
}
