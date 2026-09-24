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
} from 'lucide-react';
import type {
  AnnotationNode,
  FlowEdge,
  FlowPageNode,
  WorkspaceDocument,
  WorkspaceChangeSet,
  WorkspaceFlow,
} from '@forma/schema/workbench';
import {
  applyChanges,
  assetUrl,
  getDocument,
  getLocalState,
  getValidation,
  setLocalViewport,
} from './api.ts';

import { Button } from '@forma/ui/button';
import { Badge } from '@forma/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@forma/ui/dialog';
import { Input } from '@forma/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@forma/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@forma/ui/select';
import Brand from '@forma/ui/brand';
import CanvasRulers from '@forma/ui/canvas-rulers';
import { useStudioTheme, type StudioThemeSettings } from '@forma/ui/studio-theme';

import type { DocumentTarget, AnnotationTarget } from './DocumentEditors.tsx';
const DocumentEditor = lazy(
  /** 执行 App 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
  () => import('./DocumentEditors.tsx'),
);
const AnnotationEditor = lazy(
  /**
   * 执行 App 传入的局部处理步骤，使调用处能够控制结果如何更新。
   * @returns 当前步骤的处理结果。
   */
  () =>
    import('./DocumentEditors.tsx').then(
      /** 在 App 的异步步骤结束后处理结果。 @param module - 按需加载的模块对象。 @returns 当前步骤的处理结果。 */
      (module) => ({ default: module.AnnotationEditor }),
    ),
);

/** 流程画布的缩放与平移状态，用于将页面坐标转换到屏幕。 */
type Camera = {
  /** 水平方向的位置。 */
  x: number;
  /** 垂直方向的位置。 */
  y: number;
  /** 缩放倍率，1 表示原始尺寸。 */
  zoom: number;
};
/** 当前选中的流程对象，驱动画布高亮与侧栏详情。 */
type Selection =
  | {
      /** 用于区分数据形态或行为分支的类型。取值：node（页面节点）。 */
      type: 'node';
      /** 唯一标识，用于查找、更新和建立引用。 */
      id: string;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：edge（流程连线）。 */
      type: 'edge';
      /** 唯一标识，用于查找、更新和建立引用。 */
      id: string;
    }
  | undefined;
/**
 * 工作台展示方式，集中定义允许的分支以保持调用方一致。
 * 取值：flows（业务流程）、tokens（主题 Token）、components（组件库）。
 */
type ViewMode = 'flows' | 'tokens' | 'components';

/**
 * 根据流程页位置计算连接线形状，使拖动页面后连线仍正确连接。
 *
 * @param edge - 连接两个页面的流程边。
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param camera - 用于坐标换算的当前视口状态。
 * @returns 流程边的几何数据。
 */
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

const FlowEdgeView = memo(
  /**
   * 呈现流程连线，将展示与交互入口放在同一个组件中维护。
   *
   * @param props - 按字段解构的输入，字段用途见对应类型定义。
   * @param props.edge - 连接两个页面的流程边。
   * @param props.nodes - 按约定顺序保存的设计节点集合。
   * @param props.camera - 用于坐标换算的当前视口状态。
   * @param props.selected - 当前选择的对象或选中状态。
   * @param props.onSelect - 在选择时通知调用方，由外层决定如何更新业务状态。
   * @returns 供 React 渲染的界面内容。
   */
  function FlowEdgeView({
    edge,
    nodes,
    camera,
    selected,
    onSelect,
  }: {
    /** 连接两个页面的流程边。 */
    edge: FlowEdge;
    /** 按约定顺序保存的设计节点集合。 */
    nodes: Map<string, FlowPageNode>;
    /** 用于坐标换算的当前视口状态。 */
    camera: Camera;
    /** 当前选择的对象或选中状态。 */
    selected: boolean;
    /**
     * 在选择时通知调用方，由外层决定如何更新业务状态。
     * @param id - 唯一标识，用于查找、更新和建立引用。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    onSelect: (id: string) => void;
  }) {
    const geometry = edgeGeometry(edge, nodes, camera);
    if (!geometry) return null;
    const labelX = geometry.middle,
      labelY = (geometry.y1 + geometry.y2) / 2;
    return (
      <>
        <path
          className={`edge-hit ${selected ? 'selected' : ''}`}
          d={geometry.path}
          onClick={
            /** 响应 onClick 交互，将用户操作应用到流程连线。 @returns 无返回值；通过副作用完成当前操作。 */
            () => onSelect(edge.id)
          }
        />
        <path
          className={`edge-path ${edge.crossFlow ? 'cross-flow' : ''} ${selected ? 'selected' : ''}`}
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
            <Button
              variant="ghost"
              size="sm"
              className={`edge-label ${selected ? 'selected' : ''}`}
              onClick={
                /** 响应 onClick 交互，将用户操作应用到流程连线。 @returns 无返回值；通过副作用完成当前操作。 */
                () => onSelect(edge.id)
              }
            >
              {edge.trigger || '转场'}
              {edge.crossFlow ? <small>{edge.to.split('/')[0]}</small> : null}
              <ChevronRight size={14} />
            </Button>
          </div>
        </foreignObject>
      </>
    );
  },
);

