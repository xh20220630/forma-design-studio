import {
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import type { DesignNode, DesignPage, Project } from '@forma/schema';
import { getProjectTokens } from './scene-values';
import { CanvasEngine, type CanvasOverlay, type CanvasView } from './canvas/engine';
import { SceneCompiler, type SceneEntry } from './canvas/scene';
import type { Bounds, Point } from './canvas/geometry';

/** 通过引用暴露的命中与区域查询接口，避免交互层直接依赖渲染器内部状态。 */
export interface CanvasRendererHandle {
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
  /** 本帧需要绘制的选择和辅助信息。 */
  overlay: CanvasOverlay;
  /** 正在通过文本编辑框修改的节点 ID。 */
  editingText?: string;
}

/** 界面状态：暴露给调用方的 Canvas 渲染组件引用。通过状态更新驱动界面刷新。 */
export const CanvasRenderer = memo(
  /**
   * 呈现Canvas 设计渲染器，将展示与交互入口放在同一个组件中维护。
   *
   * @param props - 按字段解构的输入，字段用途见对应类型定义。
   * @param props.ref - 暴露 DOM 或组件操作入口的引用。
   * @param props.project - 当前设计项目或工作空间项目元信息。
   * @param props.page - 当前正在展示或编辑的页面。
   * @param props.view - 当前视图或画布相机参数。
   * @param props.overlay - 本帧需要绘制的选择和辅助信息。
   * @param props.editingText - 正在通过文本编辑框修改的节点 ID。
   * @returns 供 React 渲染的界面内容。
   */
  function CanvasRenderer({ ref, project, page, view, overlay, editingText }: Props) {
    const canvas = useRef<HTMLCanvasElement>(null),
      overlayCanvas = useRef<HTMLCanvasElement>(null);
    const engine = useRef<CanvasEngine | null>(null);
    /** 界面状态：将设计节点转换为场景的编译器。通过状态更新驱动界面刷新。 */
    const [compiler] = useState(
      /** 在Canvas 设计渲染器首次挂载时建立初始状态，避免每次渲染重复初始化。 @returns 初始状态值。 */
      () => new SceneCompiler(),
    );
    const scene = useMemo(
      /** 计算Canvas 设计渲染器的派生数据，并在依赖未变化时复用结果。 @returns 当前步骤的处理结果。 */
      () => compiler.compile(page, project),
      [
        compiler,
        page.nodes,
        project.components,
        project.tokens,
        project.themeModes,
        project.activeMode,
        project.variableCollections,
        project.activeVariableModes,
      ],
    );
    const tokens = getProjectTokens(project);
    useImperativeHandle(
      ref,
      /**
       * 执行Canvas 设计渲染器传入的局部处理步骤，使调用处能够控制结果如何更新。
       * @returns 当前步骤的处理结果。
       */
      () => ({
        /**
         * 从上层节点向下检查局部路径和裁剪范围，找出指针实际命中的图层。
         *
         * @param point - 当前处理的坐标点。
         * @returns 命中的设计节点；没有命中时返回 undefined。
         */
        hitTest: (point) => engine.current?.hitTest(point),
        /**
         * 查询与指定区域相交的条目，缩小渲染或框选需要遍历的范围。
         *
         * @param bounds - 用于布局、查询或素材定位的矩形范围。
         * @returns 与区域相交的候选结果。
         */
        query: (bounds) => engine.current?.query(bounds) ?? [],
        /**
         * 通过节点 ID 取得编译后的场景信息，供交互层读取变换和边界。
         *
         * @param id - 唯一标识，用于查找、更新和建立引用。
         * @returns 场景条目；找不到时返回 undefined。
         */
        entry: (id) => scene.nodes.get(id),
      }),
      [scene],
    );
    useLayoutEffect(
      /**
       * 在Canvas 设计渲染器的依赖变化后同步外部资源或界面状态。
       * @returns 用于结束当前订阅或恢复现场的清理函数。
       */
      () => {
        const renderer = new CanvasEngine(canvas.current!, overlayCanvas.current!);
        engine.current = renderer;
        /**
         * 结束Canvas 设计渲染器当前建立的监听或临时操作，避免后续重复执行。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        return () => {
          renderer.dispose();
          engine.current = null;
        };
      },
      [],
    );
    useLayoutEffect(
      /**
       * 在Canvas 设计渲染器的依赖变化后同步外部资源或界面状态。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      () => {
        engine.current?.setScene(scene, page, tokens, editingText);
      },
      [scene, page.background, page.width, page.height, page.grid, tokens, editingText],
    );
    useLayoutEffect(
      /**
       * 在Canvas 设计渲染器的依赖变化后同步外部资源或界面状态。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      () => {
        engine.current?.setView(view);
      },
      [view.width, view.height, view.zoom, view.x, view.y],
    );
    useLayoutEffect(
      /**
       * 在Canvas 设计渲染器的依赖变化后同步外部资源或界面状态。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      () => {
        engine.current?.setOverlay(overlay);
      },
      [overlay],
    );
    // Keep canvases outside the transformed artboard to avoid browser resampling of text.
    const style = {
      position: 'absolute' as const,
      pointerEvents: 'none' as const,
      left: 0,
      top: 0,
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
          ref={overlayCanvas}
          className="ed-overlay-canvas"
          style={style}
          aria-hidden="true"
        />
      </>
    );
  },
);
