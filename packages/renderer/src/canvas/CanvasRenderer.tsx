import { memo, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import type { DesignNode, DesignPage, Project } from '@forma/schema';
import { CanvasEngine, type CanvasOverlay, type CanvasView } from './engine.ts';
import type { SceneEntry } from './scene.ts';
import type { Bounds, Point } from './geometry.ts';

/** 通过引用暴露的命中与区域查询接口，避免交互层直接依赖渲染器内部状态。 */
export interface CanvasRendererHandle {
  beginTranslation(ids: string[]): boolean;
  translate(x: number, y: number, guides: CanvasOverlay['guides']): void;
  endTranslation(): void;
  /**
   * 从上层节点向下检查局部路径和裁剪范围，找出指针实际命中的图层。
   *
   * @param point - 当前处理的坐标点。
   * @returns 命中的设计节点；没有命中时返回 undefined。
   */
  hitTest(point: Point): DesignNode | undefined;
  /**
   * 查询与指定区域相交的条目，缩小渲染或框选需要遍历的范围。
   *
   * @param bounds - 用于布局、查询或素材定位的矩形范围。
   * @returns 与区域相交的候选结果。
   */
  query(bounds: Bounds): string[];
  /**
   * 通过节点 ID 取得编译后的场景信息，供交互层读取变换和边界。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @returns 场景条目；找不到时返回 undefined。
   */
  entry(id: string): SceneEntry | undefined;
}
/** CanvasRenderer 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 暴露 DOM 或组件操作入口的引用。 */
  ref?: Ref<CanvasRendererHandle>;
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /** 当前正在展示或编辑的页面。 */
  page: DesignPage;
  /** 当前视图或画布相机参数。 */
  view: CanvasView;
  /** 随原生滚动移动，同时以未缩放的视口尺寸绘制。 */
  scrollOffset?: Point;
  /** 本帧需要绘制的选择和辅助信息。 */
  overlay: CanvasOverlay;
  /** 正在通过文本编辑框修改的节点 ID。 */
  editingText?: string;
}

export const CanvasRenderer = memo(function CanvasRenderer({
  ref,
  project,
  page,
  view,
  scrollOffset,
  overlay,
  editingText,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    gpuCanvas = useRef<HTMLCanvasElement>(null),
    overlayCanvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<CanvasEngine | null>(null);
  const scrollsWithContent = scrollOffset !== undefined;
  useImperativeHandle(
    ref,
    () => ({
      beginTranslation: (ids) => engine.current?.beginTranslation(ids) ?? false,
      translate: (x, y, guides) => engine.current?.translate(x, y, guides),
      endTranslation: () => engine.current?.endTranslation(),
      hitTest: (point) => engine.current?.hitTest(point),
      query: (bounds) => engine.current?.query(bounds) ?? [],
      entry: (id) => engine.current?.entry(id),
    }),
    [],
  );
  useLayoutEffect(() => {
    const renderer = new CanvasEngine(canvas.current!, overlayCanvas.current!, gpuCanvas.current!);
    engine.current = renderer;
    return () => {
      renderer.dispose();
      engine.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    engine.current?.setDocument(page, project, editingText);
  }, [page, project, editingText]);
  useLayoutEffect(() => {
    engine.current?.setOverlay(overlay);
  }, [overlay]);
  useLayoutEffect(() => {
    engine.current?.setView(view, scrollsWithContent);
  }, [view.width, view.height, view.zoom, view.x, view.y, scrollsWithContent]);
  // 随画板一起原生滚动，但不继承画板的 scale，保持文字清晰。
  const style = {
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
    left: scrollOffset?.x ?? 0,
    top: scrollOffset?.y ?? 0,
    width: view.width,
    height: view.height,
  };
  return (
    <>
      <canvas
        ref={canvas}
        className="ed-scene-canvas"
        style={style}
        aria-label="设计画布；使用图层面板或画布选择与编辑元素"
        role="img"
      />
      <canvas
        ref={gpuCanvas}
        className="ed-scene-canvas ed-gpu-canvas"
        style={style}
        aria-hidden="true"
      />
      <canvas ref={overlayCanvas} className="ed-overlay-canvas" style={style} aria-hidden="true" />
    </>
  );
});