const PageNode = memo(
  /**
   * 呈现流程页面节点，将展示与交互入口放在同一个组件中维护。
   *
   * @param props - 按字段解构的输入，字段用途见对应类型定义。
   * @param props.node - 当前处理的设计节点。
   * @param props.camera - 用于坐标换算的当前视口状态。
   * @param props.selected - 当前选择的对象或选中状态。
   * @param props.impactCount - 受设计系统版本变化影响的页面数量。
   * @param props.showAnnotations - 是否在页面图片上显示标注。
   * @param props.activeAnnotation - 当前选中的标注。
   * @param props.onSelect - 在选择时通知调用方，由外层决定如何更新业务状态。
   * @param props.onDragStart - 在开始拖动时通知调用方，由外层决定如何更新业务状态。
   * @param props.onAnnotation - 在标注时通知调用方，由外层决定如何更新业务状态。
   * @param props.onOpenImage - 在查看图片时通知调用方，由外层决定如何更新业务状态。
   * @returns 供 React 渲染的界面内容。
   */
  function PageNode({
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
    /** 当前处理的设计节点。 */
    node: FlowPageNode;
    /** 用于坐标换算的当前视口状态。 */
    camera: Camera;
    /** 当前选择的对象或选中状态。 */
    selected: boolean;
    /** 受设计系统版本变化影响的页面数量。 */
    impactCount: number;
    /** 是否在页面图片上显示标注。 */
    showAnnotations: boolean;
    /** 当前选中的标注。 */
    activeAnnotation?: string;
    /**
     * 在选择时通知调用方，由外层决定如何更新业务状态。
     * @param id - 唯一标识，用于查找、更新和建立引用。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    onSelect: (id: string) => void;
    /**
     * 在开始拖动时通知调用方，由外层决定如何更新业务状态。
     * @param event - 当前事件及其触发位置。
     * @param node - 当前处理的设计节点。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    onDragStart: (event: ReactPointerEvent, node: FlowPageNode) => void;
    /**
     * 在标注时通知调用方，由外层决定如何更新业务状态。
     * @param node - 当前处理的设计节点。
     * @param annotation - 待保存的定位标注。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    onAnnotation: (node: FlowPageNode, annotation: AnnotationNode) => void;
    /**
     * 在查看图片时通知调用方，由外层决定如何更新业务状态。
     * @param node - 当前处理的设计节点。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    onOpenImage: (node: FlowPageNode) => void;
  }) {
    return (
      <article
        className={`page-node ${selected ? 'selected' : ''}`}
        style={{
          left: camera.x + node.frame.x * camera.zoom,
          top: camera.y + node.frame.y * camera.zoom,
          width: node.frame.width * camera.zoom,
          height: node.frame.height * camera.zoom,
        }}
        onPointerDown={
          /** 响应 onPointerDown 交互，将用户操作应用到流程页面节点。 @returns 无返回值；通过副作用完成当前操作。 */
          () => onSelect(node.id)
        }
      >
        <header
          className="page-node-header"
          onPointerDown={
            /** 响应 onPointerDown 交互，将用户操作应用到流程页面节点。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
            (event) => onDragStart(event, node)
          }
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
            {impactCount ? <span className="impact-badge">{impactCount} 影响</span> : null}
            <Button
              variant="ghost"
              size="sm"
              onPointerDown={
                /** 响应 onPointerDown 交互，将用户操作应用到流程页面节点。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                (event) => event.stopPropagation()
              }
              onClick={
                /** 响应 onClick 交互，将用户操作应用到流程页面节点。 @returns 无返回值；通过副作用完成当前操作。 */
                () => onOpenImage(node)
              }
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
              {node.annotations.map(
                /**
                 * 转换流程页面节点中的集合条目，供后续处理或展示。
                 *
                 * @param annotation - 待保存的定位标注。
                 * @returns 当前条目转换后的结果。
                 */
                (annotation) => (
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
                ),
              )}
            </svg>
          ) : null}
          {showAnnotations
            ? node.annotations.map(
                /**
                 * 转换流程页面节点中的集合条目，供后续处理或展示。
                 *
                 * @param annotation - 待保存的定位标注。
                 * @param index - 空间查询索引或当前条目的位置。
                 * @returns 当前条目转换后的结果。
                 */
                (annotation, index) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    key={annotation.id}
                    className={`annotation-pin ${activeAnnotation === `${node.id}/${annotation.id}` ? 'active' : ''}`}
                    style={{
                      left: `${annotation.labelX * 100}%`,
                      top: `${annotation.labelY * 100}%`,
                    }}
                    onPointerDown={
                      /** 响应 onPointerDown 交互，将用户操作应用到流程页面节点。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                      (event) => event.stopPropagation()
                    }
                    onClick={
                      /** 响应 onClick 交互，将用户操作应用到流程页面节点。 @returns 无返回值；通过副作用完成当前操作。 */
                      () => onAnnotation(node, annotation)
                    }
                    aria-label={annotation.label}
                  >
                    {index + 1}
                  </Button>
                ),
              )
            : null}
        </div>
      </article>
    );
  },
);

