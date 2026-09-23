import type { DesignNode, DesignPage, Project } from '@forma/schema';
import { resolveNode } from '../scene-values.ts';
import { identity, inverse, multiply, nodeMatrix, SpatialIndex, transformedBounds, type Bounds, type Matrix } from './geometry.ts';

export interface SceneClip { node: DesignNode; matrix: Matrix; inverse: Matrix }
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
export interface CanvasScene {
  entries: SceneEntry[];
  index: SpatialIndex<SceneEntry>;
  nodes: Map<string, SceneEntry>;
}

// Keep resolved node identities stable for path/text caches when only the camera or selection changes.
export class SceneCompiler {
  private resolved = new WeakMap<DesignNode, DesignNode>();
  private geometry = new WeakMap<DesignNode, { parent?: SceneEntry; base: Matrix; entry: SceneEntry }>();
  private dependencies: unknown[] = [];

  compile(page: DesignPage, project: Project): CanvasScene {
    const dependencies = [project.tokens, project.themeModes, project.activeMode,
      project.variableCollections, project.activeVariableModes, project.components];
    if (dependencies.some((value, index) => value !== this.dependencies[index])) {
      this.resolved = new WeakMap();
      this.geometry = new WeakMap();
      this.dependencies = dependencies;
    }
    const resolve = (input: DesignNode) => {
      let node = this.resolved.get(input);
      if (!node) { node = resolveNode(input, project); this.resolved.set(input, node); }
      return node;
    };
    const scene: CanvasScene = { entries: [], index: new SpatialIndex(), nodes: new Map() };
    const components = new Map(project.components.map(component => [component.id, component]));
    const append = (inputs: DesignNode[], base: Matrix, inherited?: SceneEntry, depth = 0) => {
      const byId = new Map(inputs.map(node => [node.id, node]));
      const computed = new Map<string, SceneEntry>();
      const visiting = new Set<string>();
      const entryFor = (input: DesignNode): SceneEntry | undefined => {
        if (computed.has(input.id)) return computed.get(input.id);
        // Imported malformed hierarchies must not hang the renderer.
        if (visiting.has(input.id) || visiting.size >= 256) return;
        visiting.add(input.id);
        const node = resolve(input);
        const parentInput = node.parentId ? byId.get(node.parentId) : undefined;
        const parent = parentInput ? entryFor(parentInput) : undefined;
        const ancestor = parent ?? inherited;
        const cached = this.geometry.get(input);
        if (cached && cached.parent === ancestor && cached.base === base) {
          visiting.delete(input.id);
          computed.set(input.id, cached.entry);
          return cached.entry;
        }
        const parentMatrix = parent
          ? multiply(parent.matrix, [1, 0, 0, 1, -parent.node.x, -parent.node.y]) : base;
        const matrix = multiply(parentMatrix, nodeMatrix(node));
        const inv = inverse(matrix);
        visiting.delete(input.id);
        if (!inv || ![node.x, node.y, node.width, node.height].every(Number.isFinite)) return;
        let clips = ancestor?.clips ?? [];
        if (ancestor?.node.clipContent) clips = [...clips, { node: ancestor.node, matrix: ancestor.matrix, inverse: ancestor.inverse }];
        const shadow = node.shadow;
        const padding = Math.max(0, node.strokeWidth ?? 0) + (node.blur ?? 0) * 3 +
          (shadow ? Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) + shadow.blur * 3 + Math.abs(shadow.spread) : 0);
        const bounds = transformedBounds(matrix, { x: -padding, y: -padding, width: node.width + padding * 2, height: node.height + padding * 2 });
        const entry: SceneEntry = { node, target: inherited?.target ?? input, matrix, inverse: inv, bounds, clips,
          opacity: (ancestor?.opacity ?? 1) * (node.opacity ?? 1), visible: (ancestor?.visible ?? true) && node.visible !== false,
          locked: (ancestor?.locked ?? false) || Boolean(node.locked), order: 0 };
        computed.set(input.id, entry);
        this.geometry.set(input, { parent: ancestor, base, entry });
        return entry;
      };
      for (const input of inputs) {
        const entry = entryFor(input);
        if (!entry) continue;
        if (!inherited) scene.nodes.set(input.id, entry);
        if (!entry.visible) continue;
        entry.order = scene.entries.length;
        scene.entries.push(entry);
        scene.index.insert(entry);
        const component = components.get(entry.node.componentId ?? '');
        if (entry.node.type === 'component' && component && depth < 16 && component.width > 0 && component.height > 0) {
          const children = component.nodes.map(child => ({ ...resolve(child), ...entry.node.overrides?.[child.id],
            ...(entry.node.overrides?.[child.id]?.fill !== undefined ? { gradient: undefined } : {}),
            tokenBindings: undefined, variableBindings: undefined }));
          append(children, multiply(entry.matrix, [entry.node.width / component.width, 0, 0, entry.node.height / component.height, 0, 0]), entry, depth + 1);
        }
      }
    };
    append(page.nodes, identity);
    return scene;
  }
}
