import { readFile } from 'node:fs/promises';

/** 直接读取 PNG 文件头中的尺寸，避免为尺寸检查解码整张图片。 */
function parsePng(buffer: Buffer) {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString() === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
}

/** 扫描 JPEG 标记找到尺寸信息，兼容不同 JPEG 帧头。 */
function parseJpeg(buffer: Buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (length < 2) break;
    offset += length + 2;
  }
}

/** 按 WebP 编码类型读取尺寸，兼容有损、无损和扩展头。 */
function parseWebp(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString() !== 'RIFF' ||
    buffer.subarray(8, 12).toString() !== 'WEBP'
  )
    return;
  const kind = buffer.subarray(12, 16).toString();
  if (kind === 'VP8X')
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  if (kind === 'VP8 ' && buffer.length >= 30)
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
}
/** 按支持的图片格式解析文件头，给页面布局提供真实尺寸。 */
export async function imageSize(file: string) {
  const buffer = await readFile(file);
  const result = parsePng(buffer) || parseJpeg(buffer) || parseWebp(buffer);
  if (!result || result.width <= 0 || result.height <= 0) throw new Error('无法识别图片尺寸。');
  return result;
}
