export const rinMotionAssets = {
  loop: '/brand/rin/v4/motion/rin-pearl-loop.webm',
  poster: '/brand/rin/v4/motion/rin-pearl-poster.webp',
} as const;

export const rinMotionTiming = {
  press: 0.12,
  selection: 0.2,
  enter: 0.34,
  settle: 0.46,
} as const;

export const rinMotionEase = [0.16, 1, 0.3, 1] as const;

/**
 * 为 Rin 品牌元素生成入场参数，使品牌动效遵守全局运动偏好。
 *
 * @param reduced - 是否采用减少动态效果的表现。
 * @param delay - 开始动画前的等待时间。
 * @returns 品牌元素的入场动画配置。
 */
export function rinEnterMotion(reduced = false, delay = 0) {
  return {
    initial: reduced ? (false as const) : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: reduced ? undefined : { opacity: 0, y: -4 },
    transition: {
      duration: reduced ? 0 : rinMotionTiming.enter,
      delay: reduced ? 0 : Math.min(delay, 0.2),
      ease: rinMotionEase,
    },
  };
}
