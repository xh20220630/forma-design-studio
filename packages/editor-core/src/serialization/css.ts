import type { DesignNode, ThemeTokens } from '@forma/schema';

/**
 * 将节点属性和 Token 绑定转换为可复制的 CSS，保留主题变量关系。
 *
 * @param node - 当前处理的设计节点。
 * @param tokens - 设计主题或语义 Token 集合。
 * @returns 节点的 CSS 声明文本。
 */
export function nodeCss(node: DesignNode, tokens: ThemeTokens) {
  const value = (key: string, fallback: string) =>
    node.tokenBindings?.[key] ? `var(--forma-${node.tokenBindings[key]})` : fallback;
  return [
    `position: absolute;`,
    `left: ${node.x}px;`,
    `top: ${node.y}px;`,
    `width: ${node.width}px;`,
    `height: ${node.height}px;`,
    `background: ${value('fill', node.fill ?? 'transparent')};`,
    `color: ${value('color', node.color ?? tokens.text)};`,
    `border-radius: ${value('radius', `${node.radius ?? 0}px`)};`,
    node.stroke ? `border: ${node.strokeWidth ?? 1}px solid ${node.stroke};` : '',
    node.rotation ? `transform: rotate(${node.rotation}deg);` : '',
    node.fontSize
      ? `font: ${node.fontWeight ?? 400} ${node.fontSize}px/${node.lineHeight ?? 1.4} ${node.fontFamily ?? tokens.fontFamily};`
      : '',
    node.layout && node.layout !== 'none'
      ? `display: flex;\nflex-direction: ${node.layout === 'vertical' ? 'column' : 'row'};\ngap: ${node.gap ?? 16}px;\npadding: ${node.padding ?? 16}px;`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
