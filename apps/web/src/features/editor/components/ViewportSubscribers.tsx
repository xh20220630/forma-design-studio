import { useSyncExternalStore, type ComponentProps } from 'react';
import { CanvasRenderer } from '@forma/renderer/canvas';
import CanvasRulers from './CanvasRulers';
import type { CanvasViewportSource } from '../hooks/useCanvasViewport';

export function ViewportRenderer({
  source,
  ...props
}: Omit<ComponentProps<typeof CanvasRenderer>, 'view' | 'scrollOffset'> & {
  source: CanvasViewportSource;
}) {
  const camera = useSyncExternalStore(source.subscribe, source.getSnapshot);
  return (
    <CanvasRenderer
      {...props}
      view={{
        width: camera.width,
        height: camera.height,
        zoom: camera.zoom,
        x: camera.width - camera.scrollX,
        y: camera.height - camera.scrollY,
      }}
      scrollOffset={{ x: camera.scrollX, y: camera.scrollY }}
    />
  );
}

export function ViewportRulers({
  source,
  ...props
}: Omit<ComponentProps<typeof CanvasRulers>, 'zoom' | 'origin' | 'viewport'> & {
  source: CanvasViewportSource;
}) {
  const camera = useSyncExternalStore(source.subscribe, source.getSnapshot);
  return (
    <CanvasRulers
      {...props}
      zoom={camera.zoom}
      origin={{ x: camera.width - camera.scrollX, y: camera.height - camera.scrollY }}
      viewport={{ width: camera.width, height: camera.height }}
    />
  );
}

export function ViewportZoom({ source }: { source: CanvasViewportSource }) {
  const camera = useSyncExternalStore(source.subscribe, source.getSnapshot);
  return <>{Math.round(camera.zoom * 100)}%</>;
}
