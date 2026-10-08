import type { BrandVector } from '@forma/schema';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function vectorBlob(vector: BrandVector, reverse = false) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('width', String(vector.width));
  svg.setAttribute('height', String(vector.height));
  svg.setAttribute('viewBox', `0 0 ${vector.width} ${vector.height}`);
  for (const item of vector.paths) {
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', item.d);
    path.setAttribute(
      'fill',
      reverse ? (item.fill.toUpperCase() === '#FFFFFF' ? '#000000' : '#FFFFFF') : item.fill,
    );
    path.setAttribute('fill-rule', item.fillRule);
    svg.appendChild(path);
  }
  return new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
}

export function downloadBrandSvg(vector: BrandVector, name: string) {
  downloadBlob(vectorBlob(vector), `${name}-logo.svg`);
}

export async function downloadBrandPng(vector: BrandVector, name: string) {
  const url = URL.createObjectURL(vectorBlob(vector));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const scale = 1024 / Math.max(vector.width, vector.height);
    canvas.width = Math.max(1, Math.round(vector.width * scale));
    canvas.height = Math.max(1, Math.round(vector.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法导出 PNG，请下载 SVG 交付包。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG 导出失败。'))),
        'image/png',
      ),
    );
    downloadBlob(blob, `${name}-logo.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadBrandPackage(projectId: string, artifactId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/brand/export?artifactId=${encodeURIComponent(artifactId)}`,
  );
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || '交付包下载失败。');
  }
  downloadBlob(await response.blob(), `${projectId}-brand.zip`);
}
