import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  canvasAnchorScroll,
  canvasPendingPanDelta,
  canvasViewportCenter,
  canvasWorldPoint,
  clampCanvasZoom,
  fitCanvasBounds,
  type CanvasBounds,
  type CanvasCamera,
  type CanvasPoint,
  type CanvasSize,
} from '@forma/editor-core/viewport';

/** 画布视口 Hook 的依赖和回调，连接页面尺寸与编辑器操作。 */
interface CanvasViewportOptions extends CanvasSize {
  /** 识别当前页面的稳定键，变化时重置相关视口状态。 */
  pageKey: string;
  /**
   * 判断当前交互是否允许改变倍率的回调。
   * @returns 条件是否成立的布尔值。
   */
  canZoom?: () => boolean;
}

/** 等待 DOM 尺寸更新后应用的相机状态，避免滚动范围未更新时定位失准。 */
interface PendingCamera {
  /** 用于坐标换算的当前视口状态。 */
  camera: CanvasCamera;
  /** 相机操作开始时的原始滚动位置。 */
  sourceScroll: CanvasPoint;
}

/** 画布适配目标，集中定义允许的分支以保持调用方一致。 */
type FitMode = {
  /** 用于布局、查询或素材定位的矩形范围。 */
  bounds?: CanvasBounds;
} | null;

const emptyCamera: CanvasCamera = { width: 0, height: 0, zoom: 1, scrollX: 0, scrollY: 0 };

/**
 * 集中管理画布尺寸、缩放和滚动，使不同交互入口共用同一相机状态。
 *
 * @param options - 按字段解构的输入，字段用途见对应类型定义。
 * @param options.pageKey - 识别当前页面的稳定键，变化时重置相关视口状态。
 * @param options.width - 对象的宽度。
 * @param options.height - 对象的高度。
 * @param options.canZoom - 判断当前交互是否允许改变倍率的回调。
 * @returns 视口状态、引用与定位操作。
 */
