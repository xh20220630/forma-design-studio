/**
 * 流程页面种类，集中定义允许的分支以保持调用方一致。
 * 取值：page（完整页面）、modal（模态弹窗）、drawer（抽屉）、state（页面状态）。
 */
export type PageKind = 'page' | 'modal' | 'drawer' | 'state';
/**
 * 设备平台，集中定义允许的分支以保持调用方一致。
 * 取值：desktop（桌面端）、mobile（移动端）。
 */
export type Platform = 'desktop' | 'mobile';

/** 文件工作空间的项目元信息和主题确认记录。 */
export interface ProjectMeta {
  /** 数据结构版本，用于兼容不同年代的文件格式。 */
  schemaVersion: 1 | 2;
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 项目主题及其规范路径和确认信息。 */
  theme: {
    /** 唯一标识，用于查找、更新和建立引用。 */
    id: string;
    /** 规范或安装内容的版本标识。 */
    version: string;
    /** 对象当前所处状态，决定后续可执行操作。取值：draft（草稿）、approved（已确认）。 */
    status: 'draft' | 'approved';
    /** 主题确认记录，说明当前视觉方向的认可情况。 */
    confirmation: string;
    /** 设计规范文档的相对路径。 */
    designPath: string;
    /** 主题 Token 文件的相对路径。 */
    tokensPath: string;
    /** 用于锚定视觉方向的参考图片路径。 */
    anchorImage?: string;
  };
}

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

/** 锁定的页面设计图片，同时记录展示尺寸和原始像素尺寸。 */
export interface ImageNode {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 用于区分数据形态或行为分支的类型。取值：image（图片）。 */
  type: 'image';
  /** 设计根目录内的图片素材相对路径。 */
  assetPath: string;
  /** 对象的宽度。 */
  width: number;
  /** 对象的高度。 */
  height: number;
  /** 原始图片的真实像素宽度。 */
  intrinsicWidth: number;
  /** 原始图片的真实像素高度。 */
  intrinsicHeight: number;
  /** 是否锁定编辑；锁定容器也会限制其子节点操作。 */
  locked: true;
}

/** 图片上的定位标注，将解释文字与具体设计位置关联。 */
export interface AnnotationNode {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户显示的简短标签。 */
  label: string;
  /** 需要展示或编辑的文字内容。 */
  text: string;
  /** 水平方向的位置。 */
  x: number;
  /** 垂直方向的位置。 */
  y: number;
  /** 标注标签的水平位置，与被标注位置分开保存。 */
  labelX: number;
  /** 标注标签的垂直位置，与被标注位置分开保存。 */
  labelY: number;
  /** 操作作用的目标。 */
  target?: string;
}

/** 流程画布中的页面、弹窗或状态节点，包含参考图、标注和组件引用。 */
export interface FlowPageNode {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 跨流程可定位的页面引用。 */
  pageRef: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 该页面或流程要完成的业务目标。 */
  goal: string;
  /** 用于决定展示或处理分支的类别。 */
  kind: PageKind;
  /** 页面面向的设备平台。 */
  platform: Platform;
  /** 父级对象或页面引用。 */
  parent?: string;
  /** 页面在流程画布中的位置与尺寸，或待执行动画帧的句柄。 */
  frame: {
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
    /** 对象的宽度。 */
    width: number;
    /** 对象的高度。 */
    height: number;
  };
  /** 图片数据、图片模型绑定或页面图片节点。 */
  image: ImageNode;
  /** 指向页面具体位置的说明标注。 */
  annotations: AnnotationNode[];
  /** 当前页面复用的组件版本及适配说明。 */
  componentUsage: ComponentReference[];
  /** 页面参考图的修订号。 */
  imageRevision: number;
  /** 页面或 Token 使用的主题版本，供影响分析比较。 */
  themeVersion: string;
  /** 生成该页面图片时使用的提示词文件路径。 */
  promptPath?: string;
}

/** 页面之间的跳转关系，记录触发条件及操作结果。 */
export interface FlowEdge {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 连接的起点或渐变起始颜色。 */
  from: string;
  /** 连接的终点或渐变结束颜色。 */
  to: string;
  /** 触发跳转或动作的交互条件。 */
  trigger: string;
  /** 允许执行跳转的业务条件。 */
  condition: string;
  /** 动作完成后应产生的业务结果。 */
  effect: string;
  /** 是否跨越当前流程跳转。 */
  crossFlow: boolean;
  /**
   * 跳转的业务意图，用于识别打开、退出或返回等动作。取值：open（打开目标）、navigate（跳转页面）、close（关闭）、cancel（取消）、success（成功后退出）、back（返回）。
   */
  intent?: 'open' | 'navigate' | 'close' | 'cancel' | 'success' | 'back';
}

/** 一条业务流程的页面集合、连接关系和默认浏览位置。 */
export interface WorkspaceFlow {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 该页面或流程要完成的业务目标。 */
  goal: string;
  /** 原始设计文件的相对路径。 */
  sourcePath: string;
  /** 流程简报的文件路径与正文。 */
  brief?: {
    /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
    path: string;
    /** 文件、消息或编辑文档的正文。 */
    content: string;
  };
  /** 进入该流程时首先展示的页面。 */
  entryPage: string;
  /** 该流程内需要共同遵守的设计一致性说明。 */
  consistencyNotes: string[];
  /** 共享流程的默认缩放与平移位置。 */
  defaultViewport?: {
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
    /** 缩放倍率，1 表示原始尺寸。 */
    zoom: number;
  };
  /** 按约定顺序保存的设计节点集合。 */
  nodes: FlowPageNode[];
  /** 页面之间的流程连接集合。 */
  edges: FlowEdge[];
}

