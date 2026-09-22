import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dataRoot } from './store.mjs';
import { ApiError, requireValue } from './errors.mjs';

export function localAssetFilename(source) {
  requireValue(typeof source === 'string' && /^\/api\/assets\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,240}\.(?:png|jpe?g|webp|svg)$/.test(source), '本地图片地址必须是 /api/assets/ 下的单个 PNG、JPEG、WebP 或 SVG 文件名。');
  return source.slice('/api/assets/'.length);
}

export function validateSafeSvg(source) {
  requireValue(typeof source === 'string' && source.length <= 2000000 && /<svg(?:\s|>)/i.test(source), 'SVG 格式无效或过大。');
  requireValue(!/<!(?:DOCTYPE|ENTITY)|<\?|javascript:|data:|url\(\s*[^#]|\bon\w+\s*=|\b(?:href|style)\s*=/i.test(source), 'SVG 不允许脚本、事件、外部资源或内联样式。');
  const allowed = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'title', 'desc']);
  for (const match of source.matchAll(/<\/?([\w:-]+)\b/g)) requireValue(allowed.has(match[1]), `SVG 不支持元素 ${match[1]}。`);
  return source;
}

export function embedLocalAsset(source) {
  const filename = localAssetFilename(source);
  const directory = path.join(dataRoot, 'assets');
  const target = path.join(directory, filename);
  try {
    const directoryInfo = lstatSync(directory);
    const fileInfo = lstatSync(target);
    requireValue(directoryInfo.isDirectory() && !directoryInfo.isSymbolicLink() && fileInfo.isFile() && !fileInfo.isSymbolicLink(), `图片资源不能使用符号链接：${filename}`, 409);
    requireValue(fileInfo.size <= 30000000, `图片资源过大，无法导出：${filename}`, 409);
    const bytes = readFileSync(target);
    const mime = filename.endsWith('.svg') ? 'image/svg+xml' : filename.endsWith('.webp') ? 'image/webp' : /\.jpe?g$/.test(filename) ? 'image/jpeg' : 'image/png';
    const valid = mime === 'image/svg+xml' ? validateSafeSvg(bytes.toString('utf8')) : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    requireValue(valid, `图片资源内容与格式不匹配：${filename}`, 409);
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(409, `本地图片资源不存在或无法读取，请重新添加图片：${filename}`);
  }
}
