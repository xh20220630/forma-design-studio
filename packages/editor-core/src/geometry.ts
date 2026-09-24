import type { DesignNode, ThemeTokens } from '@forma/schema';

/**
 * 为新节点生成独立标识，避免复制或新增时与现有节点冲突。
 * @returns 随机 UUID。
 */
export const uid = (): string => crypto.randomUUID();
export const containers = new Set(['frame', 'group', 'section']);
/**
 * 沿父子关系收集完整子树，保证移动、删除和复制包含所有后代。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param initial - 初始值。
 * @returns 包含初始节点及所有后代的去重 ID 列表。
 */
export const descendants = (nodes: DesignNode[], initial: string[]) => {
  const ids = new Set(initial);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes)
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
  }
  return [...ids];
};
/**
 * 剔除祖先已被选中的节点，防止同一子树被重复移动或缩放。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param ids - 参与当前操作的对象标识集合。
 * @returns 只保留选区根节点的 ID 列表。
 */
export const rootSelection = (nodes: DesignNode[], ids: string[]) =>
  ids.filter(
    /**
     * 判断 rootSelection 中的条目是否符合保留条件。
     *
     * @param id - 唯一标识，用于查找、更新和建立引用。
     * @returns 该条目是否符合条件。
     */
    (id) => {
      let node = nodes.find(
        /** 检查条目的标识是否与目标标识一致，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.id === id,
      );
      const visited = new Set<string>();
      while (node?.parentId && !visited.has(node.parentId)) {
        if (ids.includes(node.parentId)) return false;
        visited.add(node.parentId);
        node = nodes.find(
          /** 检查条目的标识等于节点的父节点标识，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (item) => item.id === node!.parentId,
        );
      }
      return true;
    },
  );
/**
 * 计算节点集合的轴对齐包围盒，供对齐、编组和视图定位共用。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @returns 包围盒；空集合返回零尺寸区域。
 */
export function boundsOf(nodes: DesignNode[]) {
  if (!nodes.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(
      ...nodes.map(
        /** 提取节点的横坐标，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的横坐标。 */
        (node) => node.x,
      ),
    ),
    y = Math.min(
      ...nodes.map(
        /** 提取节点的纵坐标，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的纵坐标。 */
        (node) => node.y,
      ),
    );
  return {
    x,
    y,
    width:
      Math.max(
        ...nodes.map(
          /** 提取节点的横坐标加上节点的宽度，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的横坐标加上节点的宽度。 */
          (node) => node.x + node.width,
        ),
      ) - x,
    height:
      Math.max(
        ...nodes.map(
          /** 提取节点的纵坐标加上节点的高度，供后续计算或展示使用。 @param node - 当前处理的设计节点。 @returns 节点的纵坐标加上节点的高度。 */
          (node) => node.y + node.height,
        ),
      ) - y,
  };
}
/**
 * 沿祖先链检查可见性，使隐藏父容器下的节点也保持隐藏。
 *
 * @param node - 当前处理的设计节点。
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @returns 节点及祖先是否都可见。
 */
export function visibleNode(node: DesignNode, nodes: DesignNode[]) {
  const visited = new Set<string>();
  let current: DesignNode | undefined = node;
  while (current && !visited.has(current.id)) {
    if (current.visible === false) return false;
    visited.add(current.id);
    current = nodes.find(
      /** 检查条目的标识等于当前值的父节点标识，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (item) => item.id === current!.parentId,
    );
  }
  return true;
}
/**
 * 同时平移目标节点及其后代，保持容器内部的相对位置。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param ids - 参与当前操作的对象标识集合。
 * @param dx - 水平方向的位移。
 * @param dy - 垂直方向的位移。
 * @returns 坐标已更新的节点数组。
 */
export function moveNodes(nodes: DesignNode[], ids: string[], dx: number, dy: number) {
  const all = new Set(descendants(nodes, ids));
  return nodes.map(
    /** 转换 moveNodes 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
    (node) =>
      all.has(node.id) ? { ...node, x: Math.round(node.x + dx), y: Math.round(node.y + dy) } : node,
  );
}
/**
 * 按两个坐标轴缩放 SVG 路径，并修正椭圆弧参数以保留几何形状。
 *
 * @param path - 文件路径或矢量路径内容，具体格式由所属对象约定。
 * @param sx - 水平方向的缩放倍率。
 * @param sy - 垂直方向的缩放倍率。
 * @returns 缩放后的路径；无法安全解析时保留原路径。
 */
export function scalePath(path: string, sx: number, sy: number): string {
  if ((sx === 1 && sy === 1) || !Number.isFinite(sx) || !Number.isFinite(sy)) return path;
  if (!/^[MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]+$/.test(path)) return path;
  const tokens =
    path.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  const output: string[] = [];
  let command = '',
    index = 0;
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    const upper = command.toUpperCase();
    if (upper === 'Z') {
      output.push(command);
      command = '';
      continue;
    }
    const count = arity[upper];
    if (!count || index + count > tokens.length) return path;
    const values = tokens.slice(index, index + count).map(Number);
    if (!values.every(Number.isFinite)) return path;
    index += count;
    if (upper === 'H') values[0] *= sx;
    else if (upper === 'V') values[0] *= sy;
    else if (upper === 'A') {
      const [rx, ry, degrees] = values,
        angle = (degrees * Math.PI) / 180;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      // Nonuniform scaling changes a rotated ellipse's principal axes.
      const a = sx * sx * (rx * rx * cos * cos + ry * ry * sin * sin);
      const b = sx * sy * cos * sin * (rx * rx - ry * ry);
      const d = sy * sy * (rx * rx * sin * sin + ry * ry * cos * cos);
      const delta = Math.hypot(a - d, 2 * b);
      values[0] = Math.sqrt(Math.max(0, (a + d + delta) / 2));
      values[1] = Math.sqrt(Math.max(0, (a + d - delta) / 2));
      values[2] = (Math.atan2(2 * b, a - d) * 90) / Math.PI;
      if (sx * sy < 0) values[4] = values[4] ? 0 : 1;
      values[5] *= sx;
      values[6] *= sy;
    } else
      for (let coordinate = 0; coordinate < values.length; coordinate++)
        values[coordinate] *= coordinate % 2 ? sy : sx;
    output.push(
      command,
      ...values.map(
        /** 转换 scalePath 中的集合条目，供后续处理或展示。 @param value - 当前字段、模式或控件的取值。 @returns 当前条目转换后的结果。 */
        (value) => String(Number(value.toFixed(8))),
      ),
    );
    if (upper === 'M') command = command === 'm' ? 'l' : 'L';
  }
  return output.join(' ');
}
/**
 * 更新节点尺寸并按约束调整后代，再衔接自动布局以保持层级一致。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @param patch - 仅包含本次要修改字段的局部更新。
 * @param layoutPrepared - 子布局是否已经测量，避免递归中重复计算。
 * @returns 完成尺寸和布局联动的节点数组。
 */
export function resizeNodes(
  nodes: DesignNode[],
  id: string,
  patch: Partial<DesignNode>,
  layoutPrepared = false,
) {
  const original = nodes.find(
    /** 检查节点的标识等于标识，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (node) => node.id === id,
  );
  if (!original) return nodes;
  const next = { ...original, ...patch };
  const sx = original.width ? next.width / original.width : 1,
    sy = original.height ? next.height / original.height : 1;
  if (sx !== 1 || sy !== 1) {
    if (original.points && patch.points === undefined)
      next.points = original.points.map(
        /** 转换 resizeNodes 中的集合条目，供后续处理或展示。 @param point - 当前处理的坐标点。 @returns 当前条目转换后的结果。 */
        (point) => ({ x: point.x * sx, y: point.y * sy }),
      );
    if (original.path && patch.path === undefined) next.path = scalePath(original.path, sx, sy);
  }
  let result = nodes.map(
    /** 转换 resizeNodes 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
    (node) => (node.id === id ? next : node),
  );
  const dx = next.x - original.x,
    dy = next.y - original.y;
  const dw = next.width - original.width,
    dh = next.height - original.height;
  for (const child of nodes.filter(
    /** 检查节点的父节点标识等于标识且 next 的layout不成立或 next 的layout等于“none”或节点的可见性等于假，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (node) =>
      node.parentId === id && (!next.layout || next.layout === 'none' || node.visible === false),
  )) {
    const c =
      child.constraints ??
      (original.type === 'group'
        ? { horizontal: 'scale', vertical: 'scale' }
        : { horizontal: 'left', vertical: 'top' });
    const relativeX = child.x - original.x,
      relativeY = child.y - original.y;
    let x = child.x + dx,
      y = child.y + dy,
      width = child.width,
      height = child.height;
    if (c.horizontal === 'right') x += dw;
    if (c.horizontal === 'center') x += dw / 2;
    if (c.horizontal === 'left-right') width = Math.max(1, width + dw);
    if (c.horizontal === 'scale') {
      x = next.x + relativeX * sx;
      width *= sx;
    }
    if (c.vertical === 'bottom') y += dh;
    if (c.vertical === 'center') y += dh / 2;
    if (c.vertical === 'top-bottom') height = Math.max(1, height + dh);
    if (c.vertical === 'scale') {
      y = next.y + relativeY * sy;
      height *= sy;
    }
    result = resizeNodes(result, child.id, { x, y, width, height }, layoutPrepared);
  }
  return layoutNodes(result, id, !layoutPrepared);
}
/**
 * 从指定容器开始重新计算自动布局，让属性修改及时反映到子节点位置。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param frameId - 目标自动布局容器的标识。
 * @returns 完成自动布局的节点数组。
 */
export function applyAutoLayout(nodes: DesignNode[], frameId: string): DesignNode[] {
  return layoutNodes(nodes, frameId, true);
}
/**
 * 先测量子容器，再分配主轴空间和交叉轴尺寸，避免嵌套布局重复计算。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param frameId - 目标自动布局容器的标识。
 * @param measureChildren - 是否先测量子容器尺寸。
 * @returns 重新排列并按需调整容器尺寸后的节点数组。
 */
function layoutNodes(nodes: DesignNode[], frameId: string, measureChildren: boolean): DesignNode[] {
  const frame = nodes.find(
    /** 检查节点的标识等于frameId，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (node) => node.id === frameId,
  );
  if (!frame?.layout || frame.layout === 'none') return nodes;
  let result = nodes;
  if (measureChildren)
    for (const child of nodes.filter(
      /** 检查节点的父节点标识等于 frame 的标识且节点的可见性不等于假且节点的layout且节点的layout不等于“none”，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (node) =>
        node.parentId === frame.id &&
        node.visible !== false &&
        node.layout &&
        node.layout !== 'none',
    ))
      result = layoutNodes(result, child.id, true);
  const children = result.filter(
    /** 检查节点的父节点标识等于 frame 的标识且节点的可见性不等于假，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (node) => node.parentId === frame.id && node.visible !== false,
  );
  const px = frame.paddingX ?? frame.padding ?? 16,
    py = frame.paddingY ?? frame.padding ?? 16,
    gap = frame.gap ?? 16;
  const horizontal = frame.layout !== 'vertical';
  const mainSize = horizontal ? 'width' : 'height',
    crossSize = horizontal ? 'height' : 'width';
  const mainSizing = horizontal ? 'sizingHorizontal' : 'sizingVertical',
    crossSizing = horizontal ? 'sizingVertical' : 'sizingHorizontal';
  const mainHug = frame[mainSizing] === 'hug',
    crossHug = frame[crossSizing] === 'hug';
  const available = Math.max(0, frame[mainSize] - (horizontal ? px : py) * 2);
  const lines: DesignNode[][] = [[]];
  let lineWidth = 0;
  for (const child of children) {
    const line = lines[lines.length - 1];
    if (
      frame.layout === 'wrap' &&
      !mainHug &&
      line.length &&
      lineWidth + gap + child.width > available
    ) {
      lines.push([child]);
      lineWidth = child.width;
    } else {
      line.push(child);
      lineWidth += child[mainSize] + (line.length > 1 ? gap : 0);
    }
  }
  let rowY = 0;
  for (const line of lines) {
    const fillChildren = mainHug
      ? []
      : line.filter(
          /** 检查child中指定项等于“fill”，供集合筛选或定位使用。 @param child - 当前处理的子节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (child) => child[mainSizing] === 'fill',
        );
    const fixed = line.reduce(
      /** 累积 layoutNodes 中的条目结果，供后续计算使用。 @param sum - 累加到当前项之前的结果。 @param child - 当前处理的子节点。 @returns 纳入当前条目后的累计结果。 */
      (sum, child) => sum + (fillChildren.includes(child) ? 0 : child[mainSize]),
      0,
    );
    const fillSize = fillChildren.length
      ? Math.max(1, (available - fixed - gap * Math.max(0, line.length - 1)) / fillChildren.length)
      : 0;
    const occupied = fixed + fillSize * fillChildren.length;
    const target = mainHug ? occupied + gap * Math.max(0, line.length - 1) : available;
    const distributedGap =
      frame.justifyContent === 'space-between' && line.length > 1
        ? Math.max(gap, (target - occupied) / (line.length - 1))
        : gap;
    const used = occupied + distributedGap * Math.max(0, line.length - 1);
    let cursor =
      frame.justifyContent === 'center'
        ? Math.max(0, (target - used) / 2)
        : frame.justifyContent === 'end'
          ? Math.max(0, target - used)
          : 0;
    const naturalCross = Math.max(
      0,
      ...line.map(
        /** 提取child中指定项，供后续计算或展示使用。 @param child - 当前处理的子节点。 @returns child中指定项。 */
        (child) => child[crossSize],
      ),
    );
    const crossAvailable =
      crossHug || frame.layout === 'wrap'
        ? naturalCross
        : Math.max(0, frame[crossSize] - (horizontal ? py : px) * 2);
    for (const child of line) {
      const main = fillChildren.includes(child) ? fillSize : child[mainSize];
      const cross =
        !crossHug && (frame.alignItems === 'stretch' || child[crossSizing] === 'fill')
          ? Math.max(1, crossAvailable)
          : child[crossSize];
      const crossOffset =
        frame.alignItems === 'center'
          ? Math.max(0, (crossAvailable - cross) / 2)
          : frame.alignItems === 'end'
            ? Math.max(0, crossAvailable - cross)
            : 0;
      const x = frame.x + px + (horizontal ? cursor : crossOffset);
      const y = frame.y + py + (horizontal ? rowY + crossOffset : cursor);
      result = resizeNodes(
        result,
        child.id,
        { x, y, width: horizontal ? main : cross, height: horizontal ? cross : main },
        true,
      );
      cursor += main + distributedGap;
    }
    rowY += crossAvailable + gap;
  }
  if (frame.sizingHorizontal === 'hug' || frame.sizingVertical === 'hug') {
    const bounds = boundsOf(
      result.filter(
        /** 检查节点的父节点标识等于 frame 的标识且节点的可见性不等于假，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (node) => node.parentId === frame.id && node.visible !== false,
      ),
    );
    result = result.map(
      /**
       * 转换 layoutNodes 中的集合条目，供后续处理或展示。
       *
       * @param node - 当前处理的设计节点。
       * @returns 当前条目转换后的结果。
       */
      (node) =>
        node.id === frame.id
          ? {
              ...node,
              width: frame.sizingHorizontal === 'hug' ? bounds.width + px * 2 : node.width,
              height: frame.sizingVertical === 'hug' ? bounds.height + py * 2 : node.height,
            }
          : node,
    );
  }
  return result;
}
/**
 * 复制完整子树并重建内部 ID 引用，确保副本可以独立编辑。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param ids - 参与当前操作的对象标识集合。
 * @param offset - 相对起点的偏移量。
 * @returns 复制的节点及新选区 ID。
 */
export function cloneNodes(nodes: DesignNode[], ids: string[], offset = 24) {
  const included = new Set(descendants(nodes, ids));
  const idMap = new Map(
    [...included].map(
      /** 转换 cloneNodes 中的集合条目，供后续处理或展示。 @param id - 唯一标识，用于查找、更新和建立引用。 @returns 当前条目转换后的结果。 */
      (id) => [id, uid()],
    ),
  );
  return {
    nodes: nodes
      .filter(
        /** 检查included包含节点的标识，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (node) => included.has(node.id),
      )
      .map(
        /**
         * 转换 cloneNodes 中的集合条目，供后续处理或展示。
         *
         * @param node - 当前处理的设计节点。
         * @returns 当前条目转换后的结果。
         */
        (node) => ({
          ...structuredClone(node),
          id: idMap.get(node.id)!,
          x: node.x + offset,
          y: node.y + offset,
          name: `${node.name} 副本`,
          parentId: node.parentId ? (idMap.get(node.parentId) ?? node.parentId) : undefined,
        }),
      ),
    ids: ids
      .map(
        /** 提取从新旧标识映射读取标识，供后续计算或展示使用。 @param id - 唯一标识，用于查找、更新和建立引用。 @returns 从新旧标识映射读取标识。 */
        (id) => idMap.get(id)!,
      )
      .filter(Boolean),
  };
}
/**
 * 将节点属性和 Token 绑定转换为可复制的 CSS，保留主题变量关系。
 *
 * @param node - 当前处理的设计节点。
 * @param tokens - 设计主题或语义 Token 集合。
 * @returns 节点的 CSS 声明文本。
 */
export function nodeCss(node: DesignNode, tokens: ThemeTokens) {
  /**
   * 解析属性对应的值，为调用处提供统一取值规则。
   *
   * @param key - 要访问或更新的字段名。
   * @param fallback - 输入缺失或无效时采用的回退值。
   * @returns 计算得到的文本。
   */
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
