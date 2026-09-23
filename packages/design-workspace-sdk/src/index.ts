import { createHash, randomUUID } from 'node:crypto';
import { watchFile, unwatchFile } from 'node:fs';
import { open, readFile, realpath, rename, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type {
  AnnotationNode,
  ApplyResult,
  ComponentReference,
  DesignComponentSpec,
  Disposable,
  FlowEdge,
  FlowPageNode,
  PageKind,
  Platform,
  ProjectMeta,
  TokenCollection,
  ValidationIssue,
  ValidationReport,
  WorkspaceChangeSet,
  WorkspaceDocument,
  WorkspaceEvent,
  WorkspaceFlow,
  WorkspaceLocalState,
} from '@forma/schema/workbench';

type JsonObject = Record<string, unknown>;

export interface DesignWorkspace {
  read(): Promise<WorkspaceDocument>;
  validate(): Promise<ValidationReport>;
  apply(changeSet: WorkspaceChangeSet): Promise<ApplyResult>;
  watch(listener: (event: WorkspaceEvent) => void): Promise<Disposable>;
  resolveAsset(relativePath: string): Promise<string>;
  readLocalState(): Promise<WorkspaceLocalState>;
  setLocalViewport(flowId: string, viewport: { x: number; y: number; zoom: number }): Promise<WorkspaceLocalState>;
}

export class WorkspaceValidationError extends Error {
  readonly report: ValidationReport;

  constructor(report: ValidationReport) {
    super(report.issues.find(issue => issue.severity === 'error')?.message || '设计资产校验失败。');
    this.name = 'WorkspaceValidationError';
    this.report = report;
  }
}

export class WorkspaceConflictError extends Error {
  readonly currentRevision?: number;
  readonly details?: { baseRevision: number; currentRevision: number; changedFiles: string[] };

  constructor(message: string, currentRevision?: number, details?: { baseRevision: number; currentRevision: number; changedFiles: string[] }) {
    super(message);
    this.name = 'WorkspaceConflictError';
    this.currentRevision = currentRevision;
    this.details = details;
  }
}

export class WorkspaceInputError extends Error {
  constructor(message: string) { super(message); this.name = 'WorkspaceInputError'; }
}

const pageKinds = new Set<PageKind>(['page', 'modal', 'drawer', 'state']);
const platforms = new Set<Platform>(['desktop', 'mobile']);
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semanticVersion = /^(\d+)\.\d+\.\d+(?:[-+].+)?$/;
const supportedImages = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const tokenGroupNames = ['color', 'typography', 'spacing', 'radius', 'shadow', 'layout', 'motion'] as const;
const exitTransitionIntents = new Set(['close', 'cancel', 'success', 'back']);
const transitionIntents = new Set(['open', 'navigate', ...exitTransitionIntents]);
const exitTransitionWords = /(?:关闭|取消|完成|成功|确认|返回|close|cancel|done|success|confirm|back)/i;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return arrayValue(value).filter((item): item is string => typeof item === 'string');
}

function slug(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design-project';
}

async function readJson(file: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!isObject(value)) throw new Error(`${file} 必须包含 JSON 对象。`);
  return value;
}

function parsePng(buffer: Buffer) {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString() === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
}

function parseJpeg(buffer: Buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    if (length < 2) break;
    offset += length + 2;
  }
}

function parseWebp(buffer: Buffer) {
  if (buffer.length < 30 || buffer.subarray(0, 4).toString() !== 'RIFF' || buffer.subarray(8, 12).toString() !== 'WEBP') return;
  const kind = buffer.subarray(12, 16).toString();
  if (kind === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  if (kind === 'VP8 ' && buffer.length >= 30) return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
}

async function imageSize(file: string) {
  const buffer = await readFile(file);
  const result = parsePng(buffer) || parseJpeg(buffer) || parseWebp(buffer);
  if (!result || result.width <= 0 || result.height <= 0) throw new Error('无法识别图片尺寸。');
  return result;
}

function issue(issues: ValidationIssue[], severity: 'error' | 'warning', code: string, file: string, message: string) {
  issues.push({ severity, code, path: file, message });
}

function parseImageRevision(value: unknown, assetPath: string) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  return Number(/-v(\d+)\.[^.]+$/i.exec(assetPath)?.[1] || 1);
}

