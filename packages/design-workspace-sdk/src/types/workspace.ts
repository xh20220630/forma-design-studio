import type {
  ApplyResult,
  Disposable,
  ValidationReport,
  WorkspaceChangeSet,
  WorkspaceDocument,
  WorkspaceEvent,
  WorkspaceLocalState,
} from '@forma/schema/workbench';

/** 设计文件工作空间的统一访问接口，让 CLI 和服务共用读取、校验与提交规则。 */
export interface DesignWorkspace {
  /** 读取并校验工作空间，向调用方提供可用于界面展示的设计文档。 */
  read(): Promise<WorkspaceDocument>;
  /** 汇总设计文件的结构和引用问题，供命令行或界面展示诊断。 */
  validate(): Promise<ValidationReport>;
  /** 校验基线版本和操作内容后应用变更，阻止过期编辑覆盖当前文档。 */
  apply(changeSet: WorkspaceChangeSet): Promise<ApplyResult>;
  /** 监听设计修订变化并通知订阅者，让界面及时读取最新数据。 */
  watch(listener: (event: WorkspaceEvent) => void): Promise<Disposable>;
  /** 解析工作空间中的素材路径，使服务层无需直接拼接文件系统路径。 */
  resolveAsset(relativePath: string): Promise<string>;
  /** 读取本机视口与安装信息，缺失时提供可用的初始状态。 */
  readLocalState(): Promise<WorkspaceLocalState>;
  /** 保存当前流程的本地视口，恢复浏览时使用同一缩放和位置。 */
  setLocalViewport(
    flowId: string,
    viewport: {
      x: number;
      y: number;
      /** 缩放倍率，1 表示原始尺寸。 */
      zoom: number;
    },
  ): Promise<WorkspaceLocalState>;
}
