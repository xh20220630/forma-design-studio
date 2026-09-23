import {
  memo,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDownRight,
  ChevronRight,
  Component,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Pencil,
  GitBranch,
  Grip,
  Layers3,
  Maximize2,
  Minus,
  Palette,
  RefreshCw,
  Scan,
  Search,
  X,
  ZoomIn,
} from "lucide-react";
import type {
  AnnotationNode,
  FlowEdge,
  FlowPageNode,
  WorkspaceDocument,
  WorkspaceChangeSet,
  WorkspaceFlow,
} from "@forma/schema/workbench";
import {
  applyChanges,
  assetUrl,
  getDocument,
  getLocalState,
  getValidation,
  setLocalViewport,
} from "./api.ts";

import { Button } from "@forma/ui/button";
import { Badge } from "@forma/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@forma/ui/dialog";
import { Input } from "@forma/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@forma/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@forma/ui/select";
import Brand from "@forma/ui/brand";
import CanvasRulers from "@forma/ui/canvas-rulers";
import { useStudioTheme, type StudioThemeSettings } from "@forma/ui/studio-theme";

import type { DocumentTarget, AnnotationTarget } from "./DocumentEditors.tsx";
const DocumentEditor = lazy(() => import("./DocumentEditors.tsx"));
const AnnotationEditor = lazy(() => import("./DocumentEditors.tsx").then(module => ({ default: module.AnnotationEditor })));

type Camera = { x: number; y: number; zoom: number };
type Selection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | undefined;
type ViewMode = "flows" | "tokens" | "components";

function edgeGeometry(edge: FlowEdge, nodes: Map<string, FlowPageNode>, camera: Camera) {
  const from = nodes.get(edge.from),
    to = nodes.get(edge.to);
  if (!from && !to) return;
  const worldX1 = from ? from.frame.x + from.frame.width : to!.frame.x - 420;
  const worldY1 = from ? from.frame.y + from.frame.height / 2 : to!.frame.y + to!.frame.height / 2;
  const worldX2 = to ? to.frame.x : from!.frame.x + from!.frame.width + 420;
  const worldY2 = to ? to.frame.y + to.frame.height / 2 : worldY1;
  const x1 = camera.x + worldX1 * camera.zoom;
  const y1 = camera.y + worldY1 * camera.zoom;
  const x2 = camera.x + worldX2 * camera.zoom;
  const y2 = camera.y + worldY2 * camera.zoom;
  const middle = x1 + Math.max(180 * camera.zoom, (x2 - x1) / 2);
  return {
    x1,
    y1,
    x2,
    y2,
    middle,
    path: `M ${x1} ${y1} H ${middle} V ${y2} H ${x2}`,
  };
}

