import { CanvasEngine } from '../../../../packages/renderer/src/canvas/engine';
import { SceneCompiler } from '../../../../packages/renderer/src/canvas/scene';
import { SpatialIndex } from '../../../../packages/renderer/src/canvas/geometry';
import { WebGL2Compositor } from '../../../../packages/renderer/src/canvas/compositor';

export const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
export async function settle(count = 5) {
  for (let i = 0; i < count; i++) await frame();
}
const round = (value: number) => Math.round(value * 100) / 100;
export function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: values.length,
    median: round(sorted[Math.floor(sorted.length / 2)] ?? 0),
    p95: round(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0),
    max: round(sorted.at(-1) ?? 0),
    total: round(values.reduce((a, b) => a + b, 0)),
  };
}

type Trace = { timings: Record<string, number[]>; draws: Record<string, number>[] };
let active: Trace | undefined;
const instrumented = new WeakSet<object>();
const counters = [
  'rasterizedTiles',
  'rasterizedNodes',
  'textureUploads',
  'visibleNodes',
  'sceneNodes',
  'tileCacheBytes',
  'pendingTiles',
];

function record(label: string, ms: number) {
  (active!.timings[label] ??= []).push(ms);
}
function wrap(target: object, method: string, label: string, draw = false) {
  const owner = target as Record<string, (...args: any[]) => any>;
  const original = owner[method];
  const wrapped = function (this: any, ...args: any[]) {
    if (method === 'setDocument' && !instrumented.has(this)) {
      instrumented.add(this);
      wrap(this, 'draw', 'engine.draw', true);
    }
    if (!active) return original.apply(this, args);
    const before = draw ? Number(this.canvas.dataset.renderCount ?? 0) : 0;
    const start = performance.now();
    try {
      return original.apply(this, args);
    } finally {
      record(label, performance.now() - start);
      if (draw && Number(this.canvas.dataset.renderCount ?? 0) !== before)
        active.draws.push(
          Object.fromEntries(counters.map((key) => [key, Number(this.canvas.dataset[key] ?? 0)])),
        );
    }
  };
  owner[method] = draw ? wrapped.bind(target) : wrapped;
}

wrap(CanvasEngine.prototype, 'setDocument', 'engine.document');
wrap(CanvasEngine.prototype, 'setView', 'engine.view');
wrap(CanvasEngine.prototype, 'beginTranslation', 'engine.preview-begin');
wrap(CanvasEngine.prototype, 'translate', 'engine.translate');
wrap(CanvasEngine.prototype, 'paintTile', 'engine.tile');
wrap(CanvasEngine.prototype, 'hitTest', 'engine.hitTest');
wrap(CanvasEngine.prototype, 'query', 'engine.marquee');
wrap(SceneCompiler.prototype, 'compile', 'scene.compile');
wrap(SpatialIndex.prototype, 'query', 'spatial.query');
wrap(WebGL2Compositor.prototype, 'draw', 'gpu.tile');
wrap(WebGL2Compositor.prototype, 'begin', 'gpu.begin');
wrap(WebGL2Compositor.prototype, 'end', 'gpu.end');
wrap(window, 'structuredClone', 'document.clone');
const stringify = JSON.stringify;
JSON.stringify = function (value: any, ...options: any[]) {
  if (!active || !Array.isArray(value) || !value[0]?.nodes) return stringify(value, ...options);
  const start = performance.now();
  try {
    return stringify(value, ...options);
  } finally {
    record('document.compare-json', performance.now() - start);
  }
} as typeof JSON.stringify;

const longTasks: PerformanceEntry[] = [];
const longFrames: PerformanceEntry[] = [];
const runtimeErrors: string[] = [];
window.addEventListener('error', (event) => runtimeErrors.push(event.message));
window.addEventListener('unhandledrejection', (event) => runtimeErrors.push(String(event.reason)));
for (const [type, target] of [
  ['longtask', longTasks],
  ['long-animation-frame', longFrames],
] as const) {
  if (PerformanceObserver.supportedEntryTypes.includes(type))
    new PerformanceObserver((list) => target.push(...list.getEntries())).observe({
      type,
      buffered: true,
    });
}

