import type {
  DesignNode,
  DesignPage,
  DesignComponent,
  GenerationState,
  Project,
  ThemeTokens,
} from '@forma/schema';
import { isRecord } from './errors.ts';
import { requireValue } from './errors.ts';
import { designContextHash } from './design-context.ts';
import { localAssetFilename, validateSafeSvg } from './assets.ts';

/** 集中维护 tokenKeys 的约定值或当前状态，供相关分支保持一致。 */
export const tokenKeys = [
  'primary',
  'background',
  'surface',
  'text',
  'muted',
  'border',
  'radius',
  'fontFamily',
  'spacing',
];
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const nodeTypes = new Set([
  'frame',
  'text',
  'rectangle',
  'button',
  'image',
  'component',
  'group',
  'ellipse',
  'line',
  'polygon',
  'star',
  'path',
  'section',
]);
const colorPattern =
  /^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgb|hsl)a?\([\d\s.,%/+-]+\)|transparent|currentColor|[a-zA-Z]{1,30})$/;

/**
 * 限制标识符格式，避免路径使用和记录查找出现歧义。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @returns 通过校验的标识符。
 */
export function validateId(id: unknown): string {
  requireValue(
    typeof id === 'string' && idPattern.test(id),
    'ID 仅允许字母、数字、短横线和下划线，长度 1–100。',
  );
  return id;
}
/**
 * 检查颜色是否属于允许的表达方式，避免无效颜色进入渲染器。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @returns 颜色格式是否合法。
 */
export function validColor(value: unknown): value is string {
  return typeof value === 'string' && colorPattern.test(value);
}
/**
 * 校验数值有限且落在允许范围内，防止异常尺寸污染设计数据。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param min - 允许的最小值。
 * @param max - 允许的最大值。
 * @returns 是否为范围内的有限数值。
 */
function finite(value: unknown, min = -100000, max = 100000) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
const record = isRecord;
/**
 * 校验字符串类型与长度，让设计字段保持可显示、可存储。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param max - 允许的最大值。
 * @returns 是否为不超过长度上限的字符串。
 */
function text(value: unknown, max = 500): value is string {
  return typeof value === 'string' && value.length <= max;
}
/**
 * 限制字段只能取约定值，避免状态或样式分支落入未知情况。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param values - 各模式或选项对应的实际取值。
 * @param message - 面向用户或调用方的说明消息。
 * @returns 无返回值；不支持的取值会抛出错误。
 */
function choices(value: unknown, values: readonly unknown[], message: string) {
  if (value !== undefined) requireValue(values.includes(value), message);
}
/**
 * 检查同一集合内标识符是否重复，保证引用和更新能唯一定位对象。
 *
 * @param items - 索引中的全部条目，供大范围查询回退遍历。
 * @param scope - 当前数据或操作生效的范围。
 * @returns 无返回值；重复时抛出错误。
 */
function uniqueIds(items: readonly unknown[], scope: string) {
  const ids = new Set();
  for (const item of items) {
    requireValue(record(item), `${scope}格式无效。`);
    validateId(item.id);
    requireValue(!ids.has(item.id), `${scope} ID 重复。`);
    ids.add(item.id);
  }
}
/**
 * 逐项校验可选节点属性，兼顾未配置字段和已填写字段的约束。
 *
 * @param node - 当前处理的设计节点。
 * @returns 无返回值；字段无效时抛出错误。
 */