const FlowEdgeView = memo(function FlowEdgeView({
  edge,
  nodes,
  camera,
  selected,
  onSelect,
}: {
  edge: FlowEdge;
  nodes: Map<string, FlowPageNode>;
  camera: Camera;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const geometry = edgeGeometry(edge, nodes, camera);
  if (!geometry) return null;
  const labelX = geometry.middle,
    labelY = (geometry.y1 + geometry.y2) / 2;
  return (
    <>
      <path
        className={`edge-hit ${selected ? "selected" : ""}`}
        d={geometry.path}
        onClick={() => onSelect(edge.id)}
      />
      <path
        className={`edge-path ${edge.crossFlow ? "cross-flow" : ""} ${selected ? "selected" : ""}`}
        d={geometry.path}
        markerEnd="url(#arrow)"
      />
      <foreignObject
        x={labelX - 90 * camera.zoom}
        y={labelY - 13 * camera.zoom}
        width={180 * camera.zoom}
        height={26 * camera.zoom}
        className="edge-label-wrap"
      >
        <div className="edge-label-anchor">
          <Button variant="ghost" size="sm"
            className={`edge-label ${selected ? "selected" : ""}`}
            onClick={() => onSelect(edge.id)}
          >
            {edge.trigger || "转场"}
            {edge.crossFlow ? <small>{edge.to.split("/")[0]}</small> : null}
            <ChevronRight size={14} />
          </Button>
        </div>
      </foreignObject>
    </>
  );
});

const PageNode = memo(function PageNode({
  node,
  camera,
  selected,
  impactCount,
  showAnnotations,
  activeAnnotation,
  onSelect,
  onDragStart,
  onAnnotation,
  onOpenImage,
}: {
  node: FlowPageNode;
  camera: Camera;
  selected: boolean;
  impactCount: number;
  showAnnotations: boolean;
  activeAnnotation?: string;
  onSelect: (id: string) => void;
  onDragStart: (event: ReactPointerEvent, node: FlowPageNode) => void;
  onAnnotation: (node: FlowPageNode, annotation: AnnotationNode) => void;
  onOpenImage: (node: FlowPageNode) => void;
}) {
  return (
    <article
      className={`page-node ${selected ? "selected" : ""}`}
      style={{
        left: camera.x + node.frame.x * camera.zoom,
        top: camera.y + node.frame.y * camera.zoom,
        width: node.frame.width * camera.zoom,
        height: node.frame.height * camera.zoom,
      }}
      onPointerDown={() => onSelect(node.id)}
    >
      <header
        className="page-node-header"
        onPointerDown={(event) => onDragStart(event, node)}
      >
        <div>
          <Grip size={22} />
          <span>
            <strong>{node.name}</strong>
            <small>
              {node.kind} · {node.image.width} × {node.image.height}
            </small>
          </span>
        </div>
        <div>
          {impactCount ? (
            <span className="impact-badge">{impactCount} 影响</span>
          ) : null}
          <Button variant="ghost" size="sm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onOpenImage(node)}
            aria-label="查看原图"
          >
            <Maximize2 size={18} />
          </Button>
        </div>
      </header>
      <div className="page-image-stage">
        <img
          src={assetUrl(node.image.assetPath)}
          width={node.frame.width * camera.zoom}
          height={node.frame.height * camera.zoom}
          alt={node.name}
          draggable={false}
        />
        {showAnnotations && node.annotations.length ? (
          <svg
            className="annotation-leaders"
            viewBox={`0 0 ${node.frame.width * camera.zoom} ${node.frame.height * camera.zoom}`}
            aria-hidden="true"
          >
            {node.annotations.map((annotation) => (
              <g key={annotation.id}>
                <line
                  x1={annotation.x * node.frame.width * camera.zoom}
                  y1={annotation.y * node.frame.height * camera.zoom}
                  x2={annotation.labelX * node.frame.width * camera.zoom}
                  y2={annotation.labelY * node.frame.height * camera.zoom}
                />
                <circle
                  cx={annotation.x * node.frame.width * camera.zoom}
                  cy={annotation.y * node.frame.height * camera.zoom}
                  r={3 * camera.zoom}
                />
              </g>
            ))}
          </svg>
        ) : null}
        {showAnnotations
          ? node.annotations.map((annotation, index) => (
              <Button variant="ghost" size="sm"
                key={annotation.id}
                className={`annotation-pin ${activeAnnotation === `${node.id}/${annotation.id}` ? "active" : ""}`}
                style={{
                  left: `${annotation.labelX * 100}%`,
                  top: `${annotation.labelY * 100}%`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onAnnotation(node, annotation)}
                aria-label={annotation.label}
              >
                {index + 1}
              </Button>
            ))
          : null}
      </div>
    </article>
  );
});

function tokenEntries(value: unknown, prefix = ""): { name: string; value: string }[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => tokenEntries(child, prefix ? `${prefix}.${key}` : key));
  }
  return [{ name: prefix, value: typeof value === "string" ? value : JSON.stringify(value) ?? "—" }];
}

