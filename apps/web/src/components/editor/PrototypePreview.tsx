import { useState } from 'react';
import { ArrowLeft, Play, X } from 'lucide-react';
import { Button } from '@forma/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@forma/ui/dialog';
import { NodeView } from '@forma/renderer';
import type { DesignNode, Project } from '@forma/schema';

/**
 * 呈现原型交互预览，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.pageId - 目标页面的唯一标识。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export default function PrototypePreview({
  project,
  pageId,
  onClose,
}: {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /** 目标页面的唯一标识。 */
  pageId: string;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
}) {
  /** 界面状态：更新前的当前值。通过状态更新驱动界面刷新。 */
  const [current, setCurrent] = useState(
    project.pages.find(
      /** 检查页面的prototypeStart，供集合筛选或定位使用。 @param page - 当前正在展示或编辑的页面。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (page) => page.prototypeStart,
    )?.id ?? pageId,
  );
  /** 界面状态：可供撤销的项目快照栈。通过状态更新驱动界面刷新。 */
  const [history, setHistory] = useState<string[]>([]);
  /** 界面状态：本帧需要绘制的选择和辅助信息。通过状态更新驱动界面刷新。 */
  const [overlay, setOverlay] = useState<string>();
  /** 界面状态：页面跳转或动画过渡配置。通过状态更新驱动界面刷新。 */
  const [transition, setTransition] = useState({
    name: 'instant',
    duration: 0,
  });
  const page =
    project.pages.find(
      /** 检查条目的标识等于当前值，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (item) => item.id === current,
    ) ?? project.pages[0];
  const overlayPage = project.pages.find(
    /** 检查条目的标识等于overlay，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (item) => item.id === overlay,
  );
  const scale = Math.min(
    1,
    (window.innerWidth - 120) / page.width,
    (window.innerHeight - 160) / page.height,
  );
  /**
   * 按原型动作执行导航、覆盖层或外部链接，保持预览交互与设计一致。
   *
   * @param node - 当前处理的设计节点。
   * @returns 无返回值；更新原型预览状态。
   */
  const act = (node: DesignNode) => {
    const action = node.prototype;
    if (!action) return;
    setTransition({
      name: action.animation ?? 'instant',
      duration: action.duration ?? 300,
    });
    if (action.action === 'back') {
      if (overlay) setOverlay(undefined);
      else if (history.length) {
        setCurrent(history[history.length - 1]);
        setHistory(
          /** 基于最新状态计算 History 的下一份值，避免连续更新时读到旧状态。 @param items - 索引中的全部条目，供大范围查询回退遍历。 @returns 供 React 保存的新状态。 */
          (items) => items.slice(0, -1),
        );
      }
    } else if (action.action === 'url') {
      if (/^https?:\/\//i.test(action.target ?? ''))
        window.open(action.target, '_blank', 'noopener,noreferrer');
    } else if (
      project.pages.some(
        /** 检查条目的标识等于 action 的目标，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.id === action.target,
      )
    ) {
      if (action.action === 'overlay') setOverlay(action.target);
      else {
        setHistory(
          /** 基于最新状态计算 History 的下一份值，避免连续更新时读到旧状态。 @param items - 索引中的全部条目，供大范围查询回退遍历。 @returns 供 React 保存的新状态。 */
          (items) => [...items, current],
        );
        setCurrent(action.target!);
        setOverlay(undefined);
      }
    }
  };
  /**
   * 渲染指定原型页面，并接入节点交互处理。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @returns 原型页面的界面内容。
   */
  const scene = (id: string) => {
    const target = project.pages.find(
      /** 检查条目的标识是否与目标标识一致，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (item) => item.id === id,
    )!;
    return (
      <div
        className="ed-preview-artboard"
        style={{
          width: target.width,
          height: target.height,
          background: target.background ?? project.tokens.background,
        }}
      >
        {target.nodes.map(
          /**
           * 转换 scene 中的集合条目，供后续处理或展示。
           *
           * @param node - 当前处理的设计节点。
           * @returns 当前条目转换后的结果。
           */
          (node) => (
            <NodeView
              key={node.id}
              node={node}
              project={project}
              nodes={target.nodes}
              onClick={act}
            />
          ),
        )}
      </div>
    );
  };
  return (
    <Dialog
      open
      onOpenChange={
        /** 响应 onOpenChange 交互，将用户操作应用到原型交互预览。 @param open - 弹层或面板当前是否打开。 @returns 无返回值；通过副作用完成当前操作。 */
        (open) => !open && onClose()
      }
    >
      <DialogContent className="ed-preview-dialog" showCloseButton={false}>
        <header>
          <Button
            variant="ghost"
            size="icon"
            aria-label="返回原型上一页"
            disabled={!history.length && !overlay}
            onClick={
              /** 响应 onClick 交互，将用户操作应用到原型交互预览。 @returns 无返回值；通过副作用完成当前操作。 */
              () => act({ prototype: { action: 'back' } } as DesignNode)
            }
          >
            <ArrowLeft size={17} />
          </Button>
          <DialogTitle>
            <Play size={14} />
            <span className="ed-preview-project-name">{project.name}</span>
            <span className="ed-preview-title-divider">/</span>
            <span className="ed-preview-page-name">{page.name}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            预览项目的页面交互，按 Esc 返回编辑器。
          </DialogDescription>
          <Button
            variant="ghost"
            onClick={
              /**
               * 响应 onClick 交互，将用户操作应用到原型交互预览。
               * @returns 无返回值；通过副作用完成当前操作。
               */
              () => {
                setCurrent(
                  project.pages.find(
                    /** 检查当前项的prototypeStart，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                    (p) => p.prototypeStart,
                  )?.id ?? pageId,
                );
                setHistory([]);
                setOverlay(undefined);
              }
            }
          >
            重新开始
          </Button>
          <Button variant="ghost" size="icon" aria-label="关闭预览" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>
        <main>
          <div
            className="ed-preview-scaled"
            style={{ width: page.width * scale, height: page.height * scale }}
          >
            <div
              key={page.id}
              className={`ed-preview-transition ${transition.name}`}
              style={{
                transform: `scale(${scale})`,
                animationDuration: `${transition.duration}ms`,
              }}
            >
              {scene(page.id)}
            </div>
          </div>
          {overlayPage && (
            <div
              className="ed-preview-overlay"
              onClick={
                /** 响应 onClick 交互，将用户操作应用到原型交互预览。 @returns 当前步骤的处理结果。 */
                () => setOverlay(undefined)
              }
            >
              <div
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到原型交互预览。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                  (event) => event.stopPropagation()
                }
                style={{
                  width: overlayPage.width * scale,
                  height: overlayPage.height * scale,
                }}
              >
                <div
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {scene(overlayPage.id)}
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="ed-overlay-close"
                  title="关闭浮层"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到原型交互预览。 @returns 当前步骤的处理结果。 */
                    () => setOverlay(undefined)
                  }
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
          )}
        </main>
        <footer>点击有交互的图层体验原型 · Esc 退出</footer>
      </DialogContent>
    </Dialog>
  );
}
