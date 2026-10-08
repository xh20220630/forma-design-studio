import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TileCache,
  planTiles,
  placeTile,
  tileBytes,
  tilePixels,
  tilePaintBounds,
} from '../../src/canvas/tiles.ts';

const bounds = { x: 0, y: 0, width: tilePixels * 2 - 10, height: tilePixels * 2 - 10 };
const createCanvas = () =>
  ({ width: 0, height: 0, getContext: () => ({}) }) as unknown as HTMLCanvasElement;

test('world tiles survive panning and fractional zoom keeps shared pixel boundaries', () => {
  const first = planTiles(bounds, 1, 64);
  const panned = planTiles({ ...bounds, x: 10 }, 1, 64);
  assert.deepEqual(
    panned.map((tile) => tile.key),
    first.map((tile) => tile.key),
  );
  const camera = [0.625, 0, 0, 0.625, -100.25, 52.75] as const;
  const a = placeTile(first[0], camera),
    b = placeTile(first[1], camera);
  assert.equal(a.x + a.width, b.x);
  assert.equal(a.y, b.y);
  assert.equal(
    planTiles({ x: -5000, y: -5000, width: 10000, height: 10000 }, 16, 12).length <= 12,
    true,
  );
});

test('lower-resolution fallback crops its source to one target tile without duplicate alpha blending', () => {
  const tile = planTiles({ x: 0, y: 0, width: 256, height: 256 }, 1, 16)[0];
  const crop = placeTile(tile, [2, 0, 0, 2, 0, 0], { x: 128, y: 0, width: 128, height: 128 });
  assert.equal(crop.x, 256);
  assert.equal(crop.width, 256);
  assert.equal(crop.sx, 130);
  assert.equal(crop.sw, 128);
});

test('damage includes the sampling gutter and leaves unrelated cached tiles clean', () => {
  const cache = new TileCache(() => {}, tileBytes * 8, createCanvas);
  const tiles = planTiles(bounds, 1, cache.capacity).map((address) => cache.get(address));
  tiles.forEach((tile) => {
    tile.dirty = false;
  });
  cache.invalidate([{ x: 40, y: 40, width: 20, height: 20 }]);
  assert.deepEqual(
    tiles.map((tile) => tile.dirty),
    [true, false, false, false],
  );
  tiles.forEach((tile) => {
    tile.dirty = false;
  });
  cache.invalidate([{ x: tilePixels - 1, y: 30, width: 0, height: 10 }]);
  assert.deepEqual(
    tiles.map((tile) => tile.dirty),
    [true, true, false, false],
  );
  assert.equal(tilePaintBounds(tiles[0]).x, -2);
  cache.clear();
  assert.equal(cache.bytes, 0);
});

test('LRU evicts CPU and GPU resources together and remains within budget', () => {
  const released: string[] = [];
  const cache = new TileCache((tile) => released.push(tile.key), tileBytes * 4, createCanvas);
  const addresses = planTiles({ ...bounds, width: tilePixels * 4, height: tilePixels }, 1, 4);
  addresses.forEach((address) => cache.get(address));
  cache.get(addresses[0]);
  cache.get({ key: 'extra', scale: 1, bounds: { ...bounds, x: 3000 } });
  assert.deepEqual(released, [addresses[1].key]);
  assert.equal(cache.bytes, tileBytes * 4);
  cache.clear();
  assert.equal(released.length, 5);
});