function DesignSystemView({
  mode,
  document,
  onOpenDocument,
}: {
  onOpenDocument: (target: DocumentTarget) => void;
  mode: Exclude<ViewMode, "flows">;
  document: WorkspaceDocument;
}) {
  if (mode === "tokens") {
    const groups = Object.entries(document.designSystem.tokens.tokens);
    return (
      <main className="library-view">
        <header>
          <Palette size={22} />
          <div>
            <h2>主题与变量</h2>
            <p>
              主题 {document.designSystem.tokens.themeVersion} · 系统级语义变量
            </p>
          </div>
        </header>
        <div className="token-groups">
          {groups.map(([name, value]) => (
            <section key={name}>
              <h3>{name}</h3>
              <dl className="token-list">
                {tokenEntries(value).map((token) => (
                  <div key={token.name}>
                    <dt>{token.name || name}</dt>
                    <dd>{/^(#[\da-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i.test(token.value) ? <i className="token-swatch" style={{ background: token.value }} /> : null}<code>{token.value}</code></dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </main>
    );
  }
  return (
    <main className="library-view">
      <header>
        <Component size={22} />
        <div>
          <h2>设计组件</h2>
          <p>{document.designSystem.components.length} 个版本化设计规范</p>
        </div>
      </header>
      <div className="component-grid">
        {document.designSystem.components.map((component) => (
          <article key={`${component.id}@${component.version}`}>
            <div className="component-preview"><Component size={36} /><Badge variant="secondary">v{component.version}</Badge></div>
            <div>
              <span className={`component-status ${component.status}`} />
              {{ draft: "草稿", approved: "已确认", deprecated: "已弃用" }[component.status] || component.status}
            </div>
            <h3>{component.name}</h3>
            <code>
              {component.id}@{component.version}
            </code>
            <p>{component.scope.join(" · ") || "尚未定义适用范围"}</p>
            <Button variant="outline" size="sm" onClick={() => onOpenDocument({ type: "component", id: component.id, version: component.version })}><FileText size={14} />查看规范</Button>
          </article>
        ))}
      </div>
    </main>
  );
}

function FlowDocumentCard({ flow, onOpenDocument }: { flow?: WorkspaceFlow; onOpenDocument: (target: DocumentTarget) => void }) {
  if (!flow) return null;
  const title = flow.brief?.content.match(/^#\s+(.+)$/m)?.[1] || `${flow.name} · 流程文档`;
  return <section className="flow-document-section">
    <h3><FileText size={14} />流程设计依据</h3>
    <p>当前 UI 流程基于以下文档设计</p>
    {flow.brief ? <button className="flow-document-card" onClick={() => onOpenDocument({ type: "brief", flowId: flow.id })}>
      <span className="flow-document-icon"><FileText size={20} /></span><span><strong>{title}</strong><small>design/{flow.brief.path}</small><span className="document-card-action">查看与编辑文档 <ChevronRight size={12} /></span></span>
    </button> : <div className="flow-document-empty">尚未关联流程文档</div>}
  </section>;
}

function Inspector({
  flow,
  selection,
  document,
  onOpenDocument,
  onAnnotation,
}: {
  onOpenDocument: (target: DocumentTarget) => void;
  onAnnotation: (node: FlowPageNode, annotation: AnnotationNode) => void;
  flow?: WorkspaceFlow;
  selection: Selection;
  document: WorkspaceDocument;
}) {
  const node =
    selection?.type === "node"
      ? flow?.nodes.find((item) => item.id === selection.id)
      : undefined;
  const edge =
    selection?.type === "edge"
      ? flow?.edges.find((item) => item.id === selection.id)
      : undefined;
  const impact = node
    ? document.designSystem.impacts.find(
        (item) => item.pageRef === node.pageRef,
      )
    : undefined;
  if (node)
    return (
      <aside className="inspector">
        <div className="inspector-heading">
          <FileImage size={18} />
          <span>页面检查器</span>
        </div>
        <section>
          <span className="eyebrow">{node.kind}</span>
          <h2>{node.name}</h2>
          <p>{node.goal}</p>
        </section>
        {impact ? (
          <section className="impact-panel">
            <h3>版本差异</h3>
            {impact.reasons.map((reason) => (
              <p key={`${reason.type}/${reason.subject}`}>
                <strong>
                  {reason.type === "tokens" ? "Tokens" : reason.subject}
                </strong>
                {reason.message}
              </p>
            ))}
          </section>
        ) : null}
        <section>
          <h3>来源</h3>
          <dl>
            <dt>页面 ID</dt>
            <dd>{node.pageRef}</dd>
            <dt>流程</dt>
            <dd>{flow?.sourcePath}</dd>
            <dt>图片</dt>
            <dd>{node.image.assetPath}</dd>
            <dt>Prompt</dt>
            <dd>{node.promptPath || "未记录"}</dd>
            <dt>尺寸</dt>
            <dd>
              {node.image.width} × {node.image.height}
            </dd>
            <dt>主题</dt>
            <dd>{node.themeVersion}</dd>
          </dl>
        </section>
        <section>
          <h3>组件引用</h3>
          {node.componentUsage.length ? (
            node.componentUsage.map((item) => {
              const component = document.designSystem.components.find(
                (candidate) =>
                  candidate.id === item.id &&
                  candidate.version === item.version,
              );
              return (
                <button className="usage usage-link" key={`${item.id}@${item.version}`} disabled={!component} onClick={() => onOpenDocument({ type: "component", id: item.id, version: item.version })}>
                  <strong>
                    {item.id}@{item.version}
                  </strong>
                  <span>{item.adaptation}</span>
                  <code>{component?.specPath || "规范路径缺失"}</code>
                  <span className="document-card-action">查看规范 <ChevronRight size={12} /></span>
                </button>
              );
            })
          ) : (
            <p className="muted">无组件引用</p>
          )}
        </section>
        <section>
          <h3>设计注释 <span className="muted">{node.annotations.length}</span></h3>
          {node.annotations.length ? node.annotations.map((annotation, index) => <button className="annotation-list-item" key={annotation.id} onClick={() => onAnnotation(node, annotation)}>
            <span>{index + 1}</span><span><strong>{annotation.label}</strong><small>{annotation.text}</small></span><Pencil size={13} />
          </button>) : <p className="muted">暂无设计注释</p>}
        </section>
        <FlowDocumentCard flow={flow} onOpenDocument={onOpenDocument} />
      </aside>
    );
  if (edge)
    return (
      <aside className="inspector">
        <div className="inspector-heading">
          <GitBranch size={18} />
          <span>转场检查器</span>
        </div>
        <section>
          <span className="eyebrow">
            {edge.crossFlow ? "跨流程" : "流程内"}
          </span>
          <h2>{edge.trigger || "未命名转场"}</h2>
        </section>
        <section>
          <dl>
            <dt>转场 ID</dt>
            <dd>{edge.id}</dd>
            <dt>来源文件</dt>
            <dd>{flow?.sourcePath}</dd>
            <dt>起点</dt>
            <dd>{edge.from}</dd>
            <dt>目标</dt>
            <dd>{edge.to}</dd>
            <dt>条件</dt>
            <dd>{edge.condition || "无"}</dd>
            <dt>结果</dt>
            <dd>{edge.effect || "无"}</dd>
          </dl>
        </section>
        <FlowDocumentCard flow={flow} onOpenDocument={onOpenDocument} />
      </aside>
    );
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <Layers3 size={18} />
        <span>流程检查器</span>
      </div>
      <section>
        <span className="eyebrow">当前流程</span>
        <h2>{flow?.name || document.project.name}</h2>
        <p>{flow?.goal || "选择页面或转场查看详情。"}</p>
      </section>
      {flow ? (
        <>
          <section>
            <dl>
              <dt>入口页面</dt>
              <dd>{flow.entryPage}</dd>
              <dt>页面</dt>
              <dd>{flow.nodes.length}</dd>
              <dt>转场</dt>
              <dd>{flow.edges.length}</dd>
              <dt>版本</dt>
              <dd>revision {document.revision}</dd>
            </dl>
          </section>
          <FlowDocumentCard flow={flow} onOpenDocument={onOpenDocument} />
          <section>
            <h3>一致性说明</h3>
            {flow.consistencyNotes.length ? (
              flow.consistencyNotes.map((note) => <p key={note}>{note}</p>)
            ) : (
              <p className="muted">暂无说明</p>
            )}
          </section>
        </>
      ) : null}
    </aside>
  );
}

export default function App() {
  const { settings, presets, updateSettings } = useStudioTheme();
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [document, setDocument] = useState<WorkspaceDocument>();
  const [error, setError] = useState<string>();
  const [activeFlowId, setActiveFlowId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("flows");
  const [selection, setSelection] = useState<Selection>();
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [activeAnnotation, setActiveAnnotation] = useState<AnnotationTarget>();
  const [documentTarget, setDocumentTarget] = useState<DocumentTarget>();
  const [imageViewer, setImageViewer] = useState<FlowPageNode>();
  const [camera, setCamera] = useState<Camera>({ x: 64, y: 64, zoom: 0.28 });
  const [localViewports, setLocalViewports] = useState<Record<string, Camera>>(
    {},
  );
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [search, setSearch] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const gesture = useRef<
    | {
        type: "pan" | "node";
        startX: number;
        startY: number;
        camera?: Camera;
        node?: FlowPageNode;
        origin?: { x: number; y: number };
      }
    | undefined
  >(undefined);

  const load = useCallback(async () => {
    try {
      const [next, validation, localState] = await Promise.all([
        getDocument(),
        getValidation(),
        getLocalState(),
      ]);
      setDocument(current => !current || next.revision >= current.revision ? next : current);
      setError(
        validation.valid
          ? undefined
          : validation.issues.map((item) => item.message).join(" · "),
      );
      setLocalViewports(localState.viewports);
      setActiveFlowId((current) =>
        next.flows.some((flow) => flow.id === current)
          ? current
          : next.flows[0]?.id || "",
      );
      positionsRef.current = {};
      setPositions({});
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "无法加载设计资产。",
      );
    }
  }, []);

  useEffect(() => {
    void load();
    const events = new EventSource("/api/events");
    events.addEventListener("revision", () => void load());
    return () => events.close();
  }, [load]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewMode, !!document]);
  const activeFlow = document?.flows.find((flow) => flow.id === activeFlowId);
  const renderedFlow = useMemo(
    () =>
      activeFlow
        ? {
            ...activeFlow,
            nodes: activeFlow.nodes.map((node) =>
              positions[node.id]
                ? { ...node, frame: { ...node.frame, ...positions[node.id] } }
                : node,
            ),
          }
        : undefined,
    [activeFlow, positions],
  );
  const nodeMap = useMemo(
    () => new Map(renderedFlow?.nodes.map((node) => [node.id, node]) || []),
    [renderedFlow],
  );
  const impactsByPage = useMemo(
    () =>
      new Map(
        document?.designSystem.impacts.map((impact) => [
          impact.pageRef,
          impact,
        ]) || [],
      ),
    [document],
  );
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !document) return [];
    return document.flows
      .flatMap((flow) =>
        flow.nodes
          .filter((node) =>
            `${node.name} ${node.goal} ${node.pageRef}`
              .toLowerCase()
              .includes(query),
          )
          .map((node) => ({ flow, node })),
      )
      .slice(0, 12);
  }, [document, search]);

  const fit = useCallback(() => {
    if (!renderedFlow?.nodes.length || !viewportRef.current) return;
    const minX = Math.min(...renderedFlow.nodes.map((node) => node.frame.x)),
      minY = Math.min(...renderedFlow.nodes.map((node) => node.frame.y));
    const maxX = Math.max(
        ...renderedFlow.nodes.map((node) => node.frame.x + node.frame.width),
      ),
      maxY = Math.max(
        ...renderedFlow.nodes.map(
          (node) => node.frame.y + node.frame.height,
        ),
      );
    const width = maxX - minX,
      height = maxY - minY,
      viewport = viewportRef.current.getBoundingClientRect();
    const zoom = Math.max(
      0.05,
      Math.min(
        0.8,
        Math.min(
          (viewport.width - 120) / width,
          (viewport.height - 120) / height,
        ),
      ),
    );
    setCamera({
      x: (viewport.width - width * zoom) / 2 - minX * zoom,
      y: (viewport.height - height * zoom) / 2 - minY * zoom,
      zoom,
    });
  }, [renderedFlow]);
  useEffect(() => {
    const local = localViewports[activeFlowId];
    if (local) setCamera(local);
    else if (renderedFlow?.defaultViewport)
      setCamera(renderedFlow.defaultViewport);
    else requestAnimationFrame(fit);
  }, [activeFlowId]);
  useEffect(() => {
    if (!document || !activeFlowId) return;
    const timeout = window.setTimeout(() => {
      void setLocalViewport(activeFlowId, camera).catch(() => {
        /* local viewport persistence is non-blocking */
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [activeFlowId, camera, document]);

  const pointerMove = useCallback(
    (event: PointerEvent) => {
      const current = gesture.current;
      if (!current) return;
      if (current.type === "pan" && current.camera)
        setCamera({
          ...current.camera,
          x: current.camera.x + event.clientX - current.startX,
          y: current.camera.y + event.clientY - current.startY,
        });
      if (current.type === "node" && current.node && current.origin)
        setPositions((existing) => {
          const next = {
            ...existing,
            [current.node!.id]: {
              x:
                current.origin!.x +
                (event.clientX - current.startX) / camera.zoom,
              y:
                current.origin!.y +
                (event.clientY - current.startY) / camera.zoom,
            },
          };
          positionsRef.current = next;
          return next;
        });
    },
    [camera.zoom],
  );
  const pointerUp = useCallback(async () => {
    const current = gesture.current;
    gesture.current = undefined;
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", pointerUp);
    if (current?.type === "node" && current.node && document) {
      const position = positionsRef.current[current.node.id];
      if (!position) return;
      try {
        const result = await applyChanges({
          baseRevision: document.revision,
          operations: [
            {
              type: "set-node-position",
              flowId: current.node.pageRef.split("/")[0],
              pageId: current.node.pageRef.split("/")[1],
              ...position,
            },
          ],
        });
        setDocument(result.document);
        positionsRef.current = {};
        setPositions({});
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "无法保存布局。",
        );
      }
    }
  }, [document, pointerMove]);
  const beginGesture = useCallback(
    (value: typeof gesture.current) => {
      gesture.current = value;
      window.addEventListener("pointermove", pointerMove);
      window.addEventListener("pointerup", pointerUp);
    },
    [pointerMove, pointerUp],
  );
  const onCanvasPointerDown = (event: ReactPointerEvent) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(".page-node,.edge-hit,.edge-label,button,.ed-viewport-rulers")
    )
      return;
    setSelection(undefined);
    setActiveAnnotation(undefined);
    beginGesture({
      type: "pan",
      startX: event.clientX,
      startY: event.clientY,
      camera,
    });
  };
  const onNodeDragStart = (event: ReactPointerEvent, node: FlowPageNode) => {
    event.stopPropagation();
    setSelection({ type: "node", id: node.id });
    beginGesture({
      type: "node",
      startX: event.clientX,
      startY: event.clientY,
      node,
      origin: { x: node.frame.x, y: node.frame.y },
    });
  };
  const zoomAt = useCallback((zoom: number, anchor?: { x: number; y: number }) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const point = anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    setCamera((current) => {
      const nextZoom = Math.max(0.05, Math.min(4, zoom));
      return {
        zoom: nextZoom,
        x: point.x - ((point.x - current.x) / current.zoom) * nextZoom,
        y: point.y - ((point.y - current.y) / current.zoom) * nextZoom,
      };
    });
  }, []);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setCamera((current) => {
        const zoom = Math.max(0.05, Math.min(4, current.zoom * Math.exp(-event.deltaY * 0.001)));
        return {
          zoom,
          x: px - ((px - current.x) / current.zoom) * zoom,
          y: py - ((py - current.y) / current.zoom) * zoom,
        };
      });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [viewMode, !!document]);
  const selectResult = (flowId: string, nodeId: string) => {
    setViewMode("flows");
    setActiveFlowId(flowId);
    setSelection({ type: "node", id: nodeId });
    setSearch("");
  };
  const onAnnotation = (node: FlowPageNode, annotation: AnnotationNode) => {
    const [flowId, pageId] = node.pageRef.split("/");
    setSelection({ type: "node", id: node.id });
    setActiveAnnotation({ flowId, pageId, annotationId: annotation.id });
  };
  const saveContent = async (change: WorkspaceChangeSet) => {
    try {
      const result = await applyChanges(change);
      setDocument(current => !current || result.document.revision >= current.revision ? result.document : current);
    } catch (reason) {
      await load();
      throw reason;
    }
  };
  if (!document)
    return (
      <div className="loading">
        <Brand />
        <p>{error || "正在读取设计资产…"}</p>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw size={15} />
          重新加载
        </Button>
      </div>
    );
  return (
    <div className="workbench">
      <header className="topbar">
        <div className="identity">
          <Brand small />
          <div>
            <strong>{document.project.name}</strong>
            <small>Forma · 最小工作台</small>
          </div>
        </div>
        <div className="search">
          <Search size={16} />
          <Input
            aria-label="搜索页面"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索页面、目标或 ID"
          />
          {search ? (
            <Button variant="ghost" size="sm" aria-label="清除搜索" onClick={() => setSearch("")}>
              <X size={15} />
            </Button>
          ) : (
            <span className="search-hint">搜索</span>
          )}
          {searchResults.length ? (
            <div className="search-results">
              {searchResults.map((result) => (
                <Button variant="ghost" size="sm"
                  key={result.node.id}
                  onClick={() => selectResult(result.flow.id, result.node.id)}
                >
                  <FileImage size={16} />
                  <span>
                    <strong>{result.node.name}</strong>
                    <small>
                      {result.flow.name} · {result.node.pageRef}
                    </small>
                  </span>
                  <ArrowDownRight size={15} />
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="top-actions">
          <Select value={settings.preset} onValueChange={(preset) => updateSettings({ preset: preset as StudioThemeSettings["preset"] })}>
            <SelectTrigger size="sm" aria-label="工作台外观"><Palette size={14} /><SelectValue /></SelectTrigger>
            <SelectContent>{presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="ghost" size="sm"
            disabled={viewMode !== "flows"}
            aria-pressed={showAnnotations}
            className={showAnnotations ? "active" : ""}
            onClick={() => setShowAnnotations((value) => !value)}
          >
            {showAnnotations ? <Eye size={16} /> : <EyeOff size={16} />}标注
          </Button>
          <Button variant="ghost" size="sm" disabled={viewMode !== "flows"} onClick={fit}>
            <Scan size={16} />
            适应画布
          </Button>
        </div>
      </header>
      <aside className="sidebar">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
          <TabsList className="mode-switch" aria-label="工作台视图">
            <TabsTrigger value="flows"><GitBranch size={16} />流程</TabsTrigger>
            <TabsTrigger value="components"><Component size={16} />组件</TabsTrigger>
            <TabsTrigger value="tokens"><Palette size={16} />主题</TabsTrigger>
          </TabsList>
        </Tabs>
        {viewMode === "flows" ? (
          <>
            <div className="sidebar-label">
              业务流程 <span>{document.flows.length}</span>
            </div>
            <nav>
              {document.flows.map((flow) => (
                <Button variant="ghost" size="sm"
                  key={flow.id}
                  className={flow.id === activeFlowId ? "active" : ""}
                  onClick={() => {
                    setActiveFlowId(flow.id);
                    setSelection(undefined);
                  }}
                >
                  <span className="flow-symbol">
                    {flow.id.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{flow.name}</strong>
                    <small>
                      {flow.nodes.length} 页面 · {flow.edges.length} 转场
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </Button>
              ))}
            </nav>
          </>
        ) : (
          <div className="system-summary">
            <span className="system-icon">
              <Layers3 size={20} />
            </span>
            <strong>系统设计语言</strong>
            <p>所有流程共享一份组件规范和语义 Tokens。</p>
            {document.designSystem.impacts.length ? (
              <small>
                {document.designSystem.impacts.length} 个页面版本差异
              </small>
            ) : null}
          </div>
        )}
        <footer>
          <div>
            <span className={`theme-state ${document.project.theme.status}`} />
            <span>
              <strong>{document.project.theme.id}</strong>
              <small>主题 {document.project.theme.version}</small>
            </span>
          </div>
        </footer>
      </aside>
      {viewMode === "flows" ? (
        <>
          <section className="canvas-shell forma-canvas">
            <header className="canvas-topbar"><span><Layers3 size={13} />{renderedFlow?.name || "设计画布"}<ChevronRight size={12} /><span>设计画布</span></span><span><Button variant="ghost" size="sm" disabled={!activeFlow?.brief} onClick={() => { if (activeFlow) setDocumentTarget({ type: "brief", flowId: activeFlow.id }); }}><FileText size={13} />流程文档</Button>{renderedFlow?.nodes.length || 0} 个页面</span></header>
          <main
            className="canvas"
            ref={viewportRef}
            onPointerDown={onCanvasPointerDown}
          >
            <div className="canvas-world" style={{ "--flow-zoom": camera.zoom } as CSSProperties}>
              {renderedFlow ? (
                <>
                  <svg className="edges" width={viewportSize.width} height={viewportSize.height}>
                    <defs>
                      <marker
                        id="arrow"
                        markerWidth="6"
                        markerHeight="6"
                        refX="6"
                        refY="3"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <path d="M0,0 L0,6 L6,3 z" />
                      </marker>
                    </defs>
                    {renderedFlow.edges.map((edge) => (
                      <FlowEdgeView
                        key={edge.id}
                        edge={edge}
                        nodes={nodeMap}
                        camera={camera}
                        selected={
                          selection?.type === "edge" && selection.id === edge.id
                        }
                        onSelect={(id) => setSelection({ type: "edge", id })}
                      />
                    ))}
                  </svg>
                  {renderedFlow.nodes.map((node) => (
                    <PageNode
                      key={node.id}
                      node={node}
                      camera={camera}
                      impactCount={
                        impactsByPage.get(node.pageRef)?.reasons.length || 0
                      }
                      selected={
                        selection?.type === "node" && selection.id === node.id
                      }
                      showAnnotations={showAnnotations}
                      activeAnnotation={activeAnnotation ? `${activeAnnotation.flowId}/${activeAnnotation.pageId}/${activeAnnotation.annotationId}` : undefined}
                      onSelect={(id) => setSelection({ type: "node", id })}
                      onDragStart={onNodeDragStart}
                      onAnnotation={onAnnotation}
                      onOpenImage={setImageViewer}
                    />
                  ))}
                </>
              ) : (
                <div className="empty-flow">尚未创建流程</div>
              )}
            </div>
            <CanvasRulers zoom={camera.zoom} origin={camera} viewport={viewportSize} onFit={fit} />
            <div className="zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={fit} aria-label="适应画布"><Scan size={16} /></Button>
              <Button variant="ghost" size="sm"
                disabled={camera.zoom <= 0.05}
                onClick={() => zoomAt(camera.zoom / 1.2)}
              >
                <Minus size={16} /><span className="sr-only">缩小</span>
              </Button>
              <Button variant="ghost" size="sm" className="zoom-reset" aria-label="恢复 100% 缩放" onClick={() => zoomAt(1)}>{Math.round(camera.zoom * 100)}%</Button>
              <Button variant="ghost" size="sm"
                disabled={camera.zoom >= 4}
                onClick={() => zoomAt(camera.zoom * 1.2)}
              >
                <ZoomIn size={16} /><span className="sr-only">放大</span>
              </Button>
            </div>
          </main>
          <footer className="canvas-status"><span>拖动画布平移 · 滚轮缩放</span><span>已载入 · r{document.revision}</span></footer>
          </section>
          <Inspector
            flow={renderedFlow}
            selection={selection}
            document={document}
            onOpenDocument={setDocumentTarget}
            onAnnotation={onAnnotation}
          />
        </>
      ) : (
        <DesignSystemView mode={viewMode} document={document} onOpenDocument={setDocumentTarget} />
      )}
      {documentTarget ? <Suspense fallback={<div className="editor-loading" role="status">正在打开文档…</div>}><DocumentEditor key={JSON.stringify(documentTarget)} target={documentTarget} document={document} onSave={saveContent} onClose={() => setDocumentTarget(undefined)} /></Suspense> : null}
      {activeAnnotation ? <Suspense fallback={<div className="editor-loading" role="status">正在打开注释…</div>}><AnnotationEditor key={JSON.stringify(activeAnnotation)} target={activeAnnotation} document={document} onSave={saveContent} onClose={() => setActiveAnnotation(undefined)} onNavigate={pageRef => selectResult(pageRef.split("/")[0], pageRef)} /></Suspense> : null}
      {imageViewer ? (
        <Dialog open onOpenChange={(open) => { if (!open) setImageViewer(undefined); }}>
        <DialogContent className="image-viewer" showCloseButton={false}>
          <header>
            <div>
              <FileImage size={18} />
              <span>
                <DialogTitle>{imageViewer.name}</DialogTitle>
                <DialogDescription asChild><small>
                  {imageViewer.image.width} × {imageViewer.image.height}
                </small></DialogDescription>
              </span>
            </div>
            <a
              href={assetUrl(imageViewer.image.assetPath)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              打开原图
            </a>
            <Button variant="ghost" size="sm" aria-label="关闭原图" onClick={() => setImageViewer(undefined)}>
              <X size={18} />
            </Button>
          </header>
          <div>
            <img
              src={assetUrl(imageViewer.image.assetPath)}
              alt={imageViewer.name}
            />
          </div>
        </DialogContent>
        </Dialog>
      ) : null}
      {error ? (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <Button variant="ghost" size="sm" aria-label="关闭错误提示" onClick={() => setError(undefined)}>
            <X size={14} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
