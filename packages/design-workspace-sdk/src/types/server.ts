/** 本地工作台 HTTP 服务的生命周期接口。 */
export interface WorkbenchServer {
  /** 资源或服务的访问地址。 */
  url: string;
  /** 服务监听端口；0 通常表示由系统分配可用端口。 */
  port: number;
  /** 关闭当前界面或服务，结束其生命周期。 */
  close(): Promise<void>;
}
