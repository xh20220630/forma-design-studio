import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasEngine } from '../../src/canvas/engine.ts';
import { SpatialIndex, type Matrix } from '../../src/canvas/geometry.ts';
import type { SceneEntry } from '../../src/canvas/scene.ts';

function fakeCanvas() {
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const paints: Matrix[] = [];
  const context = {
    resetTransform() {},
    clearRect() {},
    setTransform(...next: Matrix) {
      matrix = next;
    },
    fillRect() {
      paints.push([...matrix]);
    },
    drawImage() {
      paints.push([...matrix]);
    },
  };
  const canvas = {
    width: 1,
    height: 1,
    style: {},
    dataset: {} as Record<string, string>,
    paints,
    get matrix() {
      return matrix;
    },
    getContext() {
      return context;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  Object.assign(context, { canvas });
  return canvas;
}

test('scroll-positioned canvases paint content and overlays before presentation without a stale frame', () => {
  const scheduled = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const globals = {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      scheduled.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => {
      scheduled.delete(id);
    },
    window: { devicePixelRatio: 1.25, addEventListener() {}, removeEventListener() {} },
    document: {
      createElement: fakeCanvas,
      fonts: {
        ready: new Promise(() => {}),
        addEventListener() {},
        removeEventListener() {},
      },
    },
  };
  const originals = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const canvas = fakeCanvas(),
    overlay = fakeCanvas();
  let engine: CanvasEngine | undefined;
  try {
    engine = new CanvasEngine(
      canvas as unknown as HTMLCanvasElement,
      overlay as unknown as HTMLCanvasElement,
    );
    engine.setScene(
      { entries: [], index: new SpatialIndex<SceneEntry>(), nodes: new Map() },
      { id: 'page', name: 'Page', width: 1440, height: 3113, nodes: [] },
      {
        primary: '#000',
        background: '#fff',
        surface: '#fff',
        text: '#000',
        muted: '#888',
        border: '#ddd',
        radius: 8,
        spacing: 8,
        fontFamily: 'sans-serif',
      },
    );
    const view = { width: 800, height: 600, zoom: 0.5, x: 100, y: -400 };
    engine.setView(view);
    assert.equal(scheduled.size, 1);
    assert.equal(canvas.paints.length, 0);
    for (const y of [-401.25, -430.5, -600, -590.75]) {
      engine.setView({ ...view, y }, true);
      assert.equal(scheduled.size, 0);
      assert.deepEqual(overlay.matrix, [0.625, 0, 0, 0.625, 125, y * 1.25]);
      assert.ok(canvas.paints.length > 0);
      assert.equal(Number(canvas.dataset.viewY), y);
    }
    engine.setView({ ...view, width: 600, zoom: 1, x: -50.5, y: -125.25 }, true);
    assert.equal(canvas.width, 750);
    assert.equal(canvas.height, 750);
    assert.deepEqual(overlay.matrix, [1.25, 0, 0, 1.25, -63.125, -156.5625]);
    assert.equal(scheduled.size, 0);
  } finally {
    engine?.dispose();
    for (const [key, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
  }
});
