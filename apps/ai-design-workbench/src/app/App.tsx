import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowDownRight,
  ChevronRight,
  Component,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  GitBranch,
  Layers3,
  Minus,
  Palette,
  RefreshCw,
  Scan,
  Search,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  AnnotationNode,
  FlowPageNode,
  WorkspaceDocument,
  WorkspaceChangeSet,
} from '@forma/schema/workbench';
import {
  applyChanges,
  assetUrl,
  getDocument,
  getLocalState,
  getValidation,
  setLocalViewport,
} from '../shared/api/client.ts';
import { Button } from '@forma/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@forma/ui/dialog';
import { Input } from '@forma/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@forma/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@forma/ui/select';
import Brand from '@forma/ui/brand';
import CanvasRulers from '@forma/ui/canvas-rulers';
import { useStudioTheme, type StudioThemeSettings } from '@forma/ui/studio-theme';
import type { DocumentTarget, AnnotationTarget } from '../features/documents/model/types.ts';
import type { Camera, Selection, ViewMode } from '../shared/types/workbench.ts';
import { FlowEdgeView } from '../features/flow-canvas/components/FlowEdgeView.tsx';
import { PageNode } from '../features/flow-canvas/components/PageNode.tsx';
import { DesignSystemView } from '../features/design-system/components/DesignSystemView.tsx';
import { Inspector } from '../features/inspector/components/Inspector.tsx';

const DocumentEditor = lazy(() => import('../features/documents/components/DocumentEditor.tsx'));

const AnnotationEditor = lazy(() =>
  import('../features/documents/components/AnnotationEditor.tsx').then((module) => ({
    default: module.AnnotationEditor,
  })),
);

/**
 * 呈现应用主界面，将展示与交互入口放在同一个组件中维护。
 * @returns 供 React 渲染的界面内容。
 */
