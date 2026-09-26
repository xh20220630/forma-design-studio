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
