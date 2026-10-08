import type { DesignNode, Project } from '@forma/schema';
import { CanvasEngine } from '../../../../packages/renderer/src/canvas/engine';
import { fixture, images, type SceneKind } from './fixtures';
import { environment, gpuInfo, measure, records, settle } from './metrics';

const view = { width: 960, height: 640, zoom: 1, x: 0, y: 0 };

export function surface(gpu = true) {
  const host = document.createElement('div');
  host.className = 'engine-surface';
  const canvas = document.createElement('canvas');
  const gpuCanvas = document.createElement('canvas');
  const overlay = document.createElement('canvas');
  host.append(canvas, ...(gpu ? [gpuCanvas] : []), overlay);
  document.querySelector('#preview')!.replaceChildren(host);
  const engine = new CanvasEngine(canvas, overlay, gpu ? gpuCanvas : undefined);
  if (gpu) gpuInfo(gpuCanvas);
  return {
    engine,
    canvas,
    gpuCanvas,
    dispose: () => {
      engine.dispose();
      host.remove();
    },
  };
}

async function inspect(
  doc: Project,
  label: string,
  options: { gpu?: boolean; full?: boolean } = {},
) {
  const { engine, canvas, dispose } = surface(options.gpu ?? true);
  const page = doc.pages[0];
  const details = {
    suite: 'engine',
    nodes: page.nodes.length,
    page: [page.width, page.height],
    backend: canvas.dataset.backend,
  };
  await measure(
    `${label}/cold`,
    1,
    () => {
      engine.setDocument(page, doc);
      engine.setView(view, true);
    },
    details,
  );
  await settle(8);
  engine.setView({ ...view, x: -20, y: -20 }, true);
  await measure(
    `${label}/warm-pan`,
    45,
    (i) => engine.setView({ ...view, x: -20 - (i % 5), y: -20 }, true),
    details,
  );
  await measure(
    `${label}/new-region-pan`,
    45,
    (i) => engine.setView({ ...view, x: -16 * i, y: -64 * i }, true),
    details,
  );
  engine.setView({ ...view, zoom: 0.75 }, true);
  await measure(
    `${label}/zoom-0.75-to-1.5`,
    45,
    (i) => engine.setView({ ...view, zoom: 0.75 + i / 60 }, true),
    details,
  );
  engine.setView(view, true);
  let current = page;
  await measure(
    `${label}/leaf-drag`,
    45,
    (i) => {
      const target = page.nodes.find((node) => node.type !== 'group')!;
      current = {
        ...page,
        nodes: page.nodes.map((node) =>
          node.id === target.id ? { ...node, x: node.x + i + 1 } : node,
        ),
      };
      engine.setDocument(current, { ...doc, pages: [current] });
      engine.setView(view, true);
    },
    details,
  );
  if (options.full) {
    await measure(
      `${label}/leaf-resize`,
      45,
      (i) => {
        current = {
          ...page,
          nodes: page.nodes.map((node, index) =>
            index === 0
              ? { ...node, width: node.width + i + 1, height: node.height + i / 2 }
              : node,
          ),
        };
        engine.setDocument(current, { ...doc, pages: [current] });
        engine.setView(view, true);
      },
      details,
    );
    await measure(
      `${label}/hit-test-100-per-frame`,
      30,
      (i) => {
        for (let point = 0; point < 100; point++)
          engine.hitTest({ x: (point * 53 + i) % 960, y: (point * 37) % 640 });
      },
      details,
    );
    await measure(
      `${label}/marquee-query`,
      45,
      (i) => {
        engine.query({ x: 0, y: 0, width: 200 + i * 16, height: 600 });
      },
      details,
    );
    await measure(
      `${label}/selection-overlay-1000`,
      45,
      (i) => {
        engine.setOverlay({
          selectedIds: page.nodes.slice(i, i + 1000).map((node) => node.id),
          guides: [],
          penPoints: [],
        });
      },
      details,
    );
  }
  dispose();
}

export async function runEngineSuite() {
  await document.fonts.ready;
  await Promise.all(
    images().map(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
    }),
  );
  await measure('baseline/idle', 120, () => {}, { suite: 'baseline' });
  await inspect(fixture('dense', 100), 'warmup/100');
  for (const count of [1000, 5000, 10000]) {
    await inspect(fixture('dense', count), `dense/${count}`, { full: true });
    await inspect(fixture('spread', count), `spread/${count}`);
  }
  for (const kind of ['text', 'images', 'effects', 'path', 'mixed', 'components'] as SceneKind[])
    await inspect(fixture(kind, 1000), `${kind}/1000`, { full: kind === 'mixed' });
  await inspect(fixture('dense', 10000), 'canvas2d/10000', { gpu: false });
  await inspect(fixture('overlap', 1000), 'overlap/1000', { full: true });
  for (const count of [1000, 5000]) {
    const doc = fixture('group', count),
      original = doc.pages[0];
    const { engine, dispose } = surface();
    engine.setDocument(original, doc);
    engine.setView(view, true);
    await measure(
      `group/${count}/subtree-drag`,
      45,
      (i) => {
        const page = {
          ...original,
          nodes: original.nodes.map((node) => ({ ...node, x: node.x + i + 1 })),
        };
        engine.setDocument(page, { ...doc, pages: [page] });
        engine.setView(view, true);
      },
      { suite: 'engine', nodes: count + 1 },
    );
    dispose();
  }
  const local = (await fetch('/local-projects.json').then((response) => response.json())) as {
    projects: Project[];
  };
  environment.localPageSizes = local.projects.flatMap((doc) =>
    doc.pages.map((page) => page.nodes.length),
  );
  for (const [index, doc] of local.projects.filter((doc) => doc.pages[0]?.nodes.length).entries())
    await inspect(doc, `local-project/${index}/${doc.pages[0].nodes.length}`, { full: true });
}