export function useCanvasViewport({ pageKey, width, height, canZoom }: CanvasViewportOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  /** 界面状态：用于坐标换算的当前视口状态。通过状态更新驱动界面刷新。 */
  const [camera, setCamera] = useState(emptyCamera);
  /** 界面状态：本次操作开始时的位置或状态。通过状态更新驱动界面刷新。 */
  const [origin, setOrigin] = useState<CanvasPoint>({ x: 0, y: 0 });
  const cameraRef = useRef(camera);
  const pageRef = useRef({ pageKey, width, height });
  const canZoomRef = useRef(canZoom);
  const pendingRef = useRef<PendingCamera | null>(null);
  const fitModeRef = useRef<FitMode>({});
  const programmaticScrollRef = useRef<CanvasPoint | null>(null);
  const attachedRef = useRef<{
    /** 当前操作的 DOM 元素。 */
    element: HTMLDivElement;
    /** 监听容器尺寸变化的观察器。 */
    observer: ResizeObserver;
    /**
     * 当前滚轮事件。
     * @param event - 当前事件及其触发位置。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    wheel: (event: WheelEvent) => void;
  } | null>(null);

  const readCamera = useCallback(
    /**
     * 从当前 DOM 与引用读取相机，避免高频事件使用上一次渲染的旧坐标。
     * @returns 当前步骤的处理结果。
     */
    (): CanvasCamera => {
      const element = scrollRef.current;
      const pending = pendingRef.current;
      if (pending && element)
        return {
          ...pending.camera,
          scrollX: pending.camera.scrollX + element.scrollLeft - pending.sourceScroll.x,
          scrollY: pending.camera.scrollY + element.scrollTop - pending.sourceScroll.y,
        };
      return {
        ...cameraRef.current,
        scrollX: element?.scrollLeft ?? cameraRef.current.scrollX,
        scrollY: element?.scrollTop ?? cameraRef.current.scrollY,
      };
    },
    [],
  );

  const requestCamera = useCallback(
    /**
     * 暂存目标相机并等待滚动区域尺寸更新，再应用滚动位置以避免浏览器截断。
     *
     * @param next - 后续值或中间件入口。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (next: CanvasCamera) => {
      const element = scrollRef.current;
      if (!element || !next.width || !next.height) return;
      pendingRef.current = {
        camera: next,
        sourceScroll: { x: element.scrollLeft, y: element.scrollTop },
      };
      setCamera(next);
    },
    [],
  );

  const fit = useCallback(
    /**
     * 计算目标内容在安全区域内的倍率和位置，避开标尺与工具栏。
     *
     * @param bounds - 用于布局、查询或素材定位的矩形范围。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (bounds?: CanvasBounds) => {
      const element = scrollRef.current;
      const page = pageRef.current;
      if (!element || page.width <= 0 || page.height <= 0) return;
      const target = bounds ?? { x: 0, y: 0, width: page.width, height: page.height };
      if (!Object.values(target).every(Number.isFinite)) return;
      fitModeRef.current = { bounds };
      requestCamera(
        fitCanvasBounds(
          { width: element.clientWidth, height: element.clientHeight },
          target,
          bounds ? 2 : 1,
        ),
      );
    },
    [requestCamera],
  );

  const zoomTo = useCallback(
    /**
     * 围绕指定锚点调整缩放，使用户关注的位置保持在屏幕原处。
     *
     * @param value - 当前字段、模式或控件的取值。
     * @param clientPoint - 浏览器视口中的指针位置。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (value: number, clientPoint?: CanvasPoint) => {
      const element = scrollRef.current;
      if (!element || !Number.isFinite(value)) return;
      const previous = readCamera();
      if (!previous.width || !previous.height) return;
      const rect = element.getBoundingClientRect();
      const anchor = clientPoint
        ? {
            x: clientPoint.x - rect.left - element.clientLeft,
            y: clientPoint.y - rect.top - element.clientTop,
          }
        : canvasViewportCenter(previous);
      const zoom = clampCanvasZoom(value);
      const world = canvasWorldPoint(previous, anchor);
      const scroll = canvasAnchorScroll(previous, zoom, world, anchor);
      fitModeRef.current = null;
      requestCamera({ ...previous, zoom, scrollX: scroll.x, scrollY: scroll.y });
    },
    [readCamera, requestCamera],
  );

  const onScroll = useCallback(
    /**
     * 把原生滚动位置同步到相机，并处理待应用相机产生的偏移。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      const element = scrollRef.current;
      if (!element) return;
      const expected = programmaticScrollRef.current;
      if (
        !expected ||
        Math.abs(expected.x - element.scrollLeft) > 1 ||
        Math.abs(expected.y - element.scrollTop) > 1
      ) {
        fitModeRef.current = null;
      }
      const current = cameraRef.current;
      setOrigin({ x: current.width - element.scrollLeft, y: current.height - element.scrollTop });
    },
    [],
  );

  useLayoutEffect(
    /**
     * 在 useCanvasViewport 的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      canZoomRef.current = canZoom;
    },
    [canZoom],
  );

  useLayoutEffect(
    /**
     * 在 useCanvasViewport 的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      cameraRef.current = camera;
      const element = scrollRef.current;
      const pending = pendingRef.current;
      if (!element || !pending || pending.camera !== camera) return;
      // Include native panning that occurred while React committed the new scale.
      const { x: dx, y: dy } = canvasPendingPanDelta(
        pending.sourceScroll,
        { x: element.scrollLeft, y: element.scrollTop },
        {
          x: element.scrollWidth - element.clientWidth,
          y: element.scrollHeight - element.clientHeight,
        },
      );
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) fitModeRef.current = null;
      element.scrollLeft = camera.scrollX + dx;
      element.scrollTop = camera.scrollY + dy;
      programmaticScrollRef.current = { x: element.scrollLeft, y: element.scrollTop };
      pendingRef.current = null;
      setOrigin({ x: camera.width - element.scrollLeft, y: camera.height - element.scrollTop });
    },
    [camera],
  );

  useLayoutEffect(
    /**
     * 在 useCanvasViewport 的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      pageRef.current = { pageKey, width, height };
      fit();
    },
    [pageKey, width, height, fit],
  );

  useLayoutEffect(
    /**
     * 在 useCanvasViewport 的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      const element = scrollRef.current;
      if (attachedRef.current?.element === element) return;
      if (attachedRef.current) {
        attachedRef.current.observer.disconnect();
        attachedRef.current.element.removeEventListener('wheel', attachedRef.current.wheel);
        attachedRef.current = null;
      }
      if (!element) return;
      /**
       * 读取当前容器尺寸，使可见区域与布局计算保持同步。
       * @returns 测量操作的结果。
       */
      const measure = () => {
        const viewport = { width: element.clientWidth, height: element.clientHeight };
        if (!viewport.width || !viewport.height) return;
        const previous = readCamera();
        if (previous.width === viewport.width && previous.height === viewport.height) return;
        const mode = fitModeRef.current;
        if (mode || !previous.width || !previous.height) {
          fit(mode?.bounds);
        } else {
          const world = canvasWorldPoint(previous, canvasViewportCenter(previous));
          const scroll = canvasAnchorScroll(
            viewport,
            previous.zoom,
            world,
            canvasViewportCenter(viewport),
          );
          requestCamera({ ...viewport, zoom: previous.zoom, scrollX: scroll.x, scrollY: scroll.y });
        }
      };
      /**
       * 根据滚轮事件更新缩放或滚动，并保持缩放锚点稳定。
       *
       * @param event - 当前事件及其触发位置。
       * @returns 无返回值；更新视口。
       */
      const wheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        if (canZoomRef.current?.() === false) return;
        zoomTo(readCamera().zoom * Math.exp(-event.deltaY * 0.002), {
          x: event.clientX,
          y: event.clientY,
        });
      };
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      element.addEventListener('wheel', wheel, { passive: false });
      attachedRef.current = { element, observer, wheel };
      measure();
    },
  );

  useLayoutEffect(
    /**
     * 在 useCanvasViewport 的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () =>
      /**
       * 执行 useCanvasViewport 传入的局部处理步骤，使调用处能够控制结果如何更新。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      () => {
        const attached = attachedRef.current;
        attached?.observer.disconnect();
        attached?.element.removeEventListener('wheel', attached.wheel);
        attachedRef.current = null;
      },
    [],
  );

  const stageStyle: CSSProperties = {
    width: Math.max(0, width) * camera.zoom + camera.width * 2,
    height: Math.max(0, height) * camera.zoom + camera.height * 2,
    paddingLeft: camera.width,
    paddingTop: camera.height,
    paddingRight: camera.width,
    paddingBottom: camera.height,
    boxSizing: 'border-box',
  };

  return {
    scrollRef,
    artboardRef,
    zoom: camera.zoom,
    zoomTo,
    fit,
    viewport: { width: camera.width, height: camera.height },
    origin,
    stageStyle,
    onScroll,
  };
}
