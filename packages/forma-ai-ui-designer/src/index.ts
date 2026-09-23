import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const skillSourceDirectory = path.join(moduleDirectory, path.basename(moduleDirectory) === 'dist' ? 'skills/forma-ai-ui-designer' : '../skills/forma-ai-ui-designer');
export const skillVersion = '2.0.0';
export const skillId = 'forma-ai-ui-designer';
