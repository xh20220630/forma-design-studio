import { readFileSync } from 'node:fs';

// Public Node-only entry for embedding the design contract in standalone exports.
export function getDesignTypeSource() {
  return readFileSync(new URL('./design.ts', import.meta.url), 'utf8');
}
