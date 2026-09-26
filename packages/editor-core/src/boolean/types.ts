/**
 * 图形布尔运算方式，集中定义允许的分支以保持调用方一致。
 * 取值：union（合并）、difference（从首个形状减去其他形状）、intersection（保留重叠区域）、xor（保留不重叠区域）。
 */
export type BooleanOperation = 'union' | 'difference' | 'intersection' | 'xor';
