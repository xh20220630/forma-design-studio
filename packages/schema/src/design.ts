/** 项目的基础视觉主题；节点通过绑定引用这些值，切换主题时无需逐个改样式。 */
export interface ThemeTokens {
  /** 项目的主要强调色。 */
  primary: string;
  /** 背景颜色或背景类型。 */
  background: string;
  /** 卡片或面板的表面颜色。 */
  surface: string;
  /** 需要展示或编辑的文字内容。 */
  text: string;
  /** 次要文字或弱化表面使用的颜色。 */
  muted: string;
  /** 边框使用的颜色。 */
  border: string;
  /** 圆角大小。 */
  radius: number;
  /** 字体族名称，可包含回退字体。 */
  fontFamily: string;
  /** 布局间距的基准值或语义 Token 分组。 */
  spacing: number;
}
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
/** 附着在页面坐标上的协作评论，保存作者和解决状态。 */
export interface DesignComment {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 目标页面的唯一标识。 */
  pageId: string;
  /** 水平方向的位置。 */
  x: number;
  /** 垂直方向的位置。 */
  y: number;
  /** 需要展示或编辑的文字内容。 */
  text: string;
  /** 内容的作者或创建者。 */
  author: string;
  /** 创建时间，使用可序列化的时间字符串。 */
  createdAt: string;
  /** 已解析主题与变量的节点缓存，或评论的解决状态。 */
  resolved?: boolean;
}
/** 可恢复的设计快照，连同主题和变量一起保存以维持视觉一致性。 */
export interface DesignSnapshot {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 创建时间，使用可序列化的时间字符串。 */
  createdAt: string;
  /** 项目包含的设计页面。 */
  pages: DesignPage[];
  /** 项目中的组件定义或规范集合。 */
  components: DesignComponent[];
  /** 设计主题或语义 Token 集合。 */
  tokens: ThemeTokens;
  /** 按模式组织的设计变量集合。 */
  variableCollections?: VariableCollection[];
  /** 按模式名称索引的完整主题 Token。 */
  themeModes?: Record<string, ThemeTokens>;
  /** 当前生效的主题模式名称。 */
  activeMode?: string;
  /** 各变量集合当前使用的模式，键为集合 ID。 */
  activeVariableModes?: Record<string, string>;
}
/** 按模式存储值的设计变量，供节点绑定并随主题模式切换。 */
export interface DesignVariable {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 用于区分数据形态或行为分支的类型。取值：color（颜色）、number（数值）、string（文本）、boolean（布尔值）。 */
  type: 'color' | 'number' | 'string' | 'boolean';
  /** 各模式或选项对应的实际取值。 */
  values: Record<string, string | number | boolean>;
}
/** 共享同一组模式的变量集合，避免变量各自定义不一致的模式名称。 */
export interface VariableCollection {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 集合支持的模式名称。 */
  modes: string[];
  /** 当前集合中的变量定义。 */
  variables: DesignVariable[];
}
/** 项目与代码目录的关联信息，用于预览和应用设计代码同步。 */
export interface WorkspaceBinding {
  /** 用于决定展示或处理分支的类别。取值：local（本地目录）、github（GitHub 仓库）。 */
  kind: 'local' | 'github';
  /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
  path?: string;
  /** 关联的 GitHub 仓库地址。 */
  repo?: string;
  /** 使用的 Git 分支名称。 */
  branch?: string;
  /** 设计保存后是否尝试自动同步；首次同步仍需建立基线。 */
  autoSync?: boolean;
}
/** 参考图生成记录，保留确认状态和上下文摘要以识别过期图片。 */
export interface GenerationState {
  /** 发送给模型的生成要求。 */
  prompt: string;
  /** 生成图片的访问地址。 */
  imageUrl?: string;
  /** 对象的宽度。 */
  width?: number;
  /** 对象的高度。 */
  height?: number;
  /** 当前参考图是否已经过用户确认；设计上下文变化后会撤销。 */
  approved?: boolean;
  /** 生成结果的创建时间。 */
  generatedAt?: string;
  /** 生成时的设计上下文摘要，用于判断参考图是否仍有效。 */
  contextHash?: string;
}
/** 项目持久化的完整设计数据，也是保存、生成、导出和同步的共同输入。 */
export interface Project {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 用于解释内容或用途的说明文字。 */
  description: string;
  /** 用于展示分组和筛选的分类。 */
  category: string;
  /** 项目阶段；用于区分草稿、正在设计和已同步到代码的版本。取值：draft（草稿）、in-progress（设计进行中）、synced（已同步）。 */
  status: 'draft' | 'in-progress' | 'synced';
  /** 项目采用的主题标识。 */
  themeId: string;
  /** 设计主题或语义 Token 集合。 */
  tokens: ThemeTokens;
  /** 项目包含的设计页面。 */
  pages: DesignPage[];
  /** 项目中的组件定义或规范集合。 */
  components: DesignComponent[];
  /** 最近更新时间，用于排序和展示。 */
  updatedAt: string;
  /** 代码同步目标及同步偏好。 */
  workspace?: WorkspaceBinding;
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
  /** 最近成功同步到代码的设计修订号。 */
  lastSyncedRevision?: number;
  /** 项目卡片使用的封面类型。取值：dashboard（数据看板）、commerce（商城）、travel（旅行）、finance（金融）、blank（空白）。 */
  cover: 'dashboard' | 'commerce' | 'travel' | 'finance' | 'blank';
  /** 当前项目的参考图生成及确认记录。 */
  generation?: GenerationState;
  /** 页面上的定位评论集合。 */
  comments?: DesignComment[];
  /** 可供恢复的历史设计快照。 */
  snapshots?: DesignSnapshot[];
  /** 按模式组织的设计变量集合。 */
  variableCollections?: VariableCollection[];
  /** 按模式名称索引的完整主题 Token。 */
  themeModes?: Record<string, ThemeTokens>;
  /** 当前生效的主题模式名称。 */
  activeMode?: string;
  /** 各变量集合当前使用的模式，键为集合 ID。 */
  activeVariableModes?: Record<string, string>;
}
/** 可用于创建项目的模板摘要及基础主题。 */
export interface DesignTemplate {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 用于解释内容或用途的说明文字。 */
  description: string;
  /** 用于展示分组和筛选的分类。 */
  category: string;
  /** 内容的作者或创建者。 */
  author: string;
  /** 设计主题或语义 Token 集合。 */
  tokens: ThemeTokens;
  /** 项目卡片使用的封面类型。 */
  cover: Project['cover'];
  /** 是否作为精选模板展示。 */
  featured?: boolean;
}
/**
 * 文字模型协议，集中定义允许的分支以保持调用方一致。
 * 取值：openai（OpenAI 聊天协议）、openai-responses（OpenAI Responses 协议）、anthropic（Anthropic 消息协议）、gemini（Gemini 协议）、none（不启用）。
 */
