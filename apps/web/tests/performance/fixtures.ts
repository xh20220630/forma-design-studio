import type { DesignNode, Project } from '@forma/schema';

export const tokens = {
  primary: '#1677ff',
  background: '#ffffff',
  surface: '#f4f6f9',
  text: '#192333',
  muted: '#7c8799',
  border: '#dce2ec',
  radius: 8,
  spacing: 8,
  fontFamily: 'sans-serif',
};

export function rectangle(id: string, patch: Partial<DesignNode> = {}): DesignNode {
  return {
    id,
    name: id,
    type: 'rectangle',
    x: 24,
    y: 24,
    width: 96,
    height: 48,
    fill: '#447be5',
    ...patch,
  };
}

export function project(nodes: DesignNode[], width = 960, height = 640): Project {
  return {
    id: 'performance-fixture',
    name: 'Performance fixture',
    description: '',
    category: '',
    status: 'draft',
    themeId: 'default',
    revision: 1,
    updatedAt: '',
    cover: 'blank',
    components: [],
    tokens,
    pages: [{ id: 'page', name: 'Performance page', width, height, nodes }],
  };
}

let imageSources: string[] | undefined;
export function images() {
  if (imageSources) return imageSources;
  imageSources = Array.from({ length: 16 }, (_, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, `hsl(${index * 23} 65% 60%)`);
    gradient.addColorStop(1, '#132847');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    context.fillStyle = '#ffffff';
    context.font = '70px sans-serif';
    context.fillText(`Image ${index}`, 35, 280);
    return canvas.toDataURL();
  });
  return imageSources;
}

let imageUrls: string[] | undefined;
function resourceUrls() {
  return (imageUrls ??= images().map((source) => {
    const bytes = Uint8Array.from(atob(source.split(',')[1]), (character) =>
      character.charCodeAt(0),
    );
    return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  }));
}

export type SceneKind =
  | 'dense'
  | 'spread'
  | 'text'
  | 'effects'
  | 'images'
  | 'mixed'
  | 'mixed-url'
  | 'group'
  | 'path'
  | 'overlap'
  | 'components';

export function fixture(kind: SceneKind, count: number): Project {
  const dense = kind === 'dense' || kind === 'group';
  const columns = dense ? Math.ceil(Math.sqrt(count * 1.5)) : 20;
  const spacingX = dense ? 900 / columns : 180;
  const spacingY = dense ? 570 / Math.ceil(count / columns) : 104;
  const nodes = Array.from({ length: count }, (_, index) => {
    const mode =
      kind === 'mixed' || kind === 'mixed-url'
        ? ['spread', 'text', 'images', 'effects'][index % 4]
        : kind;
    return rectangle(`node-${index}`, {
      x: kind === 'overlap' ? 100 : 24 + (index % columns) * spacingX,
      y: kind === 'overlap' ? 100 : 24 + Math.floor(index / columns) * spacingY,
      width: dense ? Math.max(2, spacingX - 3) : 150,
      height: dense ? Math.max(2, spacingY - 3) : 72,
      fill: index % 2 ? '#18a08e' : '#5686e5',
      radius: dense ? 0 : 8,
      ...(kind === 'group' ? { parentId: 'group' } : {}),
      ...(mode === 'text'
        ? {
            type: 'text',
            text: `节点 ${index} Design canvas 性能\n中文与 English 文本排版`,
            fontSize: 14,
            fill: 'transparent',
            color: '#192333',
            lineHeight: 1.4,
          }
        : {}),
      ...(mode === 'effects'
        ? {
            shadow: { x: 4, y: 6, blur: 12, spread: 2, color: '#00000044' },
            blur: index % 3 === 0 ? 3 : 0,
          }
        : {}),
      ...(mode === 'images'
        ? { type: 'image', src: (kind === 'mixed-url' ? resourceUrls() : images())[index % 16] }
        : {}),
      ...(mode === 'path'
        ? {
            type: 'path',
            path: 'M0 36 C20 -20 40 100 70 36 S120 0 150 36 L150 72 L0 72Z',
            stroke: '#203050',
            strokeWidth: 2,
          }
        : {}),
    });
  });
  if (kind === 'group')
    nodes.unshift(
      rectangle('group', {
        type: 'group',
        x: 0,
        y: 0,
        width: 960,
        height: 640,
        fill: 'transparent',
      }),
    );
  const doc = project(
    nodes,
    dense ? 960 : 3660,
    dense ? 640 : 64 + Math.ceil(count / columns) * spacingY,
  );
  if (kind === 'components') {
    doc.components = [
      {
        id: 'card',
        name: 'Card',
        description: '',
        category: 'performance',
        width: 150,
        height: 72,
        nodes: [
          rectangle('background', { x: 0, y: 0, width: 150, height: 72, radius: 8 }),
          rectangle('label', {
            type: 'text',
            x: 8,
            y: 8,
            width: 130,
            height: 40,
            text: '组件实例 Component',
            color: '#ffffff',
            fill: 'transparent',
            fontSize: 14,
          }),
        ],
      },
    ];
    doc.pages[0].nodes = nodes.map((node) => ({ ...node, type: 'component', componentId: 'card' }));
  }
  return doc;
}
