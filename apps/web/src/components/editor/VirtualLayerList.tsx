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
  const rows = useMemo(
    /**
     * 计算虚拟化图层列表的派生数据，并在依赖未变化时复用结果。
     * @returns 当前步骤的处理结果。
     */
    () => {
      const byParent = new Map<string | undefined, DesignNode[]>();
      const ids = new Set(
        nodes.map(
          /** 提取节点的标识，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的标识。 */
          (node) => node.id,
        ),
      );
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
      /**
       * 展开可见图层层级，供虚拟列表按顺序显示。
       *
       * @param parent - 父级对象或页面引用。
       * @param depth - 当前递归层级，用于控制缩进或限制展开深度。
       * @returns 层级遍历的结果。
       */
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
    },
    [nodes, collapsed, search],
  );
  useLayoutEffect(
    /**
     * 在虚拟化图层列表的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      const node = element.current!;
      /**
       * 读取当前容器尺寸，使可见区域与布局计算保持同步。
       * @returns 测量操作的结果。
       */
      const measure = () => setViewport({ top: node.scrollTop, height: node.clientHeight });
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      measure();
      /** 结束虚拟化图层列表当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => observer.disconnect();
    },
    [],
  );
  useLayoutEffect(
    /**
     * 在虚拟化图层列表的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      element.current!.scrollTop = 0;
      setViewport(
        /** 基于最新状态计算 Viewport 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
        (value) => ({ ...value, top: 0 }),
      );
    },
    [pageId, search],
  );
  const first = Math.min(
    Math.max(0, rows.length - 1),
    Math.max(0, Math.floor(viewport.top / rowHeight) - overscan),
  );
  const last = Math.min(rows.length, first + Math.ceil(viewport.height / rowHeight) + overscan * 2);
  const visibleRows = rows.slice(first, last).map(
    /** 转换虚拟化图层列表中的集合条目，供后续处理或展示。 @param row - 当前虚拟列表中的图层行。 @param index - 空间查询索引或当前条目的位置。 @returns 当前条目转换后的结果。 */
    (row, index) => ({ row, index: first + index }),
  );
  const pinnedIndex = pinnedId
    ? rows.findIndex(
        /** 检查 row 的节点的标识等于pinnedId，供集合筛选或定位使用。 @param row - 当前虚拟列表中的图层行。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (row) => row.node.id === pinnedId,
      )
    : -1;
  // Keep an in-progress rename mounted when its row scrolls out of view.
  if (pinnedIndex >= 0 && (pinnedIndex < first || pinnedIndex >= last))
    visibleRows.push({ row: rows[pinnedIndex], index: pinnedIndex });
  /**
   * 根据拖放目标重排或挂接图层，连接列表操作与设计层级。
   *
   * @param event - 当前事件及其触发位置。
   * @returns 无返回值；提交拖放结果。
   */
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
      onScroll={
        /**
         * 响应 onScroll 交互，将用户操作应用到虚拟化图层列表。
         *
         * @param event - 当前事件及其触发位置。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (event) => {
          const top = event.currentTarget.scrollTop;
          setViewport(
            /** 基于最新状态计算 Viewport 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
            (value) => ({ ...value, top }),
          );
        }
      }
      onDragOver={
        /** 响应 onDragOver 交互，将用户操作应用到虚拟化图层列表。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
        (event) => event.preventDefault()
      }
      onDrop={drop}
    >
      <div style={{ height: rows.length * rowHeight, position: 'relative' }}>
        {visibleRows.map(
          /**
           * 转换虚拟化图层列表中的集合条目，供后续处理或展示。
           *
           * @param options - 按字段解构的输入，字段用途见对应类型定义。
           * @param options.row - 当前虚拟列表中的图层行。
           * @param options.index - 空间查询索引或当前条目的位置。
           * @returns 当前条目转换后的结果。
           */
          ({ row, index }) => (
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
          ),
        )}
      </div>
      {children}
    </div>
  );
}
