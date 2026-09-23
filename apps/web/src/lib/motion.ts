import { useReducedMotion } from "motion/react";
import { useStudioTheme } from "../theme/StudioTheme";

export const motionTiming = {
  feedback: 0.14,
  enter: 0.32,
  exit: 0.18,
  settle: 0.48,
} as const;
export const motionEase = [0.22, 1, 0.36, 1] as const;

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
export function useStudioMotion() {
  const { settings } = useStudioTheme();
  const systemReduced = useReducedMotion();
  const reduced = settings.motion === "off" || Boolean(systemReduced);
  return {
    reduced,
    expressive: !reduced && settings.motion === "expressive",
    transition: {
      duration: reduced ? 0 : settings.motion === "gentle" ? 0.18 : 0.32,
      ease: motionEase,
    },
  };
}
