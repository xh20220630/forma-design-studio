import type { ComponentReference } from './design-system.ts';

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
