import { useState } from 'react';
import { Check, FileText, Pencil, Save, X } from 'lucide-react';
import { Button } from '@forma/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@forma/ui/dialog';
import type { WorkspaceOperation } from '@forma/schema/workbench';
import type { DocumentTarget, EditorProps } from '../model/types.ts';
import { useEditSession } from '../hooks/useEditSession.ts';
import { MarkdownPreview } from './MarkdownPreview.tsx';

/**
 * 呈现规范文档编辑器，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.target - 操作作用的目标。
 * @param props.document - 解析后的完整工作空间文档。
 * @param props.onSave - 在保存时通知调用方，由外层决定如何更新业务状态。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export default function DocumentEditor({
  target,
  document,
  onSave,
  onClose,
}: EditorProps & {
  /** 操作作用的目标。 */
  target: DocumentTarget;
}) {
  const component =
    target.type === 'component'
      ? document.designSystem.components.find(
          (item) => item.id === target.id && item.version === target.version,
        )
      : undefined;
  const flow =
    target.type === 'brief' ? document.flows.find((item) => item.id === target.flowId) : undefined;
  const sourcePath = component?.specPath || flow?.brief?.path;
  const content = component?.specContent ?? flow?.brief?.content ?? '';
  const title = component ? component.name : `${flow?.name || '流程'} · 设计依据`;
  const editor = useEditSession(content, document.revision, onClose);
  /** 界面状态：当前激活的标签页。通过状态更新驱动界面刷新。 */
  const [tab, setTab] = useState<'split' | 'edit' | 'preview'>('split');
  const save = () => {
    if (!editor.session || !sourcePath) return;
    const session = editor.session;
    const operation: WorkspaceOperation =
      target.type === 'component'
        ? {
            type: 'set-component-spec',
            componentId: target.id,
            version: target.version,
            content: session.draft,
            expectedContent: session.original,
          }
        : {
            type: 'set-flow-brief',
            flowId: target.flowId,
            content: session.draft,
            expectedContent: session.original,
          };
    void editor.save(() => onSave({ baseRevision: session.revision, operations: [operation] }));
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) editor.close();
      }}
    >
      <DialogContent className="document-dialog" showCloseButton={false}>
        <header className="document-heading">
          <span className="document-icon">
            <FileText size={22} />
          </span>
          <div>
            <span className="eyebrow">
              {component ? `组件规范 · v${component.version}` : '流程文档 · 设计依据'}
            </span>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {sourcePath ? `design/${sourcePath}` : '该文档已不存在'}
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="关闭文档"
            disabled={editor.saving}
            onClick={editor.close}
          >
            <X size={18} />
          </Button>
        </header>
        <div className="document-toolbar">
          {editor.session ? (
            <div className="document-tabs" role="group" aria-label="文档显示方式">
              {(
                [
                  ['split', '分栏'],
                  ['edit', '编辑'],
                  ['preview', '预览'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={tab === value ? 'secondary' : 'ghost'}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          ) : (
            <span>
              {component
                ? '共享规范 · 修改将同步到引用此规范的页面'
                : '当前流程的页面与交互以此文档为设计依据'}
            </span>
          )}
          {!editor.session ? (
            <Button size="sm" variant="outline" disabled={!sourcePath} onClick={editor.start}>
              <Pencil size={14} />
              编辑文档
            </Button>
          ) : (
            <span className="muted">Markdown</span>
          )}
        </div>
        {editor.changed ? (
          <p className="editor-warning" role="status">
            源文档已更新，当前草稿已保留。请取消编辑后查看最新内容。
          </p>
        ) : null}
        <div className={`document-body ${editor.session ? `document-${tab}` : 'document-preview'}`}>
          {editor.session && tab !== 'preview' ? (
            <textarea
              className="markdown-input"
              aria-label="Markdown 正文"
              spellCheck={false}
              value={editor.session.draft}
              disabled={editor.saving}
              onChange={(event) => editor.change(event.target.value)}
            />
          ) : null}
          {!editor.session || tab !== 'edit' ? (
            <div className="document-preview-pane">
              <MarkdownPreview
                content={editor.session?.draft ?? content}
                sourcePath={sourcePath || ''}
              />
            </div>
          ) : null}
        </div>
        <footer className="editor-footer">
          <span role="status">
            {editor.saving ? (
              '正在保存…'
            ) : editor.saved ? (
              <>
                <Check size={14} />
                已同步到源文件
              </>
            ) : editor.dirty ? (
              '有未保存的修改'
            ) : (
              '保存后同步到源文件'
            )}
          </span>
          <div>
            {editor.session ? (
              <>
                <Button variant="ghost" disabled={editor.saving} onClick={editor.cancel}>
                  取消编辑
                </Button>
                <Button
                  disabled={!editor.dirty || editor.saving || editor.changed || !sourcePath}
                  onClick={save}
                >
                  <Save size={14} />
                  保存并同步
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={editor.close}>
                关闭
              </Button>
            )}
          </div>
        </footer>
        {editor.error ? (
          <p className="editor-error" role="alert">
            {editor.error} 草稿已保留；可重试或取消编辑后重新载入。
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