/**
 * 整理语义 Token 为展示条目，便于设计系统面板按组浏览。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param prefix - 生成名称、路径或标签时使用的前缀。
 * @returns 可展示的 Token 条目。
 */
function tokenEntries(
  value: unknown,
  prefix = '',
): {
  /** 面向用户展示的名称。 */
  name: string;
  /** 当前字段、模式或控件的取值。 */
  value: string;
}[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(
      /**
       * 转换 tokenEntries 中的集合条目并展开结果，供后续处理或展示。
       *
       * @param options - 按顺序解构的当前条目。
       * @param options.key - 要访问或更新的字段名。
       * @param options.child - 当前处理的子节点。
       * @returns 当前条目展开后的结果。
       */
      ([key, child]) => tokenEntries(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [
    { name: prefix, value: typeof value === 'string' ? value : (JSON.stringify(value) ?? '—') },
  ];
}

/**
 * 呈现设计系统面板，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.mode - 当前使用的模式或操作方式。
 * @param props.document - 解析后的完整工作空间文档。
 * @param props.onOpenDocument - 在打开文档时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
function DesignSystemView({
  mode,
  document,
  onOpenDocument,
}: {
  /**
   * 在打开文档时通知调用方，由外层决定如何更新业务状态。
   * @param target - 操作作用的目标。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onOpenDocument: (target: DocumentTarget) => void;
  /** 当前使用的模式或操作方式。 */
  mode: Exclude<ViewMode, 'flows'>;
  /** 解析后的完整工作空间文档。 */
  document: WorkspaceDocument;
}) {
  if (mode === 'tokens') {
    const groups = Object.entries(document.designSystem.tokens.tokens);
    return (
      <main className="library-view">
        <header>
          <Palette size={22} />
          <div>
            <h2>主题与变量</h2>
            <p>主题 {document.designSystem.tokens.themeVersion} · 系统级语义变量</p>
          </div>
        </header>
        <div className="token-groups">
          {groups.map(
            /**
             * 转换设计系统面板中的集合条目，供后续处理或展示。
             *
             * @param options - 按顺序解构的当前条目。
             * @param options.name - 面向用户展示的名称。
             * @param options.value - 当前字段、模式或控件的取值。
             * @returns 当前条目转换后的结果。
             */
            ([name, value]) => (
              <section key={name}>
                <h3>{name}</h3>
                <dl className="token-list">
                  {tokenEntries(value).map(
                    /**
                     * 转换设计系统面板中的集合条目，供后续处理或展示。
                     *
                     * @param token - 当前处理的设计 Token。
                     * @returns 当前条目转换后的结果。
                     */
                    (token) => (
                      <div key={token.name}>
                        <dt>{token.name || name}</dt>
                        <dd>
                          {/^(#[\da-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i.test(token.value) ? (
                            <i className="token-swatch" style={{ background: token.value }} />
                          ) : null}
                          <code>{token.value}</code>
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </section>
            ),
          )}
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
        {document.designSystem.components.map(
          /**
           * 转换设计系统面板中的集合条目，供后续处理或展示。
           *
           * @param component - 当前组件母版或组件规范。
           * @returns 当前条目转换后的结果。
           */
          (component) => (
            <article key={`${component.id}@${component.version}`}>
              <div className="component-preview">
                <Component size={36} />
                <Badge variant="secondary">v{component.version}</Badge>
              </div>
              <div>
                <span className={`component-status ${component.status}`} />
                {{ draft: '草稿', approved: '已确认', deprecated: '已弃用' }[component.status] ||
                  component.status}
              </div>
              <h3>{component.name}</h3>
              <code>
                {component.id}@{component.version}
              </code>
              <p>{component.scope.join(' · ') || '尚未定义适用范围'}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到设计系统面板。 @returns 无返回值；通过副作用完成当前操作。 */
                  () =>
                    onOpenDocument({
                      type: 'component',
                      id: component.id,
                      version: component.version,
                    })
                }
              >
                <FileText size={14} />
                查看规范
              </Button>
            </article>
          ),
        )}
      </div>
    </main>
  );
}

/**
 * 呈现流程文档卡片，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.flow - 当前业务流程。
 * @param props.onOpenDocument - 在打开文档时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
function FlowDocumentCard({
  flow,
  onOpenDocument,
}: {
  /** 当前业务流程。 */
  flow?: WorkspaceFlow;
  /**
   * 在打开文档时通知调用方，由外层决定如何更新业务状态。
   * @param target - 操作作用的目标。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onOpenDocument: (target: DocumentTarget) => void;
}) {
  if (!flow) return null;
  const title = flow.brief?.content.match(/^#\s+(.+)$/m)?.[1] || `${flow.name} · 流程文档`;
  return (
    <section className="flow-document-section">
      <h3>
        <FileText size={14} />
        流程设计依据
      </h3>
      <p>当前 UI 流程基于以下文档设计</p>
      {flow.brief ? (
        <button
          className="flow-document-card"
          onClick={
            /** 响应 onClick 交互，将用户操作应用到流程文档卡片。 @returns 无返回值；通过副作用完成当前操作。 */
            () => onOpenDocument({ type: 'brief', flowId: flow.id })
          }
        >
          <span className="flow-document-icon">
            <FileText size={20} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>design/{flow.brief.path}</small>
            <span className="document-card-action">
              查看与编辑文档 <ChevronRight size={12} />
            </span>
          </span>
        </button>
      ) : (
        <div className="flow-document-empty">尚未关联流程文档</div>
      )}
    </section>
  );
}

