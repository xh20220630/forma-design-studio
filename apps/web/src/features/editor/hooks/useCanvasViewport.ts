import { useCallback, useLayoutEffect, useRef } from 'react';
import {
  canvasAnchorScroll,
  canvasViewportCenter,
  canvasWorldPoint,
  clampCanvasZoom,
  fitCanvasBounds,
  type CanvasBounds,
  type CanvasCamera,
  type CanvasPoint,
  type CanvasSize,
} from '@forma/editor-core/viewport';

interface CanvasViewportOptions extends CanvasSize {
  pageKey: string;
  canZoom?: () => boolean;
}

export interface CanvasViewportSource {
  getSnapshot(): CanvasCamera;
  subscribe(listener: () => void): () => void;
}

export function useCanvasViewport({ pageKey, width, height, canZoom }: CanvasViewportOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef({ width, height });
  const canZoomRef = useRef(canZoom);
  const fitModeRef = useRef<{ bounds?: CanvasBounds } | null>({});
  const state = useRef<CanvasCamera>({ width: 0, height: 0, zoom: 1, scrollX: 0, scrollY: 0 });
  const listeners = useRef(new Set<() => void>());
  const source = useRef<CanvasViewportSource>({
    getSnapshot: () => state.current,
    subscribe: (listener) => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    },
  }).current;
  const attached = useRef<{
    element: HTMLDivElement;
    observer: ResizeObserver;
    wheel: (event: WheelEvent) => void;
  } | null>(null);

  const publish = useCallback((next: CanvasCamera) => {
    const previous = state.current;
    if (
      Object.keys(next).every(
        (key) => next[key as keyof CanvasCamera] === previous[key as keyof CanvasCamera],
      )
    )
      return;
    state.current = next;
    for (const listener of listeners.current) listener();
  }, []);

  // 先更新滚动边界，再设置锚点；相机只有一个提交，不经编辑器顶层 React 状态。
  const requestCamera = useCallback(
    (next: CanvasCamera) => {
      const element = scrollRef.current,
        stage = stageRef.current;
      if (!element || !stage || !next.width || !next.height) return;
      stage.style.width = `${Math.max(0, pageRef.current.width) * next.zoom + next.width * 2}px`;
      stage.style.height = `${Math.max(0, pageRef.current.height) * next.zoom + next.height * 2}px`;
      stage.style.padding = `${next.height}px ${next.width}px`;
      stage.style.setProperty('--canvas-zoom', String(next.zoom));
      element.scrollLeft = next.scrollX;
      element.scrollTop = next.scrollY;
      publish({ ...next, scrollX: element.scrollLeft, scrollY: element.scrollTop });
    },
    [publish],
  );

  const readCamera = useCallback(
    () => ({
      ...state.current,
      scrollX: scrollRef.current?.scrollLeft ?? state.current.scrollX,
      scrollY: scrollRef.current?.scrollTop ?? state.current.scrollY,
    }),
    [],
  );

  const fit = useCallback(
    (bounds?: CanvasBounds) => {
      const element = scrollRef.current,
        page = pageRef.current;
      if (!element || page.width <= 0 || page.height <= 0) return;
      const target = bounds ?? { x: 0, y: 0, ...page };
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
      const scroll = canvasAnchorScroll(previous, zoom, canvasWorldPoint(previous, anchor), anchor);
      fitModeRef.current = null;
      requestCamera({ ...previous, zoom, scrollX: scroll.x, scrollY: scroll.y });
    },
    [readCamera, requestCamera],
  );

  const onScroll = useCallback(() => {
    const next = readCamera(),
      previous = state.current;
    if (next.scrollX === previous.scrollX && next.scrollY === previous.scrollY) return;
    fitModeRef.current = null;
    publish(next);
  }, [readCamera, publish]);

  useLayoutEffect(() => {
    canZoomRef.current = canZoom;
  });
  useLayoutEffect(() => {
    pageRef.current = { width, height };
    fit();
  }, [pageKey, width, height, fit]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (attached.current?.element === element) return;
    if (attached.current) {
      attached.current.observer.disconnect();
      attached.current.element.removeEventListener('wheel', attached.current.wheel);
      attached.current = null;
    }
    if (!element) return;
    const measure = () => {
      const viewport = { width: element.clientWidth, height: element.clientHeight };
      if (!viewport.width || !viewport.height) return;
      const previous = readCamera();
      if (previous.width === viewport.width && previous.height === viewport.height) return;
      const mode = fitModeRef.current;
      if (mode || !previous.width || !previous.height) fit(mode?.bounds);
      else {
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
    attached.current = { element, observer, wheel };
    measure();
  });
  useLayoutEffect(
    () => () => {
      attached.current?.observer.disconnect();
      attached.current?.element.removeEventListener('wheel', attached.current.wheel);
      attached.current = null;
    },
    [],
  );

  return { scrollRef, stageRef, artboardRef, source, readCamera, zoomTo, fit, onScroll };
}
