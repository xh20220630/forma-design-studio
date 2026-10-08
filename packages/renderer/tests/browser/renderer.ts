import type { DesignNode, DesignPage, Project } from '@forma/schema';
import { CanvasEngine } from '../../src/canvas/engine.ts';
import { CanvasPainter } from '../../src/canvas/painter.ts';
import { SceneCompiler } from '../../src/canvas/scene.ts';
import { tileBudget } from '../../src/canvas/tiles.ts';

const results = document.querySelector<HTMLPreElement>('#results')!;
const surfaces = document.querySelector<HTMLDivElement>('#surfaces')!;
const engines: CanvasEngine[] = [];
const tokens = {
  primary: '#1677ff',
  background: '#fff',
  surface: '#fff',
  text: '#111',
  muted: '#888',
  border: '#ddd',
  radius: 8,
  spacing: 8,
  fontFamily: 'sans-serif',
};
const view = { width: 900, height: 640, zoom: 1, x: 0, y: 0 };
const log = (message: string) => {
  results.textContent += `${message}\n`;
};
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  log(`PASS ${message}`);
};
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function project(nodes: DesignNode[]): Project {
  return {
    id: 'renderer-test',
    name: 'Renderer test',
    description: '',
    category: '',
    status: 'draft',
    themeId: 'default',
    revision: 1,
    updatedAt: '',
    cover: 'blank',
    components: [],
    tokens,
    pages: [{ id: 'page', name: 'Page', width: 1800, height: 1600, nodes }],
  };
}

function node(id: string, patch: Partial<DesignNode> = {}): DesignNode {
  return {
    id,
    name: id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fill: '#1677ff',
    ...patch,
  };
}

function setup(gpu: boolean) {
  const surface = document.createElement('div');
  surface.className = 'surface';
  const canvas = document.createElement('canvas'),
    gpuCanvas = document.createElement('canvas');
  const overlay = document.createElement('canvas');
  surface.append(canvas);
  if (gpu) surface.append(gpuCanvas);
  surface.append(overlay);
  surfaces.append(surface);
  const engine = new CanvasEngine(canvas, overlay, gpu ? gpuCanvas : undefined);
  engines.push(engine);
  return { engine, canvas, gpuCanvas, overlay };
}

function pixels(canvas: HTMLCanvasElement) {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0);
  return ctx.getImageData(0, 0, copy.width, copy.height).data;
}

async function drawReady(rig: ReturnType<typeof setup>, camera: typeof view) {
  rig.engine.setView(camera, true);
  const started = performance.now();
  while (Number(rig.canvas.dataset.pendingTiles) > 0) {
    if (performance.now() - started > 30_000) throw new Error('Tile refinement did not complete');
    await frame();
  }
  // GPU 默认在呈现后清空缓冲，采样前重新合成缓存纹理。
  rig.engine.setView(camera, true);
}

function reference(
  page: DesignPage,
  document: Project,
  width: number,
  height: number,
  camera = view,
) {
  const canvas = window.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const ratio = width / camera.width;
  const matrix = [
    camera.zoom * ratio,
    0,
    0,
    camera.zoom * ratio,
    camera.x * ratio,
    camera.y * ratio,
  ] as const;
  ctx.setTransform(...matrix);
  ctx.fillStyle = page.background ?? tokens.background;
  ctx.fillRect(0, 0, page.width, page.height);
  const painter = new CanvasPainter(() => {});
  const scene = new SceneCompiler().compile(page, document);
  for (const entry of scene.entries) painter.draw(ctx, entry, matrix, tokens);
  painter.dispose();
  return pixels(canvas);
}

function compare(actual: Uint8ClampedArray, expected: Uint8ClampedArray, label: string) {
  let total = 0,
    different = 0;
  for (let i = 0; i < actual.length; i++) {
    const delta = Math.abs(actual[i] - expected[i]);
    total += delta;
    if (delta > 32) different++;
  }
  const mean = total / actual.length;
  check(
    mean < 1.5 && different / actual.length < 0.01,
    `${label}: mean channel error ${mean.toFixed(3)}, >32 error ${((different / actual.length) * 100).toFixed(3)}%`,
  );
}