export async function runLifecycleSuite() {
  const doc = fixture('mixed', 1000),
    page = doc.pages[0];
  const { engine, canvas, dispose } = surface();
  engine.setDocument(page, doc);
  engine.setView(view, true);
  await settle(12);
  await measure(
    'cache/mixed1000/long-pan-360',
    360,
    (i) => engine.setView({ ...view, x: -(i % 20) * 128, y: -Math.floor(i / 20) * 256 }, true),
    { suite: 'lifecycle' },
  );
  await measure('cache/mixed1000/return-origin', 1, () => engine.setView(view, true), {
    suite: 'lifecycle',
  });
  const diagnostics = engine as unknown as {
    tiles: { bytes: number };
    painter: {
      rasterBytes: number;
      images: Map<string, unknown>;
      references: Map<DesignNode, number>;
    };
  };
  const before = {
    tileBytes: diagnostics.tiles.bytes,
    rasterBytes: diagnostics.painter.rasterBytes,
    images: diagnostics.painter.images.size,
    references: diagnostics.painter.references.size,
  };
  const fallback = canvas.dataset.backend;
  dispose();
  const after = {
    tileBytes: diagnostics.tiles.bytes,
    rasterBytes: diagnostics.painter.rasterBytes,
    images: diagnostics.painter.images.size,
    references: diagnostics.painter.references.size,
  };
  environment.disposeResources = { before, after, backend: fallback };
  await measure(
    'lifecycle/mount-draw-dispose-20',
    20,
    () => {
      const item = surface();
      item.engine.setDocument(page, doc);
      item.engine.setView(view, true);
      item.dispose();
    },
    { suite: 'lifecycle' },
  );
  environment.cacheLimitRespected = records
    .filter((row) => row.suite === 'lifecycle')
    .every((row) => row.rendering.tileCacheBytes.max <= 128 * 1024 * 1024);
}

export async function runStressComparison() {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  try {
    for (const ratio of [1, 2]) {
      // Exercise the renderer's backing-store policy; this does not emulate a physical Retina display.
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: ratio });
      for (let repeat = 1; repeat <= 3; repeat++) {
        for (const [kind, count] of [
          ['dense', 10000],
          ['effects', 1000],
          ['mixed-url', 1000],
        ] as const) {
          const doc = fixture(kind, count),
            page = doc.pages[0];
          const item = surface();
          const details = { suite: 'stress', nodes: count, simulatedDpr: ratio, repeat };
          const prefix = `stress/${kind}/${count}/dpr${ratio}/run${repeat}`;
          await measure(
            `${prefix}/cold`,
            1,
            () => {
              item.engine.setDocument(page, doc);
              item.engine.setView({ ...view, zoom: 0.99 }, true);
            },
            details,
          );
          await settle(10);
          await measure(
            `${prefix}/zoom-crossing`,
            1,
            () => item.engine.setView({ ...view, zoom: 1.01 }, true),
            details,
          );
          await measure(
            `${prefix}/warm-pan`,
            45,
            (i) => item.engine.setView({ ...view, zoom: 1.01, x: i % 4 }, true),
            details,
          );
          item.dispose();
        }
        const doc = fixture('group', 5000),
          page = doc.pages[0];
        const item = surface();
        item.engine.setDocument(page, doc);
        item.engine.setView(view, true);
        await measure(
          `stress/group/5000/dpr${ratio}/run${repeat}/drag`,
          30,
          (i) => {
            const updated = {
              ...page,
              nodes: page.nodes.map((node) => ({ ...node, x: node.x + i + 1 })),
            };
            item.engine.setDocument(updated, { ...doc, pages: [updated] });
            item.engine.setView(view, true);
          },
          { suite: 'stress', nodes: 5001, simulatedDpr: ratio, repeat },
        );
        item.dispose();
      }
    }
  } finally {
    if (descriptor) Object.defineProperty(window, 'devicePixelRatio', descriptor);
    else Reflect.deleteProperty(window, 'devicePixelRatio');
  }
}
