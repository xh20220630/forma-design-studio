import { Pencil, Save, X } from 'lucide-react';
import { Button } from '@forma/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@forma/ui/dialog';
import type { AnnotationNode, WorkspaceOperation } from '@forma/schema/workbench';
import type { AnnotationTarget, EditorProps } from '../model/types.ts';
import { useEditSession } from '../hooks/useEditSession.ts';

/**
 * 呈现定位标注编辑器，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.target - 操作作用的目标。
 * @param props.document - 解析后的完整工作空间文档。
 * @param props.onSave - 在保存时通知调用方，由外层决定如何更新业务状态。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onNavigate - 在导航时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function AnnotationEditor({
  target,
  document,
  onSave,
  onClose,
  onNavigate,
}: EditorProps & {
  /** 操作作用的目标。 */
  target: AnnotationTarget;
  /**
   * 在导航时通知调用方，由外层决定如何更新业务状态。
   * @param pageRef - 跨流程可定位的页面引用。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onNavigate: (pageRef: string) => void;
}) {
  const flow = document.flows.find((item) => item.id === target.flowId);
  const node = flow?.nodes.find((item) => item.pageRef === `${target.flowId}/${target.pageId}`);
  const current = node?.annotations.find((item) => item.id === target.annotationId);
  const editor = useEditSession(current, document.revision, onClose);
  const annotation = editor.session?.draft || current;
  const update = (patch: Partial<AnnotationNode>) => {
    if (annotation) editor.change({ ...annotation, ...patch });
  };
  const save = () => {
    if (!editor.session?.draft || !editor.session.original || !current) return;
    const operation: WorkspaceOperation = {
      type: 'update-annotation',
      flowId: target.flowId,
      pageId: target.pageId,
      annotation: editor.session.draft,
      expectedAnnotation: editor.session.original,
    };
    void editor.save(() =>
      onSave({ baseRevision: editor.session!.revision, operations: [operation] }),
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) editor.close();
      }}
    >
      <DialogContent className="document-dialog annotation-dialog" showCloseButton={false}>
        <header className="document-heading">
          <span className="document-icon">
            <Pencil size={22} />
          </span>
          <div>
            <span className="eyebrow">{node?.name} · 设计注释</span>
            <DialogTitle>{current?.label || '标注已不存在'}</DialogTitle>
            <DialogDescription>design/{flow?.sourcePath}</DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={editor.saving}
            aria-label="关闭注释"
            onClick={editor.close}
          >
            <X size={18} />
          </Button>
        </header>
        {editor.changed ? (
          <p className="editor-warning" role="status">
            源注释已更新，当前草稿已保留。请取消编辑后查看最新内容。
          </p>
        ) : null}
        <div className="annotation-editor-body">
          {editor.session && annotation ? (
            <fieldset disabled={editor.saving}>
              <label>
                注释标题
                <input
                  aria-label="注释标题"
                  value={annotation.label}
                  onChange={(event) => update({ label: event.target.value })}
                />
              </label>
              <label>
                注释内容
                <textarea
                  aria-label="注释内容"
                  rows={6}
                  value={annotation.text}
                  onChange={(event) => update({ text: event.target.value })}
                />
              </label>
              <label>
                跳转页面
                <select
                  aria-label="跳转页面"
                  value={annotation.target || ''}
                  onChange={(event) => update({ target: event.target.value || undefined })}
                >
                  <option value="">无跳转</option>
                  {document.flows.map((item) => (
                    <optgroup key={item.id} label={item.name}>
                      {item.nodes.map((page) => (
                        <option key={page.pageRef} value={page.pageRef}>
                          {page.name} · {page.pageRef}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="annotation-coordinates">
                {(
                  [
                    ['x', '锚点 X'],
                    ['y', '锚点 Y'],
                    ['labelX', '标记 X'],
                    ['labelY', '标记 Y'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      aria-label={label}
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={Number.isFinite(annotation[key]) ? annotation[key] : ''}
                      onChange={(event) => update({ [key]: event.target.valueAsNumber })}
                    />
                  </label>
                ))}
              </div>
              <small className="muted">位置范围为 0–1，以图片左上角为原点。</small>
            </fieldset>
          ) : annotation ? (
            <>
              <p className="annotation-text">{annotation.text || '暂无内容'}</p>
              {annotation.target ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    onNavigate(annotation.target!);
                    editor.close();
                  }}
                >
                  跳转到 {annotation.target}
                </Button>
              ) : null}
            </>
          ) : (
            <p>该注释已被移除。</p>
          )}
        </div>
        <footer className="editor-footer">
          <span role="status">
            {editor.saving
              ? '正在保存…'
              : editor.saved
                ? '已同步到源文件'
                : editor.dirty
                  ? '有未保存的修改'
                  : '保存后同步到源文件'}
          </span>
          <div>
            {editor.session ? (
              <>
                <Button variant="ghost" disabled={editor.saving} onClick={editor.cancel}>
                  取消编辑
                </Button>
                <Button
                  disabled={
                    !editor.dirty ||
                    editor.saving ||
                    editor.changed ||
                    !current ||
                    !annotation?.label.trim() ||
                    [annotation.x, annotation.y, annotation.labelX, annotation.labelY].some(
                      (value) => !Number.isFinite(value) || value < 0 || value > 1,
                    )
                  }
                  onClick={save}
                >
                  <Save size={14} />
                  保存并同步
                </Button>
              </>
            ) : (
              <Button disabled={!current} onClick={editor.start}>
                <Pencil size={14} />
                编辑注释
              </Button>
            )}
          </div>
        </footer>
        {editor.error ? (
          <p className="editor-error" role="alert">
            {editor.error} 草稿已保留。
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
