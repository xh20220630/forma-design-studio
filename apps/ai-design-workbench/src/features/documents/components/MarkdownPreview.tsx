import { useDeferredValue } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const plugins = [remarkGfm];

/**
 * 呈现Markdown 内容预览，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.content - 文件、消息或编辑文档的正文。
 * @param props.sourcePath - 原始设计文件的相对路径。
 * @returns 供 React 渲染的界面内容。
 */
export function MarkdownPreview({
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
