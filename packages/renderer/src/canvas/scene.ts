import type { DesignComponent, DesignNode, DesignPage, Project } from '@forma/schema';
import { resolveNode } from '../shared/scene-values.ts';
import {
  identity,
  inverse,
  multiply,
  nodeMatrix,
  SpatialIndex,
  transformedBounds,
  type Bounds,
  type Matrix,
} from './geometry.ts';

export interface SceneClip {
  node: DesignNode;
  matrix: Matrix;
  inverse: Matrix;
}

export interface SceneEntry {
  node: DesignNode;
  target: DesignNode;
  matrix: Matrix;
  inverse: Matrix;
  bounds: Bounds;
  clips: SceneClip[];
  opacity: number;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface SceneChanges {
  full: boolean;
  bounds: Bounds[];
  added: SceneEntry[];
  removed: SceneEntry[];
}

/** 索引属于编译器的当前场景；下一次 compile 后不能把旧结果作为历史快照查询。 */
export interface CanvasScene {
  entries: SceneEntry[];
  index: SpatialIndex<SceneEntry>;
  nodes: Map<string, SceneEntry>;
  changes?: SceneChanges;
  prototypes?: SceneEntry[];
  revision?: number;
}

interface CachedEntry {
  input: DesignNode;
  parent?: SceneEntry;
  base: Matrix;
  entry: SceneEntry;
  order: number;
}

function compileEntry(
  node: DesignNode,
  input: DesignNode,
  base: Matrix,
  parent?: SceneEntry,
  inherited?: SceneEntry,
): SceneEntry | undefined {
  const ancestor = parent ?? inherited;
  const parentMatrix = parent
    ? multiply(parent.matrix, [1, 0, 0, 1, -parent.node.x, -parent.node.y])
    : base;
  const matrix = multiply(parentMatrix, nodeMatrix(node));
  const inv = inverse(matrix);
  if (!inv || ![node.x, node.y, node.width, node.height].every(Number.isFinite)) return;
  let clips = ancestor?.clips ?? [];
  if (ancestor?.node.clipContent)
    clips = [
      ...clips,
      {
        node: ancestor.node,
        matrix: ancestor.matrix,
        inverse: ancestor.inverse,
      },
    ];
  const shadow = node.shadow;
  const padding =
    Math.max(0, node.strokeWidth ?? 0) +
    (node.blur ?? 0) * 3 +
    (shadow
      ? Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) + shadow.blur * 3 + Math.abs(shadow.spread)
      : 0);
  return {
    node,
    target: inherited?.target ?? input,
    matrix,
    inverse: inv,
    clips,
    bounds: transformedBounds(matrix, {
      x: -padding,
      y: -padding,
      width: node.width + padding * 2,
      height: node.height + padding * 2,
    }),
    opacity: (ancestor?.opacity ?? 1) * (node.opacity ?? 1),
    visible: (ancestor?.visible ?? true) && node.visible !== false,
    locked: (ancestor?.locked ?? false) || Boolean(node.locked),
    order: 0,
  };
}

/** 保留节点和索引，只替换变化节点及受祖先变换影响的后代。 */
export class SceneCompiler {
  private resolved = new WeakMap<DesignNode, DesignNode>();
  private instances = new WeakMap<
    DesignNode,
    { component: DesignComponent; nodes: DesignNode[] }
  >();
  private records = new Map<string, CachedEntry>();
  private index = new SpatialIndex<SceneEntry>();
  private dependencies: unknown[] = [];
  private inputs?: DesignNode[];
  private pageId?: string;
  private scene?: CanvasScene;
  private revision = 0;
  private parents = new Set<string>();

  // 常见拖拽/样式编辑保持拓扑不变，只替换叶节点；结构变化仍走完整层级解析。
  private updateLeaves(page: DesignPage, project: Project): CanvasScene | undefined {
    const current = this.scene;
    if (!current || !this.inputs || page.nodes.length !== this.inputs.length) return;
    const updates: { key: string; cached: CachedEntry; input: DesignNode; entry: SceneEntry }[] =
      [];
    for (let i = 0; i < page.nodes.length; i++) {
      const input = page.nodes[i],
        old = this.inputs[i];
      if (input === old) continue;
      if (
        input.id !== old.id ||
        this.parents.has(input.id) ||
        input.parentId !== old.parentId ||
        input.type === 'component' ||
        old.type === 'component' ||
        input.prototype !== old.prototype ||
        input.visible !== old.visible
      )
        return;
      const key = JSON.stringify([input.id]);
      const cached = this.records.get(key);
      if (!cached?.entry.visible) return;
      const node = resolveNode(input, project);
      if (node.parentId !== cached.entry.node.parentId || node.type === 'component') return;
      const entry = compileEntry(node, input, identity, cached.parent);
      if (!entry || entry.visible !== cached.entry.visible) return;
      entry.order = cached.order;
      updates.push({ key, cached, input, entry });
    }
    if (!updates.length) {
      this.inputs = page.nodes;
      return current;
    }
    const changes: SceneChanges = {
      full: updates.length > 256,
      bounds: [],
      added: [],
      removed: [],
    };
    const entries = current.entries.slice();
    const nodes = new Map(current.nodes);
    for (const { key, cached, input, entry } of updates) {
      this.index.remove(cached.entry);
      this.index.insert(entry);
      entries[entry.order] = entry;
      nodes.set(input.id, entry);
      this.records.set(key, { ...cached, input, entry });
      this.resolved.set(input, entry.node);
      changes.added.push(entry);
      changes.removed.push(cached.entry);
      if (!changes.full) changes.bounds.push(cached.entry.bounds, entry.bounds);
    }
    this.inputs = page.nodes;
    this.scene = {
      ...current,
      entries,
      nodes,
      changes,
      prototypes: current.prototypes?.map((entry) => nodes.get(entry.node.id)!),
      revision: ++this.revision,
    };
    return this.scene;
  }

