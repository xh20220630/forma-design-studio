/**
 * 为新节点生成独立标识，避免复制或新增时与现有节点冲突。
 * @returns 随机 UUID。
 */
export const uid = (): string => crypto.randomUUID();
