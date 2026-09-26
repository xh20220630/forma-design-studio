import type { ThemeTokens } from './theme.ts';
import type { DesignPage, DesignComponent } from './nodes.ts';
import type { VariableCollection } from './variables.ts';

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
