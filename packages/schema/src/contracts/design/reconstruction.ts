/** 从参考图拆出的独立素材及其生成进度，支持失败后继续复用已完成结果。 */
export interface ReconstructionAsset {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 发送给模型的生成要求。 */
  prompt: string;
  /** 背景颜色或背景类型。取值：transparent（透明背景）、opaque（不透明背景）。 */
  background: 'transparent' | 'opaque';
  /** 素材在参考图中的归一化矩形，坐标与尺寸均在 0–1 范围内。 */
  bounds: {
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
    /** 对象的宽度。 */
    width: number;
    /** 对象的高度。 */
    height: number;
  };
  /** 对象当前所处状态，决定后续可执行操作。取值：pending（等待处理）、generating（正在生成）、completed（已完成）、failed（失败）。 */
  status: 'pending' | 'generating' | 'completed' | 'failed';
  /** 资源或服务的访问地址。 */
  url?: string;
  /** 对象的宽度。 */
  width?: number;
  /** 对象的高度。 */
  height?: number;
  /** 当前操作的失败信息，供界面反馈或重试判断。 */
  error?: string;
}

/** 参考图还原任务的公开进度，供界面轮询和错误恢复提示使用。 */
export interface ReconstructionStatus {
  /**
   * 任务当前阶段，供进度界面和恢复逻辑使用。取值：analyzing（分析参考图）、assets（生成独立素材）、assembling（组装可编辑页面）、completed（已完成）、failed（失败）。
   */
  phase: 'analyzing' | 'assets' | 'assembling' | 'completed' | 'failed';
  /** 本次还原对应的参考图地址。 */
  sourceImageUrl: string;
  /** 还原过程中需要独立生成的素材集合。 */
  assets: ReconstructionAsset[];
  /** 当前操作的失败信息，供界面反馈或重试判断。 */
  error?: string;
  /** 最近更新时间，用于排序和展示。 */
  updatedAt: string;
}
