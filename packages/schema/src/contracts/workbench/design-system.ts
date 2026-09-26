/** 带结构版本与主题版本的语义 Token 文档。 */
export interface TokenCollection {
  /** 数据结构版本，用于兼容不同年代的文件格式。 */
  schemaVersion: 1 | 2;
  /** 页面或 Token 使用的主题版本，供影响分析比较。 */
  themeVersion: string;
  /** 设计主题或语义 Token 集合。 */
  tokens: SemanticTokenGroups;
}

/** 按视觉用途组织的 Token 分组，供设计系统与页面规范复用。 */
export interface SemanticTokenGroups {
  /** 文字或视觉元素的颜色。 */
  color: Record<string, unknown>;
  /** 字体、字号、行高等排版 Token。 */
  typography: Record<string, unknown>;
  /** 布局间距的基准值或语义 Token 分组。 */
  spacing: Record<string, unknown>;
  /** 圆角大小。 */
  radius: Record<string, unknown>;
  /** 阴影偏移、模糊、扩展及颜色配置。 */
  shadow: Record<string, unknown>;
  /** 容器的排列方式，决定是否自动计算子节点位置。 */
  layout: Record<string, unknown>;
  /** 动画强度偏好或动效 Token 分组。 */
  motion: Record<string, unknown>;
}

/** 带版本和适用范围的组件规范，明确何时复用以及何时不适用。 */
export interface DesignComponentSpec {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 规范或安装内容的版本标识。 */
  version: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 对象当前所处状态，决定后续可执行操作。取值：draft（草稿）、approved（已确认）、deprecated（不再推荐使用）。 */
  status: 'draft' | 'approved' | 'deprecated';
  /** 当前数据或操作生效的范围。 */
  scope: string[];
  /** 不适用该组件的场景，防止过度复用。 */
  excludes: string[];
  /** 用于检索和分类的标签。 */
  tags: string[];
  /** 组件规范文档的相对路径。 */
  specPath: string;
  /** 组件规范的 Markdown 正文。 */
  specContent: string;
}

/** 页面采用的组件版本及本次适配说明。 */
export interface ComponentReference {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 规范或安装内容的版本标识。 */
  version: string;
  /** 本次复用组件时做出的适配说明。 */
  adaptation: string;
}

/** 说明主题或组件版本变化为什么影响某个页面。 */
export interface DesignImpactReason {
  /** 用于区分数据形态或行为分支的类型。取值：tokens（主题 Token）、component（组件实例）。 */
  type: 'tokens' | 'component';
  /** 造成影响的主题或组件标识。 */
  subject: string;
  /** 变更前采用的版本。 */
  fromVersion: string;
  /** 变更后可用或要求采用的版本。 */
  toVersion: string;
  /** 面向用户或调用方的说明消息。 */
  message: string;
}

/** 需要复核的页面及造成影响的具体原因。 */
export interface DesignImpact {
  /** 跨流程可定位的页面引用。 */
  pageRef: string;
  /** 该页面需要重新检查的原因集合。 */
  reasons: DesignImpactReason[];
}
