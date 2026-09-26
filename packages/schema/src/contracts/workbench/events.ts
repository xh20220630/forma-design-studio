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
