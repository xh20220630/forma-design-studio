import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
} from "../../lib/editor-viewport";

interface CanvasViewportOptions extends CanvasSize {
  pageKey: string;
  canZoom?: () => boolean;
}

interface PendingCamera {
  camera: CanvasCamera;
  sourceScroll: CanvasPoint;
}

type FitMode = { bounds?: CanvasBounds } | null;

const emptyCamera: CanvasCamera = { width: 0, height: 0, zoom: 1, scrollX: 0, scrollY: 0 };

export function useCanvasViewport({ pageKey, width, height, canZoom }: CanvasViewportOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState(emptyCamera);
  const [origin, setOrigin] = useState<CanvasPoint>({ x: 0, y: 0 });
  const cameraRef = useRef(camera);
  const pageRef = useRef({ pageKey, width, height });
  const canZoomRef = useRef(canZoom);
  const pendingRef = useRef<PendingCamera | null>(null);
  const fitModeRef = useRef<FitMode>({});
  const programmaticScrollRef = useRef<CanvasPoint | null>(null);
  const attachedRef = useRef<{
    element: HTMLDivElement;
    observer: ResizeObserver;
    wheel: (event: WheelEvent) => void;
  } | null>(null);

  const readCamera = useCallback((): CanvasCamera => {
    const element = scrollRef.current;
    const pending = pendingRef.current;
    if (pending && element) return {
      ...pending.camera,
      scrollX: pending.camera.scrollX + element.scrollLeft - pending.sourceScroll.x,
      scrollY: pending.camera.scrollY + element.scrollTop - pending.sourceScroll.y,
    };
    return {
      ...cameraRef.current,
      scrollX: element?.scrollLeft ?? cameraRef.current.scrollX,
      scrollY: element?.scrollTop ?? cameraRef.current.scrollY,
    };
  }, []);

  const requestCamera = useCallback((next: CanvasCamera) => {
    const element = scrollRef.current;
    if (!element || !next.width || !next.height) return;
    pendingRef.current = {
      camera: next,
      sourceScroll: { x: element.scrollLeft, y: element.scrollTop },
    };
    setCamera(next);
  }, []);

  const fit = useCallback((bounds?: CanvasBounds) => {
    const element = scrollRef.current;
    const page = pageRef.current;
    if (!element || page.width <= 0 || page.height <= 0) return;
    const target = bounds ?? { x: 0, y: 0, width: page.width, height: page.height };
    if (!Object.values(target).every(Number.isFinite)) return;
    fitModeRef.current = { bounds };
    requestCamera(fitCanvasBounds(
      { width: element.clientWidth, height: element.clientHeight },
      target,
      bounds ? 2 : 1,
    ));
  }, [requestCamera]);

  const zoomTo = useCallback((value: number, clientPoint?: CanvasPoint) => {
    const element = scrollRef.current;
    if (!element || !Number.isFinite(value)) return;
    const previous = readCamera();
    if (!previous.width || !previous.height) return;
    const rect = element.getBoundingClientRect();
    const anchor = clientPoint ? {
      x: clientPoint.x - rect.left - element.clientLeft,
      y: clientPoint.y - rect.top - element.clientTop,
    } : canvasViewportCenter(previous);
    const zoom = clampCanvasZoom(value);
    const world = canvasWorldPoint(previous, anchor);
    const scroll = canvasAnchorScroll(previous, zoom, world, anchor);
    fitModeRef.current = null;
    requestCamera({ ...previous, zoom, scrollX: scroll.x, scrollY: scroll.y });
  }, [readCamera, requestCamera]);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const expected = programmaticScrollRef.current;
    if (!expected || Math.abs(expected.x - element.scrollLeft) > 1 || Math.abs(expected.y - element.scrollTop) > 1) {
      fitModeRef.current = null;
    }
    const current = cameraRef.current;
    setOrigin({ x: current.width - element.scrollLeft, y: current.height - element.scrollTop });
  }, []);

  useLayoutEffect(() => {
    canZoomRef.current = canZoom;
  }, [canZoom]);

  useLayoutEffect(() => {
    cameraRef.current = camera;
    const element = scrollRef.current;
    const pending = pendingRef.current;
    if (!element || !pending || pending.camera !== camera) return;
    // Include native panning that occurred while React committed the new scale.
    const { x: dx, y: dy } = canvasPendingPanDelta(
      pending.sourceScroll,
      { x: element.scrollLeft, y: element.scrollTop },
      { x: element.scrollWidth - element.clientWidth, y: element.scrollHeight - element.clientHeight },
    );
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) fitModeRef.current = null;
    element.scrollLeft = camera.scrollX + dx;
    element.scrollTop = camera.scrollY + dy;
    programmaticScrollRef.current = { x: element.scrollLeft, y: element.scrollTop };
    pendingRef.current = null;
    setOrigin({ x: camera.width - element.scrollLeft, y: camera.height - element.scrollTop });
  }, [camera]);

  useLayoutEffect(() => {
    pageRef.current = { pageKey, width, height };
    fit();
  }, [pageKey, width, height, fit]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (attachedRef.current?.element === element) return;
    if (attachedRef.current) {
      attachedRef.current.observer.disconnect();
      attachedRef.current.element.removeEventListener("wheel", attachedRef.current.wheel);
      attachedRef.current = null;
    }
    if (!element) return;
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
        const scroll = canvasAnchorScroll(viewport, previous.zoom, world, canvasViewportCenter(viewport));
        requestCamera({ ...viewport, zoom: previous.zoom, scrollX: scroll.x, scrollY: scroll.y });
      }
    };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (canZoomRef.current?.() === false) return;
      zoomTo(readCamera().zoom * Math.exp(-event.deltaY * 0.002), { x: event.clientX, y: event.clientY });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("wheel", wheel, { passive: false });
    attachedRef.current = { element, observer, wheel };
    measure();
  });

  useLayoutEffect(() => () => {
    const attached = attachedRef.current;
    attached?.observer.disconnect();
    attached?.element.removeEventListener("wheel", attached.wheel);
    attachedRef.current = null;
  }, []);

  const stageStyle: CSSProperties = {
    width: Math.max(0, width) * camera.zoom + camera.width * 2,
    height: Math.max(0, height) * camera.zoom + camera.height * 2,
    paddingLeft: camera.width,
    paddingTop: camera.height,
    paddingRight: camera.width,
    paddingBottom: camera.height,
    boxSizing: "border-box",
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
