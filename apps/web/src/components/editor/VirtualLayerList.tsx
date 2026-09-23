import { useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { DesignNode } from '@forma/schema';

interface LayerRow { node: DesignNode; depth: number; children: boolean }
interface Props {
  nodes: DesignNode[];
  collapsed: Set<string>;
  search: string;
  pageId: string;
  pinnedId?: string;
  renderRow: (row: LayerRow) => ReactNode;
  onRootDrop: (id: string) => void;
  children: ReactNode;
}
const rowHeight = 32;
const overscan = 8;

export default function VirtualLayerList({ nodes, collapsed, search, pageId, pinnedId, renderRow, onRootDrop, children }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 640 });
  const rows = useMemo(() => {
    const byParent = new Map<string | undefined, DesignNode[]>();
    const ids = new Set(nodes.map(node => node.id));
    for (let index = nodes.length - 1; index >= 0; index--) {
      const node = nodes[index], parent = node.parentId && ids.has(node.parentId) ? node.parentId : undefined;
      const siblings = byParent.get(parent);
      if (siblings) siblings.push(node); else byParent.set(parent, [node]);
    }
    const result: LayerRow[] = [], visited = new Set<string>();
    const term = search.toLowerCase();
    const walk = (parent: string | undefined, depth: number) => {
      if (depth > 30) return;
      for (const node of byParent.get(parent) ?? []) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        if (!term || node.name.toLowerCase().includes(term)) result.push({ node, depth, children: byParent.has(node.id) });
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
    observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => { element.current!.scrollTop = 0; setViewport(value => ({ ...value, top: 0 })); }, [pageId, search]);
  const first = Math.min(Math.max(0, rows.length - 1), Math.max(0, Math.floor(viewport.top / rowHeight) - overscan));
  const last = Math.min(rows.length, first + Math.ceil(viewport.height / rowHeight) + overscan * 2);
  const visibleRows = rows.slice(first, last).map((row, index) => ({ row, index: first + index }));
  const pinnedIndex = pinnedId ? rows.findIndex(row => row.node.id === pinnedId) : -1;
  // Keep an in-progress rename mounted when its row scrolls out of view.
  if (pinnedIndex >= 0 && (pinnedIndex < first || pinnedIndex >= last)) visibleRows.push({ row: rows[pinnedIndex], index: pinnedIndex });
  const drop = (event: DragEvent) => {
    if ((event.target as HTMLElement).closest('.ed-layer')) return;
    event.preventDefault();
    const id = event.dataTransfer.getData('text/forma-node');
    if (id) onRootDrop(id);
  };
  return <div ref={element} className="ed-layer-list" onScroll={event => {
    const top = event.currentTarget.scrollTop;
    setViewport(value => ({ ...value, top }));
  }}
    onDragOver={event => event.preventDefault()} onDrop={drop}>
    <div style={{ height: rows.length * rowHeight, position: 'relative' }}>
      {visibleRows.map(({ row, index }) => <div key={row.node.id}
        style={{ position: 'absolute', top: index * rowHeight, height: rowHeight, left: 0, right: 0 }}>
        {renderRow(row)}
      </div>)}
    </div>
    {children}
  </div>;
}
