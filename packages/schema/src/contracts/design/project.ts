import type { ThemeTokens } from './theme.ts';
import type { DesignPage, DesignComponent } from './nodes.ts';
import type { DesignComment, DesignSnapshot } from './collaboration.ts';
import type { VariableCollection } from './variables.ts';

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
