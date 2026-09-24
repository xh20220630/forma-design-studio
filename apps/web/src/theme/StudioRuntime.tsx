import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { TooltipProvider } from '@forma/ui/tooltip';
import { useStudioTheme } from './StudioTheme';

/**
 * 呈现工作室全局运行时，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.children - 由调用方放入组件的子内容。
 * @returns 供 React 渲染的界面内容。
 */
export default function StudioRuntime({
  children,
}: {
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
}) {
  const { settings } = useStudioTheme();
  return (
    <MotionConfig
      reducedMotion={settings.motion === 'off' ? 'always' : 'user'}
      transition={{
        duration: settings.motion === 'off' ? 0 : settings.motion === 'gentle' ? 0.18 : 0.32,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </MotionConfig>
  );
}