/** 工作台读取的完整设计文档，聚合项目、设计系统和业务流程。 */
export interface WorkspaceDocument {
  /** 当前设计项目或工作空间项目元信息。 */
  project: ProjectMeta;
  /** 工作空间采用的 Token、组件规范和影响分析。 */
  designSystem: {
    /** 设计主题或语义 Token 集合。 */
    tokens: TokenCollection;
    /** 项目中的组件定义或规范集合。 */
    components: DesignComponentSpec[];
    /** 版本变化后需要复核的页面集合。 */
    impacts: DesignImpact[];
  };
  /** 工作空间包含的业务流程。 */
  flows: WorkspaceFlow[];
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
}

/** 仅属于当前机器的偏好与安装信息，不作为共享设计的一部分。 */
export interface WorkspaceLocalState {
  /** 数据结构版本，用于兼容不同年代的文件格式。 */
  schemaVersion: 1;
  /** 本机记录的技能安装信息。 */
  skills?: Record<string, unknown>;
  /** 各流程在本机最后使用的视口位置。 */
  viewports: Record<
    string,
    {
      /** 水平方向的位置。 */
      x: number;
      /** 垂直方向的位置。 */
      y: number;
      /** 缩放倍率，1 表示原始尺寸。 */
      zoom: number;
    }
  >;
}

/**
 * 校验问题等级，集中定义允许的分支以保持调用方一致。
 * 取值：error（阻断错误）、warning（提醒问题）。
 */
export type ValidationSeverity = 'error' | 'warning';

/** 一条可定位的校验问题，供界面和命令行使用相同诊断格式。 */
export interface ValidationIssue {
  /** 校验问题等级：error 阻止有效性成立，warning 提醒复核。 */
  severity: ValidationSeverity;
  /** 稳定的问题代码或异常代码，供调用方识别错误类别。 */
  code: string;
  /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
  path: string;
  /** 面向用户或调用方的说明消息。 */
  message: string;
}

/** 完整校验结果；保留全部问题以便一次修正多处数据。 */
export interface ValidationReport {
  /** 是否未发现阻断性的校验错误。 */
  valid: boolean;
  /** 完整的问题列表，包含警告和错误。 */
  issues: ValidationIssue[];
}

/** 工作空间支持的修改操作，集中定义允许的分支以保持调用方一致。 */
export type WorkspaceOperation =
  | {
      /** 用于区分数据形态或行为分支的类型。取值：set-component-spec（保存组件规范）。 */
      type: 'set-component-spec';
      /** 引用的组件母版标识。 */
      componentId: string;
      /** 规范或安装内容的版本标识。 */
      version: string;
      /** 文件、消息或编辑文档的正文。 */
      content: string;
      /** 编辑开始时的原文，用于检测提交前是否已发生变化。 */
      expectedContent: string;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：set-flow-brief（保存流程简报）。 */
      type: 'set-flow-brief';
      /** 目标流程的唯一标识。 */
      flowId: string;
      /** 文件、消息或编辑文档的正文。 */
      content: string;
      /** 编辑开始时的原文，用于检测提交前是否已发生变化。 */
      expectedContent: string;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：update-annotation（更新定位标注）。 */
      type: 'update-annotation';
      /** 目标流程的唯一标识。 */
      flowId: string;
      /** 目标页面的唯一标识。 */
      pageId: string;
      /** 待保存的定位标注。 */
      annotation: AnnotationNode;
      /** 编辑开始时的标注，用于防止覆盖别人的新修改。 */
      expectedAnnotation: AnnotationNode;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：set-node-position（移动流程页面）。 */
      type: 'set-node-position';
      /** 目标流程的唯一标识。 */
      flowId: string;
      /** 目标页面的唯一标识。 */
      pageId: string;
      /** 水平方向的位置。 */
      x: number;
      /** 垂直方向的位置。 */
      y: number;
    }
  | {
      /** 用于区分数据形态或行为分支的类型。取值：set-default-viewport（保存共享默认视口）。 */
      type: 'set-default-viewport';
      /** 目标流程的唯一标识。 */
      flowId: string;
      /** 水平方向的位置。 */
      x: number;
      /** 垂直方向的位置。 */
      y: number;
      /** 缩放倍率，1 表示原始尺寸。 */
      zoom: number;
    };

/** 基于某个修订版本提交的一批操作，服务端可据此检测并发冲突。 */
export interface WorkspaceChangeSet {
  /** 本次变更基于的修订号，提交时必须仍与当前文档一致。 */
  baseRevision: number;
  /** 按顺序应用的一组工作空间操作。 */
  operations: WorkspaceOperation[];
}

/** 变更提交后的修订号、最新文档及受影响文件。 */
export interface ApplyResult {
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
  /** 解析后的完整工作空间文档。 */
  document: WorkspaceDocument;
  /** 本次提交实际涉及的文件路径。 */
  changedFiles: string[];
}

/** 设计修订变动通知，提示订阅者重新读取最新文档。 */
export interface WorkspaceEvent {
  /** 用于区分数据形态或行为分支的类型。取值：revision。 */
  type: 'revision';
  /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
  revision: number;
}

/** 统一资源释放约定，使监听方能主动结束订阅。 */
export interface Disposable {
  /**
   * 释放监听器、计时器或渲染缓存，防止对象停用后仍占用资源。
   * @returns 无返回值；清理完成后结束。
   */
  dispose(): Promise<void>;
}
