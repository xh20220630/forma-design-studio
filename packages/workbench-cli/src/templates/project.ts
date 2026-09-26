import path from 'node:path';

export function createProjectFiles(projectRoot: string) {
  const files = new Map<string, string>([
    [
      'forma.config.json',
      `${JSON.stringify({ schemaVersion: 1, designRoot: './design', workbench: { openBrowser: true }, skills: { 'forma-ai-ui-designer': { requiredVersion: '^2.0.0' } } }, null, 2)}\n`,
    ],
    [
      'design/project.json',
      `${JSON.stringify(
        {
          schema_version: 2,
          revision: 0,
          id:
            path
              .basename(projectRoot)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-') || 'design-project',
          name: path.basename(projectRoot),
          theme: {
            id: 'product-ui',
            version: '0.1.0',
            status: 'draft',
            confirmation: '',
            design_path: 'DESIGN.md',
            tokens_path: 'tokens.json',
          },
        },
        null,
        2,
      )}\n`,
    ],
    [
      'design/DESIGN.md',
      '# Design system\n\n状态：draft\n\n在生成页面图片前补充业务背景、视觉方向、语义 Tokens、框架、组件共性和交互规则。\n',
    ],
    [
      'design/tokens.json',
      `${JSON.stringify({ schema_version: 2, theme_version: '0.1.0', tokens: { color: {}, typography: {}, spacing: {}, radius: {}, shadow: {}, layout: {}, motion: {} } }, null, 2)}\n`,
    ],
    [
      'design/components/index.json',
      `${JSON.stringify({ schema_version: 2, components: [] }, null, 2)}\n`,
    ],
    ['design/flows/index.json', `${JSON.stringify({ schema_version: 2, flows: [] }, null, 2)}\n`],
  ]);

  return files;
}
