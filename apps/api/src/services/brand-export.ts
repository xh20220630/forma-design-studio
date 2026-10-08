import type { Project } from '@forma/schema';
import { brandSvg, requireBrandArtifact } from '../domain/brand-design.ts';
import { requireValue } from '../shared/errors.ts';

export function brandExportFiles(project: Project, artifactId: unknown) {
  const artifact = requireBrandArtifact(project.brandDesign, artifactId);
  requireValue(artifact.vector, '这份作品还没有矢量稿，可以在聊天中让 AI 转为 SVG。', 409);
  return [
    { name: 'logo.svg', content: brandSvg(artifact.vector) },
    { name: 'logo-reverse.svg', content: brandSvg(artifact.vector, true) },
    { name: 'brand-source.json', content: JSON.stringify(artifact, null, 2) },
    {
      name: 'README.md',
      content: `# ${artifact.name}\n\n${artifact.prompt}\n\n包含原色 SVG、单色反白 SVG 和该作品的源数据。矢量稿是独立版本，可与原图比较后继续通过聊天调整。\n`,
    },
  ];
}

/** Uncompressed ZIP keeps UTF-8 design sources portable without another runtime dependency. */
export function zipBrandFiles(files: { name: string; content: string }[]) {
  const local: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const data = Buffer.from(file.content);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    header.copy(entry, 6, 4, 30);
    entry.writeUInt32LE(offset, 42);
    directory.push(entry, name);
    offset += header.length + name.length + data.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, central, end]);
}