  compile(page: DesignPage, project: Project): CanvasScene {
    const dependencies = [
      project.tokens,
      project.themeModes,
      project.activeMode,
      project.variableCollections,
      project.activeVariableModes,
      project.components,
    ];
    const full =
      page.id !== this.pageId ||
      dependencies.some((value, index) => value !== this.dependencies[index]);
    if (!full && this.inputs === page.nodes && this.scene) return this.scene;
    if (!full) {
      const updated = this.updateLeaves(page, project);
      if (updated) return updated;
    }
    if (full) {
      this.resolved = new WeakMap();
      this.instances = new WeakMap();
    }
    const resolve = (input: DesignNode) => {
      let node = this.resolved.get(input);
      if (!node) {
        node = resolveNode(input, project);
        this.resolved.set(input, node);
      }
      return node;
    };
    const previous = this.records;
    const records = new Map<string, CachedEntry>();
    const changes: SceneChanges = { full, bounds: [], added: [], removed: [] };
    const scene: CanvasScene = {
      entries: [],
      index: this.index,
      nodes: new Map(),
      prototypes: [],
      changes,
      revision: ++this.revision,
    };
    const dirty = (bounds: Bounds) => {
      if (changes.full) return;
      // 大批量修改直接失效所有块，避免变化区域与缓存块两两比较。
      if (changes.bounds.length >= 512) {
        changes.full = true;
        changes.bounds = [];
      } else changes.bounds.push(bounds);
    };
    const components = new Map(project.components.map((component) => [component.id, component]));
    const append = (
      inputs: DesignNode[],
      base: Matrix,
      prefix: string[],
      inherited?: SceneEntry,
      depth = 0,
    ) => {
      const byId = new Map(inputs.map((node) => [node.id, node]));
      const computed = new Map<string, SceneEntry>();
      const visiting = new Set<string>();
      const entryFor = (input: DesignNode): SceneEntry | undefined => {
        if (computed.has(input.id)) return computed.get(input.id);
        if (visiting.has(input.id) || visiting.size >= 256) return;
        visiting.add(input.id);
        const node = resolve(input);
        const parentInput = node.parentId ? byId.get(node.parentId) : undefined;
        const parent = parentInput ? entryFor(parentInput) : undefined;
        const ancestor = parent ?? inherited;
        const key = JSON.stringify([...prefix, input.id]);
        const cached = previous.get(key);
        let entry: SceneEntry;
        if (
          !full &&
          cached?.input === input &&
          cached.parent === ancestor &&
          cached.base.every((value, index) => value === base[index])
        ) {
          entry = cached.entry;
        } else {
          const compiled = compileEntry(node, input, base, parent, inherited);
          if (!compiled) {
            visiting.delete(input.id);
            return;
          }
          entry = compiled;
        }
        visiting.delete(input.id);
        computed.set(input.id, entry);
        records.set(key, { input, parent: ancestor, base, entry, order: -1 });
        return entry;
      };
      for (const input of inputs) {
        const entry = entryFor(input);
        if (!entry) continue;
        if (!inherited) scene.nodes.set(input.id, entry);
        if (!entry.visible) continue;
        const key = JSON.stringify([...prefix, input.id]);
        const cached = previous.get(key);
        entry.order = scene.entries.length;
        records.get(key)!.order = entry.order;
        scene.entries.push(entry);
        if (!inherited && entry.node.prototype) scene.prototypes!.push(entry);
        if (cached?.entry !== entry || cached.order !== entry.order) dirty(entry.bounds);
        if (cached?.entry !== entry || !cached.entry.visible) {
          this.index.insert(entry);
          changes.added.push(entry);
        }
        const component = components.get(entry.node.componentId ?? '');
        if (
          entry.node.type === 'component' &&
          component &&
          depth < 16 &&
          component.width > 0 &&
          component.height > 0
        ) {
          let instance = this.instances.get(entry.node);
          if (!instance || instance.component !== component) {
            instance = {
              component,
              nodes: component.nodes.map((child) => ({
                ...resolve(child),
                ...entry.node.overrides?.[child.id],
                ...(entry.node.overrides?.[child.id]?.fill !== undefined
                  ? { gradient: undefined }
                  : {}),
                tokenBindings: undefined,
                variableBindings: undefined,
              })),
            };
            this.instances.set(entry.node, instance);
          }
          append(
            instance.nodes,
            multiply(entry.matrix, [
              entry.node.width / component.width,
              0,
              0,
              entry.node.height / component.height,
              0,
              0,
            ]),
            [...prefix, input.id],
            entry,
            depth + 1,
          );
        }
      }
    };
    append(page.nodes, identity, []);
    for (const [key, cached] of previous) {
      if (cached.entry !== records.get(key)?.entry && cached.entry.visible) {
        this.index.remove(cached.entry);
        changes.removed.push(cached.entry);
        dirty(cached.entry.bounds);
      }
    }
    this.records = records;
    this.parents = new Set(
      [...scene.nodes.values()].flatMap(({ node }) => (node.parentId ? [node.parentId] : [])),
    );
    this.dependencies = dependencies;
    this.inputs = page.nodes;
    this.pageId = page.id;
    this.scene = scene;
    return scene;
  }
}
