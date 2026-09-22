export const rinMotionAssets = {
  loop: "/brand/rin/v4/motion/rin-pearl-loop.webm",
  poster: "/brand/rin/v4/motion/rin-pearl-poster.webp",
} as const;

export const rinMotionTiming = {
  press: 0.12,
  selection: 0.2,
  enter: 0.34,
  settle: 0.46,
} as const;

export const rinMotionEase = [0.16, 1, 0.3, 1] as const;

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
