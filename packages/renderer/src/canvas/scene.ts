import type { DesignNode, DesignPage, Project } from '@forma/schema';
import { resolveNode } from '../scene-values.ts';
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

/** 祖先裁剪形状及其正逆变换，用于绘制和精确命中检测。 */
export interface SceneClip {
  /** 当前处理的设计节点。 */
  node: DesignNode;
  /** 将节点局部坐标转换到画布空间的矩阵。 */
  matrix: Matrix;
  /** 从画布空间还原到节点局部空间的逆矩阵。 */
  inverse: Matrix;
}
/** 编译后的节点绘制条目，包含继承状态、实际变换与交互目标。 */
export interface SceneEntry {
  /** 当前处理的设计节点。 */
  node: DesignNode;
  /** 操作作用的目标。 */
  target: DesignNode;
  /** 将节点局部坐标转换到画布空间的矩阵。 */
  matrix: Matrix;
  /** 从画布空间还原到节点局部空间的逆矩阵。 */
  inverse: Matrix;
  /** 用于布局、查询或素材定位的矩形范围。 */
  bounds: Bounds;
  /** 从祖先继承的裁剪区域序列。 */
  clips: SceneClip[];
  /** 不透明度，0 为完全透明，1 为完全不透明。 */
  opacity: number;
  /** 是否显示；节点缺省时按可见处理，还会受到祖先可见性的约束。 */
  visible: boolean;
  /** 是否锁定编辑；锁定容器也会限制其子节点操作。 */
  locked: boolean;
  /** 场景中的绘制顺序，也用于从上层向下进行命中检测。 */
  order: number;
}
/** 一帧可复用的场景数据，包含绘制顺序、节点查找表和空间索引。 */
export interface CanvasScene {
  /** 按绘制顺序排列的场景条目。 */
  entries: SceneEntry[];
  /** 空间查询索引或当前条目的位置。 */
  index: SpatialIndex<SceneEntry>;
  /** 按约定顺序保存的设计节点集合。 */
  nodes: Map<string, SceneEntry>;
}

// Keep resolved node identities stable for path/text caches when only the camera or selection changes.
/** 把设计数据转换为场景并复用稳定对象，减少相机或选择变化时的计算。 */
export class SceneCompiler {
  /** 已解析主题与变量的节点缓存，或评论的解决状态。 */
  private resolved = new WeakMap<DesignNode, DesignNode>();
  /** 按原节点缓存的变换和场景条目。 */
  private geometry = new WeakMap<
    DesignNode,
    {
      /** 父级对象或页面引用。 */
      parent?: SceneEntry;
      /** 当前层级继承的基础变换或比较基线。 */
      base: Matrix;
      /** 缓存的已编译场景条目。 */
      entry: SceneEntry;
    }
  >();
  /** 上次编译使用的主题、变量与组件引用，变化时需清空相关缓存。 */
  private dependencies: unknown[] = [];

