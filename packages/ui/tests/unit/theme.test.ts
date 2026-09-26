import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultStudioSettings } from '../../src/theme/presets.ts';
import {
  normalizeStudioAccent,
  parseStoredStudioSettings,
  sanitizeStudioSettings,
} from '../../src/theme/settings.ts';
import { createStudioTokens } from '../../src/theme/tokens.ts';

test('theme settings normalize colors and recover from invalid or incompatible storage', () => {
  assert.equal(normalizeStudioAccent(' #ABC '), '#aabbcc');
  assert.equal(normalizeStudioAccent('url(example)'), undefined);
  assert.deepEqual(parseStoredStudioSettings('{invalid'), defaultStudioSettings);
  assert.deepEqual(
    parseStoredStudioSettings(JSON.stringify({ version: 2, settings: { preset: 'midnight' } })),
    defaultStudioSettings,
  );
  assert.deepEqual(
    sanitizeStudioSettings({ preset: 'unknown', accent: 'invalid', radius: 'unknown' }),
    defaultStudioSettings,
  );
  const settings = parseStoredStudioSettings(
    JSON.stringify({ version: 1, settings: { preset: 'midnight', accent: '#abc' } }),
  );
  assert.equal(settings.preset, 'midnight');
  assert.equal(settings.accent, '#aabbcc');
});

test('theme token generation remains independent of React and browser storage', () => {
  const normal = createStudioTokens(defaultStudioSettings);
  assert.equal(normal['--studio-control-radius'], '8px');
  assert.equal(normal['--studio-motion-duration'], '180ms');
  const compact = createStudioTokens({
    ...defaultStudioSettings,
    preset: 'midnight',
    radius: 'compact',
    density: 'compact',
    motion: 'off',
  });
  assert.equal(compact['--studio-control-radius'], '4px');
  assert.equal(compact['--studio-row-height'], '34px');
  assert.equal(compact['--studio-motion-duration'], '0ms');
  assert.notEqual(compact['--studio-surface'], normal['--studio-surface']);
});
