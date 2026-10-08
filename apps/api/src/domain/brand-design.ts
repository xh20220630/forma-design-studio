import type { BrandArtifact, BrandDesign, BrandVector } from '@forma/schema';
import { isRecord, requireValue } from '../shared/errors.ts';

export function brandText(value: unknown, name: string, max = 3000, required = true): string {
  requireValue(
    typeof value === 'string' && value.length <= max,
    `${name}必须为不超过 ${max} 字的文字。`,
  );
  requireValue(!required || value.trim(), `请填写${name}。`);
  return value.trim();
}

export function validateBrandVector(value: unknown): BrandVector {
  requireValue(isRecord(value), '模型没有返回有效的矢量数据。', 502);
  for (const dimension of [value.width, value.height])
    requireValue(
      typeof dimension === 'number' &&
        Number.isFinite(dimension) &&
        dimension >= 32 &&
        dimension <= 4096,
      '矢量画布尺寸应为 32–4096。',
      502,
    );
  requireValue(
    Array.isArray(value.paths) && value.paths.length > 0 && value.paths.length <= 80,
    '矢量图应包含 1–80 条路径。',
    502,
  );
  const paths = value.paths.map((item) => {
    requireValue(isRecord(item), '矢量路径无效。', 502);
    // Restrict the grammar before interpolation into exported SVG attributes.
    requireValue(
      typeof item.d === 'string' &&
        item.d.length <= 20000 &&
        /^[Mm][MmZzLlHhVvCcSsQqTtAa0-9eE.,+\s-]+$/.test(item.d) &&
        /[0-9]/.test(item.d),
      '矢量路径只能包含 SVG 坐标指令。',
      502,
    );
    const numbers = item.d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
    requireValue(
      numbers.every(
        (number) => Number.isFinite(Number(number)) && Math.abs(Number(number)) <= 100000,
      ),
      '矢量坐标超出范围。',
      502,
    );
    requireValue(
      typeof item.fill === 'string' && /^#[0-9a-f]{6}$/i.test(item.fill),
      '矢量路径必须使用六位十六进制颜色。',
      502,
    );
    requireValue(
      item.fillRule === 'nonzero' || item.fillRule === 'evenodd',
      '矢量填充规则无效。',
      502,
    );
    return { d: item.d, fill: item.fill, fillRule: item.fillRule } as BrandVector['paths'][number];
  });
  return { width: value.width as number, height: value.height as number, paths };
}

export function requireBrandArtifact(brand: BrandDesign | undefined, id: unknown) {
  const artifact =
    id === 'latest' ? brand?.artifacts.at(-1) : brand?.artifacts.find((item) => item.id === id);
  requireValue(artifact, '找不到这份品牌设计，请指定对话中已有的作品。', 404);
  return artifact;
}

export function migrateBrandDesign(value: unknown): BrandDesign {
  requireValue(isRecord(value), '品牌设计数据无效。');
  if (Array.isArray(value.artifacts)) return value as unknown as BrandDesign;
  requireValue(Array.isArray(value.revisions), '品牌设计数据无效。');
  return validateBrandDesign({
    artifacts: value.revisions.map((item, index) => ({
      ...(isRecord(item) ? item : {}),
      name: `历史方案 ${index + 1}`,
    })),
    adoptedArtifactId: value.approvedRevisionId,
    legacy: value,
  });
}

export function validateBrandDesign(value: unknown): BrandDesign {
  requireValue(isRecord(value), '品牌设计数据无效。');
  if (!Array.isArray(value.artifacts)) return migrateBrandDesign(value);
  requireValue(value.artifacts.length <= 100, '当前项目已达到 100 份品牌作品上限。');
  const artifacts: BrandArtifact[] = [];
  for (const item of value.artifacts) {
    requireValue(isRecord(item), '品牌作品无效。');
    requireValue(
      typeof item.id === 'string' &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(item.id) &&
        !artifacts.some((entry) => entry.id === item.id),
      '品牌作品 ID 无效或重复。',
    );
    requireValue(
      typeof item.imageUrl === 'string' &&
        /^\/api\/assets\/[a-zA-Z0-9_-]+\.(png|jpeg|webp)$/.test(item.imageUrl),
      '品牌图片必须是本地生成素材。',
    );
    requireValue(
      [item.width, item.height].every(
        (dimension) =>
          typeof dimension === 'number' &&
          Number.isFinite(dimension) &&
          dimension > 0 &&
          dimension <= 100000,
      ),
      '品牌图片尺寸无效。',
    );
    requireValue(
      typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)),
      '品牌作品时间无效。',
    );
    if (item.parentId !== undefined)
      requireValue(
        artifacts.some((entry) => entry.id === item.parentId),
        '品牌修改版本来源无效。',
      );
    artifacts.push({
      id: item.id,
      name: brandText(item.name, '作品名称', 200),
      imageUrl: item.imageUrl,
      width: item.width as number,
      height: item.height as number,
      prompt: brandText(item.prompt, '生成要求', 60000),
      createdAt: item.createdAt,
      ...(item.parentId ? { parentId: item.parentId as string } : {}),
      ...(item.vector ? { vector: validateBrandVector(item.vector) } : {}),
    });
  }
  const brand: BrandDesign = { artifacts };
  if (value.adoptedArtifactId !== undefined)
    brand.adoptedArtifactId = requireBrandArtifact(brand, value.adoptedArtifactId).id;
  if (isRecord(value.legacy)) brand.legacy = value.legacy;
  return brand;
}

export function brandSvg(vector: BrandVector, reverse = false) {
  const checked = validateBrandVector(vector);
  const paths = checked.paths
    .map(
      (path) =>
        `<path d="${path.d}" fill="${reverse ? (path.fill.toUpperCase() === '#FFFFFF' ? '#000000' : '#FFFFFF') : path.fill}" fill-rule="${path.fillRule}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${checked.width}" height="${checked.height}" viewBox="0 0 ${checked.width} ${checked.height}">${paths}</svg>`;
}
