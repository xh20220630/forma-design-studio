/** 携带 HTTP 状态码的业务错误，供路由统一转换为响应。 */
export class ApiError extends Error {
  /** 返回给客户端的 HTTP 状态码。 */
  readonly status: number;

  /**
   * 建立 ApiError 实例并保存其依赖，让后续操作共用同一份资源或状态。
   *
   * @param status - 应返回的 HTTP 状态码。
   * @param message - 面向用户或调用方的说明消息。
   * @returns 构造完成的实例；构造函数不显式返回业务数据。
   */
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * 将前置条件失败统一转换为 API 错误，避免后续代码继续使用无效输入。
 *
 * @param condition - 必须为真的前置条件；为假时抛出业务错误。
 * @param message - 面向用户或调用方的说明消息。
 * @param status - 应返回的 HTTP 状态码。
 * @returns 无返回值；条件为假时抛出 ApiError。
 */
export function requireValue(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new ApiError(status, message);
}

/**
 * 确认输入是非空且非数组的对象，之后才能安全读取模型或请求字段。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @returns 是否可以按字符串键读取属性。
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 在未知异常对象上安全读取指定字段，兼容非 Error 类型的异常。
 *
 * @param error - 当前操作的失败信息，供界面反馈或重试判断。
 * @param key - 要访问或更新的字段名。
 * @returns 对应的异常属性。
 */
export function errorProperty(error: unknown, key: string): unknown {
  return isRecord(error) ? error[key] : undefined;
}

/**
 * 统一提取异常文本，供 API 响应和界面提示使用。
 *
 * @param error - 当前操作的失败信息，供界面反馈或重试判断。
 * @returns 可展示的错误消息。
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 读取异常附带的 HTTP 状态码，把没有状态码的情况留给路由决定如何处理。
 *
 * @param error - 当前操作的失败信息，供界面反馈或重试判断。
 * @returns 数字状态码；未提供有效数字时返回 undefined。
 */
export function errorStatus(error: unknown): number | undefined {
  /** 集中维护 status 的约定值或当前状态，供相关分支保持一致。 */
  const status = errorProperty(error, 'status');
  return typeof status === 'number' ? status : undefined;
}
