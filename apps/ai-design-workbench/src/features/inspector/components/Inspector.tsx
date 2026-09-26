import { ChevronRight, FileImage, Pencil, GitBranch, Layers3 } from 'lucide-react';
import type {
  AnnotationNode,
  FlowPageNode,
  WorkspaceDocument,
  WorkspaceFlow,
} from '@forma/schema/workbench';
import type { DocumentTarget } from '../../documents/model/types.ts';
import type { Selection } from '../../../shared/types/workbench.ts';
import { FlowDocumentCard } from './FlowDocumentCard.tsx';

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
export function Inspector({
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
    selection?.type === 'node' ? flow?.nodes.find((item) => item.id === selection.id) : undefined;
  const edge =
    selection?.type === 'edge' ? flow?.edges.find((item) => item.id === selection.id) : undefined;
  const impact = node
    ? document.designSystem.impacts.find((item) => item.pageRef === node.pageRef)
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
                <strong>{reason.type === 'tokens' ? 'Tokens' : reason.subject}</strong>
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
            node.componentUsage.map((item) => {
              const component = document.designSystem.components.find(
                (candidate) => candidate.id === item.id && candidate.version === item.version,
              );
              return (
                <button
                  className="usage usage-link"
                  key={`${item.id}@${item.version}`}
                  disabled={!component}
                  onClick={() =>
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
            })
          ) : (
            <p className="muted">无组件引用</p>
          )}
        </section>
        <section>
          <h3>
            设计注释 <span className="muted">{node.annotations.length}</span>
          </h3>
          {node.annotations.length ? (
            node.annotations.map((annotation, index) => (
              <button
                className="annotation-list-item"
                key={annotation.id}
                onClick={() => onAnnotation(node, annotation)}
              >
                <span>{index + 1}</span>
                <span>
                  <strong>{annotation.label}</strong>
                  <small>{annotation.text}</small>
                </span>
                <Pencil size={13} />
              </button>
            ))
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
