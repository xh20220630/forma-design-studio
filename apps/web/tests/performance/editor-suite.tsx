import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Project } from '@forma/schema';
import DesignEditor from '../../src/features/editor/components/DesignEditor';
import { StudioThemeProvider } from '../../src/shared/theme/StudioTheme';
import { TooltipProvider } from '@forma/ui/tooltip';
import { fixture } from './fixtures';
import { environment, measure, settle } from './metrics';

const noop = () => {};
const key = (value: string, options: KeyboardEventInit = {}) =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options }),
  );
const pointer = (
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  options: PointerEventInit = {},
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
      ...options,
    }),
  );

async function editorCase(doc: Project, label: string, snapshotOnly = false, interactive = false) {
  const host = document.createElement('div');
  host.className = 'workspace-root';
  document.querySelector('#preview')!.replaceChildren(host);
  const root = createRoot(host);
  let committed = doc,
    commits = 0;
  function Harness() {
    const [value, setValue] = useState(doc);
    return (
      <StudioThemeProvider>
        <TooltipProvider>
          <DesignEditor
            project={value}
            onChange={(next) => {
              committed = next;
              commits++;
              setValue(next);
            }}
            onBack={noop}
            onOpenAgent={noop}
            onSync={noop}
          />
        </TooltipProvider>
      </StudioThemeProvider>
    );
  }
  const details = {
    suite: 'editor',
    nodes: doc.pages[0].nodes.length,
    syntheticInput: true,
    inlineImageChars: doc.pages[0].nodes.reduce(
      (sum, node) => sum + (node.src?.startsWith('data:') ? node.src.length : 0),
      0,
    ),
  };
  await measure(`${label}/mount`, 1, () => flushSync(() => root.render(<Harness />)), details);
  await settle(30);
  await Promise.all(
    Array.from(document.images)
      .filter((image) => image.src.includes('/brand/'))
      .map((image) => image.decode()),
  );
  const scroll = host.querySelector<HTMLElement>('.ed-canvas-scroll')!;
  const artboard = host.querySelector<HTMLElement>('.ed-artboard')!;
  const canvas = host.querySelector<HTMLCanvasElement>('.ed-scene-canvas')!;
  if (!scroll || !artboard || !canvas?.dataset.sceneNodes)
    throw new Error(`${label}: editor did not mount`);
  const camera = () => ({
    zoom: parseFloat(host.querySelector('.ed-zoom-trigger')!.textContent!) / 100,
    box: artboard.getBoundingClientRect(),
  });
  const point = (x: number, y: number) => {
    const { box } = camera();
    const zoom = box.width / committed.pages[0].width;
    return { x: box.left + x * zoom, y: box.top + y * zoom };
  };
  const center = () => {
    const rect = scroll.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  if (interactive) return;
  const wheel = (deltaY: number) => {
    const p = center();
    scroll.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY,
        ctrlKey: true,
        clientX: p.x,
        clientY: p.y,
        bubbles: true,
        cancelable: true,
      }),
    );
  };
  const moveViewToOrigin = async () => {
    const zoom = camera().zoom;
    wheel(-Math.log(1 / zoom) / 0.002);
    await settle(6);
    scroll.scrollLeft = scroll.clientWidth - 30;
    scroll.scrollTop = scroll.clientHeight - 30;
    await settle(6);
  };
  if (!snapshotOnly) {
    await measure(`${label}/idle`, 45, noop, details);
    const initialScroll = { x: scroll.scrollLeft, y: scroll.scrollTop };
    await measure(
      `${label}/native-scroll-pan`,
      60,
      (i) => {
        scroll.scrollLeft = initialScroll.x + i * 5;
        scroll.scrollTop = initialScroll.y + i * 8;
      },
      details,
    );
    await measure(`${label}/wheel-zoom`, 60, (i) => wheel(i < 30 ? -14 : 14), details);
    await moveViewToOrigin();
    await measure(
      `${label}/hover`,
      60,
      (i) => {
        const p = point(24 + (i % 6) * 150, 30 + (i % 4) * 80);
        pointer(scroll, 'pointermove', p.x, p.y, { buttons: 0 });
      },
      details,
    );
  } else await moveViewToOrigin();
  const target = committed.pages[0].nodes.find(
    (node) => !['frame', 'group', 'section'].includes(node.type),
  )!;
  if (target) {
    let p = point(target.x + target.width / 2, target.y + target.height / 2);
    await measure(
      `${label}/pointerdown`,
      1,
      () => {
        p = point(target.x + target.width / 2, target.y + target.height / 2);
        pointer(artboard, 'pointerdown', p.x, p.y);
      },
      details,
    );
    if (!host.querySelector('.ed-selection,.ed-multi-selection'))
      throw new Error(`${label}: drag target not selected`);
    await measure(
      `${label}/drag-with-snap`,
      60,
      (i) => pointer(window, 'pointermove', p.x + i + 1, p.y + i / 2),
      details,
    );
    await measure(
      `${label}/drag-commit`,
      1,
      () => pointer(window, 'pointerup', p.x + 60, p.y + 30),
      details,
    );
    if (!commits) throw new Error(`${label}: drag never committed`);
    const moved = committed.pages[0].nodes.find((node) => node.id === target.id)!;
    if (moved.x === target.x && moved.y === target.y)
      throw new Error(`${label}: drag did not move document`);
    if (label.startsWith('checks/')) {
      const original = committed;
      const count = commits;
      for (const cancel of ['pointercancel', 'escape', 'return-origin'] as const) {
        const anchor = point(moved.x + moved.width / 2, moved.y + moved.height / 2);
        pointer(artboard, 'pointerdown', anchor.x, anchor.y);
        pointer(window, 'pointermove', anchor.x + 19, anchor.y + 13, { altKey: true });
        await settle(5);
        const beforeZoom = artboard.getBoundingClientRect().width;
        wheel(-14);
        await settle(3);
        if (Math.abs(artboard.getBoundingClientRect().width - beforeZoom) > 0.1)
          throw new Error(`${label}: zoom changed during a gesture`);
        if (cancel === 'return-origin') {
          pointer(window, 'pointermove', anchor.x, anchor.y, { altKey: true });
          pointer(window, 'pointerup', anchor.x, anchor.y);
        } else if (cancel === 'escape') key('Escape');
        else pointer(window, 'pointercancel', anchor.x + 19, anchor.y + 13);
        await settle(8);
        if (
          commits !== count ||
          committed !== original ||
          artboard.style.getPropertyValue('--gesture-x')
        )
          throw new Error(`${label}: ${cancel} changed history or left a transient transform`);
      }
      const viewBefore = artboard.getBoundingClientRect();
      const anchor = center();
      const worldX = (anchor.x - viewBefore.left) / (viewBefore.width / committed.pages[0].width);
      const worldY = (anchor.y - viewBefore.top) / (viewBefore.width / committed.pages[0].width);
      wheel(-25);
      await settle(6);
      const after = point(worldX, worldY);
      if (Math.hypot(after.x - anchor.x, after.y - anchor.y) > 2)
        throw new Error(`${label}: zoom did not preserve its world anchor`);
      environment[`${label}/regressions`] =
        'pointercancel, Escape, no-op history, gesture zoom guard, anchored zoom passed';
    }
    if (snapshotOnly) {
      await measure(`${label}/unmount`, 1, () => flushSync(() => root.unmount()), details);
      host.remove();
      return;
    }
    p = point(moved.x + moved.width / 2, moved.y + moved.height / 2);
    pointer(artboard, 'pointerdown', p.x, p.y, { ctrlKey: true });
    await settle(4);
    await measure(
      `${label}/drag-without-snap`,
      60,
      (i) => pointer(window, 'pointermove', p.x + i + 1, p.y, { altKey: true }),
      details,
    );
    pointer(window, 'pointerup', p.x + 60, p.y);
    await settle(6);
    const handle = host.querySelector<HTMLElement>('.ed-resize-handle.se');
    if (handle) {
      const box = handle.getBoundingClientRect();
      pointer(handle, 'pointerdown', box.x + box.width / 2, box.y + box.height / 2);
      await measure(
        `${label}/resize`,
        60,
        (i) => pointer(window, 'pointermove', box.x + i + 1, box.y + i / 2),
        details,
      );
      pointer(window, 'pointerup', box.x + 60, box.y + 30);
      await settle(6);
    }
    const revision = committed.revision;
    const geometryBeforeUndo = committed.pages[0].nodes.map((node) => [
      node.id,
      node.x,
      node.y,
      node.width,
      node.height,
    ]);
    await measure(`${label}/undo`, 1, () => key('z', { ctrlKey: true }), details);
    await measure(`${label}/redo`, 1, () => key('z', { ctrlKey: true, shiftKey: true }), details);
    if (
      committed.revision !== revision + 2 ||
      JSON.stringify(geometryBeforeUndo) !==
        JSON.stringify(
          committed.pages[0].nodes.map((node) => [
            node.id,
            node.x,
            node.y,
            node.width,
            node.height,
          ]),
        )
    )
      throw new Error(`${label}: undo/redo did not restore geometry and advance revision`);
  }
  key('Escape');
  await settle(5);
  let start = point(5, 5);
  pointer(artboard, 'pointerdown', start.x, start.y);
  await measure(
    `${label}/marquee`,
    45,
    (i) => {
      const end = point(80 + i * 18, 80 + i * 10);
      pointer(window, 'pointermove', end.x, end.y);
    },
    details,
  );
  pointer(window, 'pointerup', start.x + 800, start.y + 500);
  await settle(6);
  key('Escape');
  await settle(5);
  await measure(`${label}/select-all`, 1, () => key('a', { ctrlKey: true }), details);
  await measure(`${label}/selected-idle`, 30, noop, details);
  if (label.includes('dense')) {
    const node = committed.pages[0].nodes[0];
    const p = point(node.x + node.width / 2, node.y + node.height / 2);
    await measure(
      `${label}/multi-pointerdown`,
      1,
      () => pointer(artboard, 'pointerdown', p.x, p.y),
      details,
    );
    await measure(
      `${label}/multi-drag`,
      15,
      (i) => pointer(window, 'pointermove', p.x + i + 1, p.y + i + 1, { altKey: true }),
      details,
    );
    await measure(
      `${label}/multi-commit`,
      1,
      () => pointer(window, 'pointerup', p.x + 15, p.y + 15),
      details,
    );
  }
  key('Escape');
  await settle(5);
  const text = committed.pages[0].nodes.find((node) => node.type === 'text');
  if (text) {
    const p = point(text.x + text.width / 2, text.y + Math.min(10, text.height / 2));
    await measure(
      `${label}/text-enter`,
      1,
      () =>
        artboard.dispatchEvent(
          new MouseEvent('dblclick', { bubbles: true, clientX: p.x, clientY: p.y }),
        ),
      details,
    );
    const input = host.querySelector<HTMLTextAreaElement>('.ed-inline-editor');
    if (!input) throw new Error(`${label}: inline text editor did not open`);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    await measure(
      `${label}/text-input`,
      45,
      (i) => {
        setter.call(input, `${text.text} ${'文字'.repeat(i + 1)}`);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      details,
    );
    await measure(`${label}/text-commit`, 1, () => input.blur(), details);
    if (
      !committed.pages[0].nodes
        .find((node) => node.id === text.id)!
        .text!.endsWith('文字'.repeat(45))
    )
      throw new Error(`${label}: input events did not update text`);
  }
  environment[`${label}/checks`] = {
    commits,
    sceneNodes: Number(canvas.dataset.sceneNodes),
    backend: canvas.dataset.backend,
    layerDomRows: host.querySelectorAll('.ed-layer').length,
    canvasCss: [canvas.clientWidth, canvas.clientHeight],
    canvasPixels: [canvas.width, canvas.height],
  };
  await measure(`${label}/unmount`, 1, () => flushSync(() => root.unmount()), details);
  host.remove();
}