async function renderingChecks() {
  const document = project([
    node('wide', {
      x: 40,
      y: 30,
      width: 760,
      height: 110,
      radius: 20,
      gradient: { type: 'linear', from: '#f97316', to: '#7c3aed', angle: 90 },
    }),
    node('clip', {
      x: 380,
      y: 190,
      width: 220,
      height: 200,
      rotation: 17,
      radius: 32,
      clipContent: true,
      fill: '#e7edff',
    }),
    node('ellipse', {
      parentId: 'clip',
      type: 'ellipse',
      x: 390,
      y: 180,
      width: 270,
      height: 230,
      fill: '#0ea5e9',
      opacity: 0.6,
      blendMode: 'multiply',
    }),
    node('shadow', {
      x: 470,
      y: 435,
      width: 150,
      height: 115,
      radius: 18,
      fill: '#10b981',
      shadow: { x: 9, y: 5, blur: 15, spread: 4, color: '#0008' },
    }),
    node('text', {
      type: 'text',
      x: 40,
      y: 190,
      width: 310,
      height: 190,
      fill: 'transparent',
      text: '二维渲染 Canvas\nRetained tiles · 2D\n缓存 / 裁剪 / 字体',
      fontSize: 27,
    }),
    node('path', {
      type: 'path',
      x: 75,
      y: 420,
      width: 240,
      height: 140,
      path: 'M 0 120 C 50 -40 160 -40 240 120 Z',
      closed: true,
      fill: '#f43f5e',
      stroke: '#7f1d1d',
      strokeWidth: 3,
    }),
  ]);
  for (const gpu of [false, true]) {
    const rig = setup(gpu);
    await Promise.resolve();
    rig.engine.setDocument(document.pages[0], document);
    for (const zoom of [1, 0.625, 1.25]) {
      const camera = { ...view, zoom, x: 13.25, y: -9.5 };
      await drawReady(rig, camera);
      const output = rig.canvas.dataset.backend === 'webgl2' ? rig.gpuCanvas : rig.canvas;
      compare(
        pixels(output),
        reference(document.pages[0], document, rig.canvas.width, rig.canvas.height, camera),
        `${rig.canvas.dataset.backend} visual parity at ${zoom}x`,
      );
    }
    if (gpu) check(rig.canvas.dataset.backend === 'webgl2', 'real WebGL2 path is active');
    await drawReady(rig, view);
    await drawReady(rig, view);
    check(
      rig.canvas.dataset.rasterizedTiles === '0',
      'unchanged view performs no node rasterization',
    );
    check(rig.canvas.dataset.textureUploads === '0', 'unchanged view performs no texture uploads');
    const count = rig.canvas.dataset.renderCount;
    rig.engine.setOverlay({ selectedIds: ['clip'], guides: [], penPoints: [] });
    await frame();
    check(rig.canvas.dataset.renderCount === count, 'selection redraws only the overlay');
    const changedPage = {
      ...document.pages[0],
      nodes: document.pages[0].nodes.filter((item) => item.id !== 'path'),
    };
    rig.engine.setDocument(changedPage, document);
    await drawReady(rig, view);
    compare(
      pixels(rig.canvas.dataset.backend === 'webgl2' ? rig.gpuCanvas : rig.canvas),
      reference(changedPage, document, rig.canvas.width, rig.canvas.height),
      'deleted node leaves no stale pixels',
    );
    if (gpu) {
      const gl = rig.gpuCanvas.getContext('webgl2')!;
      const loss = gl.getExtension('WEBGL_lose_context');
      if (!loss) throw new Error('WEBGL_lose_context unavailable for recovery test');
      loss.loseContext();
      await frame();
      await frame();
      check(rig.canvas.dataset.backend === 'canvas2d', 'context loss switches to Canvas 2D');
      compare(
        pixels(rig.canvas),
        reference(changedPage, document, rig.canvas.width, rig.canvas.height),
        'fallback preserves the scene',
      );
    }
  }
  const transparent = project([
    node('translucent', { x: 100, y: 100, width: 650, height: 300, fill: '#ef4444', opacity: 0.5 }),
  ]);
  transparent.pages[0].background = 'transparent';
  const alphaRig = setup(true);
  await Promise.resolve();
  alphaRig.engine.setDocument(transparent.pages[0], transparent);
  await drawReady(alphaRig, { ...view, zoom: 0.83, x: 0.25 });
  compare(
    pixels(alphaRig.canvas.dataset.backend === 'webgl2' ? alphaRig.gpuCanvas : alphaRig.canvas),
    reference(transparent.pages[0], transparent, alphaRig.canvas.width, alphaRig.canvas.height, {
      ...view,
      zoom: 0.83,
      x: 0.25,
    }),
    'transparent blocks preserve premultiplied alpha across tile seams',
  );

  const imageCanvas = window.document.createElement('canvas');
  imageCanvas.width = imageCanvas.height = 24;
  const imageContext = imageCanvas.getContext('2d')!;
  imageContext.fillStyle = '#ff0000';
  imageContext.fillRect(0, 0, 24, 24);
  const imageDocument = project([
    node('image', {
      type: 'image',
      x: 270,
      y: 300,
      width: 48,
      height: 48,
      src: imageCanvas.toDataURL(),
    }),
  ]);
  const imageRig = setup(true);
  await Promise.resolve();
  imageRig.engine.setDocument(imageDocument.pages[0], imageDocument);
  await drawReady(imageRig, view);
  await frame();
  await frame();
  await frame();
  await drawReady(imageRig, view);
  const sample = (x: number, y: number) => {
    const output = pixels(
      imageRig.canvas.dataset.backend === 'webgl2' ? imageRig.gpuCanvas : imageRig.canvas,
    );
    const ratio = imageRig.canvas.width / view.width;
    const offset = (Math.floor(y * ratio) * imageRig.canvas.width + Math.floor(x * ratio)) * 4;
    return [...output.slice(offset, offset + 4)];
  };
  check(
    sample(290, 320).join(',') === '255,0,0,255',
    'loaded image invalidates its previously cached block',
  );
  const moved = {
    ...imageDocument.pages[0],
    nodes: [{ ...imageDocument.pages[0].nodes[0], x: 600 }],
  };
  imageRig.engine.setDocument(moved, imageDocument);
  await drawReady(imageRig, view);
  check(
    sample(620, 320).join(',') === '255,0,0,255',
    'moving an image preserves its decoded resource',
  );
  check(
    sample(290, 320).join(',') === '255,255,255,255',
    'moving across tiles clears the old position',
  );

  const textDocument = project([
    node('edit', {
      type: 'text',
      x: 20,
      y: 20,
      width: 300,
      height: 100,
      fill: 'transparent',
      text: '临时输入框 Text',
      fontSize: 28,
    }),
  ]);
  imageRig.engine.setDocument(textDocument.pages[0], textDocument, 'edit');
  await drawReady(imageRig, view);
  compare(
    pixels(imageRig.canvas.dataset.backend === 'webgl2' ? imageRig.gpuCanvas : imageRig.canvas),
    reference(
      { ...textDocument.pages[0], nodes: [] },
      textDocument,
      imageRig.canvas.width,
      imageRig.canvas.height,
    ),
    'entering inline editing invalidates cached text',
  );
  imageRig.engine.setDocument(textDocument.pages[0], textDocument);
  await drawReady(imageRig, view);
  compare(
    pixels(imageRig.canvas.dataset.backend === 'webgl2' ? imageRig.gpuCanvas : imageRig.canvas),
    reference(textDocument.pages[0], textDocument, imageRig.canvas.width, imageRig.canvas.height),
    'leaving inline editing restores cached text',
  );
  log('Rendering checks complete.');
  const movable = project([
    node('under', { width: 750, height: 550, fill: '#fde68a' }),
    node('group', { type: 'group', x: 40, y: 30, width: 1000, height: 450, fill: 'transparent' }),
    node('moving', {
      parentId: 'group',
      x: 80,
      y: 80,
      width: 250,
      height: 200,
      fill: '#ef4444',
      opacity: 0.5,
      prototype: { action: 'navigate', target: 'page', trigger: 'click' },
    }),
    node('offscreen', {
      parentId: 'group',
      x: 980,
      y: 150,
      width: 100,
      height: 100,
      fill: '#2563eb',
    }),
    node('over', { x: 120, y: 100, width: 200, height: 150, fill: '#10b981', opacity: 0.5 }),
  ]);
  for (const gpu of [false, true]) {
    const rig = setup(gpu);
    const overlayReference = setup(false);
    const selection = { selectedIds: ['moving'], guides: [], penPoints: [] };
    rig.engine.setDocument(movable.pages[0], movable);
    rig.engine.setOverlay(selection);
    await drawReady(rig, view);
    const ids = new Set(['group', 'moving', 'offscreen']);
    check(rig.engine.beginTranslation([...ids]), 'group uses retained translation layers');
    for (const [x, y] of [
      [15, 20],
      [-200, 0],
      [0, 0],
    ]) {
      rig.engine.translate(x, y, []);
      await drawReady(rig, view);
      const movedPage = {
        ...movable.pages[0],
        nodes: movable.pages[0].nodes.map((item) =>
          ids.has(item.id) ? { ...item, x: item.x + x, y: item.y + y } : item,
        ),
      };
      compare(
        pixels(rig.canvas.dataset.backend === 'webgl2' ? rig.gpuCanvas : rig.canvas),
        reference(movedPage, movable, rig.canvas.width, rig.canvas.height),
        `translation ${x},${y} keeps stacking, alpha and newly visible nodes`,
      );
      overlayReference.engine.setDocument(movedPage, movable);
      overlayReference.engine.setOverlay(selection);
      await drawReady(overlayReference, view);
      compare(
        pixels(rig.overlay),
        pixels(overlayReference.overlay),
        `translation ${x},${y} keeps selection and prototype indicators aligned`,
      );
    }
    rig.engine.endTranslation();
    await drawReady(rig, view);
    compare(
      pixels(rig.canvas.dataset.backend === 'webgl2' ? rig.gpuCanvas : rig.canvas),
      reference(movable.pages[0], movable, rig.canvas.width, rig.canvas.height),
      'cancelled translation restores original pixels',
    );
  }
  log('Translation checks complete.');
}

