import type { DesignComponent, DesignNode, DesignPage, DesignTemplate, Project, ThemeTokens } from '../types';

const baseTokens: ThemeTokens = {
  primary: '#33795e', background: '#f5f7f6', surface: '#ffffff', text: '#233831',
  muted: '#829089', border: '#e5ebe7', radius: 10, fontFamily: 'Inter, system-ui, sans-serif', spacing: 8,
};

export const seedTemplates: DesignTemplate[] = [
  { id: 'moss', name: 'Moss', description: '自然的色彩，安静的日常。为有温度的生活方式品牌而生。', category: '电商', author: 'Forma Studio', cover: 'commerce', featured: true,
    tokens: { ...baseTokens, primary: '#60704c', background: '#f4f2eb', surface: '#fffef9', text: '#303a2c', muted: '#8d917f', border: '#dfdfd3', radius: 4, fontFamily: 'Georgia, serif' } },
  { id: 'midnight', name: 'Midnight', description: '深邃底色与鲜明数据，兼具专业感和未来感。', category: '仪表盘', author: 'Forma Studio', cover: 'finance', featured: true,
    tokens: { ...baseTokens, primary: '#bef264', background: '#171b20', surface: '#242a30', text: '#f2f5f1', muted: '#8b959d', border: '#363f45', radius: 12 } },
  { id: 'paper', name: 'Paper', description: '编辑式排版与细腻留白，让内容成为主角。', category: '品牌网站', author: 'Forma Studio', cover: 'commerce',
    tokens: { ...baseTokens, primary: '#a96f50', background: '#f8f4ee', surface: '#fffcf7', text: '#3a332c', muted: '#998d81', border: '#e8dfd5', radius: 2, fontFamily: 'Georgia, serif' } },
  { id: 'tide', name: 'Tide', description: '海岸色调与轻盈的布局，为每次探索留出空间。', category: '品牌网站', author: 'Forma Studio', cover: 'travel', featured: true,
    tokens: { ...baseTokens, primary: '#267c83', background: '#f3f8f7', text: '#163d40', muted: '#7c9697', border: '#dce9e7', radius: 14 } },
  { id: 'studio', name: 'Studio', description: '清晰、克制、高效。适合从零构建现代工作台。', category: '仪表盘', author: 'Forma Studio', cover: 'dashboard',
    tokens: { ...baseTokens } },
  { id: 'iris', name: 'Iris', description: '柔和的紫色与亲切的界面，让工作也充满灵感。', category: 'SaaS', author: 'Forma Studio', cover: 'dashboard',
    tokens: { ...baseTokens, primary: '#8871c5', background: '#f7f5fc', text: '#39314e', muted: '#9288a2', border: '#e8e2f0', radius: 16 } },
];

function components(tokens: ThemeTokens): DesignComponent[] {
  return [
    { id: 'button-primary', name: 'Button / Primary', description: '使用品牌主色的主要操作按钮', category: '基础组件', width: 160, height: 44,
      nodes: [{ id: 'button-root', name: 'Primary button', type: 'button', x: 0, y: 0, width: 160, height: 44, fill: tokens.primary, color: tokens.background === '#171b20' ? '#171b20' : '#ffffff', text: '开始使用', fontSize: 14, radius: tokens.radius, tokenBindings: { fill: 'primary', radius: 'radius' } }] },
    { id: 'card-default', name: 'Card / Default', description: '基础内容容器，使用统一表面与圆角', category: '布局组件', width: 260, height: 150,
      nodes: [{ id: 'card-root', name: 'Card surface', type: 'frame', x: 0, y: 0, width: 260, height: 150, fill: tokens.surface, radius: tokens.radius, tokenBindings: { fill: 'surface', radius: 'radius' } },
        { id: 'card-title', name: 'Card title', type: 'text', x: 22, y: 24, width: 216, height: 24, text: '让好的设计，发生。', color: tokens.text, fontSize: 17, tokenBindings: { color: 'text' } },
        { id: 'card-description', name: 'Card description', type: 'text', x: 22, y: 65, width: 216, height: 48, text: '一致的细节，构建熟悉的体验。', color: tokens.muted, fontSize: 13, tokenBindings: { color: 'muted' } }] },
  ];
}

