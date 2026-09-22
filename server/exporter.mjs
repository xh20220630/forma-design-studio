import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError, requireValue } from './errors.mjs';
import { readJson } from './store.mjs';
import { embedLocalAsset } from './assets.mjs';
import { activeProjectTokens } from './design-context.mjs';

export const generatedDirectory = 'forma-generated';
export const hash = content => createHash('sha256').update(content).digest('hex');
const json = value => JSON.stringify(value, null, 2);

const rendererSource = readFileSync(new URL('../src/components/SceneRenderer.tsx', import.meta.url), 'utf8').replace(/^import type .* from '\.\.\/types';\r?\n/m, '');
const typeSource = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
const runtime = `${rendererSource}\n${typeSource}\n
import design from './design.json';
import './tokens.css';

type Interaction = (nodeId: string) => void;
const project = design as unknown as Project;
const pages = project.pages;
const components = project.components;
export function FormaPage({ pageId = pages.find(item => item.prototypeStart)?.id || pages[0]?.id, onAction, style, className = '', mode, variableModes }: { pageId?: string; onAction?: Interaction; style?: React.CSSProperties; className?: string; mode?: string; variableModes?: Record<string,string> }) {
  const [currentPage, setCurrentPage] = React.useState(pageId);
  const [history, setHistory] = React.useState<string[]>([]);
  const [overlay, setOverlay] = React.useState<string>();
  const [transition, setTransition] = React.useState<DesignNode['prototype']>();
  React.useEffect(() => { setCurrentPage(pageId); setHistory([]); setOverlay(undefined); }, [pageId]);
  const activeProject = { ...project, activeMode: mode ?? project.activeMode, activeVariableModes: variableModes ?? project.activeVariableModes };
  const page = pages.find(item => item.id === currentPage);
  if (!page) return null;
  const activate = (node: DesignNode) => {
    onAction?.(node.id);
    const action = node.prototype;
    if (!action) return;
    setTransition(action);
    if (action.action === 'navigate' && action.target && pages.some(item => item.id === action.target)) { setHistory(previous => [...previous, currentPage!]); setCurrentPage(action.target); setOverlay(undefined); }
    if (action.action === 'overlay' && pages.some(item => item.id === action.target)) setOverlay(action.target);
    if (action.action === 'back') { if (overlay) setOverlay(undefined); else { setCurrentPage(history.at(-1) || pageId); setHistory(previous => previous.slice(0, -1)); } }
    if (action.action === 'url' && /^https?:\\/\\//i.test(action.target || '') && typeof window !== 'undefined') window.open(action.target, '_blank', 'noopener,noreferrer');
  };
  const animation = transition?.animation && transition.animation !== 'instant' ? 'forma-' + transition.animation + ' ' + (transition.duration ?? 250) + 'ms ease both' : undefined;
  const overlayPage = pages.find(item => item.id === overlay);
  return <main className={'forma-theme ' + className} data-forma-page={page.id} style={{ ...getThemeStyle(activeProject), position: 'relative', width: page.width, minHeight: page.height, isolation: 'isolate', background: page.background || getProjectTokens(activeProject).background, ...style }}>
    <div key={page.id} style={{ position: 'relative', width: page.width, height: page.height, animation }}>{page.nodes.map(node => <NodeView key={node.id} node={node} nodes={page.nodes} project={activeProject} onClick={activate} />)}</div>
    {overlayPage && <div role="presentation" onClick={() => setOverlay(undefined)} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0005', zIndex: 10000 }}><div role="dialog" aria-modal="true" aria-label={overlayPage.name} onClick={event => event.stopPropagation()} style={{ position: 'relative', width: overlayPage.width, height: overlayPage.height, background: overlayPage.background || getProjectTokens(activeProject).background, animation }}>{overlayPage.nodes.map(node => <NodeView key={node.id} node={node} nodes={overlayPage.nodes} project={activeProject} onClick={activate} />)}</div></div>}
  </main>;
}

export function FormaComponent({ componentId, onAction, style, mode, variableModes }: { componentId: string; onAction?: Interaction; style?: React.CSSProperties; mode?: string; variableModes?: Record<string,string> }) {
  const component = components.find(item => item.id === componentId);
  if (!component) return null;
  const activeProject = { ...project, activeMode: mode ?? project.activeMode, activeVariableModes: variableModes ?? project.activeVariableModes };
  return <div className="forma-theme" data-forma-component={component.id} style={{ ...getThemeStyle(activeProject), position: 'relative', width: component.width, height: component.height, ...style }}>{component.nodes.map(node => <NodeView key={node.id} node={node} nodes={component.nodes} project={activeProject} onClick={node => onAction?.(node.id)} />)}</div>;
}

export const formaProject = { id: design.id, name: design.name, revision: design.revision };
export { design };
`;
export function generateFiles(project) {
  const cssTokens = Object.entries(activeProjectTokens(project)).map(([key, value]) => `  --forma-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}: ${typeof value === 'number' ? `${value}px` : value};`).join('\n');
  const embedded = new Map();
  const portableSurfaces = surfaces => surfaces.map(surface => ({ ...surface, nodes: surface.nodes.map(node => {
    if (!node.src?.startsWith('/api/assets/')) return node;
    if (!embedded.has(node.src)) embedded.set(node.src, embedLocalAsset(node.src));
    return { ...node, src: embedded.get(node.src) };
  }) }));
  const content = { id: project.id, name: project.name, revision: project.revision, tokens: project.tokens, themeModes: project.themeModes, activeMode: project.activeMode, variableCollections: project.variableCollections, activeVariableModes: project.activeVariableModes, pages: portableSurfaces(project.pages), components: portableSurfaces(project.components) };
  const files = [
    { path: 'tokens.css', content: `.forma-theme {\n${cssTokens}\n  color: var(--forma-text);\n  font-family: var(--forma-font-family);\n}\n@keyframes forma-dissolve { from { opacity: 0; } to { opacity: 1; } }\n@keyframes forma-slide { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }\n@media (prefers-reduced-motion: reduce) { .forma-theme * { animation-duration: 0.01ms !important; } }\n` },
    { path: 'design.json', content: `${json(content)}\n` },
    { path: 'index.tsx', content: runtime },
    { path: 'README.md', content: `# ${project.name}\n\nGenerated by Forma. Requires React and TypeScript with resolveJsonModule enabled.\n\nImport { FormaPage, FormaComponent } from './forma-generated';\n\nRender <FormaPage pageId="${project.pages[0]?.id || ''}" onAction={handleNodeAction} />. Navigation, overlays, back actions, safe external URLs, click/hover triggers and basic dissolve/slide transitions are included. onAction also receives the clicked node ID for application behavior.\n\nPass mode="your-mode" and variableModes={{ collectionId: "mode-name" }} to choose saved theme or variable modes. Components use their saved variant IDs and instance overrides. Local PNG/JPEG/WebP/safe SVG images are embedded as data URLs.\n\nThe editor and exported bundle share the same renderer source for shapes, typography, effects, themes and instances. Keep business logic outside this folder. Revisions update these generated files; locally changed files block synchronization.\nThe renderer preserves fixed canvas coordinates. Auto-layout and constraints are applied while editing; responsive breakpoints, live application data, collaborative state and production routing must be implemented in the consuming app. Ancestor clipping uses axis-aligned bounds; rotated frame clipping, advanced vector stroke alignment and arbitrary masks are not supported.\n` },
  ];
  const manifest = { schemaVersion: 1, projectId: project.id, revision: project.revision, files: Object.fromEntries(files.map(file => [file.path, hash(file.content)])) };
  return [...files, { path: 'manifest.json', content: `${json(manifest)}\n` }];
}

