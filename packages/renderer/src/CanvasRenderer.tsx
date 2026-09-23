import { memo, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import type { DesignNode, DesignPage, Project } from '@forma/schema';
import { getProjectTokens } from './scene-values';
import { CanvasEngine, type CanvasOverlay, type CanvasView } from './canvas/engine';
import { SceneCompiler, type SceneEntry } from './canvas/scene';
import type { Bounds, Point } from './canvas/geometry';

export interface CanvasRendererHandle {
  hitTest(point: Point): DesignNode | undefined;
  query(bounds: Bounds): string[];
  entry(id: string): SceneEntry | undefined;
}
interface Props {
  ref?: Ref<CanvasRendererHandle>;
  project: Project;
  page: DesignPage;
  view: CanvasView;
  overlay: CanvasOverlay;
  editingText?: string;
}

export const CanvasRenderer = memo(function CanvasRenderer({ ref, project, page, view, overlay, editingText }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), overlayCanvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<CanvasEngine | null>(null);
  const [compiler] = useState(() => new SceneCompiler());
  const scene = useMemo(() => compiler.compile(page, project), [compiler, page.nodes, project.components,
    project.tokens, project.themeModes, project.activeMode, project.variableCollections, project.activeVariableModes]);
  const tokens = getProjectTokens(project);
  useImperativeHandle(ref, () => ({
    hitTest: point => engine.current?.hitTest(point),
    query: bounds => engine.current?.query(bounds) ?? [],
    entry: id => scene.nodes.get(id),
  }), [scene]);
  useLayoutEffect(() => {
    const renderer = new CanvasEngine(canvas.current!, overlayCanvas.current!);
    engine.current = renderer;
    return () => { renderer.dispose(); engine.current = null; };
  }, []);
  useLayoutEffect(() => { engine.current?.setScene(scene, page, tokens, editingText); }, [scene, page.background, page.width, page.height, page.grid, tokens, editingText]);
  useLayoutEffect(() => { engine.current?.setView(view); }, [view.width, view.height, view.zoom, view.x, view.y]);
  useLayoutEffect(() => { engine.current?.setOverlay(overlay); }, [overlay]);
  // Keep canvases outside the transformed artboard to avoid browser resampling of text.
  const style = { position: 'absolute' as const, pointerEvents: 'none' as const,
    left: 0, top: 0, width: view.width, height: view.height };
  return <>
    <canvas ref={canvas} className="ed-scene-canvas" style={style} aria-label="设计画布；使用图层面板或画布选择与编辑元素" role="img" />
    <canvas ref={overlayCanvas} className="ed-overlay-canvas" style={style} aria-hidden="true" />
  </>;
});
