import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Diamond, Layers3 } from 'lucide-react';
import type { DesignComponent, DesignNode, Project } from '@forma/schema';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@forma/ui/dialog';
import { NodeView, getProjectTokens, resolveNode } from '@forma/renderer';
import { applyAutoLayout, resizeNodes, rootSelection } from '@forma/editor-core/geometry';
import '../editor.css';

/** ComponentMasterDialog 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /** 引用的组件母版标识。 */
  componentId: string;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param project - 当前设计项目或工作空间项目元信息。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (project: Project) => void;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
}
const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  fontSize: 12,
  color: 'var(--studio-text-secondary)',
};
/**
 * 呈现带标签的表单字段，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.label - 面向用户显示的简短标签。
 * @param props.children - 由调用方放入组件的子内容。
 * @returns 供 React 渲染的界面内容。
 */
function Field({
  label,
  children,
}: {
  /** 面向用户显示的简短标签。 */
  label: string;
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      {label}
      {children}
    </label>
  );
}

/**
 * 呈现组件母版编辑对话框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.componentId - 引用的组件母版标识。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export default function ComponentMasterDialog({ project, componentId, onChange, onClose }: Props) {
  const source = project.components.find(
    /** 检查 component 的标识等于组件引用，供集合筛选或定位使用。 @param component - 当前组件母版或组件规范。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (component) => component.id === componentId,
  );
  /** 界面状态：尚未提交的编辑内容或待组装的设计草稿。通过状态更新驱动界面刷新。 */
  const [draft, setDraft] = useState<DesignComponent | undefined>(
    /** 在组件母版编辑对话框首次挂载时建立初始状态，避免每次渲染重复初始化。 @returns 初始状态值。 */
    () => (source ? structuredClone(source) : undefined),
  );
  /** 界面状态：当前选中节点的标识列表。通过状态更新驱动界面刷新。 */
  const [selectedIds, setSelectedIds] = useState<string[]>(
    /** 在组件母版编辑对话框首次挂载时建立初始状态，避免每次渲染重复初始化。 @returns 初始状态值。 */
    () => (source?.nodes[0] ? [source.nodes[0].id] : []),
  );
  const previewProject = useMemo(
    /**
     * 计算组件母版编辑对话框的派生数据，并在依赖未变化时复用结果。
     * @returns 当前步骤的处理结果。
     */
    () => ({
      ...project,
      components: project.components.map(
        /** 转换组件母版编辑对话框中的集合条目，供后续处理或展示。 @param component - 当前组件母版或组件规范。 @returns 当前条目转换后的结果。 */
        (component) => (component.id === componentId && draft ? draft : component),
      ),
    }),
    [project, componentId, draft],
  );
  if (!draft)
    return (
      <Dialog
        open
        onOpenChange={
          /**
           * 响应 onOpenChange 交互，将用户操作应用到组件母版编辑对话框。
           *
           * @param open - 弹层或面板当前是否打开。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          (open) => {
            if (!open) onClose();
          }
        }
      >
        <DialogContent className="ed-dialog">
          <DialogHeader>
            <DialogTitle>组件不存在</DialogTitle>
            <DialogDescription>该组件已被删除，请返回画布重新选择。</DialogDescription>
          </DialogHeader>
          <Button onClick={onClose}>返回画布</Button>
        </DialogContent>
      </Dialog>
    );
  const selected = draft.nodes.filter(
    /** 检查selectedIds包含节点的标识，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (node) => selectedIds.includes(node.id),
  );
  const first = selected[0] ? resolveNode(selected[0], previewProject) : undefined;
  const scale = Math.min(1.2, 420 / Math.max(1, draft.width), 320 / Math.max(1, draft.height));
  const tokens = getProjectTokens(project);
  /**
   * 选择当前目标，更新后续编辑所使用的上下文。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @param additive - 是否保留已有选区并追加选择。
   * @returns 当前步骤的处理结果。
   */
  const select = (id: string, additive: boolean) =>
    setSelectedIds(
      /**
       * 基于最新状态计算 SelectedIds 的下一份值，避免连续更新时读到旧状态。
       *
       * @param current - 更新前的当前值。
       * @returns 供 React 保存的新状态。
       */
      (current) =>
        additive
          ? current.includes(id)
            ? current.filter(
                /** 检查条目不等于标识，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                (item) => item !== id,
              )
            : [...current, id]
          : [id],
    );
  /**
   * 合并局部属性修改，保留未编辑字段。
   *
   * @param changes - 本次合并的局部变更。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  const patch = (changes: Partial<DesignNode>) => {
    setDraft(
      /**
       * 基于最新状态计算 Draft 的下一份值，避免连续更新时读到旧状态。
       *
       * @param current - 更新前的当前值。
       * @returns 供 React 保存的新状态。
       */
      (current) => {
        if (!current) return current;
        let nodes = current.nodes.map(
          /**
           * 转换 patch 中的集合条目，供后续处理或展示。
           *
           * @param node - 当前处理的设计节点。
           * @returns 当前条目转换后的结果。
           */
          (node) => {
            if (!selectedIds.includes(node.id)) return node;
            const tokenBindings = { ...node.tokenBindings };
            const variableBindings = { ...node.variableBindings };
            for (const property of Object.keys(changes)) {
              delete tokenBindings[property];
              delete variableBindings[property];
            }
            return { ...node, tokenBindings, variableBindings };
          },
        );
        const geometry = Object.keys(changes).some(
          /** 检查包含键名，供集合筛选或定位使用。 @param key - 要访问或更新的字段名。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (key) => ['x', 'y', 'width', 'height'].includes(key),
        );
        if (geometry) {
          for (const id of rootSelection(nodes, selectedIds))
            nodes = resizeNodes(nodes, id, changes);
          for (const id of new Set(
            nodes
              .filter(
                /** 检查selectedIds包含节点的标识，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                (node) => selectedIds.includes(node.id),
              )
              .map(
                /** 提取节点的父节点标识，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的父节点标识。 */
                (node) => node.parentId,
              )
              .filter(Boolean),
          ))
            nodes = applyAutoLayout(nodes, id!);
        } else
          nodes = nodes.map(
            /**
             * 转换 patch 中的集合条目，供后续处理或展示。
             *
             * @param node - 当前处理的设计节点。
             * @returns 当前条目转换后的结果。
             */
            (node) =>
              selectedIds.includes(node.id)
                ? {
                    ...node,
                    ...changes,
                    ...(changes.fill === undefined ? {} : { gradient: undefined }),
                  }
                : node,
          );
        return { ...current, nodes };
      },
    );
  };
  /**
   * 调整组件尺寸并同步内部节点布局。
   *
   * @param key - 要访问或更新的字段名。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  const setSize = (key: 'width' | 'height', value: number) => {
    setDraft(
      /**
       * 基于最新状态计算 Draft 的下一份值，避免连续更新时读到旧状态。
       *
       * @param current - 更新前的当前值。
       * @returns 供 React 保存的新状态。
       */
      (current) => {
        if (!current) return current;
        const canvasId = `master-bounds-${componentId}`;
        const originalParents = new Map(
          current.nodes.map(
            /** 转换 setSize 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
            (node) => [node.id, node.parentId],
          ),
        );
        const canvas: DesignNode = {
          id: canvasId,
          name: 'Bounds',
          type: 'frame',
          x: 0,
          y: 0,
          width: current.width,
          height: current.height,
        };
        const resized = resizeNodes(
          [
            canvas,
            ...current.nodes.map(
              /** 转换 setSize 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
              (node) => ({
                ...node,
                parentId: node.parentId ?? canvasId,
              }),
            ),
          ],
          canvasId,
          { [key]: value },
        );
        return {
          ...current,
          [key]: value,
          nodes: resized
            .filter(
              /** 检查节点的标识不等于canvasId，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
              (node) => node.id !== canvasId,
            )
            .map(
              /** 转换 setSize 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
              (node) => ({ ...node, parentId: originalParents.get(node.id) }),
            ),
        };
      },
    );
  };
  /**
   * 把输入转换为可用数值，供当前几何或属性编辑流程继续计算。
   *
   * @param value - 当前字段、模式或控件的取值。
   * @param min - 允许的最小值。
   * @param max - 允许的最大值。
   * @returns 转换后的数值。
   */
  const number = (value: string, min = 1, max = 10000) =>
    Math.min(max, Math.max(min, Number(value) || min));
  /**
   * 保存当前编辑结果，并维护提交过程的界面状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  const save = () => {
    if (!draft.name.trim()) return;
    onChange({
      ...project,
      components: project.components.map(
        /**
         * 转换 save 中的集合条目，供后续处理或展示。
         *
         * @param component - 当前组件母版或组件规范。
         * @returns 当前条目转换后的结果。
         */
        (component) =>
          component.id === draft.id
            ? {
                ...draft,
                name: draft.name.trim(),
                nodes: draft.nodes.map(
                  /** 转换 save 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
                  (node) => ({
                    ...node,
                    fontFamily: node.fontFamily?.trim() || undefined,
                  }),
                ),
              }
            : component,
      ),
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
      status: 'in-progress',
    });
    onClose();
  };
  /**
   * 沿父节点关系计算缩进层级，使列表反映图层结构。
   *
   * @param node - 当前处理的设计节点。
   * @returns 节点的层级深度。
   */
  const depth = (node: DesignNode) => {
    let parent = node.parentId;
    let count = 0;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      count++;
      parent = draft.nodes.find(
        /** 检查条目的标识等于parent，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.id === parent,
      )?.parentId;
    }
    return count;
  };
  return (
    <Dialog
      open
      onOpenChange={
        /**
         * 响应 onOpenChange 交互，将用户操作应用到组件母版编辑对话框。
         *
         * @param open - 弹层或面板当前是否打开。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (open) => {
          if (!open) onClose();
        }
      }
    >
      <DialogContent
        className="ed-master-dialog"
        style={{
          width: 'min(1080px, calc(100vw - 48px))',
          maxWidth: 1080,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 0,
          gap: 0,
        }}
      >
        <DialogHeader
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--studio-border)',
            textAlign: 'left',
          }}
        >
          <DialogTitle
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              fontSize: 15,
            }}
          >
            <Diamond size={17} color="var(--studio-accent-ink)" />
            编辑主组件
          </DialogTitle>
          <DialogDescription style={{ fontSize: 12, color: 'var(--studio-text-secondary)' }}>
            保存后更新项目中的所有关联实例；实例独立覆盖的属性会保留。
          </DialogDescription>
        </DialogHeader>
        <div className="ed-master-layout">
          <aside
            className="ed-master-layers"
            style={{
              borderRight: '1px solid var(--studio-border)',
              padding: '12px 8px',
              background: 'var(--studio-surface-raised)',
              overflowY: 'auto',
              maxHeight: 550,
            }}
          >
            <div style={{ padding: '3px 8px 12px', fontSize: 12, fontWeight: 600 }}>
              组件图层{' '}
              <span
                style={{
                  float: 'right',
                  fontWeight: 400,
                  color: 'var(--studio-text-muted)',
                }}
              >
                {draft.nodes.length}
              </span>
            </div>
            {draft.nodes.map(
              /**
               * 转换组件母版编辑对话框中的集合条目，供后续处理或展示。
               *
               * @param node - 当前处理的设计节点。
               * @returns 当前条目转换后的结果。
               */
              (node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                    (event) => select(node.id, event.shiftKey || event.ctrlKey || event.metaKey)
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    width: '100%',
                    padding: `9px 8px 9px ${8 + depth(node) * 12}px`,
                    fontSize: 12,
                    textAlign: 'left',
                    background: selectedIds.includes(node.id)
                      ? 'var(--studio-accent-soft)'
                      : 'transparent',
                    color: selectedIds.includes(node.id)
                      ? 'var(--studio-accent-ink)'
                      : 'var(--studio-text-secondary)',
                    border: 0,
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <Layers3 size={13} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {node.name}
                  </span>
                </button>
              ),
            )}
            <p
              style={{
                color: 'var(--studio-text-muted)',
                fontSize: 11,
                lineHeight: 1.7,
                padding: '12px 8px 0',
              }}
            >
              按住 Shift 或 Ctrl 选择多个图层。
            </p>
          </aside>
          <section
            className="ed-master-canvas"
            style={{
              padding: 22,
              background: 'var(--studio-canvas-bg)',
              minWidth: 0,
            }}
          >
            <Field label="组件名称">
              <Input
                value={draft.name}
                maxLength={200}
                onChange={
                  /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                  (event) => setDraft({ ...draft, name: event.target.value })
                }
                style={{
                  background: 'var(--studio-surface-raised)',
                  fontSize: 13,
                }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <Field label="组件宽度">
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={draft.width}
                  onChange={
                    /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                    (event) => setSize('width', number(event.target.value))
                  }
                  style={{
                    background: 'var(--studio-surface-raised)',
                    fontSize: 12,
                  }}
                />
              </Field>
              <Field label="组件高度">
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={draft.height}
                  onChange={
                    /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                    (event) => setSize('height', number(event.target.value))
                  }
                  style={{
                    background: 'var(--studio-surface-raised)',
                    fontSize: 12,
                  }}
                />
              </Field>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 310,
                padding: '32px 0',
                overflow: 'auto',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: draft.width * scale,
                  height: draft.height * scale,
                  flexShrink: 0,
                }}
              >
                <div
                  onClickCapture={
                    /**
                     * 响应 onClickCapture 交互，将用户操作应用到组件母版编辑对话框。
                     *
                     * @param event - 当前事件及其触发位置。
                     * @returns 无返回值；通过副作用完成当前操作。
                     */
                    (event) => {
                      const target = (event.target as HTMLElement).closest<HTMLElement>(
                        '[data-forma-node]',
                      );
                      const id = target?.dataset.formaNode;
                      if (
                        id &&
                        draft.nodes.some(
                          /** 检查节点的标识等于标识，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                          (node) => node.id === id,
                        )
                      ) {
                        event.stopPropagation();
                        select(id, event.shiftKey || event.ctrlKey || event.metaKey);
                      }
                    }
                  }
                  style={{
                    position: 'relative',
                    width: draft.width,
                    height: draft.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    background: '#fff',
                    boxShadow: '0 1px 8px #00000010',
                  }}
                >
                  {draft.nodes.map(
                    /**
                     * 转换组件母版编辑对话框中的集合条目，供后续处理或展示。
                     *
                     * @param node - 当前处理的设计节点。
                     * @returns 当前条目转换后的结果。
                     */
                    (node) => (
                      <NodeView
                        key={node.id}
                        node={node}
                        project={previewProject}
                        nodes={draft.nodes}
                      />
                    ),
                  )}
                  {selected.map(
                    /**
                     * 转换组件母版编辑对话框中的集合条目，供后续处理或展示。
                     *
                     * @param node - 当前处理的设计节点。
                     * @returns 当前条目转换后的结果。
                     */
                    (node) => (
                      <div
                        key={`selection-${node.id}`}
                        style={{
                          position: 'absolute',
                          left: node.x,
                          top: node.y,
                          width: node.width,
                          height: node.height,
                          outline: `${1 / scale}px solid var(--studio-accent)`,
                          pointerEvents: 'none',
                          transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
            <p
              style={{
                color: 'var(--studio-text-muted)',
                fontSize: 11,
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              调整组件边界会根据子图层约束更新布局。所有修改在点击保存后生效。
            </p>
          </section>
          <aside
            className="ed-master-properties"
            style={{
              borderLeft: '1px solid var(--studio-border)',
              padding: 18,
              maxHeight: 550,
              overflowY: 'auto',
            }}
          >
            <h3 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 18px' }}>
              {selected.length > 1
                ? `已选择 ${selected.length} 个图层`
                : (first?.name ?? '选择图层')}
            </h3>
            {first ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  <Field label="X">
                    <Input
                      type="number"
                      value={first.x}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (event) => patch({ x: number(event.target.value, -10000) })
                      }
                    />
                  </Field>
                  <Field label="Y">
                    <Input
                      type="number"
                      value={first.y}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (event) => patch({ y: number(event.target.value, -10000) })
                      }
                    />
                  </Field>
                  <Field label="宽度">
                    <Input
                      type="number"
                      min={1}
                      value={first.width}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (event) => patch({ width: number(event.target.value) })
                      }
                    />
                  </Field>
                  <Field label="高度">
                    <Input
                      type="number"
                      min={1}
                      value={first.height}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (event) => patch({ height: number(event.target.value) })
                      }
                    />
                  </Field>
                </div>
                <Field label="填充颜色">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(first.fill ?? '') ? first.fill : '#ffffff'}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (event) => patch({ fill: event.target.value })
                      }
                      aria-label="主组件图层填充"
                      style={{
                        width: 34,
                        height: 34,
                        padding: 2,
                        border: '1px solid var(--studio-border)',
                        borderRadius: 4,
                        background: 'var(--studio-surface-raised)',
                        cursor: 'pointer',
                      }}
                    />
                    <code
                      style={{
                        fontSize: 12,
                        color: 'var(--studio-text-secondary)',
                      }}
                    >
                      {first.fill ?? 'transparent'}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ marginLeft: 'auto', fontSize: 11 }}
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到组件母版编辑对话框。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => patch({ fill: 'transparent' })
                      }
                    >
                      无
                    </Button>
                  </div>
                </Field>
                {selected.some(
                  /** 检查节点的类型等于“text”或节点的类型等于“button”，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                  (node) => node.type === 'text' || node.type === 'button',
                ) && (
                  <>
                    <Field label="文字内容">
                      <Textarea
                        rows={3}
                        value={first.text ?? ''}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                          (event) => patch({ text: event.target.value })
                        }
                        style={{ fontSize: 12, lineHeight: 1.7 }}
                      />
                    </Field>
                    <Field label="字体">
                      <Input
                        value={first.fontFamily ?? tokens.fontFamily}
                        onChange={
                          /**
                           * 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。
                           *
                           * @param event - 当前事件及其触发位置。
                           * @returns 无返回值；通过副作用完成当前操作。
                           */
                          (event) =>
                            patch({
                              fontFamily: event.target.value
                                .replace(/[;{}<>\r\n]/g, '')
                                .slice(0, 249),
                            })
                        }
                      />
                    </Field>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                      }}
                    >
                      <Field label="字号">
                        <Input
                          type="number"
                          min={1}
                          max={1000}
                          value={first.fontSize ?? 14}
                          onChange={
                            /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                            (event) =>
                              patch({
                                fontSize: number(event.target.value, 1, 1000),
                              })
                          }
                        />
                      </Field>
                      <Field label="字重">
                        <Input
                          type="number"
                          min={1}
                          max={1000}
                          step={100}
                          value={first.fontWeight ?? 400}
                          onChange={
                            /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                            (event) =>
                              patch({
                                fontWeight: number(event.target.value, 1, 1000),
                              })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="文字颜色">
                      <input
                        type="color"
                        value={
                          /^#[0-9a-f]{6}$/i.test(first.color ?? tokens.text)
                            ? (first.color ?? tokens.text)
                            : '#191919'
                        }
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到组件母版编辑对话框。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                          (event) => patch({ color: event.target.value })
                        }
                        aria-label="主组件文字颜色"
                        style={{
                          width: '100%',
                          height: 32,
                          border: '1px solid var(--studio-border)',
                          background: 'var(--studio-surface-raised)',
                          borderRadius: 4,
                        }}
                      />
                    </Field>
                  </>
                )}
                <p
                  style={{
                    fontSize: 11,
                    lineHeight: 1.7,
                    color: 'var(--studio-text-muted)',
                    margin: 0,
                  }}
                >
                  直接修改属性会解除该属性的 Token 或变量绑定。
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--studio-text-muted)', fontSize: 12 }}>
                在左侧选择要编辑的图层。
              </p>
            )}
          </aside>
        </div>
        <DialogFooter
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--studio-border)',
          }}
        >
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!draft.name.trim()}>
            <Check size={15} />
            保存主组件
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
