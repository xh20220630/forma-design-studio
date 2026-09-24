'use client';

import * as React from 'react';
import { cn } from 'cn';
import { Separator as SeparatorPrimitive } from 'radix-ui';

/**
 * 呈现分隔线，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.className - 调用方追加的 CSS 类名。
 * @param props.orientation - 控件采用的水平或垂直方向。
 * @param props.decorative - 是否仅作装饰，从辅助技术的语义中隐藏。
 * @returns 供 React 渲染的界面内容。
 */
function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