export async function runEditorSuite() {
  await document.fonts.ready;
  // Synthetic pointers have no native pointer ID to capture. All gesture, React and drawing handlers still run.
  const capture = Element.prototype.setPointerCapture,
    release = Element.prototype.releasePointerCapture;
  Element.prototype.setPointerCapture = noop;
  Element.prototype.releasePointerCapture = noop;
  try {
    const local = (await fetch('/local-projects.json').then((response) => response.json())) as {
      projects: Project[];
    };
    const sample = local.projects.find((doc) => doc.pages[0]?.nodes.length > 0);
    if (sample)
      await editorCase(structuredClone(sample), `editor/local/${sample.pages[0].nodes.length}`);
    for (const count of [100, 1000, 5000, 10000])
      await editorCase(fixture('mixed-url', count), `editor/mixed-url/${count}`);
    for (const count of [1000, 10000])
      await editorCase(fixture('dense', count), `editor/dense/${count}`);
    for (const count of [1000, 5000])
      await editorCase(fixture('group', count), `editor/group/${count}`);
  } finally {
    Element.prototype.setPointerCapture = capture;
    Element.prototype.releasePointerCapture = release;
  }
}

export async function runSnapshotComparison() {
  const capture = Element.prototype.setPointerCapture,
    release = Element.prototype.releasePointerCapture;
  Element.prototype.setPointerCapture = noop;
  Element.prototype.releasePointerCapture = noop;
  try {
    for (let repeat = 1; repeat <= 3; repeat++)
      for (const kind of ['mixed-url', 'mixed'] as const)
        await editorCase(fixture(kind, 1000), `snapshot/${kind}/1000/run${repeat}`, true);
  } finally {
    Element.prototype.setPointerCapture = capture;
    Element.prototype.releasePointerCapture = release;
  }
}

