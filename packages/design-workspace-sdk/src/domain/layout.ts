import type { JsonObject } from '../types/json.ts';
import { stringValue } from '../utils/json.ts';

/** 按流程连接关系分层排列页面，并为未连接页面预留位置。 */
export function automaticPositions(
  pages: Array<{
    id: string;

    width: number;

    height: number;
  }>,
  transitions: JsonObject[],
  entryPage: string,
) {
  const ids = new Set(pages.map((page) => page.id));
  const incoming = new Map(pages.map((page) => [page.id, 0]));
  const outgoing = new Map(pages.map((page) => [page.id, [] as string[]]));
  for (const transition of transitions) {
    const from = stringValue(transition.from).split('/').at(-1) || '';
    const to = stringValue(transition.to).split('/').at(-1) || '';
    if (ids.has(from) && ids.has(to)) {
      outgoing.get(from)?.push(to);
      incoming.set(to, (incoming.get(to) || 0) + 1);
    }
  }
  const levels = new Map<string, number>();
  const queue = ids.has(entryPage)
    ? [entryPage]
    : pages.filter((page) => (incoming.get(page.id) || 0) === 0).map((page) => page.id);
  if (queue.length === 0 && pages[0]) queue.push(pages[0].id);
  for (const id of queue) levels.set(id, 0);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const nextLevel = (levels.get(current) || 0) + 1;
    for (const target of outgoing.get(current) || []) {
      if (!levels.has(target)) {
        levels.set(target, nextLevel);
        queue.push(target);
      }
    }
  }
  let overflowLevel = Math.max(0, ...levels.values()) + 1;
  for (const page of pages) if (!levels.has(page.id)) levels.set(page.id, overflowLevel++);
  const columns = new Map<number, typeof pages>();
  for (const page of pages) {
    const level = levels.get(page.id) || 0;
    const column = columns.get(level) || [];
    column.push(page);
    columns.set(level, column);
  }
  const positions = new Map<
    string,
    {
      x: number;

      y: number;
    }
  >();
  let x = 0;
  for (const [level, column] of [...columns.entries()].sort(([a], [b]) => a - b)) {
    let y = 0;
    let maxWidth = 0;
    for (const page of column) {
      positions.set(page.id, { x, y });
      y += page.height + 320;
      maxWidth = Math.max(maxWidth, page.width);
    }
    x += maxWidth + 520 + level * 0;
  }
  return positions;
}
