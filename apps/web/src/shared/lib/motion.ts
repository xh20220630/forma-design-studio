import { useReducedMotion } from 'motion/react';
import { useStudioTheme } from '../theme/StudioTheme';

export const motionTiming = {
  feedback: 0.14,
  enter: 0.32,
  exit: 0.18,
  settle: 0.48,
} as const;
export const motionEase = [0.22, 1, 0.36, 1] as const;

/**
 * 按动效级别生成入场参数，集中管理页面过渡节奏。
 *
 * @param reduced - 是否采用减少动态效果的表现。
 * @returns 入场动效配置。
 */
export function enterMotion(reduced = false) {
  return {
    initial: reduced ? (false as const) : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduced ? 0 : motionTiming.enter,
      ease: motionEase,
    },
  };
}
/**
 * 结合主题偏好和减少动态效果设置，统一决定组件是否播放动画。
 * @returns 当前动效配置与相关状态。
 */
export function useStudioMotion() {
  const { settings } = useStudioTheme();
  const systemReduced = useReducedMotion();
  const reduced = settings.motion === 'off' || Boolean(systemReduced);
  return {
    reduced,
    expressive: !reduced && settings.motion === 'expressive',
    transition: {
      duration: reduced ? 0 : settings.motion === 'gentle' ? 0.18 : 0.32,
      ease: motionEase,
    },
  };
}