export async function runEmptyEditor() {
  const capture = Element.prototype.setPointerCapture;
  Element.prototype.setPointerCapture = noop;
  try {
    const local = (await fetch('/local-projects.json').then((response) => response.json())) as {
      projects: Project[];
    };
    const doc = local.projects.find((item) => item.pages[0]?.nodes.length === 0);
    if (!doc) throw new Error('No local empty page is available');
    for (let repeat = 1; repeat <= 3; repeat++)
      await editorCase(structuredClone(doc), `editor/empty/0/run${repeat}`);
  } finally {
    Element.prototype.setPointerCapture = capture;
  }
}

export async function showInteractiveEditor() {
  await editorCase(fixture('mixed-url', 100), 'interactive/mixed-url/100', false, true);
}

export async function runInteractionChecks() {
  const capture = Element.prototype.setPointerCapture,
    release = Element.prototype.releasePointerCapture;
  Element.prototype.setPointerCapture = noop;
  Element.prototype.releasePointerCapture = noop;
  try {
    for (const [kind, count] of [
      ['dense', 100],
      ['mixed', 1000],
      ['mixed', 5000],
      ['group', 5000],
    ] as const)
      await editorCase(fixture(kind, count), `checks/${kind}/${count}`, true);
  } finally {
    Element.prototype.setPointerCapture = capture;
    Element.prototype.releasePointerCapture = release;
  }
}