/**
 * 呈现属性检查面板，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.flow - 当前业务流程。
 * @param props.selection - 当前选区或所选对象。
 * @param props.document - 解析后的完整工作空间文档。
 * @param props.onOpenDocument - 在打开文档时通知调用方，由外层决定如何更新业务状态。
 * @param props.onAnnotation - 在标注时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
function Inspector({
  flow,
  selection,
  document,
  onOpenDocument,
  onAnnotation,
}: {
  /**
   * 在打开文档时通知调用方，由外层决定如何更新业务状态。
   * @param target - 操作作用的目标。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onOpenDocument: (target: DocumentTarget) => void;
  /**
   * 在标注时通知调用方，由外层决定如何更新业务状态。
   * @param node - 当前处理的设计节点。
   * @param annotation - 待保存的定位标注。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onAnnotation: (node: FlowPageNode, annotation: AnnotationNode) => void;
  /** 当前业务流程。 */
  flow?: WorkspaceFlow;
  /** 当前选区或所选对象。 */
  selection: Selection;
  /** 解析后的完整工作空间文档。 */
  document: WorkspaceDocument;
}) {
  const node =
    selection?.type === 'node'
      ? flow?.nodes.find(
          /** 检查条目的标识等于 selection 的标识，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (item) => item.id === selection.id,
        )
      : undefined;
  const edge =
    selection?.type === 'edge'
      ? flow?.edges.find(
          /** 检查条目的标识等于 selection 的标识，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (item) => item.id === selection.id,
        )
      : undefined;
  const impact = node
    ? document.designSystem.impacts.find(
        /** 检查条目的pageRef等于节点的pageRef，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
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
            {impact.reasons.map(
              /**
               * 转换属性检查面板中的集合条目，供后续处理或展示。
               *
               * @param reason - 本次影响或失败的原因。
               * @returns 当前条目转换后的结果。
               */
              (reason) => (
                <p key={`${reason.type}/${reason.subject}`}>
                  <strong>{reason.type === 'tokens' ? 'Tokens' : reason.subject}</strong>
                  {reason.message}
                </p>
              ),
            )}
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
            <dd>{node.promptPath || '未记录'}</dd>
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
            node.componentUsage.map(
              /**
               * 转换属性检查面板中的集合条目，供后续处理或展示。
               *
               * @param item - 当前遍历的条目。
               * @returns 当前条目转换后的结果。
               */
              (item) => {
                const component = document.designSystem.components.find(
                  /** 检查 candidate 的标识等于条目的标识且 candidate 的version等于条目的version，供集合筛选或定位使用。 @param candidate - 正在校验或比较的候选值。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                  (candidate) => candidate.id === item.id && candidate.version === item.version,
                );
                return (
                  <button
                    className="usage usage-link"
                    key={`${item.id}@${item.version}`}
                    disabled={!component}
                    onClick={
                      /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                      () =>
                        onOpenDocument({ type: 'component', id: item.id, version: item.version })
                    }
                  >
                    <strong>
                      {item.id}@{item.version}
                    </strong>
                    <span>{item.adaptation}</span>
                    <code>{component?.specPath || '规范路径缺失'}</code>
                    <span className="document-card-action">
                      查看规范 <ChevronRight size={12} />
                    </span>
                  </button>
                );
              },
            )
          ) : (
            <p className="muted">无组件引用</p>
          )}
        </section>
        <section>
          <h3>
            设计注释 <span className="muted">{node.annotations.length}</span>
          </h3>
          {node.annotations.length ? (
            node.annotations.map(
              /**
               * 转换属性检查面板中的集合条目，供后续处理或展示。
               *
               * @param annotation - 待保存的定位标注。
               * @param index - 空间查询索引或当前条目的位置。
               * @returns 当前条目转换后的结果。
               */
              (annotation, index) => (
                <button
                  className="annotation-list-item"
                  key={annotation.id}
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => onAnnotation(node, annotation)
                  }
                >
                  <span>{index + 1}</span>
                  <span>
                    <strong>{annotation.label}</strong>
                    <small>{annotation.text}</small>
                  </span>
                  <Pencil size={13} />
                </button>
              ),
            )
          ) : (
            <p className="muted">暂无设计注释</p>
          )}
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
          <span className="eyebrow">{edge.crossFlow ? '跨流程' : '流程内'}</span>
          <h2>{edge.trigger || '未命名转场'}</h2>
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
            <dd>{edge.condition || '无'}</dd>
            <dt>结果</dt>
            <dd>{edge.effect || '无'}</dd>
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
        <p>{flow?.goal || '选择页面或转场查看详情。'}</p>
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
              flow.consistencyNotes.map(
                /** 转换属性检查面板中的集合条目，供后续处理或展示。 @param note - 需要展示的补充说明。 @returns 当前条目转换后的结果。 */
                (note) => <p key={note}>{note}</p>,
              )
            ) : (
              <p className="muted">暂无说明</p>
            )}
          </section>
        </>
      ) : null}
    </aside>
  );
}

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

  const load = useCallback(
    /**
     * 读取最新工作空间文档并更新界面，保留当前流程与选择的有效部分。
     * @returns 完成当前异步操作的 Promise，不携带业务数据。
     */
    async () => {
      try {
        const [next, validation, localState] = await Promise.all([
          getDocument(),
          getValidation(),
          getLocalState(),
        ]);
        setDocument(
          /** 基于最新状态计算 Document 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
          (current) => (!current || next.revision >= current.revision ? next : current),
        );
        setError(
          validation.valid
            ? undefined
            : validation.issues
                .map(
                  /** 提取条目的消息，供后续计算或展示使用。 @param item - 当前遍历的条目。 @returns 条目的消息。 */
                  (item) => item.message,
                )
                .join(' · '),
        );
        setLocalViewports(localState.viewports);
        setActiveFlowId(
          /**
           * 基于最新状态计算 ActiveFlowId 的下一份值，避免连续更新时读到旧状态。
           *
           * @param current - 更新前的当前值。
           * @returns 供 React 保存的新状态。
           */
          (current) =>
            next.flows.some(
              /** 检查 flow 的标识等于当前值，供集合筛选或定位使用。 @param flow - 当前业务流程。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
              (flow) => flow.id === current,
            )
              ? current
              : next.flows[0]?.id || '',
        );
        positionsRef.current = {};
        setPositions({});
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '无法加载设计资产。');
      }
    },
    [],
  );

  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      void load();
      const events = new EventSource('/api/events');
      events.addEventListener(
        'revision',
        /** 响应 revision 事件，推进应用主界面的状态更新。 @returns 当前步骤的处理结果。 */
        () => void load(),
      );
      /** 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => events.close();
    },
    [load],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const observer = new ResizeObserver(
        /** 执行应用主界面传入的局部处理步骤，使调用处能够控制结果如何更新。 @param options - 按顺序解构的当前条目。 @param options.entry - 缓存的已编译场景条目。 @returns 当前步骤的处理结果。 */
        ([entry]) =>
          setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
      );
      observer.observe(viewport);
      /** 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => observer.disconnect();
    },
    [viewMode, !!document],
  );
  const activeFlow = document?.flows.find(
    /** 检查 flow 的标识等于activeFlowId，供集合筛选或定位使用。 @param flow - 当前业务流程。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (flow) => flow.id === activeFlowId,
  );
  const renderedFlow = useMemo(
    /**
     * 计算应用主界面的派生数据，并在依赖未变化时复用结果。
     * @returns 当前步骤的处理结果。
     */
    () =>
      activeFlow
        ? {
            ...activeFlow,
            nodes: activeFlow.nodes.map(
              /** 转换应用主界面中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
              (node) =>
                positions[node.id]
                  ? { ...node, frame: { ...node.frame, ...positions[node.id] } }
                  : node,
            ),
          }
        : undefined,
    [activeFlow, positions],
  );
  const nodeMap = useMemo(
    /**
     * 计算应用主界面的派生数据，并在依赖未变化时复用结果。
     * @returns 当前步骤的处理结果。
     */
    () =>
      new Map(
        renderedFlow?.nodes.map(
          /** 转换应用主界面中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
          (node) => [node.id, node],
        ) || [],
      ),
    [renderedFlow],
  );
  const impactsByPage = useMemo(
    /**
     * 计算应用主界面的派生数据，并在依赖未变化时复用结果。
     * @returns 当前步骤的处理结果。
     */
    () =>
      new Map(
        document?.designSystem.impacts.map(
          /** 转换应用主界面中的集合条目，供后续处理或展示。 @param impact - 当前页面的版本影响记录。 @returns 当前条目转换后的结果。 */
          (impact) => [impact.pageRef, impact],
        ) || [],
      ),
    [document],
  );
  const searchResults = useMemo(
    /**
     * 计算应用主界面的派生数据，并在依赖未变化时复用结果。
     * @returns 当前步骤的处理结果。
     */
    () => {
      const query = search.trim().toLowerCase();
      if (!query || !document) return [];
      return document.flows
        .flatMap(
          /**
           * 转换应用主界面中的集合条目并展开结果，供后续处理或展示。
           *
           * @param flow - 当前业务流程。
           * @returns 当前条目展开后的结果。
           */
          (flow) =>
            flow.nodes
              .filter(
                /** 检查将转为小写包含query，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                (node) => `${node.name} ${node.goal} ${node.pageRef}`.toLowerCase().includes(query),
              )
              .map(
                /** 转换应用主界面中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
                (node) => ({ flow, node }),
              ),
        )
        .slice(0, 12);
    },
    [document, search],
  );

  const fit = useCallback(
    /**
     * 计算目标内容在安全区域内的倍率和位置，避开标尺与工具栏。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (!renderedFlow?.nodes.length || !viewportRef.current) return;
      const minX = Math.min(
          ...renderedFlow.nodes.map(
            /** 提取节点的 frame 的横坐标，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的 frame 的横坐标。 */
            (node) => node.frame.x,
          ),
        ),
        minY = Math.min(
          ...renderedFlow.nodes.map(
            /** 提取节点的 frame 的纵坐标，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的 frame 的纵坐标。 */
            (node) => node.frame.y,
          ),
        );
      const maxX = Math.max(
          ...renderedFlow.nodes.map(
            /** 提取节点的 frame 的横坐标加上节点的 frame 的宽度，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的 frame 的横坐标加上节点的 frame 的宽度。 */
            (node) => node.frame.x + node.frame.width,
          ),
        ),
        maxY = Math.max(
          ...renderedFlow.nodes.map(
            /** 提取节点的 frame 的纵坐标加上节点的 frame 的高度，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的 frame 的纵坐标加上节点的 frame 的高度。 */
            (node) => node.frame.y + node.frame.height,
          ),
        );
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
    },
    [renderedFlow],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      const local = localViewports[activeFlowId];
      if (local) setCamera(local);
      else if (renderedFlow?.defaultViewport) setCamera(renderedFlow.defaultViewport);
      else requestAnimationFrame(fit);
    },
    [activeFlowId],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      if (!document || !activeFlowId) return;
      const timeout = window.setTimeout(
        /**
         * 基于最新状态计算 Timeout 的下一份值，避免连续更新时读到旧状态。
         * @returns 供 React 保存的新状态。
         */
        () => {
          void setLocalViewport(activeFlowId, camera).catch(
            /**
             * 处理应用主界面中的异步失败，按当前流程决定回退或继续抛出。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {
              /* local viewport persistence is non-blocking */
            },
          );
        },
        450,
      );
      /** 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => window.clearTimeout(timeout);
    },
    [activeFlowId, camera, document],
  );

  const pointerMove = useCallback(
    /**
     * 根据手势起点计算平移或节点拖动，保持移动基于同一坐标基准。
     *
     * @param event - 当前事件及其触发位置。
     * @returns 无返回值；通过副作用完成当前操作。
     */
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
        setPositions(
          /**
           * 基于最新状态计算 Positions 的下一份值，避免连续更新时读到旧状态。
           *
           * @param existing - 已经存在的记录或配置。
           * @returns 供 React 保存的新状态。
           */
          (existing) => {
            const next = {
              ...existing,
              [current.node!.id]: {
                x: current.origin!.x + (event.clientX - current.startX) / camera.zoom,
                y: current.origin!.y + (event.clientY - current.startY) / camera.zoom,
              },
            };
            positionsRef.current = next;
            return next;
          },
        );
    },
    [camera.zoom],
  );
  const pointerUp = useCallback(
    /**
     * 结束当前手势并提交最终节点位置，让临时预览成为正式设计。
     * @returns 完成当前异步操作的 Promise，不携带业务数据。
     */
    async () => {
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
    },
    [document, pointerMove],
  );
  const beginGesture = useCallback(
    /**
     * 保存指针起点和原始相机，供后续移动计算稳定的位移。
     *
     * @param value - 当前字段、模式或控件的取值。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (value: typeof gesture.current) => {
      gesture.current = value;
      window.addEventListener('pointermove', pointerMove);
      window.addEventListener('pointerup', pointerUp);
    },
    [pointerMove, pointerUp],
  );
  /**
   * 记录流程画布上的指针起点，区分平移与选中操作。
   *
   * @param event - 当前事件及其触发位置。
   * @returns 无返回值；初始化本次画布交互。
   */
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
  /**
   * 记录流程节点的原位置与指针位置，供拖动时计算位移。
   *
   * @param event - 当前事件及其触发位置。
   * @param node - 当前处理的设计节点。
   * @returns 无返回值；开始节点拖动。
   */
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
  const zoomAt = useCallback(
    /**
     * 围绕屏幕上的指定位置缩放流程画布，避免视图发生跳跃。
     *
     * @param zoom - 缩放倍率，1 表示原始尺寸。
     * @param anchor - 缩放前后需要保持屏幕位置的锚点。
     * @returns 无返回值；通过副作用完成当前操作。
     */
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
      setCamera(
        /**
         * 基于最新状态计算 Camera 的下一份值，避免连续更新时读到旧状态。
         *
         * @param current - 更新前的当前值。
         * @returns 供 React 保存的新状态。
         */
        (current) => {
          const nextZoom = Math.max(0.05, Math.min(4, zoom));
          return {
            zoom: nextZoom,
            x: point.x - ((point.x - current.x) / current.zoom) * nextZoom,
            y: point.y - ((point.y - current.y) / current.zoom) * nextZoom,
          };
        },
      );
    },
    [],
  );
  useEffect(
    /**
     * 在应用主界面的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      /**
       * 根据滚轮意图调整流程视口，保持浏览与缩放操作一致。
       *
       * @param event - 当前事件及其触发位置。
       * @returns 无返回值；更新相机状态。
       */
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        setCamera(
          /**
           * 基于最新状态计算 Camera 的下一份值，避免连续更新时读到旧状态。
           *
           * @param current - 更新前的当前值。
           * @returns 供 React 保存的新状态。
           */
          (current) => {
            const zoom = Math.max(
              0.05,
              Math.min(4, current.zoom * Math.exp(-event.deltaY * 0.001)),
            );
            return {
              zoom,
              x: px - ((px - current.x) / current.zoom) * zoom,
              y: py - ((py - current.y) / current.zoom) * zoom,
            };
          },
        );
      };
      viewport.addEventListener('wheel', onWheel, { passive: false });
      /** 结束应用主界面当前建立的监听或临时操作，避免后续重复执行。 @returns 当前步骤的处理结果。 */
      return () => viewport.removeEventListener('wheel', onWheel);
    },
    [viewMode, !!document],
  );
  /**
   * 打开搜索结果对应的流程和页面，帮助用户定位设计内容。
   *
   * @param flowId - 目标流程的唯一标识。
   * @param nodeId - 目标设计节点的标识。
   * @returns 无返回值；更新选择和视口。
   */
  const selectResult = (flowId: string, nodeId: string) => {
    setViewMode('flows');
    setActiveFlowId(flowId);
    setSelection({ type: 'node', id: nodeId });
    setSearch('');
  };
  /**
   * 定位或编辑指定标注，使画面位置与侧栏内容相互对应。
   *
   * @param node - 当前处理的设计节点。
   * @param annotation - 待保存的定位标注。
   * @returns 无返回值；更新标注选择。
   */
  const onAnnotation = (node: FlowPageNode, annotation: AnnotationNode) => {
    const [flowId, pageId] = node.pageRef.split('/');
    setSelection({ type: 'node', id: node.id });
    setActiveAnnotation({ flowId, pageId, annotationId: annotation.id });
  };
  /**
   * 携带编辑前内容提交文档修改，让服务端能够检测并发覆盖。
   *
   * @param change - 本次要应用的变更内容。
   * @returns 保存操作的结果。
   */
  const saveContent = async (change: WorkspaceChangeSet) => {
    try {
      const result = await applyChanges(change);
      setDocument(
        /** 基于最新状态计算 Document 的下一份值，避免连续更新时读到旧状态。 @param current - 更新前的当前值。 @returns 供 React 保存的新状态。 */
        (current) =>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={
            /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
            () => void load()
          }
        >
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
            onChange={
              /** 响应 onChange 交互，将用户操作应用到应用主界面。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
              (event) => setSearch(event.target.value)
            }
            placeholder="搜索页面、目标或 ID"
          />
          {search ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="清除搜索"
              onClick={
                /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                () => setSearch('')
              }
            >
              <X size={15} />
            </Button>
          ) : (
            <span className="search-hint">搜索</span>
          )}
          {searchResults.length ? (
            <div className="search-results">
              {searchResults.map(
                /**
                 * 转换应用主界面中的集合条目，供后续处理或展示。
                 *
                 * @param result - 上一步操作得到的结果。
                 * @returns 当前条目转换后的结果。
                 */
                (result) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    key={result.node.id}
                    onClick={
                      /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 无返回值；通过副作用完成当前操作。 */
                      () => selectResult(result.flow.id, result.node.id)
                    }
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
                ),
              )}
            </div>
          ) : null}
        </div>
        <div className="top-actions">
          <Select
            value={settings.preset}
            onValueChange={
              /** 响应 onValueChange 交互，将用户操作应用到应用主界面。 @param preset - 工作室基础配色预设。 @returns 当前步骤的处理结果。 */
              (preset) => updateSettings({ preset: preset as StudioThemeSettings['preset'] })
            }
          >
            <SelectTrigger size="sm" aria-label="工作台外观">
              <Palette size={14} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presets.map(
                /** 转换应用主界面中的集合条目，供后续处理或展示。 @param preset - 工作室基础配色预设。 @returns 当前条目转换后的结果。 */
                (preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            disabled={viewMode !== 'flows'}
            aria-pressed={showAnnotations}
            className={showAnnotations ? 'active' : ''}
            onClick={
              /**
               * 响应 onClick 交互，将用户操作应用到应用主界面。
               * @returns 当前步骤的处理结果。
               */
              () =>
                setShowAnnotations(
                  /** 基于最新状态计算 ShowAnnotations 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
                  (value) => !value,
                )
            }
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
        <Tabs
          value={viewMode}
          onValueChange={
            /** 响应 onValueChange 交互，将用户操作应用到应用主界面。 @param value - 当前字段、模式或控件的取值。 @returns 当前步骤的处理结果。 */
            (value) => setViewMode(value as ViewMode)
          }
        >
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
              {document.flows.map(
                /**
                 * 转换应用主界面中的集合条目，供后续处理或展示。
                 *
                 * @param flow - 当前业务流程。
                 * @returns 当前条目转换后的结果。
                 */
                (flow) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    key={flow.id}
                    className={flow.id === activeFlowId ? 'active' : ''}
                    onClick={
                      /**
                       * 响应 onClick 交互，将用户操作应用到应用主界面。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      () => {
                        setActiveFlowId(flow.id);
                        setSelection(undefined);
                      }
                    }
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
                ),
              )}
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
                  onClick={
                    /**
                     * 响应 onClick 交互，将用户操作应用到应用主界面。
                     * @returns 无返回值；通过副作用完成当前操作。
                     */
                    () => {
                      if (activeFlow) setDocumentTarget({ type: 'brief', flowId: activeFlow.id });
                    }
                  }
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
                      {renderedFlow.edges.map(
                        /**
                         * 转换应用主界面中的集合条目，供后续处理或展示。
                         *
                         * @param edge - 连接两个页面的流程边。
                         * @returns 当前条目转换后的结果。
                         */
                        (edge) => (
                          <FlowEdgeView
                            key={edge.id}
                            edge={edge}
                            nodes={nodeMap}
                            camera={camera}
                            selected={selection?.type === 'edge' && selection.id === edge.id}
                            onSelect={
                              /** 响应 onSelect 交互，将用户操作应用到应用主界面。 @param id - 唯一标识，用于查找、更新和建立引用。 @returns 当前步骤的处理结果。 */
                              (id) => setSelection({ type: 'edge', id })
                            }
                          />
                        ),
                      )}
                    </svg>
                    {renderedFlow.nodes.map(
                      /**
                       * 转换应用主界面中的集合条目，供后续处理或展示。
                       *
                       * @param node - 当前处理的设计节点。
                       * @returns 当前条目转换后的结果。
                       */
                      (node) => (
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
                          onSelect={
                            /** 响应 onSelect 交互，将用户操作应用到应用主界面。 @param id - 唯一标识，用于查找、更新和建立引用。 @returns 当前步骤的处理结果。 */
                            (id) => setSelection({ type: 'node', id })
                          }
                          onDragStart={onNodeDragStart}
                          onAnnotation={onAnnotation}
                          onOpenImage={setImageViewer}
                        />
                      ),
                    )}
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
              <div
                className="zoom-controls"
                onPointerDown={
                  /** 响应 onPointerDown 交互，将用户操作应用到应用主界面。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                  (event) => event.stopPropagation()
                }
              >
                <Button variant="ghost" size="sm" onClick={fit} aria-label="适应画布">
                  <Scan size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={camera.zoom <= 0.05}
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                    () => zoomAt(camera.zoom / 1.2)
                  }
                >
                  <Minus size={16} />
                  <span className="sr-only">缩小</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="zoom-reset"
                  aria-label="恢复 100% 缩放"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                    () => zoomAt(1)
                  }
                >
                  {Math.round(camera.zoom * 100)}%
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={camera.zoom >= 4}
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                    () => zoomAt(camera.zoom * 1.2)
                  }
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
            onClose={
              /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
              () => setDocumentTarget(undefined)
            }
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
            onClose={
              /** 响应 onClose 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
              () => setActiveAnnotation(undefined)
            }
            onNavigate={
              /** 响应 onNavigate 交互，将用户操作应用到应用主界面。 @param pageRef - 跨流程可定位的页面引用。 @returns 无返回值；通过副作用完成当前操作。 */
              (pageRef) => selectResult(pageRef.split('/')[0], pageRef)
            }
          />
        </Suspense>
      ) : null}
      {imageViewer ? (
        <Dialog
          open
          onOpenChange={
            /**
             * 响应 onOpenChange 交互，将用户操作应用到应用主界面。
             *
             * @param open - 弹层或面板当前是否打开。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            (open) => {
              if (!open) setImageViewer(undefined);
            }
          }
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
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
                  () => setImageViewer(undefined)
                }
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
            onClick={
              /** 响应 onClick 交互，将用户操作应用到应用主界面。 @returns 当前步骤的处理结果。 */
              () => setError(undefined)
            }
          >
            <X size={14} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
