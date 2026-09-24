import { imageSize } from 'image-size';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataRoot } from './store.ts';
import { ApiError, requireValue } from './errors.ts';

/**
 * 从图片字节读取真实格式和尺寸，避免依赖模型宣称的尺寸。
 *
 * @param bytes - 图片或文件的原始字节。
 * @returns 图片宽高、扩展名和 MIME 类型。
 */
export function imageMetadata(bytes: Uint8Array) {
  let metadata;
  try {
    metadata = imageSize(bytes);
  } catch {
    throw new ApiError(502, '图片内容无效，无法读取实际尺寸。');
  }
  requireValue(
    ['png', 'jpg', 'webp'].includes(metadata.type || '') &&
      metadata.width > 0 &&
      metadata.height > 0,
    '图片必须是有效的 PNG/JPEG/WebP。',
    502,
  );
  return {
    width: metadata.width,
    height: metadata.height,
    extension: metadata.type === 'jpg' ? 'jpeg' : metadata.type!,
    mime: metadata.type === 'jpg' ? 'image/jpeg' : `image/${metadata.type}`,
  };
}
/**
 * 读取模型返回的图片并限制下载体积，按真实格式保存到本地素材目录。
 *
 * @param projectId - 动作、会话或记录所属项目的标识。
 * @param result - 上一步操作得到的结果。
 * @returns 本地素材地址、实际宽高和 MIME 类型。
 */
export async function saveGeneratedMedia(
  projectId: string,
  result: {
    /** 上游直接返回的 Base64 图片内容。 */
    b64_json?: string;
    /** 资源或服务的访问地址。 */
    url?: string;
  },
) {
  let bytes: Buffer;
  if (result.b64_json) {
    requireValue(result.b64_json.length < 40000000, '生成图片文件过大。', 502);
    bytes = Buffer.from(result.b64_json, 'base64');
  } else {
    let url: URL;
    try {
      url = new URL(result.url || '');
    } catch {
      throw new ApiError(502, '模型返回了无效图片地址。');
    }
    requireValue(url.protocol === 'https:', '模型返回的图片必须使用 HTTPS。', 502);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(45000),
        redirect: 'error',
      });
    } catch {
      throw new ApiError(502, '无法下载生成的图片。');
    }
    requireValue(
      response.ok && Number(response.headers.get('content-length') || 0) < 30000000,
      '无法下载图片或图片文件过大。',
      502,
    );
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body!) {
      size += chunk.length;
      requireValue(size < 30000000, '生成图片文件过大。', 502);
      chunks.push(chunk);
    }
    bytes = Buffer.concat(chunks);
  }
  const metadata = imageMetadata(bytes);
  const filename = `${projectId}-${randomUUID()}.${metadata.extension}`;
  await mkdir(path.join(dataRoot, 'assets'), { recursive: true });
  await writeFile(path.join(dataRoot, 'assets', filename), bytes);
  return {
    url: `/api/assets/${filename}`,
    width: metadata.width,
    height: metadata.height,
    mime: metadata.mime,
  };
}