function buildPage(cover: Project['cover'], tokens: ThemeTokens, title: string): DesignPage {
  const nodes: DesignNode[] = [];
  const add = (node: Omit<DesignNode, 'id'>) => nodes.push({ ...node, id: `node-${nodes.length + 1}` });
  const frame = (name: string, x: number, y: number, width: number, height: number, fill: keyof ThemeTokens = 'surface', radius = tokens.radius) =>
    add({ name, type: 'frame', x, y, width, height, fill: String(tokens[fill]), radius, tokenBindings: { fill, ...(radius === tokens.radius ? { radius: 'radius' as const } : {}) } });
  const text = (name: string, value: string, x: number, y: number, width: number, fontSize = 16, color: keyof ThemeTokens = 'text', height = 36) =>
    add({ name, type: 'text', text: value, x, y, width, height, fontSize, color: String(tokens[color]), tokenBindings: { color } });
  const button = (value: string, x: number, y: number, width = 148) =>
    add({ name: value, type: 'button', text: value, x, y, width, height: 44, fill: tokens.primary, color: tokens.background === '#171b20' ? '#171b20' : '#ffffff', fontSize: 14, radius: tokens.radius, tokenBindings: { fill: 'primary', radius: 'radius' } });

  frame('Page background', 0, 0, 1120, 760, 'background', 0);
  if (cover === 'dashboard' || cover === 'finance') {
    const finance = cover === 'finance';
    frame('Sidebar', 0, 0, 204, 760, 'surface', 0);
    text('Brand', finance ? '◈  vault' : '◈  nexus', 28, 32, 152, 27);
    text('Workspace label', finance ? 'PERSONAL FINANCE' : 'WORKSPACE', 28, 100, 155, 10, 'muted');
    frame('Active navigation', 16, 141, 172, 44, 'background');
    ['◫   总览', '▥   数据分析', '▤   项目管理', '◷   活动记录'].forEach((label, i) => text(`Navigation ${i + 1}`, finance ? ['◫   资产总览', '↗   我的投资', '▤   交易记录', '◷   分析报告'][i] : label, 30, 154 + i * 55, 145, 14, i === 0 ? 'primary' : 'muted'));
    text('Workspace name', '个人工作空间', 28, 692, 150, 12, 'muted');
    text('Eyebrow', finance ? 'YOUR MONEY, AT A GLANCE' : 'WORKSPACE / OVERVIEW', 246, 33, 500, 10, 'muted');
    text('Page title', finance ? '你的财富，一目了然。' : '每一个增长，都值得看见。', 246, 83, 630, 29, 'text', 48);
    text('Page subtitle', finance ? '欢迎回来，这是你的资产概况。' : '早上好，Alex。今天也是充满可能的一天。', 246, 133, 650, 14, 'muted');
    button(finance ? '+ 添加资产' : '↗ 导出报告', 924, 86, 152);
    [finance ? ['资产总额', '¥128,450.00', '+12.8% 本月'] : ['总收入', '¥128,450', '+18.6% 较上月'], finance ? ['本月收益', '¥8,240.60', '+8.2% 本月'] : ['活跃用户', '8,549', '+12.8% 较上月'], finance ? ['可用余额', '¥24,680.00', '随时可转出'] : ['转化率', '4.28%', '+2.4% 较上月']].forEach((metric, i) => {
      frame(`Metric card ${i + 1}`, 246 + i * 281, 195, 262, 140);
      text(`Metric label ${i + 1}`, metric[0], 267 + i * 281, 216, 215, 12, 'muted');
      text(`Metric value ${i + 1}`, metric[1], 267 + i * 281, 255, 218, finance ? 25 : 29);
      text(`Metric trend ${i + 1}`, metric[2], 267 + i * 281, 302, 215, 11, 'primary');
    });
    frame('Analytics panel', 246, 359, 824, 335);
    text('Chart title', finance ? '资产趋势' : '收入概览', 270, 382, 300, 17);
    text('Chart summary', finance ? '+ ¥12,684.28' : '持续增长，未来可期。', 270, 421, 400, 13, 'muted');
    [64, 104, 85, 142, 113, 165, 126, 185, 156, 198].forEach((height, i) => add({ name: `Chart bar ${i + 1}`, type: 'rectangle', x: 282 + i * 75, y: 659 - height, width: 31, height, fill: tokens.primary, radius: 5, opacity: 0.35 + i * 0.065, tokenBindings: { fill: 'primary' } }));
    text('Chart axis', '1月         2月         3月         4月         5月         6月         7月         8月         9月        10月', 279, 671, 760, 10, 'muted');
  } else if (cover === 'commerce') {
    text('Brand', 'moss.', 55, 31, 220, 34);
    text('Navigation', '所有好物          家居生活          我们的故事', 424, 44, 540, 14);
    text('Shopping bag', '购物袋  (0)', 972, 44, 130, 12);
    frame('Hero surface', 40, 108, 1040, 436, 'surface', 0);
    text('Eyebrow', 'THOUGHTFULLY MADE, NATURALLY LIVED.', 88, 159, 500, 11, 'muted');
    text('Hero title', '给生活，\n留一点自然。', 87, 210, 540, 54, 'text', 155);
    text('Hero description', '精选日常好物，让简单的日子闪闪发光。\n源自自然，回归本真。', 90, 384, 490, 15, 'muted', 55);
    button('探索当季精选  ↗', 88, 466, 190);
    add({ name: 'Product backdrop', type: 'rectangle', x: 664, y: 142, width: 365, height: 361, fill: '#dce0cf', radius: 180 });
    add({ name: 'Ceramic vase', type: 'rectangle', x: 763, y: 292, width: 153, height: 171, fill: '#b9ab8f', radius: 55 });
    add({ name: 'Vase neck', type: 'rectangle', x: 810, y: 241, width: 64, height: 106, fill: '#c5b799', radius: 16 });
    add({ name: 'Botanical stem', type: 'rectangle', x: 840, y: 178, width: 6, height: 123, fill: '#687c4e', radius: 4 });
    add({ name: 'Botanical leaf', type: 'rectangle', x: 845, y: 176, width: 63, height: 24, fill: '#738761', radius: 25 });
    add({ name: 'Botanical leaf 2', type: 'rectangle', x: 790, y: 214, width: 58, height: 23, fill: '#82916b', radius: 25 });
    text('Collection heading', '喜欢的日常，就在这里。', 55, 578, 600, 28);
    text('Collection link', '查看全部  ↗', 955, 590, 138, 13, 'muted');
    ['慢生活 · 家居', '自然感 · 器物', '好时光 · 香氛'].forEach((label, i) => {
      frame(`Collection card ${i + 1}`, 55 + i * 346, 635, 319, 88, 'surface');
      text(`Collection name ${i + 1}`, label, 80 + i * 346, 664, 270, 18);
    });
  } else if (cover === 'travel') {
    text('Brand', 'roam', 52, 30, 185, 32);
    text('Navigation', '目的地           精选体验           旅行故事', 417, 44, 535, 14);
    button('开启旅程  ↗', 930, 29, 140);
    frame('Coastal horizon', 40, 108, 1040, 423, 'primary', 20);
    add({ name: 'Sea', type: 'rectangle', x: 40, y: 357, width: 1040, height: 174, fill: '#67a9a5', radius: 20 });
    add({ name: 'Coastal island', type: 'rectangle', x: 715, y: 267, width: 365, height: 264, fill: '#9da889', radius: 120 });
    add({ name: 'Sandy shore', type: 'rectangle', x: 832, y: 367, width: 248, height: 164, fill: '#ded7b8', radius: 85 });
    add({ name: 'Hero eyebrow', type: 'text', text: 'WANDER MORE. FEEL MORE.', x: 93, y: 162, width: 520, height: 24, color: '#d3ebe8', fontSize: 11 });
    add({ name: 'Hero title', type: 'text', text: '下一站，\n去心动的地方。', x: 90, y: 206, width: 720, height: 169, color: '#ffffff', fontSize: 57 });
    add({ name: 'Hero description', type: 'text', text: '远离日常，靠近自己。发现属于你的旅行方式。', x: 94, y: 393, width: 800, height: 36, color: '#ecf5ec', fontSize: 15 });
    frame('Destination search', 91, 452, 530, 59, 'surface');
    text('Search placeholder', '⌕  想去哪里？', 112, 471, 345, 14, 'muted');
    button('探索目的地', 472, 460, 137);
    text('Featured heading', '让世界，给你一点惊喜。', 53, 565, 720, 27);
    text('Featured subtitle', '精心挑选的目的地，总有一处让你想出发。', 55, 610, 720, 13, 'muted');
    ['巴厘岛 · 与海相遇', '京都 · 慢一点生活', '云南 · 山野之间'].forEach((label, i) => {
      frame(`Destination card ${i + 1}`, 54 + i * 346, 655, 319, 72, 'surface');
      text(`Destination name ${i + 1}`, label, 78 + i * 346, 678, 272, 16);
    });
  } else {
    text('Brand', title, 64, 42, 890, 22);
    text('Hero title', '好设计，从一个想法开始。', 64, 215, 994, 54, 'text', 90);
    text('Hero subtitle', '在这里构建你的下一款产品。', 67, 320, 880, 20, 'muted');
    button('开始探索  ↗', 67, 390, 172);
  }
  return { id: 'page-home', name: '首页', width: 1120, height: 760, nodes };
}

