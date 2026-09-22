import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "../components/ui/tooltip";
import { useStudioTheme } from "./StudioTheme";

export default function StudioRuntime({ children }: { children: ReactNode }) {
  const { settings } = useStudioTheme();
  return (
    <MotionConfig
      reducedMotion={settings.motion === "off" ? "always" : "user"}
      transition={{
        duration:
          settings.motion === "off"
            ? 0
            : settings.motion === "gentle"
              ? 0.18
              : 0.32,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </MotionConfig>
  );
}