export default function App() {
  const { settings, presets, updateSettings } = useStudioTheme();
  /** 界面状态：流程画布可用区域的宽高。通过状态更新驱动界面刷新。 */
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  /** 界面状态：解析后的完整工作空间文档。通过状态更新驱动界面刷新。 */
  const [document, setDocument] = useState<WorkspaceDocument>();
  /** 界面状态：当前操作的失败信息，供界面反馈或重试判断。通过状态更新驱动界面刷新。 */
  const [error, setError] = useState<string>();
  /** 界面状态：当前打开的业务流程标识。通过状态更新驱动界面刷新。 */
  const [activeFlowId, setActiveFlowId] = useState('');
  /** 界面状态：工作台当前采用的展示方式。通过状态更新驱动界面刷新。 */
  const [viewMode, setViewMode] = useState<ViewMode>('flows');
  /** 界面状态：当前选区或所选对象。通过状态更新驱动界面刷新。 */
  const [selection, setSelection] = useState<Selection>();
  /** 界面状态：是否在页面图片上显示标注。通过状态更新驱动界面刷新。 */
  const [showAnnotations, setShowAnnotations] = useState(true);
  /** 界面状态：当前选中的标注。通过状态更新驱动界面刷新。 */
  const [activeAnnotation, setActiveAnnotation] = useState<AnnotationTarget>();
  /** 界面状态：当前打开的规范或简报文档。通过状态更新驱动界面刷新。 */
  const [documentTarget, setDocumentTarget] = useState<DocumentTarget>();
  /** 界面状态：当前放大查看的图片。通过状态更新驱动界面刷新。 */
  const [imageViewer, setImageViewer] = useState<FlowPageNode>();
  /** 界面状态：用于坐标换算的当前视口状态。通过状态更新驱动界面刷新。 */
  const [camera, setCamera] = useState<Camera>({ x: 64, y: 64, zoom: 0.28 });
  /** 界面状态：各流程在本机保存的缩放与平移状态。通过状态更新驱动界面刷新。 */
  const [localViewports, setLocalViewports] = useState<Record<string, Camera>>({});
  /** 界面状态：按节点标识保存的临时拖动坐标。通过状态更新驱动界面刷新。 */
  const [positions, setPositions] = useState<
    Record<
      string,
      {
        /** 水平方向的位置。 */
        x: number;
        /** 垂直方向的位置。 */
        y: number;
      }
    >
  >({});
  /** 界面状态：用于筛选列表的搜索文本。通过状态更新驱动界面刷新。 */
  const [search, setSearch] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<
    Record<
      string,
      {
        /** 水平方向的位置。 */
        x: number;
        /** 垂直方向的位置。 */
        y: number;
      }
    >
  >({});
  const gesture = useRef<
    | {
        /** 用于区分数据形态或行为分支的类型。取值：pan、node（页面节点）。 */
        type: 'pan' | 'node';
        /** 指针操作开始时的水平位置。 */
        startX: number;
        /** 指针操作开始时的垂直位置。 */
        startY: number;
        /** 用于坐标换算的当前视口状态。 */
        camera?: Camera;
        /** 当前处理的设计节点。 */
        node?: FlowPageNode;
        /** 本次操作开始时的位置或状态。 */
        origin?: {
          /** 水平方向的位置。 */
          x: number;
          /** 垂直方向的位置。 */
          y: number;
        };
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
      setDocument((current) => (!current || next.revision >= current.revision ? next : current));
      setError(
        validation.valid ? undefined : validation.issues.map((item) => item.message).join(' · '),
      );
      setLocalViewports(localState.viewports);
      setActiveFlowId((current) =>
        next.flows.some((flow) => flow.id === current) ? current : next.flows[0]?.id || '',
      );
      positionsRef.current = {};
      setPositions({});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '无法加载设计资产。');
    }
  }, []);

  useEffect(() => {
    void load();
    const events = new EventSource('/api/events');
    events.addEventListener('revision', () => void load());
    return () => events.close();
  }, [load]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
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
    () => new Map(document?.designSystem.impacts.map((impact) => [impact.pageRef, impact]) || []),
    [document],
  );
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !document) return [];
    return document.flows
      .flatMap((flow) =>
        flow.nodes
          .filter((node) =>
            `${node.name} ${node.goal} ${node.pageRef}`.toLowerCase().includes(query),
          )
          .map((node) => ({ flow, node })),
      )
      .slice(0, 12);
  }, [document, search]);

  const fit = useCallback(() => {
    if (!renderedFlow?.nodes.length || !viewportRef.current) return;
    const minX = Math.min(...renderedFlow.nodes.map((node) => node.frame.x)),
      minY = Math.min(...renderedFlow.nodes.map((node) => node.frame.y));
    const maxX = Math.max(...renderedFlow.nodes.map((node) => node.frame.x + node.frame.width)),
      maxY = Math.max(...renderedFlow.nodes.map((node) => node.frame.y + node.frame.height));
    const width = maxX - minX,
      height = maxY - minY,
      viewport = viewportRef.current.getBoundingClientRect();
    const zoom = Math.max(
      0.05,
      Math.min(0.8, Math.min((viewport.width - 120) / width, (viewport.height - 120) / height)),
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
    else if (renderedFlow?.defaultViewport) setCamera(renderedFlow.defaultViewport);
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

  // 位移始终以手势起点为基准，避免连续移动时累积误差。
  const pointerMove = useCallback(
    (event: PointerEvent) => {
      const current = gesture.current;
      if (!current) return;
      if (current.type === 'pan' && current.camera)
        setCamera({
          ...current.camera,
          x: current.camera.x + event.clientX - current.startX,
          y: current.camera.y + event.clientY - current.startY,
        });
      if (current.type === 'node' && current.node && current.origin)
        setPositions((existing) => {
          const next = {
            ...existing,
            [current.node!.id]: {
              x: current.origin!.x + (event.clientX - current.startX) / camera.zoom,
              y: current.origin!.y + (event.clientY - current.startY) / camera.zoom,
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
    window.removeEventListener('pointermove', pointerMove);
    window.removeEventListener('pointerup', pointerUp);
    if (current?.type === 'node' && current.node && document) {
      const position = positionsRef.current[current.node.id];
      if (!position) return;
      try {
        const result = await applyChanges({
          baseRevision: document.revision,
          operations: [
            {
              type: 'set-node-position',
              flowId: current.node.pageRef.split('/')[0],
              pageId: current.node.pageRef.split('/')[1],
              ...position,
            },
          ],
        });
        setDocument(result.document);
        positionsRef.current = {};
        setPositions({});
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '无法保存布局。');
      }
    }
  }, [document, pointerMove]);
  const beginGesture = useCallback(
    (value: typeof gesture.current) => {
      gesture.current = value;
      window.addEventListener('pointermove', pointerMove);
      window.addEventListener('pointerup', pointerUp);
    },
    [pointerMove, pointerUp],
  );
  const onCanvasPointerDown = (event: ReactPointerEvent) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('.page-node,.edge-hit,.edge-label,button,.ed-viewport-rulers')
    )
      return;
    setSelection(undefined);
    setActiveAnnotation(undefined);
    beginGesture({
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      camera,
    });
  };
  const onNodeDragStart = (event: ReactPointerEvent, node: FlowPageNode) => {
    event.stopPropagation();
    setSelection({ type: 'node', id: node.id });
    beginGesture({
      type: 'node',
      startX: event.clientX,
      startY: event.clientY,
      node,
      origin: { x: node.frame.x, y: node.frame.y },
    });
  };
  // 缩放时保持锚点下的画布内容在屏幕上的位置不变。
  const zoomAt = useCallback(
    (
      zoom: number,
      anchor?: {
        /** 水平方向的位置。 */
        x: number;
        /** 垂直方向的位置。 */
        y: number;
      },
    ) => {
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
    },
    [],
  );
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
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [viewMode, !!document]);
  const selectResult = (flowId: string, nodeId: string) => {
    setViewMode('flows');
    setActiveFlowId(flowId);
    setSelection({ type: 'node', id: nodeId });
    setSearch('');
  };
  const onAnnotation = (node: FlowPageNode, annotation: AnnotationNode) => {
    const [flowId, pageId] = node.pageRef.split('/');
    setSelection({ type: 'node', id: node.id });
    setActiveAnnotation({ flowId, pageId, annotationId: annotation.id });
  };
  const saveContent = async (change: WorkspaceChangeSet) => {
    try {
      const result = await applyChanges(change);
      setDocument((current) =>
        !current || result.document.revision >= current.revision ? result.document : current,
      );
    } catch (reason) {
      await load();
      throw reason;
    }
  };
  if (!document)
    return (
      <div className="loading">
        <Brand />
        <p>{error || '正在读取设计资产…'}</p>
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
            <Button variant="ghost" size="sm" aria-label="清除搜索" onClick={() => setSearch('')}>
              <X size={15} />
            </Button>
          ) : (
            <span className="search-hint">搜索</span>
          )}
          {searchResults.length ? (
            <div className="search-results">
              {searchResults.map((result) => (
                <Button
                  variant="ghost"
                  size="sm"
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
          <Select
            value={settings.preset}
            onValueChange={(preset) =>
              updateSettings({ preset: preset as StudioThemeSettings['preset'] })
            }
          >
            <SelectTrigger size="sm" aria-label="工作台外观">
              <Palette size={14} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            disabled={viewMode !== 'flows'}
            aria-pressed={showAnnotations}
            className={showAnnotations ? 'active' : ''}
            onClick={() => setShowAnnotations((value) => !value)}
          >
            {showAnnotations ? <Eye size={16} /> : <EyeOff size={16} />}标注
          </Button>
          <Button variant="ghost" size="sm" disabled={viewMode !== 'flows'} onClick={fit}>
            <Scan size={16} />
            适应画布
          </Button>
        </div>
      </header>
      <aside className="sidebar">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
          <TabsList className="mode-switch" aria-label="工作台视图">
            <TabsTrigger value="flows">
              <GitBranch size={16} />
              流程
            </TabsTrigger>
            <TabsTrigger value="components">
              <Component size={16} />
              组件
            </TabsTrigger>
            <TabsTrigger value="tokens">
              <Palette size={16} />
              主题
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {viewMode === 'flows' ? (
          <>
            <div className="sidebar-label">
              业务流程 <span>{document.flows.length}</span>
            </div>
            <nav>
              {document.flows.map((flow) => (
                <Button
                  variant="ghost"
                  size="sm"
                  key={flow.id}
                  className={flow.id === activeFlowId ? 'active' : ''}
                  onClick={() => {
                    setActiveFlowId(flow.id);
                    setSelection(undefined);
                  }}
                >
                  <span className="flow-symbol">{flow.id.slice(0, 1).toUpperCase()}</span>
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
              <small>{document.designSystem.impacts.length} 个页面版本差异</small>
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
      {viewMode === 'flows' ? (
        <>
          <section className="canvas-shell forma-canvas">
            <header className="canvas-topbar">
              <span>
                <Layers3 size={13} />
                {renderedFlow?.name || '设计画布'}
                <ChevronRight size={12} />
                <span>设计画布</span>
              </span>
              <span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!activeFlow?.brief}
                  onClick={() => {
                    if (activeFlow) setDocumentTarget({ type: 'brief', flowId: activeFlow.id });
                  }}
                >
                  <FileText size={13} />
                  流程文档
                </Button>
                {renderedFlow?.nodes.length || 0} 个页面
              </span>
            </header>
            <main className="canvas" ref={viewportRef} onPointerDown={onCanvasPointerDown}>
              <div className="canvas-world" style={{ '--flow-zoom': camera.zoom } as CSSProperties}>
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
                          selected={selection?.type === 'edge' && selection.id === edge.id}
                          onSelect={(id) => setSelection({ type: 'edge', id })}
                        />
                      ))}
                    </svg>
                    {renderedFlow.nodes.map((node) => (
                      <PageNode
                        key={node.id}
                        node={node}
                        camera={camera}
                        impactCount={impactsByPage.get(node.pageRef)?.reasons.length || 0}
                        selected={selection?.type === 'node' && selection.id === node.id}
                        showAnnotations={showAnnotations}
                        activeAnnotation={
                          activeAnnotation
                            ? `${activeAnnotation.flowId}/${activeAnnotation.pageId}/${activeAnnotation.annotationId}`
                            : undefined
                        }
                        onSelect={(id) => setSelection({ type: 'node', id })}
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
              <CanvasRulers
                zoom={camera.zoom}
                origin={camera}
                viewport={viewportSize}
                onFit={fit}
              />
              <div className="zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={fit} aria-label="适应画布">
                  <Scan size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={camera.zoom <= 0.05}
                  onClick={() => zoomAt(camera.zoom / 1.2)}
                >
                  <Minus size={16} />
                  <span className="sr-only">缩小</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="zoom-reset"
                  aria-label="恢复 100% 缩放"
                  onClick={() => zoomAt(1)}
                >
                  {Math.round(camera.zoom * 100)}%
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={camera.zoom >= 4}
                  onClick={() => zoomAt(camera.zoom * 1.2)}
                >
                  <ZoomIn size={16} />
                  <span className="sr-only">放大</span>
                </Button>
              </div>
            </main>
            <footer className="canvas-status">
              <span>拖动画布平移 · 滚轮缩放</span>
              <span>已载入 · r{document.revision}</span>
            </footer>
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
      {documentTarget ? (
        <Suspense
          fallback={
            <div className="editor-loading" role="status">
              正在打开文档…
            </div>
          }
        >
          <DocumentEditor
            key={JSON.stringify(documentTarget)}
            target={documentTarget}
            document={document}
            onSave={saveContent}
            onClose={() => setDocumentTarget(undefined)}
          />
        </Suspense>
      ) : null}
      {activeAnnotation ? (
        <Suspense
          fallback={
            <div className="editor-loading" role="status">
              正在打开注释…
            </div>
          }
        >
          <AnnotationEditor
            key={JSON.stringify(activeAnnotation)}
            target={activeAnnotation}
            document={document}
            onSave={saveContent}
            onClose={() => setActiveAnnotation(undefined)}
            onNavigate={(pageRef) => selectResult(pageRef.split('/')[0], pageRef)}
          />
        </Suspense>
      ) : null}
      {imageViewer ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setImageViewer(undefined);
          }}
        >
          <DialogContent className="image-viewer" showCloseButton={false}>
            <header>
              <div>
                <FileImage size={18} />
                <span>
                  <DialogTitle>{imageViewer.name}</DialogTitle>
                  <DialogDescription asChild>
                    <small>
                      {imageViewer.image.width} × {imageViewer.image.height}
                    </small>
                  </DialogDescription>
                </span>
              </div>
              <a href={assetUrl(imageViewer.image.assetPath)} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                打开原图
              </a>
              <Button
                variant="ghost"
                size="sm"
                aria-label="关闭原图"
                onClick={() => setImageViewer(undefined)}
              >
                <X size={18} />
              </Button>
            </header>
            <div>
              <img src={assetUrl(imageViewer.image.assetPath)} alt={imageViewer.name} />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {error ? (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="关闭错误提示"
            onClick={() => setError(undefined)}
          >
            <X size={14} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
