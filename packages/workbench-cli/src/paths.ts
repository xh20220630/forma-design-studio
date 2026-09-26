import { fileURLToPath } from 'node:url';

// 源码模块与打包后的 CLI 都位于包根目录下一层，保持资源定位一致。
export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
