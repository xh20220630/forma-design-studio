import type { ThemeTokens } from './theme.ts';

/**
 * 设计节点种类，集中定义允许的分支以保持调用方一致。
 * 取值：frame（画框）、text（文字）、rectangle（矩形）、button（按钮）、image（图片）、component（组件实例）、group（编组）、ellipse（椭圆）、line（线段）、polygon（多边形）、star（星形）、path（矢量路径）、section（分区）。
 */
export type NodeType =
  | 'frame'
  | 'text'
  | 'rectangle'
  | 'button'
  | 'image'
  | 'component'
  | 'group'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'star'
  | 'path'
  | 'section';

/** 可编辑图层的统一数据契约，供编辑器、API 校验与两种渲染入口共同使用。 */
export interface DesignNode {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 用于区分数据形态或行为分支的类型。 */
  type: NodeType;
  /** 相对所在页面或组件表面的水平坐标；即使有 parentId 也不是相对父节点的偏移。 */
  x: number;
  /** 相对所在页面或组件表面的垂直坐标；即使有 parentId 也不是相对父节点的偏移。 */
  y: number;
  /** 对象的宽度。 */
  width: number;
  /** 对象的高度。 */
  height: number;
  /** 图层填充颜色；未设置时由渲染规则决定。 */
  fill?: string;
  /** 文字或视觉元素的颜色。 */
  color?: string;
  /** 需要展示或编辑的文字内容。 */
  text?: string;
  /** 文字字号。 */
  fontSize?: number;
  /** 圆角大小。 */
  radius?: number;
  /** 不透明度，0 为完全透明，1 为完全不透明。 */
  opacity?: number;
  /** 父节点标识；未设置时表示根层级。 */
  parentId?: string;
  /** 引用的组件母版标识。 */
  componentId?: string;
  /** 节点属性到主题 Token 的绑定，主题变化时可统一更新样式。 */
  tokenBindings?: Record<string, keyof ThemeTokens>;
  /** 是否显示；节点缺省时按可见处理，还会受到祖先可见性的约束。 */
  visible?: boolean;
  /** 是否锁定编辑；锁定容器也会限制其子节点操作。 */
  locked?: boolean;
  /** 属性到变量集合及变量 ID 的绑定关系。 */
  variableBindings?: Record<
    string,
    {
      /** 变量所属集合的标识。 */
      collectionId: string;
      /** 目标设计变量的标识。 */
      variableId: string;
    }
  >;
  /** 容器的排列方式，决定是否自动计算子节点位置。取值：none（不启用）、horizontal（横向）、vertical（纵向）、wrap（换行排列）。 */
  layout?: 'none' | 'horizontal' | 'vertical' | 'wrap';
  /** 相邻子元素之间的间距。 */
  gap?: number;
  /** 图片资源地址。 */
  src?: string;
  /** 图片适配方式：cover 铺满并可能裁剪，contain 完整显示并可能留白。取值：cover、contain。 */
  imageFit?: 'cover' | 'contain';
  /** 围绕中心旋转的角度，单位为度。 */
  rotation?: number;
  /** 是否水平翻转。 */
  flipX?: boolean;
  /** 是否垂直翻转。 */
  flipY?: boolean;
  /** 图形描边颜色。 */
  stroke?: string;
  /** 描边宽度。 */
  strokeWidth?: number;
  /** 描边相对图形边界的位置。取值：inside（内侧）、center（居中）、outside（外侧）。 */
  strokeAlign?: 'inside' | 'center' | 'outside';
  /** 描边线型。取值：solid（实线）、dashed（虚线）、dotted（点线）。 */
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  /** 渐变填充配置，包含方向和起止颜色。 */
  gradient?: {
    /** 用于区分数据形态或行为分支的类型。取值：linear（线性渐变）、radial（径向渐变）。 */
    type: 'linear' | 'radial';
    /** 连接的起点或渐变起始颜色。 */
    from: string;
    /** 连接的终点或渐变结束颜色。 */
    to: string;
    /** 旋转或渐变方向的角度。 */
    angle: number;
  };
  /** 阴影偏移、模糊、扩展及颜色配置。 */
  shadow?: {
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
    /** 模糊半径。 */
    blur: number;
    /** 阴影向外扩展的距离。 */
    spread: number;
    /** 文字或视觉元素的颜色。 */
    color: string;
    /** 是否将阴影绘制在图形内部。 */
    inset?: boolean;
  };
  /** 模糊半径。 */
  blur?: number;
  /** 图层与背景的颜色混合方式。取值：normal（常规）、multiply（正片叠底）、screen（滤色）、overlay（叠加）、darken（变暗）、lighten（变亮）。 */
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';
  /** 字体族名称，可包含回退字体。 */
  fontFamily?: string;
  /** 字体粗细，通常使用 400 表示常规、700 表示加粗。 */
  fontWeight?: number;
  /** 字体是否使用斜体。取值：normal（常规）、italic（斜体）。 */
  fontStyle?: 'normal' | 'italic';
  /** 文字在行内的水平对齐方式。取值：left（左侧）、center（居中）、right（右侧）、justify（两端对齐）。 */
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  /** 文字在节点区域内的垂直对齐方式。取值：top（顶部）、center（居中）、bottom（底部）。 */
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** 行高设置，用于多行文字排版。 */
  lineHeight?: number;
  /** 文字字符之间的附加间距。 */
  letterSpacing?: number;
  /** 文字的下划线或删除线样式。取值：none（不启用）、underline（下划线）、line-through（删除线）。 */
  textDecoration?: 'none' | 'underline' | 'line-through';
  /** 正多边形的边数。 */
  polygonSides?: number;
  /** 星形内半径与外半径的比例，控制尖角深度。 */
  starRatio?: number;
  /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
  path?: string;
  /** 矢量形状的局部坐标点序列。 */
  points?: {
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
  }[];
  /** 路径是否闭合，决定首尾相连及填充行为。 */
  closed?: boolean;
  /** 四个方向共用的内边距。 */
  padding?: number;
  /** 水平方向内边距，用于覆盖共用内边距。 */
  paddingX?: number;
  /** 垂直方向内边距，用于覆盖共用内边距。 */
  paddingY?: number;
  /** 子元素在布局交叉轴上的对齐方式。取值：start（起始侧）、center（居中）、end（结束侧）、stretch（拉伸）。 */
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  /** 子元素在布局主轴上的对齐或分布方式。取值：start（起始侧）、center（居中）、end（结束侧）、space-between（均匀分布）。 */
  justifyContent?: 'start' | 'center' | 'end' | 'space-between';
  /** 宽度策略：fixed 固定、hug 随内容、fill 填满可用空间。取值：fixed（固定尺寸）、hug（适应内容）、fill（填满可用空间）。 */
  sizingHorizontal?: 'fixed' | 'hug' | 'fill';
  /** 高度策略：fixed 固定、hug 随内容、fill 填满可用空间。取值：fixed（固定尺寸）、hug（适应内容）、fill（填满可用空间）。 */
  sizingVertical?: 'fixed' | 'hug' | 'fill';
  /** 父容器尺寸改变时，子节点如何保持位置或缩放。 */
  constraints?: {
    /** 水平方向的约束或布局设置。取值：left（左侧）、right（右侧）、center（居中）、left-right（左右拉伸）、scale（按比例缩放）。 */
    horizontal: 'left' | 'right' | 'center' | 'left-right' | 'scale';
    /** 垂直方向的约束或布局设置。取值：top（顶部）、bottom（底部）、center（居中）、top-bottom（上下拉伸）、scale（按比例缩放）。 */
    vertical: 'top' | 'bottom' | 'center' | 'top-bottom' | 'scale';
  };
  /** 是否裁剪超出容器边界的子内容。 */
  clipContent?: boolean;
  /** 调整尺寸时是否保持宽高比。 */
  aspectRatioLocked?: boolean;
  /** 节点触发的原型动作、目标和过渡配置。 */
  prototype?: {
    /** 当前要执行的操作或操作结果分类。取值：navigate（跳转页面）、overlay（叠加）、back（返回）、url（打开外部链接）。 */
    action: 'navigate' | 'overlay' | 'back' | 'url';
    /** 操作作用的目标。 */
    target?: string;
    /** 原型切换采用的动画方式。取值：instant（立即切换）、dissolve（淡入淡出）、slide（滑动切换）。 */
    animation?: 'instant' | 'dissolve' | 'slide';
    /** 动画持续时间。 */
    duration?: number;
    /** 触发跳转或动作的交互条件。取值：click（点击触发）、hover（悬停触发）。 */
    trigger?: 'click' | 'hover';
  };
  /** 实例对子节点的覆盖值，让局部定制无需修改母版。 */
  overrides?: Record<
    string,
    {
      /** 需要展示或编辑的文字内容。 */
      text?: string;
      /** 图层填充颜色；未设置时由渲染规则决定。 */
      fill?: string;
      /** 是否显示；节点缺省时按可见处理，还会受到祖先可见性的约束。 */
      visible?: boolean;
    }
  >;
}