function normalizeRelativePath(value: string): string | undefined {
  if (!value || path.isAbsolute(value) || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) return;
  const normalized = path.posix.normalize(value);
  if (normalized.startsWith('../') || normalized === '..') return;
  return normalized;
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map(part => Number.parseInt(part, 10));
  const rightParts = right.split('.').map(part => Number.parseInt(part, 10));
  if (leftParts.some(Number.isNaN) || rightParts.some(Number.isNaN)) return left.localeCompare(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function automaticPositions(pages: Array<{ id: string; width: number; height: number }>, transitions: JsonObject[], entryPage: string) {
  const ids = new Set(pages.map(page => page.id));
  const incoming = new Map(pages.map(page => [page.id, 0]));
  const outgoing = new Map(pages.map(page => [page.id, [] as string[]]));
  for (const transition of transitions) {
    const from = stringValue(transition.from).split('/').at(-1) || '';
    const to = stringValue(transition.to).split('/').at(-1) || '';
    if (ids.has(from) && ids.has(to)) {
      outgoing.get(from)?.push(to);
      incoming.set(to, (incoming.get(to) || 0) + 1);
    }
  }
  const levels = new Map<string, number>();
  const queue = ids.has(entryPage) ? [entryPage] : pages.filter(page => (incoming.get(page.id) || 0) === 0).map(page => page.id);
  if (queue.length === 0 && pages[0]) queue.push(pages[0].id);
  for (const id of queue) levels.set(id, 0);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const nextLevel = (levels.get(current) || 0) + 1;
    for (const target of outgoing.get(current) || []) {
      if (!levels.has(target)) { levels.set(target, nextLevel); queue.push(target); }
    }
  }
  let overflowLevel = Math.max(0, ...levels.values()) + 1;
  for (const page of pages) if (!levels.has(page.id)) levels.set(page.id, overflowLevel++);
  const columns = new Map<number, typeof pages>();
  for (const page of pages) {
    const level = levels.get(page.id) || 0;
    const column = columns.get(level) || [];
    column.push(page); columns.set(level, column);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let x = 0;
  for (const [level, column] of [...columns.entries()].sort(([a], [b]) => a - b)) {
    let y = 0;
    let maxWidth = 0;
    for (const page of column) {
      positions.set(page.id, { x, y });
      y += page.height + 320;
      maxWidth = Math.max(maxWidth, page.width);
    }
    x += maxWidth + 520 + level * 0;
  }
  return positions;
}

class FileDesignWorkspace implements DesignWorkspace {
  private readonly root: string;

  private constructor(root: string) { this.root = root; }

  static async open(root: string) {
    const resolved = await realpath(path.resolve(root));
    return new FileDesignWorkspace(resolved);
  }

  private async safeFile(relativePath: string, issues?: ValidationIssue[], code = 'invalid-path') {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) {
      if (issues) issue(issues, 'error', code, relativePath || '<empty>', '路径必须是设计根目录内的安全相对路径。');
      throw new Error('路径必须是设计根目录内的安全相对路径。');
    }
    const file = path.resolve(this.root, ...normalized.split('/'));
    const relative = path.relative(this.root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('路径越出设计根目录。');
    return { file, normalized };
  }

  async resolveAsset(relativePath: string) {
    const { file } = await this.safeFile(relativePath);
    const resolved = await realpath(file);
    const relative = path.relative(this.root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('资源通过符号链接越出设计根目录。');
    return resolved;
  }

  private localStateFile() { return path.join(this.root, '..', '.forma', 'local-state.json'); }

  async readLocalState(): Promise<WorkspaceLocalState> {
    try {
      const raw = await readJson(this.localStateFile());
      const viewportsRaw = isObject(raw.viewports) ? raw.viewports : {};
      const viewports: WorkspaceLocalState['viewports'] = {};
      for (const [flowId, value] of Object.entries(viewportsRaw)) if (safeId.test(flowId) && isObject(value)) {
        const zoom = numberValue(value.zoom, 0.35);
        if (Number.isFinite(value.x) && Number.isFinite(value.y) && zoom >= 0.05 && zoom <= 4) viewports[flowId] = { x: numberValue(value.x), y: numberValue(value.y), zoom };
      }
      return { schemaVersion: 1, ...(isObject(raw.skills) ? { skills: raw.skills } : {}), viewports };
    } catch { return { schemaVersion: 1, viewports: {} }; }
  }

  async setLocalViewport(flowId: string, viewport: { x: number; y: number; zoom: number }) {
    if (!safeId.test(flowId) || !Number.isFinite(viewport.x) || !Number.isFinite(viewport.y) || !Number.isFinite(viewport.zoom) || viewport.zoom < 0.05 || viewport.zoom > 4) throw new WorkspaceInputError('本机视口数据无效。');
    const document = await this.read();
    if (!document.flows.some(flow => flow.id === flowId)) throw new WorkspaceInputError(`流程不存在：${flowId}`);
    const state = await this.readLocalState();
    const next = { ...state, viewports: { ...state.viewports, [flowId]: viewport } };
    const file = this.localStateFile();
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, file);
    return next;
  }

  private async load(): Promise<{ document?: WorkspaceDocument; report: ValidationReport }> {
    const issues: ValidationIssue[] = [];
    let projectRaw: JsonObject;
    let tokensRaw: JsonObject;
    let componentsRaw: JsonObject;
    let flowsRaw: JsonObject;
    try {
      [projectRaw, tokensRaw, componentsRaw, flowsRaw] = await Promise.all([
        readJson(path.join(this.root, 'project.json')),
        readJson(path.join(this.root, 'tokens.json')),
        readJson(path.join(this.root, 'components/index.json')),
        readJson(path.join(this.root, 'flows/index.json')),
      ]);
    } catch (error) {
      issue(issues, 'error', 'missing-root-contract', '.', error instanceof Error ? error.message : '无法读取设计根契约。');
      return { report: { valid: false, issues } };
    }

    const projectSchema = numberValue(projectRaw.schema_version, 1) === 2 ? 2 : 1;
    const projectName = stringValue(projectRaw.name, 'Untitled design');
    const themeRaw = isObject(projectRaw.theme) ? projectRaw.theme : {};
    const project: ProjectMeta = {
      schemaVersion: projectSchema,
      revision: numberValue(projectRaw.revision, 0),
      id: stringValue(projectRaw.id, slug(projectName)),
      name: projectName,
      theme: {
        id: stringValue(themeRaw.id, 'default'),
        version: stringValue(themeRaw.version, '0.0.0'),
        status: themeRaw.status === 'approved' ? 'approved' : 'draft',
        confirmation: stringValue(themeRaw.confirmation),
        designPath: stringValue(themeRaw.design_path, 'DESIGN.md'),
        tokensPath: stringValue(themeRaw.tokens_path, 'tokens.json'),
        ...(typeof themeRaw.anchor_image === 'string' ? { anchorImage: themeRaw.anchor_image } : {}),
      },
    };
    if (!safeId.test(project.id)) issue(issues, 'error', 'invalid-project-id', 'project.json', '项目 ID 必须使用小写字母、数字和连字符。');
    for (const [label, relative] of [['DESIGN', project.theme.designPath], ['Tokens', project.theme.tokensPath]] as const) {
      try { await readFile((await this.safeFile(relative, issues)).file); }
      catch { issue(issues, 'error', 'missing-project-resource', relative, `${label} 资源不存在。`); }
    }
    if (project.theme.anchorImage) {
      try { await this.resolveAsset(project.theme.anchorImage); }
      catch { issue(issues, 'error', 'invalid-anchor-image', project.theme.anchorImage, '主题锚点图片不存在或路径不安全。'); }
    }

    const tokenValues = isObject(tokensRaw.tokens) ? tokensRaw.tokens : {};
    if (numberValue(tokensRaw.schema_version, 1) === 2) {
      for (const group of tokenGroupNames) {
        if (!isObject(tokenValues[group])) issue(issues, 'error', 'missing-token-group', 'tokens.json', `v2 Tokens 必须包含对象分组：${group}`);
      }
    }
    const tokens: TokenCollection = {
      schemaVersion: numberValue(tokensRaw.schema_version, 1) === 2 ? 2 : 1,
      themeVersion: stringValue(tokensRaw.theme_version, project.theme.version),
      tokens: {
        color: isObject(tokenValues.color) ? tokenValues.color : {},
        typography: isObject(tokenValues.typography) ? tokenValues.typography : {},
        spacing: isObject(tokenValues.spacing) ? tokenValues.spacing : {},
        radius: isObject(tokenValues.radius) ? tokenValues.radius : {},
        shadow: isObject(tokenValues.shadow) ? tokenValues.shadow : {},
        layout: isObject(tokenValues.layout) ? tokenValues.layout : {},
        motion: isObject(tokenValues.motion) ? tokenValues.motion : {},
      },
    };

    const components: DesignComponentSpec[] = [];
    const componentKeys = new Set<string>();
    for (const value of arrayValue(componentsRaw.components)) {
      if (!isObject(value)) continue;
      const id = stringValue(value.id), version = stringValue(value.version), specPath = stringValue(value.spec_path);
      const key = `${id}@${version}`;
      const versionMatch = semanticVersion.exec(version);
      if (!safeId.test(id) || !versionMatch || !specPath) {
        issue(issues, 'error', 'invalid-component', 'components/index.json', '组件必须包含有效 ID、语义化版本和规范路径。');
        continue;
      }
      if (numberValue(componentsRaw.schema_version, 1) === 2 && specPath !== `components/${id}/v${versionMatch[1]}.md`) {
        issue(issues, 'error', 'invalid-component-spec-path', 'components/index.json', `v2 组件规范路径必须为 components/${id}/v${versionMatch[1]}.md。`);
      }
      if (componentKeys.has(key)) issue(issues, 'error', 'duplicate-component', 'components/index.json', `组件版本重复：${key}`);
      componentKeys.add(key);
      let specContent = '';
      try { specContent = await readFile(await this.resolveAsset(specPath), 'utf8'); }
      catch { issue(issues, 'error', 'missing-component-spec', specPath, `组件规范不存在：${key}`); }
      components.push({
        id, version, name: stringValue(value.name, id),
        status: value.status === 'deprecated' ? 'deprecated' : value.status === 'approved' ? 'approved' : 'draft',
        scope: stringArray(value.scope), excludes: stringArray(value.excludes), tags: stringArray(value.tags), specPath, specContent,
      });
    }

    const flowEntries = arrayValue(flowsRaw.flows).filter(isObject);
    const flowIds = new Set(flowEntries.map(value => stringValue(value.id)).filter(Boolean));
    const relatedByFlow = new Map(flowEntries.map(value => [stringValue(value.id), new Set(stringArray(value.related_flows))]));
    const pageRefs = new Set<string>();
    const flows: WorkspaceFlow[] = [];
    for (const entry of flowEntries) {
      const flowId = stringValue(entry.id);
      const flowPath = stringValue(entry.path);
      if (!safeId.test(flowId) || !flowPath) {
        issue(issues, 'error', 'invalid-flow', 'flows/index.json', '流程必须包含有效 ID 和路径。');
        continue;
      }
      for (const related of stringArray(entry.related_flows)) if (!flowIds.has(related)) issue(issues, 'error', 'missing-related-flow', 'flows/index.json', `关联流程不存在：${related}`);
      let flowRaw: JsonObject;
      try { flowRaw = await readJson((await this.safeFile(flowPath, issues)).file); }
      catch (error) { issue(issues, 'error', 'missing-flow', flowPath, error instanceof Error ? error.message : '流程文件无法读取。'); continue; }
      const flowSchema = numberValue(flowRaw.schema_version, 1) === 2 ? 2 : 1;
      if (stringValue(flowRaw.id, flowId) !== flowId) issue(issues, 'error', 'flow-id-mismatch', flowPath, `流程文件 ID 与索引不一致：${stringValue(flowRaw.id)}`);
      const briefPath = stringValue(flowRaw.brief_path);
      let brief: WorkspaceFlow['brief'];
      if (briefPath) {
        try { brief = { path: briefPath, content: await readFile(await this.resolveAsset(briefPath), 'utf8') }; }
        catch { issue(issues, 'error', 'missing-flow-brief', briefPath, `流程 BRIEF 不存在：${flowId}`); }
      } else if (flowSchema === 2) issue(issues, 'error', 'missing-flow-brief', flowPath, `v2 流程必须声明 brief_path：${flowId}`);
      const pagesRaw = arrayValue(flowRaw.pages).filter(isObject);
      const transitionsRaw = arrayValue(flowRaw.transitions).filter(isObject);
      const layoutPath = stringValue(entry.layout_path, `flows/${flowId}/layout.json`);
      let layoutRaw: JsonObject = {};
      try { layoutRaw = await readJson((await this.safeFile(layoutPath)).file); } catch { /* layout is optional */ }
      const layoutNodes = isObject(layoutRaw.nodes) ? layoutRaw.nodes : {};
      const pageDimensions = pagesRaw.map(page => ({ id: stringValue(page.id), width: numberValue(page.width), height: numberValue(page.height) }));
      const positions = automaticPositions(pageDimensions, transitionsRaw, stringValue(flowRaw.entry_page));
      const nodes: FlowPageNode[] = [];
      const localPageIds = new Set<string>();
      for (const pageRaw of pagesRaw) {
        const pageId = stringValue(pageRaw.id);
        const pageRef = `${flowId}/${pageId}`;
        const pageFile = `${flowPath}#${pageId}`;
        if (!safeId.test(pageId)) issue(issues, 'error', 'invalid-page-id', pageFile, `页面 ID 无效：${pageId}`);
        if (localPageIds.has(pageId)) issue(issues, 'error', 'duplicate-page', pageFile, `页面 ID 重复：${pageId}`);
        localPageIds.add(pageId); pageRefs.add(pageRef);
        const kind = stringValue(pageRaw.kind, 'page') as PageKind;
        const platform = stringValue(pageRaw.platform, 'desktop') as Platform;
        if (!pageKinds.has(kind)) issue(issues, 'error', 'invalid-page-kind', pageFile, `页面类型无效：${kind}`);
        if (!platforms.has(platform)) issue(issues, 'error', 'invalid-platform', pageFile, `平台无效：${platform}`);
        const parent = typeof pageRaw.parent === 'string' ? pageRaw.parent : undefined;
        if (kind !== 'page' && !parent) issue(issues, 'error', 'missing-parent', pageFile, `${kind} 必须声明 parent。`);
        const assetPath = stringValue(pageRaw.image);
        const ext = path.extname(assetPath).toLowerCase();
        if (!supportedImages.has(ext)) issue(issues, 'error', 'unsupported-image', pageFile, `不支持的图片格式：${ext || '<none>'}`);
        let intrinsic = { width: 0, height: 0 };
        try { intrinsic = await imageSize(await this.resolveAsset(assetPath)); }
        catch (error) { issue(issues, 'error', 'invalid-image', assetPath, error instanceof Error ? error.message : '图片无法读取。'); }
        const width = numberValue(pageRaw.width, intrinsic.width), height = numberValue(pageRaw.height, intrinsic.height);
        if (intrinsic.width && (width !== intrinsic.width || height !== intrinsic.height)) {
          issue(issues, 'error', 'image-size-mismatch', pageFile, `记录尺寸 ${width}×${height} 与图片实际尺寸 ${intrinsic.width}×${intrinsic.height} 不一致。`);
        }
        const componentUsage: ComponentReference[] = [];
        for (const usage of arrayValue(pageRaw.component_usage)) {
          if (!isObject(usage)) continue;
          const reference = { id: stringValue(usage.id), version: stringValue(usage.version), adaptation: stringValue(usage.adaptation) };
          componentUsage.push(reference);
          if (!componentKeys.has(`${reference.id}@${reference.version}`)) issue(issues, 'error', 'missing-component-version', pageFile, `组件版本不存在：${reference.id}@${reference.version}`);
        }
        const annotations: AnnotationNode[] = [];
        const annotationIds = new Set<string>();
        for (const annotation of arrayValue(pageRaw.annotations)) {
          if (!isObject(annotation)) continue;
          const annotationId = stringValue(annotation.id);
          if (!annotationId || annotationIds.has(annotationId)) issue(issues, 'error', 'duplicate-annotation', pageFile, `标注 ID 缺失或重复：${annotationId}`);
          annotationIds.add(annotationId);
          const coordinates = ['x', 'y', 'label_x', 'label_y'].map(key => numberValue(annotation[key], -1));
          if (coordinates.some(coordinate => coordinate < 0 || coordinate > 1)) issue(issues, 'error', 'invalid-annotation-position', pageFile, `标注坐标必须位于 0–1：${annotationId}`);
          annotations.push({
            id: annotationId, label: stringValue(annotation.label), text: stringValue(annotation.text),
            x: coordinates[0], y: coordinates[1], labelX: coordinates[2], labelY: coordinates[3],
            ...(typeof annotation.target === 'string' ? { target: annotation.target } : {}),
          });
        }
        const autoPosition = positions.get(pageId) || { x: 0, y: 0 };
        const savedPosition = isObject(layoutNodes[pageId]) ? layoutNodes[pageId] : {};
        const imageRevision = parseImageRevision(pageRaw.image_revision, assetPath);
        const promptPath = typeof pageRaw.prompt_path === 'string' ? pageRaw.prompt_path : undefined;
        if (promptPath) {
          try { await readFile((await this.safeFile(promptPath, issues)).file); }
          catch { issue(issues, 'error', 'missing-page-prompt', promptPath, `页面 Prompt 不存在：${pageRef}`); }
        } else if (flowSchema === 2) issue(issues, 'warning', 'missing-page-prompt', pageFile, `v2 页面未声明 prompt_path：${pageRef}`);
        for (const referenceImage of stringArray(pageRaw.reference_images)) {
          try { await this.resolveAsset(referenceImage); }
          catch { issue(issues, 'error', 'invalid-reference-image', referenceImage, `参考图不存在或路径不安全：${pageRef}`); }
        }
        nodes.push({
          id: pageRef, pageRef, name: stringValue(pageRaw.name, pageId), goal: stringValue(pageRaw.goal),
          kind: pageKinds.has(kind) ? kind : 'page', platform: platforms.has(platform) ? platform : 'desktop', ...(parent ? { parent } : {}),
          frame: { x: numberValue(savedPosition.x, autoPosition.x), y: numberValue(savedPosition.y, autoPosition.y), width, height },
          image: { id: `${pageRef}/image`, type: 'image', assetPath, width, height, intrinsicWidth: intrinsic.width, intrinsicHeight: intrinsic.height, locked: true },
          annotations, componentUsage,
          imageRevision, themeVersion: stringValue(flowRaw.theme_version, project.theme.version),
          ...(promptPath ? { promptPath } : {}),
        });
      }
      const entryPage = stringValue(flowRaw.entry_page);
      if (!localPageIds.has(entryPage)) issue(issues, 'error', 'missing-entry-page', flowPath, `入口页面不存在：${entryPage}`);
      const transitionIds = new Set<string>();
      const edges: FlowEdge[] = transitionsRaw.map((transition, index) => {
        const from = stringValue(transition.from), to = stringValue(transition.to);
        const explicitId = stringValue(transition.id);
        const intent = stringValue(transition.intent);
        const id = explicitId || `${from}-to-${to}` || `${flowId}/transition-${index + 1}`;
        if (flowSchema === 2 && !safeId.test(explicitId)) issue(issues, 'error', 'invalid-transition-id', flowPath, `v2 transition 必须包含有效 ID：${explicitId || '<empty>'}`);
        if (intent && !transitionIntents.has(intent)) issue(issues, 'error', 'invalid-transition-intent', flowPath, `transition intent 无效：${intent}`);
        if (transitionIds.has(id)) issue(issues, 'error', 'duplicate-transition', flowPath, `transition ID 重复：${id}`);
        transitionIds.add(id);
        return {
          id, from, to,
          trigger: stringValue(transition.trigger), condition: stringValue(transition.condition), effect: stringValue(transition.effect),
          crossFlow: from.split('/')[0] !== to.split('/')[0],
          ...(transitionIntents.has(intent) ? { intent: intent as FlowEdge['intent'] } : {}),
        };
      });
      const viewport = isObject(layoutRaw.viewport) ? layoutRaw.viewport : undefined;
      flows.push({
        id: flowId, name: stringValue(flowRaw.name, stringValue(entry.name, flowId)), goal: stringValue(flowRaw.goal),
        sourcePath: flowPath, ...(brief ? { brief } : {}),
        entryPage, consistencyNotes: stringArray(flowRaw.consistency_notes), nodes, edges,
        ...(viewport ? { defaultViewport: { x: numberValue(viewport.x), y: numberValue(viewport.y), zoom: numberValue(viewport.zoom, 0.35) } } : {}),
      });
    }

    for (const flow of flows) {
      for (const edge of flow.edges) {
        if (!pageRefs.has(edge.from)) issue(issues, 'error', 'missing-transition-source', `flows/${flow.id}/flow.json`, `转场起点不存在：${edge.from}`);
        if (!pageRefs.has(edge.to)) issue(issues, 'error', 'missing-transition-target', `flows/${flow.id}/flow.json`, `转场目标不存在：${edge.to}`);
        const targetFlow = edge.to.split('/')[0];
        if (edge.crossFlow && !relatedByFlow.get(flow.id)?.has(targetFlow)) issue(issues, 'error', 'unregistered-cross-flow', `flows/${flow.id}/flow.json`, `跨流程目标未登记在 related_flows：${targetFlow}`);
      }
      for (const node of flow.nodes) {
        if (node.parent && !pageRefs.has(node.parent)) issue(issues, 'error', 'missing-parent-target', `flows/${flow.id}/flow.json`, `父页面不存在：${node.parent}`);
        if (node.kind === 'modal' || node.kind === 'drawer') {
          const hasExit = flow.edges.some(edge => {
            if (edge.from !== node.pageRef) return false;
            return exitTransitionIntents.has(edge.intent || '') || exitTransitionWords.test(`${edge.trigger} ${edge.effect}`);
          });
          if (!hasExit) issue(issues, 'error', 'missing-close-transition', `flows/${flow.id}/flow.json`, `${node.kind} ${node.pageRef} 缺少关闭、取消、成功或返回转场。`);
        }
        for (const annotation of node.annotations) if (annotation.target && !pageRefs.has(annotation.target)) issue(issues, 'error', 'missing-annotation-target', `flows/${flow.id}/flow.json`, `标注目标不存在：${annotation.target}`);
      }
    }

    const latestComponents = new Map<string, DesignComponentSpec>();
    for (const component of components) {
      if (component.status !== 'approved') continue;
      const current = latestComponents.get(component.id);
      if (!current || compareVersions(component.version, current.version) > 0) latestComponents.set(component.id, component);
    }
    const impacts = flows.flatMap(flow => flow.nodes.flatMap(node => {
      const reasons: WorkspaceDocument['designSystem']['impacts'][number]['reasons'] = [];
      if (node.themeVersion !== tokens.themeVersion) reasons.push({
        type: 'tokens', subject: tokens.themeVersion, fromVersion: node.themeVersion, toVersion: tokens.themeVersion,
        message: `页面主题 ${node.themeVersion} 落后于当前 Tokens ${tokens.themeVersion}。`,
      });
      for (const usage of node.componentUsage) {
        const latest = latestComponents.get(usage.id);
        if (latest && latest.version !== usage.version) reasons.push({
          type: 'component', subject: usage.id, fromVersion: usage.version, toVersion: latest.version,
          message: `${usage.id} 已从 ${usage.version} 更新为 ${latest.version}。`,
        });
      }
      return reasons.length ? [{ pageRef: node.pageRef, reasons }] : [];
    }));
    const report = { valid: !issues.some(item => item.severity === 'error'), issues };
    const document: WorkspaceDocument = { project, designSystem: { tokens, components, impacts }, flows, revision: project.revision };
    return { document, report };
  }

  async read() {
    const loaded = await this.load();
    if (!loaded.report.valid || !loaded.document) throw new WorkspaceValidationError(loaded.report);
    return loaded.document;
  }

  async validate() {
    return (await this.load()).report;
  }

  private async acquireLock() {
    const directory = path.join(this.root, '..', '.forma');
    await mkdir(directory, { recursive: true });
    const lockPath = path.join(directory, 'write.lock');
    try {
      const handle = await open(lockPath, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      await handle.close();
      return lockPath;
    } catch (error) {
      if (isObject(error) && error.code === 'EEXIST') throw new WorkspaceConflictError('设计工作区正在被另一个进程写入。');
      throw error;
    }
  }

  private async commit(files: Map<string, JsonObject | string>) {
    const staged: Array<{ target: string; temporary: string; backup: string; relative: string; backedUp: boolean; committed: boolean }> = [];
    try {
      for (const [relative, value] of files) {
        const { file: target } = await this.safeFile(relative);
        await mkdir(path.dirname(target), { recursive: true });
        const temporary = `${target}.${randomUUID()}.tmp`;
        await writeFile(temporary, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 });
        staged.push({ target, temporary, backup: `${target}.${randomUUID()}.backup`, relative, backedUp: false, committed: false });
      }
      staged.sort((a, b) => Number(a.relative === 'project.json') - Number(b.relative === 'project.json'));
      for (const item of staged) {
        try { await rename(item.target, item.backup); item.backedUp = true; }
        catch (error) { if (!isObject(error) || error.code !== 'ENOENT') throw error; }
        await rename(item.temporary, item.target);
        item.committed = true;
      }
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      for (const item of [...staged].reverse()) {
        try {
          if (item.committed) await rm(item.target, { force: true });
          if (item.backedUp) await rename(item.backup, item.target);
        } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      }
      if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], '设计资产提交失败，且回滚未完整完成。');
      throw error;
    } finally {
      await Promise.all(staged.map(item => rm(item.temporary, { force: true })));
    }
    await Promise.all(staged.map(item => rm(item.backup, { force: true })));
  }

  async apply(changeSet: WorkspaceChangeSet): Promise<ApplyResult> {
    const rawChangeSet: unknown = changeSet;
    if (!isObject(rawChangeSet) || !Number.isInteger(rawChangeSet.baseRevision) || numberValue(rawChangeSet.baseRevision, -1) < 0 || !Array.isArray(rawChangeSet.operations)) {
      throw new WorkspaceInputError('ChangeSet 必须包含非负整数 baseRevision 和 operations 数组。');
    }
    for (const operation of rawChangeSet.operations) {
      if (!isObject(operation)) throw new WorkspaceInputError('存在无效的工作区操作。');
      if (operation.type === 'set-component-spec' || operation.type === 'set-flow-brief') {
        if (typeof operation.content !== 'string' || typeof operation.expectedContent !== 'string') throw new WorkspaceInputError('文档操作必须包含正文和编辑前的正文。');
        if (operation.type === 'set-component-spec' && (typeof operation.componentId !== 'string' || typeof operation.version !== 'string')) throw new WorkspaceInputError('组件操作必须指定组件和版本。');
        if (operation.type === 'set-flow-brief' && typeof operation.flowId !== 'string') throw new WorkspaceInputError('流程文档操作必须指定流程。');
      } else if (operation.type === 'update-annotation') {
        if (typeof operation.flowId !== 'string' || typeof operation.pageId !== 'string' || !isObject(operation.expectedAnnotation)) throw new WorkspaceInputError('标注操作必须指定流程、页面和编辑前的标注。');
        const annotation = operation.annotation;
        if (!isObject(annotation) || typeof annotation.id !== 'string' || typeof annotation.label !== 'string' || !annotation.label.trim() || typeof annotation.text !== 'string' || (annotation.target !== undefined && typeof annotation.target !== 'string')) throw new WorkspaceInputError('标注必须包含 ID、标题和正文。');
        if (['x', 'y', 'labelX', 'labelY'].some(key => typeof annotation[key] !== 'number' || !Number.isFinite(annotation[key]) || numberValue(annotation[key], -1) < 0 || numberValue(annotation[key], 2) > 1)) throw new WorkspaceInputError('标注坐标必须位于 0–1。');
      } else if (operation.type === 'set-node-position' || operation.type === 'set-default-viewport') {
        if (typeof operation.flowId !== 'string' || !Number.isFinite(operation.x) || !Number.isFinite(operation.y)) throw new WorkspaceInputError('布局操作必须包含有效流程和有限坐标。');
        if (operation.type === 'set-node-position' && typeof operation.pageId !== 'string') throw new WorkspaceInputError('节点位置操作必须包含 pageId。');
        if (operation.type === 'set-default-viewport' && (!Number.isFinite(operation.zoom) || numberValue(operation.zoom) < 0.05 || numberValue(operation.zoom) > 4)) throw new WorkspaceInputError('视口缩放必须位于 0.05–4。');
      } else throw new WorkspaceInputError('存在无效的工作区操作。');
    }
    const lockPath = await this.acquireLock();
    try {
      const document = await this.read();
      if (changeSet.baseRevision !== document.revision) {
        let changedFiles: string[] = [];
        try {
          const revisionRaw = await readJson(path.join(this.root, 'revisions/index.json'));
          changedFiles = [...new Set(arrayValue(revisionRaw.revisions).filter(isObject).filter(entry => numberValue(entry.revision) > changeSet.baseRevision).flatMap(entry => stringArray(entry.files)))];
        } catch { changedFiles = ['project.json']; }
        const details = { baseRevision: changeSet.baseRevision, currentRevision: document.revision, changedFiles };
        throw new WorkspaceConflictError(`设计版本已从 ${changeSet.baseRevision} 更新为 ${document.revision}${changedFiles.length ? `；已变更：${changedFiles.join('、')}` : ''}。`, document.revision, details);
      }
      const projectRaw = await readJson(path.join(this.root, 'project.json'));
      const files = new Map<string, JsonObject | string>();
      for (const operation of changeSet.operations) {
        if (operation.type === 'set-component-spec' || operation.type === 'set-flow-brief') {
          const component = operation.type === 'set-component-spec' ? document.designSystem.components.find(item => item.id === operation.componentId && item.version === operation.version) : undefined;
          const brief = operation.type === 'set-flow-brief' ? document.flows.find(item => item.id === operation.flowId)?.brief : undefined;
          const relative = component?.specPath || brief?.path;
          if (!relative || path.extname(relative).toLowerCase() !== '.md') throw new WorkspaceInputError('未找到可编辑的 Markdown 文档。');
          const currentContent = await readFile(await this.resolveAsset(relative), 'utf8');
          if (currentContent !== operation.expectedContent) throw new WorkspaceConflictError('文档已被其他操作修改，请重新载入后再编辑。', document.revision);
          files.set(relative, operation.content);
          continue;
        }
        const flowId = operation.flowId;
        if (operation.type === 'update-annotation') {
          const flow = document.flows.find(item => item.id === flowId);
          const node = flow?.nodes.find(item => item.pageRef === `${flowId}/${operation.pageId}`);
          const current = node?.annotations.find(item => item.id === operation.annotation.id);
          if (!flow || !current) throw new WorkspaceInputError('待编辑的标注不存在。');
          const keys: (keyof AnnotationNode)[] = ['id', 'label', 'text', 'x', 'y', 'labelX', 'labelY', 'target'];
          if (keys.some(key => current[key] !== operation.expectedAnnotation[key])) throw new WorkspaceConflictError('标注已被其他操作修改，请重新载入后再编辑。', document.revision);
          const annotation = operation.annotation;
          if (annotation.target && !document.flows.some(item => item.nodes.some(page => page.pageRef === annotation.target))) throw new WorkspaceInputError('标注跳转目标不存在。');
          const pending = files.get(flow.sourcePath);
          const raw = isObject(pending) ? pending : await readJson(await this.resolveAsset(flow.sourcePath));
          const page = arrayValue(raw.pages).find(item => isObject(item) && item.id === operation.pageId);
          if (!isObject(page)) throw new WorkspaceInputError('标注所在页面不存在。');
          page.annotations = arrayValue(page.annotations).map(item => isObject(item) && item.id === annotation.id ? {
            ...item, label: annotation.label, text: annotation.text, x: annotation.x, y: annotation.y,
            label_x: annotation.labelX, label_y: annotation.labelY, target: annotation.target || null,
          } : item);
          files.set(flow.sourcePath, raw);
          continue;
        }
        const indexRaw = await readJson(path.join(this.root, 'flows/index.json'));
        const flowIndex = arrayValue(indexRaw.flows).find(value => isObject(value) && value.id === flowId);
        if (!isObject(flowIndex)) throw new Error(`流程不存在：${flowId}`);
        const layoutRelative = stringValue(flowIndex.layout_path, `flows/${flowId}/layout.json`);
        const pendingLayout = files.get(layoutRelative);
        let layoutRaw = isObject(pendingLayout) ? pendingLayout : undefined;
        if (!layoutRaw) {
          try { layoutRaw = await readJson((await this.safeFile(layoutRelative)).file); }
          catch { layoutRaw = { schema_version: 1, flow_id: flowId, nodes: {} }; }
        }
        if (operation.type === 'set-node-position') {
          const flow = document.flows.find(item => item.id === flowId);
          if (!flow?.nodes.some(node => node.pageRef === `${flowId}/${operation.pageId}`)) throw new Error(`页面不存在：${flowId}/${operation.pageId}`);
          const nodes = isObject(layoutRaw.nodes) ? layoutRaw.nodes : {};
          nodes[operation.pageId] = { x: operation.x, y: operation.y };
          layoutRaw.nodes = nodes;
        } else {
          layoutRaw.viewport = { x: operation.x, y: operation.y, zoom: operation.zoom };
        }
        files.set(layoutRelative, layoutRaw);
      }
      const nextRevision = document.revision + 1;
      projectRaw.schema_version = 2;
      projectRaw.revision = nextRevision;
      projectRaw.id = stringValue(projectRaw.id, document.project.id);
      const revisionFiles = [...new Set([...files.keys(), 'project.json'])];
      let revisionsRaw: JsonObject;
      try { revisionsRaw = await readJson(path.join(this.root, 'revisions/index.json')); }
      catch { revisionsRaw = { schema_version: 1, revisions: [] }; }
      revisionsRaw.revisions = [...arrayValue(revisionsRaw.revisions), {
        revision: nextRevision,
        created_at: new Date().toISOString(),
        source: 'ai-design-workbench',
        operations: changeSet.operations.map(operation => operation.type),
        files: revisionFiles,
      }];
      files.set('revisions/index.json', revisionsRaw);
      files.set('project.json', projectRaw);
      await this.commit(files);
      const next = await this.read();
      return { revision: nextRevision, document: next, changedFiles: [...files.keys()] };
    } finally {
      await rm(lockPath, { force: true });
    }
  }

  async watch(listener: (event: WorkspaceEvent) => void): Promise<Disposable> {
    const file = path.join(this.root, 'project.json');
    let revision = (await this.read()).revision;
    const handler = async () => {
      try {
        const next = numberValue((await readJson(file)).revision, 0);
        if (next !== revision) { revision = next; listener({ type: 'revision', revision: next }); }
      } catch { /* ignore transient writes; project.json is the commit marker */ }
    };
    watchFile(file, { interval: 250, persistent: false }, handler);
    return { async dispose() { unwatchFile(file, handler); } };
  }
}

export async function openDesignWorkspace(options: { root: string }): Promise<DesignWorkspace> {
  return FileDesignWorkspace.open(options.root);
}

export async function checksumDirectory(root: string) {
  const { readdir } = await import('node:fs/promises');
  const hash = createHash('sha256');
  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === '.forma-skill.json') continue;
      const file = path.join(directory, entry.name);
      const relative = path.relative(root, file).split(path.sep).join('/');
      hash.update(relative);
      if (entry.isDirectory()) await visit(file); else hash.update(await readFile(file));
    }
  }
  await visit(root);
  return `sha256:${hash.digest('hex')}`;
}
