import { Component, FileText, Palette } from 'lucide-react';
import type { WorkspaceDocument } from '@forma/schema/workbench';
import { Button } from '@forma/ui/button';
import { Badge } from '@forma/ui/badge';
import type { DocumentTarget } from '../../documents/model/types.ts';
import type { ViewMode } from '../../../shared/types/workbench.ts';
import { tokenEntries } from '../lib/token-entries.ts';

/**
 * 呈现设计系统面板，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.mode - 当前使用的模式或操作方式。
 * @param props.document - 解析后的完整工作空间文档。
 * @param props.onOpenDocument - 在打开文档时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function DesignSystemView({
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
          {groups.map(([name, value]) => (
            <section key={name}>
              <h3>{name}</h3>
              <dl className="token-list">
                {tokenEntries(value).map((token) => (
                  <div key={token.name}>
                    <dt>{token.name || name}</dt>
                    <dd>
                      {/^(#[\da-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i.test(token.value) ? (
                        <i className="token-swatch" style={{ background: token.value }} />
                      ) : null}
                      <code>{token.value}</code>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
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
        {document.designSystem.components.map((component) => (
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
              onClick={() =>
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
        ))}
      </div>
    </main>
  );
}
