import { useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { DesignNode } from '@forma/schema';

/** 虚拟图层列表中的一行，保留缩进和折叠所需信息。 */
interface LayerRow {
  /** 当前处理的设计节点。 */
  node: DesignNode;
  /** 当前递归层级，用于控制缩进或限制展开深度。 */
  depth: number;
  /** 由调用方放入组件的子内容。 */
  children: boolean;
}
/** VirtualLayerList 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 按约定顺序保存的设计节点集合。 */
  nodes: DesignNode[];
  /** 已折叠的分组或节点集合。 */
  collapsed: Set<string>;
  /** 用于筛选列表的搜索文本。 */
  search: string;
  /** 目标页面的唯一标识。 */
  pageId: string;
  /** 需要固定显示的图层标识。 */
  pinnedId?: string;
  /**
   * 把图层行转换为界面元素的回调。
   * @param row - 当前虚拟列表中的图层行。
   * @returns 供 React 渲染的界面内容。
   */
  renderRow: (row: LayerRow) => ReactNode;
  /**
   * 在拖到根层级时通知调用方，由外层决定如何更新业务状态。
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onRootDrop: (id: string) => void;
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
}
const rowHeight = 32;
const overscan = 8;

/**
 * 呈现虚拟化图层列表，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.nodes - 按约定顺序保存的设计节点集合。
 * @param props.collapsed - 已折叠的分组或节点集合。
 * @param props.search - 用于筛选列表的搜索文本。
 * @param props.pageId - 目标页面的唯一标识。
 * @param props.pinnedId - 需要固定显示的图层标识。
 * @param props.renderRow - 把图层行转换为界面元素的回调。
 * @param props.onRootDrop - 在拖到根层级时通知调用方，由外层决定如何更新业务状态。
 * @param props.children - 由调用方放入组件的子内容。
 * @returns 供 React 渲染的界面内容。
 */
export default function VirtualLayerList({
  nodes,
  collapsed,
  search,
  pageId,
  pinnedId,
  renderRow,
  onRootDrop,
  children,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  /** 界面状态：画布可见区域的尺寸或相机状态。通过状态更新驱动界面刷新。 */
  const [viewport, setViewport] = useState({ top: 0, height: 640 });
  const rows = useMemo(() => {
    const byParent = new Map<string | undefined, DesignNode[]>();
    const ids = new Set(nodes.map((node) => node.id));
    for (let index = nodes.length - 1; index >= 0; index--) {
      const node = nodes[index],
        parent = node.parentId && ids.has(node.parentId) ? node.parentId : undefined;
      const siblings = byParent.get(parent);
      if (siblings) siblings.push(node);
      else byParent.set(parent, [node]);
    }
    const result: LayerRow[] = [],
      visited = new Set<string>();
    const term = search.toLowerCase();
    const walk = (parent: string | undefined, depth: number) => {
      if (depth > 30) return;
      for (const node of byParent.get(parent) ?? []) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        if (!term || node.name.toLowerCase().includes(term))
          result.push({ node, depth, children: byParent.has(node.id) });
        if (!collapsed.has(node.id)) walk(node.id, depth + 1);
      }
    };
    walk(undefined, 0);
    return result;
  }, [nodes, collapsed, search]);
  useLayoutEffect(() => {
    const node = element.current!;
    const measure = () => setViewport({ top: node.scrollTop, height: node.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    element.current!.scrollTop = 0;
    setViewport((value) => ({ ...value, top: 0 }));
  }, [pageId, search]);
  const first = Math.min(
    Math.max(0, rows.length - 1),
    Math.max(0, Math.floor(viewport.top / rowHeight) - overscan),
  );
  const last = Math.min(rows.length, first + Math.ceil(viewport.height / rowHeight) + overscan * 2);
  const visibleRows = rows.slice(first, last).map((row, index) => ({ row, index: first + index }));
  const pinnedIndex = pinnedId ? rows.findIndex((row) => row.node.id === pinnedId) : -1;
  // Keep an in-progress rename mounted when its row scrolls out of view.
  if (pinnedIndex >= 0 && (pinnedIndex < first || pinnedIndex >= last))
    visibleRows.push({ row: rows[pinnedIndex], index: pinnedIndex });
  const drop = (event: DragEvent) => {
    if ((event.target as HTMLElement).closest('.ed-layer')) return;
    event.preventDefault();
    const id = event.dataTransfer.getData('text/forma-node');
    if (id) onRootDrop(id);
  };
  return (
    <div
      ref={element}
      className="ed-layer-list"
      onScroll={(event) => {
        const top = event.currentTarget.scrollTop;
        setViewport((value) => ({ ...value, top }));
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
    >
      <div style={{ height: rows.length * rowHeight, position: 'relative' }}>
        {visibleRows.map(({ row, index }) => (
          <div
            key={row.node.id}
            style={{
              position: 'absolute',
              top: index * rowHeight,
              height: rowHeight,
              left: 0,
              right: 0,
            }}
          >
            {renderRow(row)}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