export const records: any[] = [];
export const environment: Record<string, unknown> = {
  userAgent: navigator.userAgent,
  hardwareConcurrency: navigator.hardwareConcurrency,
  deviceMemory: (navigator as any).deviceMemory,
  devicePixelRatio,
  viewport: { width: innerWidth, height: innerHeight },
  production: import.meta.env.PROD,
  supportedObservers: PerformanceObserver.supportedEntryTypes,
  startedAt: new Date().toISOString(),
};
const memory = () => (performance as any).memory?.usedJSHeapSize ?? null;

export function publish() {
  document.querySelector('#results')!.textContent = JSON.stringify(
    { environment, records },
    null,
    2,
  );
  document.querySelector('#summary')!.textContent = records
    .map(
      (row) =>
        `${row.name.padEnd(54)} action p95 ${String(row.action.p95).padStart(8)} ms | rAF p95 ${String(row.intervals.p95).padStart(7)} ms / max ${String(row.intervals.max).padStart(7)} ms | long tasks ${row.longTasks.length}`,
    )
    .join('\n');
}

export async function measure(
  name: string,
  steps: number,
  action: (index: number) => void,
  details: Record<string, unknown> = {},
) {
  await settle(3);
  document.querySelector('#status')!.textContent = name;
  await frame();
  const trace: Trace = { timings: {}, draws: [] };
  const actions: number[] = [],
    intervals: number[] = [];
  const heapBefore = memory(),
    start = performance.now();
  const errorsBefore = runtimeErrors.length;
  let previous = await frame();
  active = trace;
  for (let i = 0; i < steps; i++) {
    const begin = performance.now();
    action(i);
    actions.push(performance.now() - begin);
    const next = await frame();
    intervals.push(next - previous);
    previous = next;
  }
  // React and the renderer may queue their own next-frame work after the input callback.
  await settle(3);
  const inputEnded = performance.now();
  while (
    [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-pending-tiles]')].some(
      (canvas) => Number(canvas.dataset.pendingTiles) > 0,
    )
  ) {
    if (performance.now() - inputEnded > 30_000)
      throw new Error(`${name}: renderer did not finish pending tiles`);
    await frame();
  }
  active = undefined;
  const end = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (runtimeErrors.length !== errorsBefore)
    throw new Error(runtimeErrors.slice(errorsBefore).join('\n'));
  const row = {
    name,
    ...details,
    steps,
    action: stats(actions),
    intervals: stats(intervals),
    rafHz: round((1000 * intervals.length) / intervals.reduce((a, b) => a + b, 0)),
    over20ms: intervals.filter((value) => value > 20).length,
    over33ms: intervals.filter((value) => value > 33.4).length,
    elapsedMs: round(end - start),
    completionTailMs: round(end - inputEnded),
    timings: Object.fromEntries(
      Object.entries(trace.timings).map(([key, value]) => [key, stats(value)]),
    ),
    rendering: Object.fromEntries(
      counters.map((key) => [key, stats(trace.draws.map((item) => item[key]))]),
    ),
    heapBefore,
    heapAfter: memory(),
    visibility: document.visibilityState,
    longTasks: longTasks
      .filter((entry) => entry.startTime >= start && entry.startTime < end)
      .map((entry) => ({
        duration: round(entry.duration),
        offset: round(entry.startTime - start),
      })),
    longFrames: longFrames
      .filter((entry) => entry.startTime >= start && entry.startTime < end)
      .map((entry) => entry.toJSON()),
    samples: { actionMs: actions.map(round), intervalMs: intervals.map(round) },
  };
  records.push(row);
  publish();
  await fetch('/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ environment, records }),
  });
  return row;
}

export function gpuInfo(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2');
  if (!gl) return;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  environment.gpu = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  environment.gpuVersion = gl.getParameter(gl.VERSION);
}
