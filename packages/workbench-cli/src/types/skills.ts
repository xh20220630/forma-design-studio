/**
 * 技能安装范围，集中定义允许的分支以保持调用方一致。
 * 取值：project（当前项目）、global（全局范围）。
 */
export type SkillScope = 'project' | 'global';

/** 技能安装位置、版本与完整性结果，用于决定复用、更新或报错。 */
export interface SkillInstallation {
  /** 当前数据或操作生效的范围。 */
  scope: SkillScope;
  /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
  path: string;
  /** 目标路径是否已有安装内容。 */
  installed: boolean;
  /** 安装是否带有有效 Forma 管理标记。 */
  managed: boolean;
  /** 规范或安装内容的版本标识。 */
  version?: string;
  /** 安装目录内容摘要，用于检测手动修改或损坏。 */
  checksum?: string;
  /** 版本和内容是否满足当前工具的使用条件。 */
  compatible: boolean;
}

/** Forma 管理的技能安装标记，避免覆盖用户手动维护的目录。 */
export interface ManagedMarker {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 规范或安装内容的版本标识。 */
  version: string;
  /** 写入管理标记的工具名称。 */
  installedBy: string;
  /** 安装目录内容摘要，用于检测手动修改或损坏。 */
  checksum: string;
}
