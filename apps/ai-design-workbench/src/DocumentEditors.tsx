import { useDeferredValue, useEffect, useRef, useState } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, FileText, Pencil, Save, X } from 'lucide-react';
import { Button } from '@forma/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@forma/ui/dialog';
import type {
  AnnotationNode,
  WorkspaceChangeSet,
  WorkspaceDocument,
  WorkspaceOperation,
} from '@forma/schema/workbench';

/** 正在编辑的规范或简报位置，确保保存回正确文档。 */
export type DocumentTarget =
  | {
      /** 用于区分数据形态或行为分支的类型。取值：component（组件实例）。 */
      type: 'component';
      /** 唯一标识，用于查找、更新和建立引用。 */
      id: string;
      /** 规范或安装内容的版本标识。 */
      version: string;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：brief（流程简报）。 */
      type: 'brief';
      /** 目标流程的唯一标识。 */
      flowId: string;
    };
/** 正在编辑的页面标注位置，确保保存回正确流程和页面。 */
export type AnnotationTarget = {
  /** 目标流程的唯一标识。 */
  flowId: string;
  /** 目标页面的唯一标识。 */
  pageId: string;
  /** 目标定位标注的标识。 */
  annotationId: string;
};
/** Editor 的输入契约，把展示数据与交互回调交给调用方控制。 */
type EditorProps = {
  /** 解析后的完整工作空间文档。 */
  document: WorkspaceDocument;
  /**
   * 在保存时通知调用方，由外层决定如何更新业务状态。
   * @param change - 本次要应用的变更内容。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  onSave: (change: WorkspaceChangeSet) => Promise<void>;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
};

// Keep the edit snapshot separate from live data arriving through workspace events.
/**
 * 集中管理编辑草稿、提交与取消，防止不同文档编辑器行为不一致。
 *
 * @param current - 更新前的当前值。
 * @param revision - 当前修订号，每次持久化修改后递增，用于拒绝过期提交。
 * @param onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @returns 编辑会话状态和操作方法。
 */
function useEditSession<T>(current: T, revision: number, onClose: () => void) {
  /** 界面状态：编辑开始时的原文、修订号和当前草稿。通过状态更新驱动界面刷新。 */
  const [session, setSession] = useState<{
    /** 编辑或计算之前的原始数据。 */
    original: T;
    /** 尚未提交的编辑内容或待组装的设计草稿。 */
    draft: T;
    /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
    revision: number;
  }>();
  /** 界面状态：是否正在保存，防止重复提交。通过状态更新驱动界面刷新。 */
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  /** 界面状态：当前操作的失败信息，供界面反馈或重试判断。通过状态更新驱动界面刷新。 */
  const [error, setError] = useState('');
  /** 界面状态：最近一次成功保存的值或状态。通过状态更新驱动界面刷新。 */
  const [saved, setSaved] = useState(false);
  const dirty = !!session && JSON.stringify(session.original) !== JSON.stringify(session.draft);
  const changed = !!session && JSON.stringify(session.original) !== JSON.stringify(current);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  const cancel = () => {
    if (savingRef.current || (dirty && !window.confirm('放弃尚未保存的修改？'))) return false;
    setSession(undefined);
    setError('');
    return true;
  };
  return {
    session,
    saving,
    error,
    saved,
    dirty,
    changed,
    start() {
      setSession({ original: current, draft: current, revision });
      setError('');
      setSaved(false);
    },
    change(draft: T) {
      setSession((value) => (value ? { ...value, draft } : value));
    },
    cancel,
    close() {
      if (cancel()) onClose();
    },
    async save(action: () => Promise<void>) {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      setError('');
      try {
        await action();
        setSession(undefined);
        setSaved(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '保存失败，请重试。');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
  };
}

const plugins = [remarkGfm];
/**
 * 呈现Markdown 内容预览，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.content - 文件、消息或编辑文档的正文。
 * @param props.sourcePath - 原始设计文件的相对路径。
 * @returns 供 React 渲染的界面内容。
 */
function MarkdownPreview({
  content,
  sourcePath,
}: {
  /** 文件、消息或编辑文档的正文。 */
  content: string;
  /** 原始设计文件的相对路径。 */
  sourcePath: string;
}) {
  const deferredContent = useDeferredValue(content);
  return (
    <div className="markdown-content">
      <Markdown
        remarkPlugins={plugins}
        urlTransform={(url) => {
          const safe = defaultUrlTransform(url);
          if (!safe || safe.startsWith('#') || /^(?:[a-z]+:|\/\/)/i.test(safe)) return safe;
          // Relative images and links are resolved from the source document directory.
          const base = new URL(
            `/assets/${sourcePath.split('/').map(encodeURIComponent).join('/')}`,
            window.location.origin,
          );
          const resolved = new URL(safe, base);
          return resolved.pathname.startsWith('/assets/')
            ? `${resolved.pathname}${resolved.search}${resolved.hash}`
            : '';
        }}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {deferredContent || '*暂无内容*'}
      </Markdown>
    </div>
  );
}

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