export function createProject(name: string, template?: DesignTemplate, description = ''): Project {
  const selected = template ?? seedTemplates.find(item => item.id === 'studio')!;
  const tokens = { ...selected.tokens };
  return {
    id: `project-${crypto.randomUUID()}`, name: name.trim() || '未命名项目', description: description || '从一个想法，走向真实的产品。',
    category: selected.category, status: 'draft', themeId: selected.id, tokens,
    pages: [buildPage(template ? selected.cover : 'blank', tokens, name)], components: components(tokens),
    updatedAt: new Date().toISOString(), revision: 1, cover: template ? selected.cover : 'blank',
  };
}

export const seedProjects: Project[] = [
  { id: 'nexus', name: 'Nexus 数据分析平台', description: '让数据洞察，驱动每一个好决策。', templateId: 'studio', cover: 'dashboard', category: '数据分析', hours: 1 },
  { id: 'moss', name: 'Moss 生活方式商城', description: '自然、克制、有温度的生活方式品牌。', templateId: 'moss', cover: 'commerce', category: '电子商务', hours: 3 },
  { id: 'roam', name: 'Roam 旅行探索', description: '发现心动目的地，开启下一段旅程。', templateId: 'tide', cover: 'travel', category: '旅行生活', hours: 7 },
  { id: 'vault', name: 'Vault 财务管理', description: '清晰管理资产，从容规划未来。', templateId: 'midnight', cover: 'finance', category: '金融科技', hours: 24 },
].map((item, i) => {
  const template = seedTemplates.find(candidate => candidate.id === item.templateId)!;
  const tokens = { ...template.tokens };
  return { id: item.id, name: item.name, description: item.description, category: item.category, status: i < 2 ? 'in-progress' : 'draft',
    themeId: template.id, tokens, pages: [buildPage(item.cover as Project['cover'], tokens, item.name)], components: components(tokens),
    updatedAt: new Date(Date.now() - item.hours * 3600000).toISOString(), revision: 1, cover: item.cover as Project['cover'] };
});
