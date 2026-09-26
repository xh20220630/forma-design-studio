import type { ProjectMeta } from './project.ts';
import type { TokenCollection, DesignComponentSpec, DesignImpact } from './design-system.ts';
import type { WorkspaceFlow } from './flow.ts';

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