export type TextProtocol = 'openai' | 'openai-responses' | 'anthropic' | 'gemini' | 'none';
/**
 * 图片模型协议，集中定义允许的分支以保持调用方一致。
 * 取值：openai-images（OpenAI 图片协议）、gemini（Gemini 协议）、imagen（Imagen 图片协议）、none（不启用）。
 */
export type ImageProtocol = 'openai-images' | 'gemini' | 'imagen' | 'none';
/**
 * 供应商认证方式，集中定义允许的分支以保持调用方一致。
 * 取值：auto（按协议选择）、bearer（Bearer 令牌）、api-key（API Key 请求头）、none（不启用）。
 */
export type ProviderAuth = 'auto' | 'bearer' | 'api-key' | 'none';
/** 把一种生成任务关联到指定供应商及其模型。 */
export interface ModelBinding {
  /** 模型绑定所属供应商的标识。 */
  providerId: string;
  /** 发送给上游的模型标识。 */
  model: string;
}
/** 客户端可见的模型连接配置；密钥仅以是否存在的标记表示。 */
export interface ModelProvider {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 供应商 API 的基础地址。 */
  baseUrl: string;
  /** 文字任务使用的请求与响应协议。 */
  textProtocol: TextProtocol;
  /** 图片任务使用的请求与响应协议。 */
  imageProtocol: ImageProtocol;
  /** 连接采用的认证方式。 */
  auth: ProviderAuth;
  /** 是否已保存密钥；不向浏览器暴露密钥内容。 */
  hasApiKey: boolean;
  /** 已配置的额外请求头名称，不包含对应私密值。 */
  headerNames: string[];
  /** 查询模型列表的接口路径。 */
  modelsPath: string;
  /** 文字生成接口路径，可按协议替换模型占位符。 */
  textPath: string;
  /** 图片生成接口路径。 */
  imagePath: string;
  /** 带参考图的图片编辑接口路径。 */
  imageEditPath?: string;
  /** 上游请求允许等待的时间，单位为毫秒。 */
  timeoutMs: number;
  /** 文字任务允许生成的最大 Token 数量。 */
  maxOutputTokens: number;
  /** 是否要求模型使用结构化 JSON 输出。 */
  jsonMode: boolean;
  /** 保存的图片尺寸配置；实际请求是否采用由传输层决定。 */
  imageSize: string;
}
/** 模型列表中的可选项，分开保存请求用 ID 与展示名称。 */
export interface ProviderModel {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
}
/** 公开的供应商列表及文字、图片任务的模型选择。 */
export interface ProviderSettings {
  /** 文字模型是否已经配置就绪。 */
  configured: boolean;
  /** 图片模型是否已经配置就绪。 */
  imageConfigured: boolean;
  /** 可供选择的供应商连接。 */
  providers: ModelProvider[];
  /** 需要展示或编辑的文字内容。 */
  text: ModelBinding;
  /** 图片数据、图片模型绑定或页面图片节点。 */
  image: ModelBinding;