function validateOptionalNodeFields(node: DesignNode) {
  for (const key of [
    'visible',
    'locked',
    'flipX',
    'flipY',
    'closed',
    'clipContent',
    'aspectRatioLocked',
  ] as const)
    if (node[key] !== undefined)
      requireValue(typeof node[key] === 'boolean', `节点 ${key} 必须是布尔值。`);
  for (const key of ['strokeWidth', 'blur', 'padding', 'paddingX', 'paddingY'] as const)
    if (node[key] !== undefined) requireValue(finite(node[key], 0, 10000), `节点 ${key} 无效。`);
  for (const key of ['rotation', 'letterSpacing'] as const)
    if (node[key] !== undefined) requireValue(finite(node[key]), `节点 ${key} 无效。`);
  if (node.fontWeight !== undefined)
    requireValue(finite(node.fontWeight, 1, 1000), '字重必须介于 1 和 1000。');
  if (node.fontFamily !== undefined)
    requireValue(
      typeof node.fontFamily === 'string' &&
        node.fontFamily.length > 0 &&
        node.fontFamily.length < 250 &&
        !/[;{}<>\r\n]/.test(node.fontFamily),
      '无效的图层字体名称。',
    );
  if (node.lineHeight !== undefined)
    requireValue(finite(node.lineHeight, 0.1, 100), '行高必须介于 0.1 和 100。');
  if (node.polygonSides !== undefined)
    requireValue(
      Number.isInteger(node.polygonSides) && finite(node.polygonSides, 3, 64),
      '多边形边数必须介于 3 和 64。',
    );
  if (node.starRatio !== undefined)
    requireValue(finite(node.starRatio, 0.01, 1), '星形内径比例无效。');
  choices(node.strokeAlign, ['inside', 'center', 'outside'], '描边位置无效。');
  choices(node.strokeDash, ['solid', 'dashed', 'dotted'], '描边类型无效。');
  choices(
    node.blendMode,
    ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'],
    '混合模式无效。',
  );
  choices(node.imageFit, ['cover', 'contain'], '图片适配模式无效。');
  choices(node.fontStyle, ['normal', 'italic'], '字体样式无效。');
  choices(node.textAlign, ['left', 'center', 'right', 'justify'], '文本对齐无效。');
  choices(node.verticalAlign, ['top', 'center', 'bottom'], '垂直对齐无效。');
  choices(node.textDecoration, ['none', 'underline', 'line-through'], '文本装饰无效。');
  choices(node.alignItems, ['start', 'center', 'end', 'stretch'], '布局对齐无效。');
  choices(node.justifyContent, ['start', 'center', 'end', 'space-between'], '布局分布无效。');
  for (const key of ['sizingHorizontal', 'sizingVertical'] as const)
    choices(node[key], ['fixed', 'hug', 'fill'], '尺寸模式无效。');
  if (node.gradient !== undefined) {
    requireValue(
      record(node.gradient) &&
        ['linear', 'radial'].includes(node.gradient.type) &&
        validColor(node.gradient.from) &&
        validColor(node.gradient.to) &&
        finite(node.gradient.angle),
      '渐变参数无效。',
    );
  }
  if (node.shadow !== undefined) {
    const shadow = node.shadow;
    requireValue(
      record(shadow) &&
        finite(shadow.x) &&
        finite(shadow.y) &&
        finite(shadow.blur, 0, 1000) &&
        finite(shadow.spread) &&
        validColor(shadow.color) &&
        (shadow.inset === undefined || typeof shadow.inset === 'boolean'),
      '阴影参数无效。',
    );
  }
  if (node.points !== undefined)
    requireValue(
      Array.isArray(node.points) &&
        node.points.length <= 10000 &&
        node.points.every(
          /** 判断 validateOptionalNodeFields 中的条目是否符合检查条件。 @param point - 当前处理的坐标点。 @returns 该条目是否符合条件。 */
          (point) => record(point) && finite(point.x) && finite(point.y),
        ),
      '路径节点坐标无效。',
    );
  if (node.path !== undefined)
    requireValue(
      text(node.path, 100000) &&
        (!node.path || /^[Mm][MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]*$/.test(node.path)),
      '矢量路径仅允许 SVG path 坐标指令。',
    );
  if (node.constraints !== undefined)
    requireValue(
      record(node.constraints) &&
        ['left', 'right', 'center', 'left-right', 'scale'].includes(node.constraints.horizontal) &&
        ['top', 'bottom', 'center', 'top-bottom', 'scale'].includes(node.constraints.vertical),
      '约束参数无效。',
    );
  if (node.prototype !== undefined) {
    const prototype = node.prototype;
    requireValue(
      record(prototype) && ['navigate', 'overlay', 'back', 'url'].includes(prototype.action),
      '原型动作无效。',
    );
    choices(prototype.animation, ['instant', 'dissolve', 'slide'], '原型动画无效。');
    choices(prototype.trigger, ['click', 'hover'], '原型触发方式无效。');
    if (prototype.duration !== undefined)
      requireValue(finite(prototype.duration, 0, 10000), '原型动画时长无效。');
    if (prototype.target !== undefined)
      requireValue(text(prototype.target, 2000), '原型目标无效。');
    if (prototype.action === 'url' && prototype.target)
      requireValue(/^https?:\/\//i.test(prototype.target), '原型链接必须使用 HTTP 或 HTTPS。');
  }
  if (node.overrides !== undefined) {
    requireValue(
      record(node.overrides) && Object.keys(node.overrides).length <= 2000,
      '实例覆盖参数无效。',
    );
    for (const [id, override] of Object.entries(node.overrides)) {
      validateId(id);
      requireValue(record(override), '实例覆盖必须是对象。');
      if (override.text !== undefined)
        requireValue(text(override.text, 50000), '实例文本覆盖无效。');
      if (override.fill !== undefined)
        requireValue(validColor(override.fill), '实例颜色覆盖无效。');
      if (override.visible !== undefined)
        requireValue(typeof override.visible === 'boolean', '实例可见性覆盖无效。');
    }
  }
}
/**
 * 校验主题的颜色、字体和尺寸字段，保证多个渲染入口使用同一份有效主题。
 *
 * @param input - 当前步骤需要处理的输入。
 * @returns 通过校验的主题 Token。
 */
export function validateTokens(input: unknown): ThemeTokens {
  requireValue(record(input), '缺少主题 tokens。');
  const tokens = input;
  requireValue(tokens && typeof tokens === 'object', '缺少主题 tokens。');
  for (const key of ['primary', 'background', 'surface', 'text', 'muted', 'border'] as const)
    requireValue(validColor(tokens[key]), `无效的颜色 token：${key}`);
  requireValue(
    finite(tokens.radius, 0, 1000) && finite(tokens.spacing, 0, 1000),
    '圆角和间距必须是 0–1000 的数字。',
  );
  requireValue(
    typeof tokens.fontFamily === 'string' &&
      tokens.fontFamily.length < 250 &&
      !/[;{}<>\r\n]/.test(tokens.fontFamily),
    '无效的字体名称。',
  );
  return Object.fromEntries(
    tokenKeys.map(
      /** 转换 validateTokens 中的集合条目，供后续处理或展示。 @param key - 要访问或更新的字段名。 @returns 当前条目转换后的结果。 */
      (key) => [key, tokens[key]],
    ),
  ) as unknown as ThemeTokens;
}

/**
 * 校验节点属性及引用关系，避免非法图层结构进入编辑器和导出器。
 *
 * @param input - 当前步骤需要处理的输入。
 * @param components - 项目中的组件定义或规范集合。
 * @param scope - 当前数据或操作生效的范围。
 * @returns 通过校验的节点集合。
 */
export function validateNodes(
  input: unknown,
  components: readonly Pick<DesignComponent, 'id'>[] = [],
  scope = '页面',
): DesignNode[] {
  requireValue(Array.isArray(input), `${scope}节点数量无效。`);
  // The following checks validate every supported node field before returning this candidate.
  const nodes = input as DesignNode[];
  requireValue(Array.isArray(nodes) && nodes.length <= 2000, `${scope}节点数量无效。`);
  const ids = new Set();
  for (const node of nodes) {
    requireValue(
      node && typeof node === 'object' && !Array.isArray(node),
      '节点必须是 JSON 对象。',
    );
    validateId(node.id);
    requireValue(!ids.has(node.id), `${scope}包含重复节点 ID。`);
    ids.add(node.id);
    requireValue(nodeTypes.has(node.type), `不支持节点类型：${node.type}`);
    requireValue(typeof node.name === 'string' && node.name.length <= 500, '节点名称无效。');
    for (const key of ['x', 'y', 'width', 'height'] as const)
      requireValue(
        finite(node[key], key === 'width' || key === 'height' ? 0 : -100000),
        `节点 ${node.id} 的 ${key} 无效。`,
      );
    for (const key of ['fill', 'color', 'stroke'] as const)
      if (node[key] !== undefined)
        requireValue(validColor(node[key]), `节点 ${node.id} 的 ${key} 无效。`);
    if (node.text !== undefined)
      requireValue(typeof node.text === 'string' && node.text.length <= 50000, '节点文本过长。');
    for (const key of ['fontSize', 'radius', 'gap'] as const)
      if (node[key] !== undefined) requireValue(finite(node[key], 0, 10000), `节点 ${key} 无效。`);
    if (node.opacity !== undefined)
      requireValue(finite(node.opacity, 0, 1), '透明度必须介于 0 和 1。');
    if (node.layout !== undefined)
      requireValue(
        ['none', 'horizontal', 'vertical', 'wrap'].includes(node.layout),
        '布局模式无效。',
      );
    if (node.src !== undefined) {
      requireValue(
        typeof node.src === 'string' &&
          node.src.length < 15000000 &&
          /^(https?:\/\/|data:image\/(?:png|jpeg|webp|svg\+xml);base64,|\/api\/assets\/)/.test(
            node.src,
          ),
        '图片地址必须使用 http(s)、图片 data URL 或项目资源。',
      );
      if (node.src.startsWith('/api/assets/')) localAssetFilename(node.src);
      if (node.src.startsWith('data:image/svg+xml;base64,'))
        validateSafeSvg(Buffer.from(node.src.split(',')[1], 'base64').toString('utf8'));
    }
    if (node.tokenBindings !== undefined)
      requireValue(record(node.tokenBindings), 'token 绑定必须是对象。');
    if (node.tokenBindings)
      for (const [property, token] of Object.entries(node.tokenBindings)) {
        const compatible = ['fill', 'color', 'stroke'].includes(property)
          ? ['primary', 'background', 'surface', 'text', 'muted', 'border']
          : property === 'fontFamily'
            ? ['fontFamily']
            : ['radius', 'gap', 'fontSize', 'padding', 'paddingX', 'paddingY'].includes(property)
              ? ['radius', 'spacing']
              : [];
        requireValue(compatible.includes(token), 'token 绑定属性与值类型不匹配。');
      }
    validateOptionalNodeFields(node);
    if (node.type === 'component') requireValue(node.componentId, '组件实例缺少 componentId。');
    if (node.componentId)
      requireValue(
        components.some(
          /** 检查 component 的标识等于节点的组件引用，供集合筛选或定位使用。 @param component - 当前组件母版或组件规范。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (component) => component.id === node.componentId,
        ),
        `未找到组件 ${node.componentId}。`,
      );
  }
  const byId = new Map(
    nodes.map(
      /** 转换 validateNodes 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
      (node) => [node.id, node],
    ),
  );
  for (const node of nodes) {
    let parent = node.parentId;
    const visited = new Set([node.id]);
    while (parent) {
      requireValue(byId.has(parent), `节点 ${node.id} 的父节点不存在。`);
      requireValue(!visited.has(parent), '节点层级包含循环。');
      visited.add(parent);
      parent = byId.get(parent)!.parentId;
    }
  }
  return nodes;
}

/**
 * 检查完整项目的数据结构、引用和取值范围，作为保存与模型输出的共同边界。
 *
 * @param input - 当前步骤需要处理的输入。
 * @param arg2 - 按字段解构的输入，字段用途见对应类型定义。
 * @param arg2.historicalSnapshot - 用于兼容或恢复的历史设计快照。
 * @returns 通过校验的项目。
 */
export function validateProject(input: unknown, { historicalSnapshot = false } = {}): Project {
  requireValue(record(input), '无效的项目数据。');
  // Keep assertions local to the validator; callers supply unknown and receive the checked model.
  const project = input as unknown as Project;
  requireValue(project && typeof project === 'object', '无效的项目数据。');
  validateId(project.id);
  requireValue(
    typeof project.name === 'string' && project.name.trim() && project.name.length <= 200,
    '项目名称长度必须为 1–200。',
  );
  project.tokens = validateTokens(project.tokens);
  requireValue(
    Array.isArray(project.pages) && project.pages.length <= 100,
    '项目最多支持 100 个页面。',
  );
  requireValue(
    Array.isArray(project.components) && project.components.length <= 500,
    '项目最多支持 500 个组件。',
  );
  const ids = new Set();
  for (const entry of [...project.pages, ...project.components] as (DesignPage &
    Partial<DesignComponent>)[]) {
    requireValue(
      entry && typeof entry === 'object' && !Array.isArray(entry),
      '页面和组件必须是 JSON 对象。',
    );
    validateId(entry.id);
    requireValue(!ids.has(entry.id), '页面或组件 ID 重复。');
    ids.add(entry.id);
    requireValue(
      typeof entry.name === 'string' && entry.name.length <= 500,
      '页面或组件名称无效。',
    );
    requireValue(finite(entry.width, 1) && finite(entry.height, 1), '页面或组件尺寸无效。');
    if (entry.background !== undefined)
      requireValue(validColor(entry.background), '页面背景颜色无效。');
    if (entry.grid !== undefined) {
      const grid = entry.grid;
      requireValue(
        record(grid) && finite(grid.size, 1, 1000) && typeof grid.enabled === 'boolean',
        '布局网格参数无效。',
      );
      choices(grid.type, ['grid', 'columns'], '布局网格类型无效。');
      if (grid.columns !== undefined)
        requireValue(
          Number.isInteger(grid.columns) && finite(grid.columns, 1, 100),
          '网格列数无效。',
        );
      for (const key of ['gutter', 'margin'] as const)
        if (grid[key] !== undefined) requireValue(finite(grid[key], 0, 10000), '网格间距无效。');
    }
    if (entry.prototypeStart !== undefined)
      requireValue(typeof entry.prototypeStart === 'boolean', '原型起始页参数无效。');
    if (entry.setId !== undefined) validateId(entry.setId);
    if (entry.variantProperties !== undefined)
      requireValue(
        record(entry.variantProperties) &&
          Object.entries(entry.variantProperties).every(
            /**
             * 判断 validateProject 中的条目是否符合检查条件。
             *
             * @param options - 按顺序解构的当前条目。
             * @param options.key - 要访问或更新的字段名。
             * @param options.value - 当前字段、模式或控件的取值。
             * @returns 该条目是否符合条件。
             */
            ([key, value]) => text(key, 100) && text(value, 200),
          ),
        '组件变体参数无效。',
      );
    validateNodes(entry.nodes, project.components, entry.name);
  }
  const byId = new Map(
    project.components.map(
      /** 转换 validateProject 中的集合条目，供后续处理或展示。 @param component - 当前组件母版或组件规范。 @returns 当前条目转换后的结果。 */
      (component) => [component.id, component],
    ),
  );
  const complete = new Set();
  /**
   * 递归访问当前结构，处理子项并维护访问状态。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @param chain - 当前遍历经过的引用链，用于识别循环依赖。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  const visit = (id: string, chain: Set<string>): void => {
    if (complete.has(id)) return;
    requireValue(!chain.has(id), '组件引用包含循环。');
    const next = new Set(chain).add(id);
    for (const node of byId.get(id)!.nodes) if (node.componentId) visit(node.componentId, next);
    complete.add(id);
  };
  for (const component of project.components) visit(component.id, new Set());
  if (project.themeModes !== undefined) {
    requireValue(
      record(project.themeModes) && Object.keys(project.themeModes).length <= 50,
      '主题模式无效。',
    );
    for (const [name, tokens] of Object.entries(project.themeModes)) {
      requireValue(text(name, 100) && name.length > 0, '主题模式名称无效。');
      project.themeModes[name] = validateTokens(tokens);
    }
  }
  if (project.activeMode !== undefined)
    requireValue(
      text(project.activeMode, 100) &&
        (project.activeMode === 'default' ||
          (project.themeModes && Object.hasOwn(project.themeModes, project.activeMode))),
      '当前主题模式不存在。',
    );
  if (project.variableCollections !== undefined) {
    requireValue(
      Array.isArray(project.variableCollections) && project.variableCollections.length <= 100,
      '变量集合数量无效。',
    );
    uniqueIds(project.variableCollections, '变量集合');
    for (const collection of project.variableCollections) {
      requireValue(
        text(collection.name, 200) &&
          Array.isArray(collection.modes) &&
          collection.modes.length > 0 &&
          collection.modes.length <= 50 &&
          new Set(collection.modes).size === collection.modes.length &&
          collection.modes.every(
            /** 判断 validateProject 中的条目是否符合检查条件。 @param mode - 当前使用的模式或操作方式。 @returns 该条目是否符合条件。 */
            (mode) => text(mode, 100) && mode.length > 0,
          ),
        '变量集合模式无效。',
      );
      requireValue(
        Array.isArray(collection.variables) && collection.variables.length <= 2000,
        '变量数量无效。',
      );
      uniqueIds(collection.variables, '变量');
      for (const variable of collection.variables) {
        requireValue(
          text(variable.name, 200) &&
            ['color', 'number', 'string', 'boolean'].includes(variable.type) &&
            record(variable.values),
          '变量参数无效。',
        );
        for (const [mode, value] of Object.entries(variable.values)) {
          requireValue(collection.modes.includes(mode), '变量值引用了不存在的模式。');
          requireValue(
            variable.type === 'color'
              ? validColor(value)
              : variable.type === 'number'
                ? finite(value)
                : variable.type === 'boolean'
                  ? typeof value === 'boolean'
                  : text(value, 10000),
            '变量值类型无效。',
          );
        }
      }
    }
  }
  if (project.activeVariableModes !== undefined) {
    requireValue(record(project.activeVariableModes), '当前变量模式无效。');
    for (const [id, mode] of Object.entries(project.activeVariableModes))
      requireValue(
        project.variableCollections?.some(
          /** 检查 collection 的标识等于标识且 collection 的modes包含模式，供集合筛选或定位使用。 @param collection - 当前处理的设计变量集合。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (collection) => collection.id === id && collection.modes.includes(mode),
        ),
        '当前变量集合模式不存在。',
      );
  }
  for (const surface of [...project.pages, ...project.components])
    for (const node of surface.nodes)
      if (node.variableBindings !== undefined) {
        requireValue(record(node.variableBindings), '变量绑定必须是对象。');
        for (const [property, binding] of Object.entries(node.variableBindings)) {
          requireValue(record(binding), '变量绑定参数无效。');
          const collection = project.variableCollections?.find(
            /** 检查条目的标识等于 binding 的collectionId，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
            (item) => item.id === binding.collectionId,
          );
          const variable = collection?.variables.find(
            /** 检查条目的标识等于 binding 的variableId，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
            (item) => item.id === binding.variableId,
          );
          const expected = ['fill', 'color', 'stroke'].includes(property)
            ? 'color'
            : ['text', 'name'].includes(property)
              ? 'string'
              : ['visible', 'locked'].includes(property)
                ? 'boolean'
                : [
                      'x',
                      'y',
                      'width',
                      'height',
                      'radius',
                      'gap',
                      'fontSize',
                      'fontWeight',
                      'opacity',
                      'rotation',
                      'strokeWidth',
                      'blur',
                      'padding',
                      'paddingX',
                      'paddingY',
                      'letterSpacing',
                      'lineHeight',
                    ].includes(property)
                  ? 'number'
                  : undefined;
          if (historicalSnapshot && !variable) {
            requireValue(
              expected && text(binding.collectionId, 100) && text(binding.variableId, 100),
              '快照变量绑定参数无效。',
            );
            continue;
          }
          requireValue(
            variable && expected && variable.type === expected,
            '变量绑定引用不存在或属性类型不匹配。',
          );
          for (const value of Object.values(variable.values)) {
            if (property === 'opacity')
              requireValue(finite(value, 0, 1), '透明度变量必须介于 0 和 1。');
            if (
              [
                'width',
                'height',
                'radius',
                'gap',
                'fontSize',
                'strokeWidth',
                'blur',
                'padding',
                'paddingX',
                'paddingY',
              ].includes(property)
            )
              requireValue(finite(value, 0), '尺寸变量不能为负数。');
          }
        }
      }
  if (project.comments !== undefined) {
    requireValue(
      Array.isArray(project.comments) && project.comments.length <= 5000,
      '评论数量无效。',
    );
    uniqueIds(project.comments, '评论');
    for (const comment of project.comments) {
      validateId(comment.pageId);
      requireValue(
        finite(comment.x) &&
          finite(comment.y) &&
          text(comment.text, 20000) &&
          text(comment.author, 200) &&
          text(comment.createdAt, 100) &&
          Number.isFinite(Date.parse(comment.createdAt)),
        '评论参数无效。',
      );
      if (comment.resolved !== undefined)
        requireValue(typeof comment.resolved === 'boolean', '评论解决状态无效。');
    }
  }
  if (project.snapshots !== undefined) {
    requireValue(
      Array.isArray(project.snapshots) && project.snapshots.length <= 100,
      '版本快照数量无效。',
    );
    uniqueIds(project.snapshots, '版本快照');
    for (const snapshot of project.snapshots) {
      requireValue(
        text(snapshot.name, 200) &&
          text(snapshot.createdAt, 100) &&
          Number.isFinite(Date.parse(snapshot.createdAt)),
        '版本快照参数无效。',
      );
      validateProject(
        {
          id: snapshot.id,
          name: snapshot.name || 'Snapshot',
          tokens: snapshot.tokens,
          pages: snapshot.pages,
          components: snapshot.components,
          themeModes: snapshot.themeModes,
          activeMode: snapshot.activeMode,
          variableCollections: snapshot.variableCollections,
          activeVariableModes: snapshot.activeVariableModes,
        },
        { historicalSnapshot: true },
      );
    }
  }
  return project;
}

/**
 * 要求参考图仍对应当前设计且已由用户确认，才允许进入还原流程。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 无返回值；图片未确认或已过期时抛出错误。
 */
export function requireApproved(project: Project): asserts project is Project & {
  /** 当前项目的参考图生成及确认记录。 */
  generation: GenerationState & {
    /** 生成图片的访问地址。 */
    imageUrl: string;
  };
} {
  requireValue(
    project.generation?.approved && project.generation?.imageUrl,
    '请先生成设计图并确认通过，再还原可编辑设计。',
    409,
  );
  requireCurrentImage(project);
}

/**
 * 比较图片生成时的上下文摘要与当前设计，阻止使用过期参考图。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 无返回值；参考图缺失或过期时抛出错误。
 */
export function requireCurrentImage(project: Project): asserts project is Project & {
  /** 当前项目的参考图生成及确认记录。 */
  generation: GenerationState;
} {
  requireValue(
    project.generation?.contextHash === designContextHash(project),
    '项目主题、组件或页面规格已变更，请重新生成设计图后确认。',
    409,
  );
}