async function benchmark() {
  const document = project(
    Array.from({ length: 10000 }, (_, i) =>
      node(String(i), {
        x: (i % 125) * 7,
        y: Math.floor(i / 125) * 7,
        width: 5,
        height: 5,
        fill: ['#1677ff', '#0d9488', '#ea580c', '#a855f7'][i % 4],
      }),
    ),
  );
  const rig = setup(true);
  await Promise.resolve();
  let started = performance.now();
  rig.engine.setDocument(document.pages[0], document);
  const compile = performance.now() - started;
  started = performance.now();
  await drawReady(rig, view);
  const cold = performance.now() - started;
  await drawReady(rig, { ...view, x: 20, y: 20 });
  const timings: number[] = [];
  for (let i = 0; i < 90; i++) {
    await frame();
    started = performance.now();
    await drawReady(rig, { ...view, x: 20 + (i % 5), y: 20 });
    timings.push(performance.now() - started);
    checkSilent(rig.canvas.dataset.rasterizedTiles === '0', 'warm panning rasterized a tile');
    checkSilent(rig.canvas.dataset.textureUploads === '0', 'warm panning uploaded a texture');
  }
  const changed = { ...document.pages[0], nodes: [...document.pages[0].nodes] };
  changed.nodes[5050] = { ...changed.nodes[5050], x: changed.nodes[5050].x + 2, fill: '#000' };
  started = performance.now();
  rig.engine.setDocument(changed, document);
  await drawReady(rig, { ...view, x: 20, y: 20 });
  const edit = performance.now() - started;
  check(
    Number(rig.canvas.dataset.rasterizedTiles) <= 4,
    'single edit redraws at most four neighboring tiles',
  );
  check(
    Number(rig.canvas.dataset.rasterizedNodes) < 10000,
    'single edit does not repaint all nodes',
  );
  check(
    Number(rig.canvas.dataset.tileCacheBytes) <= tileBudget,
    'tile cache stays within memory budget',
  );
  timings.sort((a, b) => a - b);
  log(
    JSON.stringify(
      {
        backend: rig.canvas.dataset.backend,
        documentNodes: 10000,
        visibleNodes: Number(rig.canvas.dataset.visibleNodes),
        compileMs: +compile.toFixed(2),
        coldFrameMs: +cold.toFixed(2),
        warmPanMedianMs: +timings[45].toFixed(2),
        warmPanP95Ms: +timings[85].toFixed(2),
        singleEditMs: +edit.toFixed(2),
        editRasterizedTiles: Number(rig.canvas.dataset.rasterizedTiles),
        editRasterizedNodes: Number(rig.canvas.dataset.rasterizedNodes),
        tileCacheMiB: +(Number(rig.canvas.dataset.tileCacheBytes) / 1024 / 1024).toFixed(2),
        warmPanRasterizedTiles: 0,
        warmPanTextureUploads: 0,
      },
      null,
      2,
    ),
  );
}

function checkSilent(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function run(work: () => Promise<void>) {
  document.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
  engines.splice(0).forEach((engine) => engine.dispose());
  surfaces.replaceChildren();
  results.textContent = '';
  try {
    await document.fonts.ready;
    await work();
    results.dataset.status = 'passed';
  } catch (error) {
    log(`FAIL ${error instanceof Error ? error.stack : error}`);
    results.dataset.status = 'failed';
  } finally {
    document.querySelectorAll('button').forEach((button) => {
      button.disabled = false;
    });
  }
}

document.querySelector('#checks')!.addEventListener('click', () => void run(renderingChecks));
document.querySelector('#benchmark')!.addEventListener('click', () => void run(benchmark));