export async function validateWorkspacePath(workspacePath) {
  requireValue(typeof workspacePath === 'string' && path.isAbsolute(workspacePath), '工作空间必须是已存在的绝对目录路径。');
  let resolved;
  try { resolved = await realpath(workspacePath); requireValue((await lstat(resolved)).isDirectory(), '工作空间路径必须是目录。'); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, '工作空间目录不存在或无法访问。'); }
  return resolved;
}

async function safeGeneratedRoot(workspacePath) {
  const workspaceRoot = await validateWorkspacePath(workspacePath);
  const generatedRoot = path.join(workspaceRoot, generatedDirectory);
  try {
    const metadata = await lstat(generatedRoot);
    requireValue(metadata.isDirectory() && !metadata.isSymbolicLink(), 'forma-generated 必须是普通目录，不能是符号链接。', 409);
    const resolved = await realpath(generatedRoot);
    requireValue(path.dirname(resolved).toLowerCase() === workspaceRoot.toLowerCase(), '导出目录超出绑定的工作空间。', 409);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return generatedRoot;
}

async function existingFile(root, filename) {
  requireValue(path.basename(filename) === filename, '无效的导出文件路径。');
  const target = path.join(root, filename);
  try {
    const metadata = await lstat(target);
    requireValue(metadata.isFile() && !metadata.isSymbolicLink(), `拒绝覆盖特殊文件：${filename}`, 409);
    return await readFile(target, 'utf8');
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function previewSync(project, { includeBaselines = false } = {}) {
  requireValue(project.workspace?.path, '请先绑定本地目录或 GitHub 仓库。', 409);
  const root = await safeGeneratedRoot(project.workspace.path);
  const oldManifestText = await existingFile(root, 'manifest.json');
  let manifest;
  if (oldManifestText) { try { manifest = JSON.parse(oldManifestText); } catch { throw new ApiError(409, '已有导出清单损坏，请先检查 forma-generated/manifest.json。'); } }
  requireValue(!manifest || manifest.projectId === project.id, '该目录已绑定另一个 Forma 项目，请选择其他工作空间。', 409);
  const files = [];
  const baselines = {};
  for (const file of generateFiles(project)) {
    const before = await existingFile(root, file.path);
    baselines[file.path] = before === null ? null : hash(before);
    let status = before === null ? 'added' : before === file.content ? 'unchanged' : 'modified';
    if (before !== null && file.path !== 'manifest.json' && before !== file.content && (!manifest?.files?.[file.path] || hash(before) !== manifest.files[file.path])) status = 'conflict';
    if (before !== null && file.path === 'manifest.json' && !manifest?.files) status = 'conflict';
    files.push({ ...file, path: `${generatedDirectory}/${file.path}`, status });
  }
  return { files, revision: project.revision, conflicts: files.filter(file => file.status === 'conflict').map(file => file.path), ...(includeBaselines ? { baselines } : {}) };
}

export async function applySync(project) {
  const preview = await previewSync(project, { includeBaselines: true });
  requireValue(!preview.conflicts.length, `同步已停止，以下文件有本地修改：${preview.conflicts.join('、')}`, 409);
  const root = await safeGeneratedRoot(project.workspace.path);
  await mkdir(root, { recursive: true });
  for (const file of preview.files) {
    const filename = path.basename(file.path); const current = await existingFile(root, filename);
    requireValue((current === null ? null : hash(current)) === preview.baselines[filename], `同步期间文件发生变化，已停止：${file.path}`, 409);
  }
  for (const file of preview.files.filter(file => file.status !== 'unchanged')) {
    const filename = path.basename(file.path);
    const temporary = path.join(root, `.${filename}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, file.content, { flag: 'wx' });
      const current = await existingFile(root, filename);
      requireValue((current === null ? null : hash(current)) === preview.baselines[filename], `同步期间文件发生变化，已停止：${file.path}`, 409);
      await rename(temporary, path.join(root, filename));
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  return { files: preview.files, revision: project.revision };
}

export async function hasSyncManifest(project) {
  if (!project.workspace?.path) return false;
  const root = await safeGeneratedRoot(project.workspace.path);
  const manifest = await readJson(path.join(root, 'manifest.json'), null);
  return manifest?.projectId === project.id;
}
