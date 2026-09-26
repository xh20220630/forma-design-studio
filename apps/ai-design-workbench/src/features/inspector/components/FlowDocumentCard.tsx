import { ChevronRight, FileText } from 'lucide-react';
import type { WorkspaceFlow } from '@forma/schema/workbench';
import type { DocumentTarget } from '../../documents/model/types.ts';

/**
 * 呈现流程文档卡片，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.flow - 当前业务流程。
 * @param props.onOpenDocument - 在打开文档时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function FlowDocumentCard({
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
          onClick={() => onOpenDocument({ type: 'brief', flowId: flow.id })}
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