  /**
   * 展开节点层级与组件实例，并复用未变化的几何对象以提高交互帧率。
   *
   * @param page - 当前正在展示或编辑的页面。
   * @param project - 当前设计项目或工作空间项目元信息。
   * @returns 包含绘制顺序、节点映射和空间索引的场景。
   */
  compile(page: DesignPage, project: Project): CanvasScene {
    const dependencies = [
      project.tokens,
      project.themeModes,
      project.activeMode,
      project.variableCollections,
      project.activeVariableModes,
      project.components,
    ];
    if (
      dependencies.some(
        /** 检查取值不等于的dependencies中指定项，供集合筛选或定位使用。 @param value - 当前字段、模式或控件的取值。 @param index - 空间查询索引或当前条目的位置。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (value, index) => value !== this.dependencies[index],
      )
    ) {
      this.resolved = new WeakMap();
      this.geometry = new WeakMap();
      this.dependencies = dependencies;
    }
    /**
     * 复用节点属性解析结果，避免相机或选择变化时破坏绘图缓存。
     *
     * @param input - 当前步骤需要处理的输入。
     * @returns 应用主题和变量后的节点。
     */
    const resolve = (input: DesignNode) => {
      let node = this.resolved.get(input);
      if (!node) {
        node = resolveNode(input, project);
        this.resolved.set(input, node);
      }
      return node;
    };
    const scene: CanvasScene = { entries: [], index: new SpatialIndex(), nodes: new Map() };
    const components = new Map(
      project.components.map(
        /** 转换 compile 中的集合条目，供后续处理或展示。 @param component - 当前组件母版或组件规范。 @returns 当前条目转换后的结果。 */
        (component) => [component.id, component],
      ),
    );
    /**
     * 递归展开节点与组件实例，继承透明度、裁剪和交互目标。
     *
     * @param inputs - 当前递归层需要处理的节点集合。
     * @param base - 当前层级继承的基础变换或比较基线。
     * @param inherited - 从父层或组件实例继承的场景条目。
     * @param depth - 当前递归层级，用于控制缩进或限制展开深度。
     * @returns 无返回值；向当前场景追加条目。
     */
    const append = (inputs: DesignNode[], base: Matrix, inherited?: SceneEntry, depth = 0) => {
      const byId = new Map(
        inputs.map(
          /** 转换 append 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
          (node) => [node.id, node],
        ),
      );
      const computed = new Map<string, SceneEntry>();
      const visiting = new Set<string>();
      /**
       * 沿祖先链计算场景条目并拦截循环引用，避免畸形层级卡住渲染。
       *
       * @param input - 当前步骤需要处理的输入。
       * @returns 计算或缓存的场景条目；无效几何返回 undefined。
       */
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
          ? multiply(parent.matrix, [1, 0, 0, 1, -parent.node.x, -parent.node.y])
          : base;
        const matrix = multiply(parentMatrix, nodeMatrix(node));
        const inv = inverse(matrix);
        visiting.delete(input.id);
        if (!inv || ![node.x, node.y, node.width, node.height].every(Number.isFinite)) return;
        let clips = ancestor?.clips ?? [];
        if (ancestor?.node.clipContent)
          clips = [
            ...clips,
            { node: ancestor.node, matrix: ancestor.matrix, inverse: ancestor.inverse },
          ];
        const shadow = node.shadow;
        const padding =
          Math.max(0, node.strokeWidth ?? 0) +
          (node.blur ?? 0) * 3 +
          (shadow
            ? Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) +
              shadow.blur * 3 +
              Math.abs(shadow.spread)
            : 0);
        const bounds = transformedBounds(matrix, {
          x: -padding,
          y: -padding,
          width: node.width + padding * 2,
          height: node.height + padding * 2,
        });
        const entry: SceneEntry = {
          node,
          target: inherited?.target ?? input,
          matrix,
          inverse: inv,
          bounds,
          clips,
          opacity: (ancestor?.opacity ?? 1) * (node.opacity ?? 1),
          visible: (ancestor?.visible ?? true) && node.visible !== false,
          locked: (ancestor?.locked ?? false) || Boolean(node.locked),
          order: 0,
        };
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
        if (
          entry.node.type === 'component' &&
          component &&
          depth < 16 &&
          component.width > 0 &&
          component.height > 0
        ) {
          const children = component.nodes.map(
            /**
             * 转换 append 中的集合条目，供后续处理或展示。
             *
             * @param child - 当前处理的子节点。
             * @returns 当前条目转换后的结果。
             */
            (child) => ({
              ...resolve(child),
              ...entry.node.overrides?.[child.id],
              ...(entry.node.overrides?.[child.id]?.fill !== undefined
                ? { gradient: undefined }
                : {}),
              tokenBindings: undefined,
              variableBindings: undefined,
            }),
          );
          append(
            children,
            multiply(entry.matrix, [
              entry.node.width / component.width,
              0,
              0,
              entry.node.height / component.height,
              0,
              0,
            ]),
            entry,
            depth + 1,
          );
        }
      }
    };
    append(page.nodes, identity);
    return scene;
  }
}
