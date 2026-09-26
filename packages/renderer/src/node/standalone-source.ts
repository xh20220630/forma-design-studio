import { readFileSync } from 'node:fs';
import { getDesignTypeSource } from '@forma/schema/source';

const rendererFiles = [
  '../shared/scene-values.ts',
  '../dom/styles.ts',
  '../dom/vector.tsx',
  '../dom/SceneRenderer.tsx',
];

/** 内嵌共享契约及 DOM 渲染实现，使导出结果只依赖 React。 */
export function getStandaloneRendererSource() {
  const renderer = rendererFiles
    .map((file) =>
      readFileSync(new URL(file, import.meta.url), 'utf8')
        .replace(/^import[\s\S]*?;\r?\n/gm, '')
        .replace(/^export (?=(?:const vectorTypes|function VectorContent)\b)/gm, ''),
    )
    .join('\n');
  return `import React from 'react';\nimport type { CSSProperties } from 'react';\n\n${renderer}\n${getDesignTypeSource()}`;
}