  /** 供应商 API 的基础地址。 */
  baseUrl: string;
  /** 兼容旧客户端的当前文字模型摘要。 */
  textModel: string;
  /** 兼容旧客户端的当前图片模型摘要。 */
  imageModel: string;
}

/** 从参考图拆出的独立素材及其生成进度，支持失败后继续复用已完成结果。 */
export interface ReconstructionAsset {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 发送给模型的生成要求。 */
  prompt: string;
  /** 背景颜色或背景类型。取值：transparent（透明背景）、opaque（不透明背景）。 */
  background: 'transparent' | 'opaque';
  /** 素材在参考图中的归一化矩形，坐标与尺寸均在 0–1 范围内。 */
  bounds: {
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
    /** 对象的宽度。 */
    width: number;
    /** 对象的高度。 */
    height: number;
  };
  /** 对象当前所处状态，决定后续可执行操作。取值：pending（等待处理）、generating（正在生成）、completed（已完成）、failed（失败）。 */
  status: 'pending' | 'generating' | 'completed' | 'failed';
  /** 资源或服务的访问地址。 */
  url?: string;
  /** 对象的宽度。 */
  width?: number;
  /** 对象的高度。 */
  height?: number;
  /** 当前操作的失败信息，供界面反馈或重试判断。 */
  error?: string;
}
/** 参考图还原任务的公开进度，供界面轮询和错误恢复提示使用。 */
export interface ReconstructionStatus {
  /**
   * 任务当前阶段，供进度界面和恢复逻辑使用。取值：analyzing（分析参考图）、assets（生成独立素材）、assembling（组装可编辑页面）、completed（已完成）、failed（失败）。
   */
  phase: 'analyzing' | 'assets' | 'assembling' | 'completed' | 'failed';
  /** 本次还原对应的参考图地址。 */
  sourceImageUrl: string;
  /** 还原过程中需要独立生成的素材集合。 */
  assets: ReconstructionAsset[];
  /** 当前操作的失败信息，供界面反馈或重试判断。 */
  error?: string;
  /** 最近更新时间，用于排序和展示。 */
  updatedAt: string;
}