/** 一张设计画布及其图层、网格和原型入口设置。 */
export interface DesignPage {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 对象的宽度。 */
  width: number;
  /** 对象的高度。 */
  height: number;
  /** 按约定顺序保存的设计节点集合。 */
  nodes: DesignNode[];
  /** 背景颜色或背景类型。 */
  background?: string;
  /** 画布辅助网格设置。 */
  grid?: {
    /** 当前对象的尺寸或尺寸规格。 */
    size: number;
    /** 是否启用该项能力。 */
    enabled: boolean;
    /** 用于区分数据形态或行为分支的类型。取值：grid（均匀网格）、columns（分栏网格）。 */
    type?: 'grid' | 'columns';
    /** 布局网格的列数。 */
    columns?: number;
    /** 网格列之间的间距。 */
    gutter?: number;
    /** 网格与页面边缘的留白。 */
    margin?: number;
  };
  /** 是否作为原型预览的起始页面。 */
  prototypeStart?: boolean;
}

/** 可复用组件母版；实例通过 componentId 引用它，而不是重复存储整套图层。 */
export interface DesignComponent {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 用于解释内容或用途的说明文字。 */
  description: string;
  /** 用于展示分组和筛选的分类。 */
  category: string;
  /** 按约定顺序保存的设计节点集合。 */
  nodes: DesignNode[];
  /** 对象的宽度。 */
  width: number;
  /** 对象的高度。 */
  height: number;
  /** 组件所属变体集合的标识。 */
  setId?: string;
  /** 组件变体的属性名与取值，供实例切换与筛选使用。 */
  variantProperties?: Record<string, string>;
}
