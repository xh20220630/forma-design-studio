import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
/**
 * 合并条件类名并消解 Tailwind 冲突，让调用方覆盖样式时结果可预测。
 *
 * @param inputs - 当前递归层需要处理的节点集合。
 * @returns 合并后的 CSS 类名字符串。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
