import { useStudioMotion } from "../lib/motion";
import { motion, AnimatePresence } from "motion/react";
import { RinIcon, RinIllustration } from "./brand/RinBrand";
import { StudioSequence } from "./motion/StudioSequence";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Copy,
  Diamond,
  Layers3,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Variable,
} from "lucide-react";
import type {
  DesignComponent,
  DesignNode,
  DesignTemplate,
  DesignVariable,
  Project,
  ThemeTokens,
  VariableCollection,
} from "@forma/schema";
import { Button } from "@forma/ui/button";
import { Input } from "@forma/ui/input";
import { Textarea } from "@forma/ui/textarea";
import { Badge } from "@forma/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@forma/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@forma/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@forma/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@forma/ui/dropdown-menu";
import { Switch } from "@forma/ui/switch";
import ProjectPreview, { DesignNodeVisual } from "./ProjectPreview";
import { getProjectTokens, resolveNode } from "@forma/renderer";
import { applyAutoLayout } from "@forma/editor-core/geometry";
import "./library.css";

interface ProjectViewProps {
  project: Project;
  onChange: (project: Project) => void;
}
const themeLabels: Record<string, string> = {
  moss: "自然",
  midnight: "深色",
  paper: "编辑",
  tide: "海岸",
  studio: "工作台",
  iris: "柔和",
};

function updated(project: Project, changes: Partial<Project>): Project {
  const next: Project = {
    ...project,
    ...changes,
    status: "in-progress",
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  if (
    [
      "tokens",
      "themeModes",
      "activeMode",
      "variableCollections",
      "activeVariableModes",
    ].some((key) => key in changes)
  ) {
    next.tokens = getProjectTokens(next);
    const applyBindings = (nodes: DesignNode[]) => {
      let result = nodes.map((node) => resolveNode(node, next));
      const depth = (node: DesignNode) => {
        let level = 0;
        let parent = node.parentId;
        const visited = new Set<string>();
        while (parent && !visited.has(parent)) {
          visited.add(parent);
          level++;
          parent = result.find((item) => item.id === parent)?.parentId;
        }
        return level;
      };
      const frames = result
        .filter((node) => node.layout && node.layout !== "none")
        .sort((a, b) => depth(b) - depth(a));
      for (const frame of frames) result = applyAutoLayout(result, frame.id);
      return result;
    };
    next.pages = next.pages.map((page) => ({
      ...page,
      nodes: applyBindings(page.nodes),
    }));
    next.components = next.components.map((component) => ({
      ...component,
      nodes: applyBindings(component.nodes),
    }));
  }
  return next;
}
function bindNode(node: DesignNode, tokens: ThemeTokens): DesignNode {
  const bound = { ...node };
  for (const [property, token] of Object.entries(node.tokenBindings ?? {})) {
    if (property === "fill" || property === "color")
      bound[property] = String(tokens[token]);
    if (property === "radius" || property === "fontSize" || property === "gap")
      bound[property] = Number(tokens[token]);
  }
  return bound;
}
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function LibrarySurface({ children }: { children: ReactNode }) {
  const { reduced, expressive, transition } = useStudioMotion();
  return (
    <motion.section
      className="wk-view"
      initial={reduced ? false : { opacity: 0, y: expressive ? 12 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
    >
      {children}
    </motion.section>
  );
}
function LibraryEmpty({ children }: { children: ReactNode }) {
  const { reduced, expressive, transition } = useStudioMotion();
  return (
    <motion.div
      className="wk-empty"
      initial={reduced ? false : { opacity: 0, y: expressive ? 12 : 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="wk-heading">
      <div>
        <h1>
          <RinIcon
            kind={title === "组件库" ? "components" : "tokens"}
            size={24}
            variant="sculptural"
          />
          {title}
        </h1>
        <p>{description}</p>
      </div>
      <div className="wk-actions">{children}</div>
    </header>
  );
}
function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="wk-search">
      <Search size={15} />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
      />
    </div>
  );
}

export function TemplatesView({
  templates,
  onUse,
  onGenerate,
}: {
  templates: DesignTemplate[];
  onUse: (template: DesignTemplate) => void;
  onGenerate: () => void;
}) {
  const { reduced, transition } = useStudioMotion();
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const categories = [
    "全部",
    ...new Set(templates.map((template) => template.category)),
  ];
  const filtered = templates.filter(
    (template) =>
      (category === "全部" || template.category === category) &&
      `${template.name} ${template.description} ${themeLabels[template.id] ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <LibrarySurface>
      <Heading
        title="给灵感，一个漂亮的起点。"
        description="精选视觉主题，让下一次创作更快成形。"
      >
        <Button onClick={onGenerate}>
          <Sparkles size={15} />
          生成主题
        </Button>
      </Heading>
      <section className="template-editorial template-editorial--cinematic">
        <div className="template-editorial-copy"><span className="pearl-eyebrow">RIN’S CURATION / 02</span><h2>让灵感，翻开新的一页。</h2><p>颜色、字体与组件，相互呼应。<br />选择你的创作起点，再把它变成自己的风格。</p><Button variant="outline" onClick={() => { setCategory("全部"); setQuery(""); document.getElementById("template-collection")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" }); }}>探索精选 <ArrowUpRight size={14} /></Button><span className="template-curator-signature"><img src="/brand/rin/v4/rin-avatar-128.webp" alt="凛 Rin" />凛的灵感选集</span></div>
        <StudioSequence variant="atlas" trigger={category} className="template-atlas" />
      </section>
      <div className="wk-toolbar" id="template-collection">
        <div className="wk-filters">
          {categories.map((item) => (
            <Button
              variant={item === category ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCategory(item)}
              key={item}
            >
              {item}
            </Button>
          ))}
        </div>
        <SearchBox value={query} onChange={setQuery} label="搜索模板" />
      </div>
      <div className="wk-results-label">
        {filtered.length} 个模板<span>主题包含颜色、字体、间距与圆角</span>
      </div>
      <div className="wk-template-grid">
        <AnimatePresence mode="popLayout">
          {filtered.map((template) => (
            <motion.article
              className="wk-template-card"
              key={template.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transition}
            >
              <button
                className="wk-preview-button"
                onClick={() => onUse(template)}
                aria-label={`使用 ${template.name} 模板`}
              >
                <ProjectPreview template={template} compact />
                <span className="wk-preview-action">
                  使用模板 <ArrowUpRight size={14} />
                </span>
              </button>
              <div className="wk-template-body">
                <div className="wk-card-title">
                  <h3>{template.name}</h3>
                  <Badge variant="secondary">
                    {themeLabels[template.id] ?? "自定义"}
                  </Badge>
                </div>
                <p>{template.description}</p>
                <footer>
                  <span>
                    {template.category} · {template.author}
                  </span>
                  <div className="wk-swatches">
                    {[
                      template.tokens.primary,
                      template.tokens.background,
                      template.tokens.text,
                    ].map((color, i) => (
                      <i style={{ background: color }} key={i} />
                    ))}
                  </div>
                </footer>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
      {!filtered.length && (
        <LibraryEmpty>
          <RinIllustration state="empty" size={80} />
          <h3>没有匹配的模板</h3>
          <p>尝试其他名称或分类。</p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setCategory("全部");
            }}
          >
            清除筛选
          </Button>
        </LibraryEmpty>
      )}
    </LibrarySurface>
  );
}

function ComponentThumbnail({
  component,
  project,
}: {
  component: DesignComponent;
  project: Project;
}) {
  const scale = Math.min(1, 245 / component.width, 128 / component.height);
  return (
    <div
      className="wk-component-stage"
      role="img"
      aria-label={`${component.name} 组件预览`}
    >
      <div
        inert
        style={{
          position: "relative",
          width: component.width * scale,
          height: component.height * scale,
        }}
      >
        <div
          style={{
            width: component.width,
            height: component.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            fontFamily: getProjectTokens(project).fontFamily,
          }}
        >
          {component.nodes.map((node) => (
            <DesignNodeVisual
              key={node.id}
              node={node}
              tokens={project.tokens}
              components={project.components}
              nodes={component.nodes}
              project={project}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type ComponentForm = {
  id?: string;
  name: string;
  description: string;
  kind: "button" | "card";
  category: string;
  variant: string;
};
export function ComponentsView({ project, onChange }: ProjectViewProps) {
  const { reduced, transition } = useStudioMotion();
  const tokens = getProjectTokens(project);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [form, setForm] = useState<ComponentForm>();
  const [deleteId, setDeleteId] = useState<string>();
  useEffect(() => {
    setQuery("");
    setCategory("全部");
    setForm(undefined);
    setDeleteId(undefined);
  }, [project.id]);
  const categories = [
    "全部",
    ...new Set(project.components.map((component) => component.category)),
  ];
  const filtered = project.components.filter(
    (component) =>
      (category === "全部" || category === component.category) &&
      `${component.name} ${component.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const create = () =>
    setForm({
      name: "",
      description: "",
      kind: "button",
      category: "基础组件",
      variant: "",
    });
  const variantProperties = (value: string) =>
    Object.fromEntries(
      value
        .split(",")
        .map((part) => part.split("=").map((item) => item.trim()))
        .filter((part) => part.length === 2 && part[0] && part[1]),
    );
  const save = () => {
    if (!form?.name.trim()) return;
    if (form.id) {
      onChange(
        updated(project, {
          components: project.components.map((component) =>
            component.id === form.id
              ? {
                  ...component,
                  name: form.name.trim(),
                  description: form.description,
                  category: form.category.trim() || "自定义组件",
                  variantProperties: variantProperties(form.variant),
                }
              : component,
          ),
        }),
      );
    } else {
      const id = `component-${crypto.randomUUID()}`;
      const isButton = form.kind === "button";
      const nodes: DesignNode[] = isButton
        ? [
            {
              id: `${id}-root`,
              name: form.name,
              type: "button",
              x: 0,
              y: 0,
              width: 160,
              height: 40,
              fill: tokens.primary,
              color: "#ffffff",
              text: "Button",
              fontSize: 14,
              radius: tokens.radius,
              tokenBindings: { fill: "primary", radius: "radius" },
            },
          ]
        : [
            {
              id: `${id}-root`,
              name: "Card",
              type: "frame",
              x: 0,
              y: 0,
              width: 260,
              height: 140,
              fill: tokens.surface,
              radius: tokens.radius,
              tokenBindings: { fill: "surface", radius: "radius" },
            },
            {
              id: `${id}-title`,
              parentId: `${id}-root`,
              name: "Title",
              type: "text",
              x: 20,
              y: 24,
              width: 220,
              height: 27,
              text: form.name,
              fontSize: 17,
              color: tokens.text,
              tokenBindings: { color: "text" },
            },
            {
              id: `${id}-body`,
              parentId: `${id}-root`,
              name: "Description",
              type: "text",
              x: 20,
              y: 68,
              width: 220,
              height: 50,
              text: form.description || "Component description",
              fontSize: 13,
              color: tokens.muted,
              tokenBindings: { color: "muted" },
            },
          ];
      onChange(
        updated(project, {
          components: [
            ...project.components,
            {
              id,
              name: form.name.trim(),
              description: form.description,
              category: form.category.trim() || "自定义组件",
              width: isButton ? 160 : 260,
              height: isButton ? 40 : 140,
              nodes,
            },
          ],
        }),
      );
      setCategory("全部");
      setQuery("");
    }
    setForm(undefined);
  };
  const remove = (id: string) => {
    const component = project.components.find((item) => item.id === id);
    const detach = (node: DesignNode): DesignNode[] => {
      if (node.componentId !== id) return [node];
      const { componentId: _componentId, ...rest } = node;
      if (node.type !== "component" || !component)
        return [
          { ...rest, type: node.type === "component" ? "frame" : node.type },
        ];
      const scaleX = node.width / component.width;
      const scaleY = node.height / component.height;
      const idMap = new Map(
        component.nodes.map((child) => [
          child.id,
          `detached-${crypto.randomUUID()}`,
        ]),
      );
      return [
        { ...rest, type: "frame", fill: "transparent" },
        ...component.nodes.map((child) => {
          const overrides = node.overrides?.[child.id] ?? {};
          const resolved = {
            ...resolveNode(child, project),
            ...overrides,
            ...(overrides.fill === undefined ? {} : { gradient: undefined }),
          };
          const tokenBindings = { ...child.tokenBindings };
          const variableBindings = { ...child.variableBindings };
          for (const property of Object.keys(overrides)) {
            delete tokenBindings[property];
            delete variableBindings[property];
          }
          const scale = Math.min(scaleX, scaleY);
          if (scaleX !== 1 || scaleY !== 1) {
            for (const property of [
              "radius",
              "fontSize",
              "x",
              "y",
              "width",
              "height",
              "strokeWidth",
              "gap",
              "padding",
              "paddingX",
              "paddingY",
              "letterSpacing",
            ]) {
              delete tokenBindings[property];
              delete variableBindings[property];
            }
          }
          return {
            ...resolved,
            id: idMap.get(child.id)!,
            parentId: child.parentId
              ? (idMap.get(child.parentId) ?? node.id)
              : node.id,
            x: node.x + resolved.x * scaleX,
            y: node.y + resolved.y * scaleY,
            width: resolved.width * scaleX,
            height: resolved.height * scaleY,
            fontSize:
              resolved.fontSize === undefined
                ? undefined
                : resolved.fontSize * scale,
            radius: (resolved.radius ?? 0) * scale,
            strokeWidth:
              resolved.strokeWidth === undefined
                ? undefined
                : resolved.strokeWidth * scale,
            tokenBindings,
            variableBindings,
            locked: node.locked || resolved.locked,
          };
        }),
      ];
    };
    onChange(
      updated(project, {
        components: project.components
          .filter((item) => item.id !== id)
          .map((item) => ({ ...item, nodes: item.nodes.flatMap(detach) })),
        pages: project.pages.map((page) => ({
          ...page,
          nodes: page.nodes.flatMap(detach),
        })),
      }),
    );
    setDeleteId(undefined);
    setCategory("全部");
  };
  const duplicate = (component: DesignComponent, variant = false) => {
    const id = `component-${crypto.randomUUID()}`;
    const idMap = new Map(
      component.nodes.map((node) => [node.id, `node-${crypto.randomUUID()}`]),
    );
    const setId = component.setId ?? `set-${crypto.randomUUID()}`;
    const siblingCount = project.components.filter(
      (item) => item.setId === setId,
    ).length;
    const source = variant
      ? project.components.map((item) =>
          item.id === component.id
            ? {
                ...item,
                setId,
                variantProperties: Object.keys(item.variantProperties ?? {})
                  .length
                  ? item.variantProperties
                  : { State: "Default" },
              }
            : item,
        )
      : project.components;
    onChange(
      updated(project, {
        components: [
          ...source,
          {
            ...component,
            id,
            name: `${component.name}${variant ? " / Variant" : " Copy"}`,
            setId: variant ? setId : undefined,
            variantProperties: variant
              ? {
                  ...component.variantProperties,
                  State: `Variant ${siblingCount + 1}`,
                }
              : undefined,
            nodes: component.nodes.map((node) => ({
              ...node,
              id: idMap.get(node.id)!,
              parentId: node.parentId ? idMap.get(node.parentId) : undefined,
            })),
          },
        ],
      }),
    );
  };
  return (
    <LibrarySurface>
      <Heading
        title="组件库"
        description="把设计细节，变成可复用的语言。"
      >
        <Button onClick={create}>
          <Plus size={15} />
          创建组件
        </Button>
      </Heading>
      <div className="wk-catalog">
        <aside className="wk-catalog-nav" aria-label="组件分类">
          <div className="wk-catalog-label">
            分类<span>{categories.length - 1}</span>
          </div>
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? "is-active" : ""}
              onClick={() => setCategory(item)}
            >
              <RinIcon kind="components" size={15} />
              <span>{item === "全部" ? "全部组件" : item}</span>
              <small>
                {item === "全部"
                  ? project.components.length
                  : project.components.filter(
                      (component) => component.category === item,
                    ).length}
              </small>
            </button>
          ))}
          <div className="component-curator"><img src="/brand/rin/v4/rin-thinking-320.webp" alt="凛正在整理设计组件" loading="lazy" /><p>好组件，<br />让设计更轻松。</p></div>
        </aside>
        <section className="wk-catalog-main">
          <div className="wk-catalog-toolbar">
            <SearchBox
              value={query}
              onChange={setQuery}
              label="搜索组件名称或描述"
            />
            <span>{filtered.length} 个组件</span>
          </div>
          <div className="wk-component-grid">
            <AnimatePresence mode="popLayout">
              {filtered.map((component) => {
                const instances = project.pages.reduce(
                  (total, page) =>
                    total +
                    page.nodes.filter(
                      (node) => node.componentId === component.id,
                    ).length,
                  0,
                );
                return (
                  <motion.article
                    className="wk-component-card"
                    key={component.id}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                  >
                    <ComponentThumbnail
                      component={component}
                      project={project}
                    />
                    <div className="wk-component-body">
                      <div className="wk-card-title">
                        <Diamond className="wk-component-icon" size={15} />
                        <h3>{component.name}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`${component.name} 操作`}
                            >
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => duplicate(component)}
                            >
                              <Copy size={14} />
                              复制组件
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => duplicate(component, true)}
                            >
                              <Layers3 size={14} />
                              添加变体
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setForm({
                                  id: component.id,
                                  name: component.name,
                                  description: component.description,
                                  kind: "button",
                                  category: component.category,
                                  variant: Object.entries(
                                    component.variantProperties ?? {},
                                  )
                                    .map(([key, value]) => `${key}=${value}`)
                                    .join(", "),
                                })
                              }
                            >
                              编辑属性
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(component.id)}
                            >
                              <Trash2 size={14} />
                              删除组件
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p>{component.description || component.category}</p>
                      {component.setId && (
                        <div className="wk-variant-tags">
                          {Object.entries(
                            component.variantProperties ?? {},
                          ).map(([key, value]) => (
                            <Badge variant="secondary" key={key}>
                              {key}: {value}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <footer>
                        <span>
                          {component.width} × {component.height}
                        </span>
                        <span>
                          {instances} 个实例
                          {component.setId
                            ? ` · ${project.components.filter((item) => item.setId === component.setId).length} 个变体`
                            : ""}
                        </span>
                      </footer>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
          {!filtered.length && (
            <LibraryEmpty>
              <RinIllustration state="empty" size={80} />
              <h3>
                {project.components.length
                  ? "没有找到匹配的组件"
                  : "创建第一个可复用组件"}
              </h3>
              <p>
                {project.components.length
                  ? "试试其他名称，或查看所有分类。"
                  : "组件创建后，可在项目的多个页面中复用。"}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  if (project.components.length) {
                    setQuery("");
                    setCategory("全部");
                  } else create();
                }}
              >
                {project.components.length ? "清除筛选" : "创建组件"}
              </Button>
            </LibraryEmpty>
          )}
        </section>
      </div>
      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open) setForm(undefined);
        }}
      >
        <DialogContent className="wk-dialog">
          <DialogHeader>
            <DialogTitle>{form?.id ? "编辑组件属性" : "创建组件"}</DialogTitle>
            <DialogDescription>
              组件可以在项目的多个页面中复用。
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
              className="wk-form"
            >
              <label>
                名称
                <Input
                  value={form.name}
                  autoFocus
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Button / Primary"
                  required
                />
              </label>
              <label>
                描述
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="组件用途"
                  rows={2}
                />
              </label>
              <label>
                分类
                <Input
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                />
              </label>
              {!form.id ? (
                <label>
                  初始内容
                  <Choice
                    value={form.kind}
                    onChange={(value) =>
                      setForm({ ...form, kind: value as "button" | "card" })
                    }
                    label="初始组件内容"
                    options={[
                      { value: "button", label: "按钮 Button" },
                      { value: "card", label: "卡片 Card" },
                    ]}
                  />
                </label>
              ) : (
                <label>
                  变体属性
                  <Input
                    value={form.variant}
                    onChange={(event) =>
                      setForm({ ...form, variant: event.target.value })
                    }
                    placeholder="State=Default, Size=Medium"
                  />
                  <small>使用英文逗号分隔，格式为属性=值。</small>
                </label>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setForm(undefined)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={!form.name.trim()}>
                  保存组件
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(undefined);
        }}
      >
        <DialogContent className="wk-dialog">
          <DialogHeader>
            <DialogTitle>删除组件？</DialogTitle>
            <DialogDescription>
              页面中的现有实例会转换为普通图层，保留当前外观。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(undefined)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && remove(deleteId)}
            >
              删除组件
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LibrarySurface>
  );
}

function previewForeground(color: string) {
  const hex = color.slice(1);
  const normalized =
    hex.length === 3
      ? [...hex].map((character) => character + character).join("")
      : hex.slice(0, 6);
  if (!/^[\da-f]{6}$/i.test(normalized)) return "#ffffff";
  const rgb = [0, 2, 4]
    .map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
    ? "#111111"
    : "#ffffff";
}

function ColorValue({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="wk-color-value">
      <label style={{ background: value }}>
        <input
          type="color"
          value={/^#[\da-f]{6}$/i.test(value) ? value : "#000000"}
          aria-label={`选择${label}`}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <Input
        value={draft}
        aria-label={label}
        spellCheck={false}
        onBlur={() => {
          if (!/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(draft))
            setDraft(value);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          if (
            /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(event.target.value)
          )
            onChange(event.target.value);
        }}
      />
    </div>
  );
}

export function TokensView({
  project,
  onChange,
  templates = [],
}: ProjectViewProps & { templates?: DesignTemplate[] }) {
  const { reduced, transition } = useStudioMotion();
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [creation, setCreation] = useState<
    "mode" | "collection" | "variable" | "collectionMode"
  >();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<DesignVariable["type"]>("color");
  const modes =
    project.themeModes && Object.keys(project.themeModes).length
      ? project.themeModes
      : { Light: project.tokens };
  const activeMode =
    project.activeMode && modes[project.activeMode]
      ? project.activeMode
      : Object.keys(modes)[0];
  const tokens = modes[activeMode] ?? project.tokens;
  const collections = project.variableCollections ?? [];
  const collection =
    collections.find((item) => item.id === selectedCollection) ??
    collections[0];
  const setTokens = (
    next: ThemeTokens,
    themeId = project.themeId,
    changes: Partial<Project> = {},
  ) =>
    onChange(
      updated(project, {
        tokens: next,
        themeId,
        themeModes: { ...modes, [activeMode]: next },
        activeMode,
        pages: project.pages.map((page) => ({
          ...page,
          nodes: page.nodes.map((node) => bindNode(node, next)),
        })),
        components: project.components.map((component) => ({
          ...component,
          nodes: component.nodes.map((node) => bindNode(node, next)),
        })),
        ...changes,
      }),
    );
  const updateToken = <K extends keyof ThemeTokens>(
    key: K,
    value: ThemeTokens[K],
  ) => setTokens({ ...tokens, [key]: value });
  const updateCollection = (
    next: VariableCollection,
    changes: Partial<Project> = {},
  ) =>
    onChange(
      updated(project, {
        variableCollections: collections.map((item) =>
          item.id === next.id ? next : item,
        ),
        ...changes,
      }),
    );
  const variableUsage = (collectionId: string, variableId?: string) =>
    [
      ...project.pages.flatMap((page) => page.nodes),
      ...project.components.flatMap((component) => component.nodes),
    ].filter((node) =>
      Object.values(node.variableBindings ?? {}).some(
        (binding) =>
          binding.collectionId === collectionId &&
          (!variableId || binding.variableId === variableId),
      ),
    ).length;
  const tokenJson = JSON.stringify(
    {
      name: project.name,
      version: project.revision,
      tokens,
      themeModes: modes,
      variableCollections: collections,
    },
    null,
    2,
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tokenJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("无法访问剪贴板，请使用导出 JSON。");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([tokenJson], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.id}-tokens.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const create = (kind: typeof creation) => {
    setNewName("");
    setNewType("color");
    setCreation(kind);
  };
  const submitCreation = () => {
    const name = newName.trim();
    if (!name) return;
    if (creation === "mode") {
      if (modes[name]) return;
      const next = /^(dark|深色)$/i.test(name)
        ? {
            ...tokens,
            background: "#18181b",
            surface: "#27272a",
            text: "#fafafa",
            muted: "#a1a1aa",
            border: "#3f3f46",
          }
        : { ...tokens };
      setTokens(next, project.themeId, {
        themeModes: { ...modes, [activeMode]: tokens, [name]: next },
        activeMode: name,
      });
    }
    if (creation === "collection") {
      const id = `collection-${crypto.randomUUID()}`;
      onChange(
        updated(project, {
          variableCollections: [
            ...collections,
            { id, name, modes: ["Default"], variables: [] },
          ],
        }),
      );
      setSelectedCollection(id);
    }
    if (creation === "collectionMode" && collection) {
      if (collection.modes.includes(name)) return;
      updateCollection({
        ...collection,
        modes: [...collection.modes, name],
        variables: collection.variables.map((variable) => ({
          ...variable,
          values: {
            ...variable.values,
            [name]: variable.values[collection.modes[0]],
          },
        })),
      });
    }
    if (creation === "variable" && collection) {
      const defaultValue =
        newType === "color"
          ? "#0d99ff"
          : newType === "number"
            ? 0
            : newType === "boolean"
              ? false
              : "";
      updateCollection({
        ...collection,
        variables: [
          ...collection.variables,
          {
            id: `variable-${crypto.randomUUID()}`,
            name,
            type: newType,
            values: Object.fromEntries(
              collection.modes.map((mode) => [mode, defaultValue]),
            ),
          },
        ],
      });
    }
    setCreation(undefined);
  };
  const colors: [keyof ThemeTokens, string][] = [
    ["primary", "品牌主色"],
    ["background", "页面背景"],
    ["surface", "容器表面"],
    ["text", "主要文字"],
    ["muted", "辅助文字"],
    ["border", "边框"],
  ];
  const previewStyle = {
    "--token-primary": tokens.primary,
    "--token-on-primary": previewForeground(tokens.primary),
    "--token-background": tokens.background,
    "--token-surface": tokens.surface,
    "--token-text": tokens.text,
    "--token-muted": tokens.muted,
    "--token-border": tokens.border,
    "--token-radius": `${tokens.radius}px`,
    "--token-space": `${tokens.spacing}px`,
    fontFamily: tokens.fontFamily,
  } as CSSProperties;
  const duplicateName =
    creation === "mode"
      ? !!modes[newName.trim()]
      : creation === "collectionMode"
        ? collection?.modes.includes(newName.trim())
        : false;
  return (
    <LibrarySurface>
      <Heading
        title="变量与主题"
        description="管理视觉基础，实时预览每一次主题调整。"
      >
        <Button variant="outline" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "已复制" : "复制 JSON"}
        </Button>
        <Button variant="outline" onClick={download}>
          <ArrowDownToLine size={15} />
          导出
        </Button>
      </Heading>
      <Tabs defaultValue="theme">
        <TabsList>
          <TabsTrigger value="theme">主题 Token</TabsTrigger>
          <TabsTrigger value="variables">
            变量集合 <span className="wk-tab-count">{collections.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="theme">
          <div className="wk-mode-toolbar">
            <div className="wk-mode-list">
              {Object.keys(modes).map((mode) => (
                <Button
                  size="sm"
                  variant={activeMode === mode ? "secondary" : "ghost"}
                  key={mode}
                  onClick={() =>
                    setTokens(modes[mode], project.themeId, {
                      themeModes: { ...modes, [activeMode]: tokens },
                      activeMode: mode,
                    })
                  }
                >
                  {/dark|深色/i.test(mode) ? (
                    <Moon size={14} />
                  ) : (
                    <Sun size={14} />
                  )}
                  {mode}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => create("mode")}
                aria-label="添加主题模式"
              >
                <Plus size={15} />
              </Button>
            </div>
            <div className="wk-mode-select">
              <Choice
                value={
                  templates.some((item) => item.id === project.themeId)
                    ? project.themeId
                    : "custom"
                }
                label="应用主题模板"
                onChange={(value) => {
                  const template = templates.find((item) => item.id === value);
                  if (template) setTokens({ ...template.tokens }, template.id);
                }}
                options={[
                  { value: "custom", label: "自定义主题" },
                  ...templates.map((item) => ({
                    value: item.id,
                    label: item.name,
                  })),
                ]}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="主题模式操作">
                    <MoreHorizontal size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setNewName(`${activeMode} Copy`);
                      setCreation("mode");
                    }}
                  >
                    复制当前模式
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={Object.keys(modes).length < 2}
                    onClick={() => {
                      const nextModes = Object.fromEntries(
                        Object.entries(modes).filter(
                          ([name]) => name !== activeMode,
                        ),
                      );
                      const nextMode = Object.keys(nextModes)[0];
                      if (nextMode)
                        setTokens(nextModes[nextMode], project.themeId, {
                          themeModes: nextModes,
                          activeMode: nextMode,
                        });
                    }}
                  >
                    删除当前模式
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="wk-tokens-layout">
            <div className="wk-panel">
              <div className="wk-panel-header">
                <h2>语义 Token</h2>
                <span>9 个变量</span>
              </div>
              <div className="wk-token-table">
                <div className="wk-token-group-label">
                  <span>颜色</span>
                  <small>6 个 Token</small>
                </div>
                {colors.map(([key, label]) => (
                  <div className="wk-token-row" key={key}>
                    <div>
                      <b>{label}</b>
                      <code>color.{key}</code>
                    </div>
                    <ColorValue
                      value={String(tokens[key])}
                      label={`${label}颜色值`}
                      onChange={(value) => updateToken(key, value)}
                    />
                  </div>
                ))}
                <div className="wk-token-group-label">
                  <span>排版</span>
                  <small>1 个 Token</small>
                </div>
                <div className="wk-token-row">
                  <div>
                    <b>字体家族</b>
                    <code>typography.fontFamily</code>
                  </div>
                  <Input
                    value={tokens.fontFamily}
                    aria-label="字体家族"
                    onChange={(event) =>
                      updateToken("fontFamily", event.target.value)
                    }
                  />
                </div>
                <div className="wk-token-group-label">
                  <span>布局</span>
                  <small>2 个 Token</small>
                </div>
                {(["radius", "spacing"] as const).map((key) => (
                  <div className="wk-token-row" key={key}>
                    <div>
                      <b>{key === "radius" ? "基础圆角" : "间距单位"}</b>
                      <code>
                        {key === "radius" ? "shape.radius" : "layout.spacing"}
                      </code>
                    </div>
                    <div className="wk-number-value">
                      <Input
                        type="number"
                        min={0}
                        max={128}
                        value={tokens[key]}
                        aria-label={key === "radius" ? "基础圆角" : "间距单位"}
                        onChange={(event) =>
                          updateToken(
                            key,
                            Math.min(
                              128,
                              Math.max(0, Number(event.target.value)),
                            ),
                          )
                        }
                      />
                      <span>px</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="wk-panel-note">
                修改会应用到绑定 Token 的页面图层与主组件。
              </div>
            </div>
            <aside className="wk-token-preview">
              <div className="wk-panel-header">
                <h2>实时预览</h2>
                <span className="wk-live-label">
                  <i />
                  已更新
                </span>
              </div>
              <motion.div
                key={activeMode}
                className="wk-token-sample"
                style={previewStyle}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition}
              >
                <div className="wk-token-sample-nav">
                  <span className="wk-sample-mark">F</span>
                  <b>{project.name}</b>
                  <i />
                </div>
                <div className="wk-token-sample-type">
                  <strong>Aa</strong>
                  <span>项目概览</span>
                </div>
                <p>颜色、字体与布局，随主题实时变化。</p>
                <div className="wk-token-sample-card">
                  <span>容器样式</span>
                  <strong>示例卡片</strong>
                  <p>查看当前主题的文字、容器与边框样式。</p>
                  <div className="wk-sample-field">
                    <span>输入内容</span>
                    <span>⌘ K</span>
                  </div>
                </div>
                <div className="wk-token-sample-buttons">
                  <span>主要按钮</span>
                  <span>次要按钮</span>
                </div>
                <div className="wk-sample-palette">
                  {colors.map(([key]) => (
                    <i
                      key={key}
                      title={String(tokens[key])}
                      style={{ background: String(tokens[key]) }}
                    />
                  ))}
                </div>
              </motion.div>
              <dl className="wk-preview-facts">
                <dt>当前模式</dt>
                <dd>{activeMode}</dd>
                <dt>字体</dt>
                <dd title={tokens.fontFamily}>
                  {tokens.fontFamily.split(",")[0]}
                </dd>
                <dt>圆角 / 间距</dt>
                <dd>
                  {tokens.radius} / {tokens.spacing} px
                </dd>
              </dl>
              <div className="wk-preview-note">
                <img src="/brand/rin/v4/rin-avatar-128.webp" alt="凛 Rin" loading="lazy" /><span><strong>变量改变，设计随之更新。</strong>已绑定 Token 的图层与主组件会同步应用。</span>
              </div>
            </aside>{" "}
          </div>
        </TabsContent>
        <TabsContent value="variables">
          <div className="wk-variable-layout">
            <aside className="wk-collection-nav">
              <header>
                <b>集合</b>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => create("collection")}
                  aria-label="创建变量集合"
                >
                  <Plus size={15} />
                </Button>
              </header>
              {collections.map((item) => (
                <button
                  className={collection?.id === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setSelectedCollection(item.id)}
                >
                  <Variable size={15} />
                  <span>{item.name}</span>
                  <small>{item.variables.length}</small>
                </button>
              ))}
            </aside>
            <div className="wk-variables-main">
              {collection ? (
                <>
                  <div className="wk-variable-heading">
                    <Input
                      key={collection.id}
                      aria-label="集合名称"
                      defaultValue={collection.name}
                      onBlur={(event) => {
                        const name = event.target.value.trim();
                        if (name && name !== collection.name)
                          updateCollection({ ...collection, name });
                        else event.target.value = collection.name;
                      }}
                    />
                    <div>
                      <Choice
                        value={
                          project.activeVariableModes?.[collection.id] ??
                          collection.modes[0]
                        }
                        label="当前变量模式"
                        options={collection.modes.map((mode) => ({
                          value: mode,
                          label: mode,
                        }))}
                        onChange={(mode) =>
                          onChange(
                            updated(project, {
                              activeVariableModes: {
                                ...project.activeVariableModes,
                                [collection.id]: mode,
                              },
                            }),
                          )
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => create("collectionMode")}
                      >
                        <Plus size={14} />
                        模式
                      </Button>
                      <Button size="sm" onClick={() => create("variable")}>
                        <Plus size={14} />
                        变量
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="集合操作"
                          >
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              const id = `collection-${crypto.randomUUID()}`;
                              onChange(
                                updated(project, {
                                  variableCollections: [
                                    ...collections,
                                    {
                                      ...collection,
                                      id,
                                      name: `${collection.name} Copy`,
                                      variables: collection.variables.map(
                                        (variable) => ({
                                          ...variable,
                                          id: crypto.randomUUID(),
                                        }),
                                      ),
                                    },
                                  ],
                                }),
                              );
                              setSelectedCollection(id);
                            }}
                          >
                            复制集合
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            disabled={variableUsage(collection.id) > 0}
                            onClick={() =>
                              onChange(
                                updated(project, {
                                  variableCollections: collections.filter(
                                    (item) => item.id !== collection.id,
                                  ),
                                  activeVariableModes: Object.fromEntries(
                                    Object.entries(
                                      project.activeVariableModes ?? {},
                                    ).filter(([id]) => id !== collection.id),
                                  ),
                                }),
                              )
                            }
                          >
                            {variableUsage(collection.id)
                              ? `删除集合（${variableUsage(collection.id)} 个绑定）`
                              : "删除集合"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="wk-variable-scroll">
                    <table className="wk-variable-table">
                      <thead>
                        <tr>
                          <th>变量名称</th>
                          <th>类型</th>
                          {collection.modes.map((mode) => (
                            <th key={mode}>
                              <div>
                                <Input
                                  defaultValue={mode}
                                  aria-label={`变量模式 ${mode} 名称`}
                                  onBlur={(event) => {
                                    const name = event.target.value.trim();
                                    if (
                                      !name ||
                                      name === mode ||
                                      collection.modes.includes(name)
                                    ) {
                                      event.target.value = mode;
                                      return;
                                    }
                                    updateCollection(
                                      {
                                        ...collection,
                                        modes: collection.modes.map((item) =>
                                          item === mode ? name : item,
                                        ),
                                        variables: collection.variables.map(
                                          (variable) => ({
                                            ...variable,
                                            values: Object.fromEntries(
                                              Object.entries(
                                                variable.values,
                                              ).map(([key, value]) => [
                                                key === mode ? name : key,
                                                value,
                                              ]),
                                            ),
                                          }),
                                        ),
                                      },
                                      {
                                        activeVariableModes: {
                                          ...project.activeVariableModes,
                                          [collection.id]:
                                            (project.activeVariableModes?.[
                                              collection.id
                                            ] ?? collection.modes[0]) === mode
                                              ? name
                                              : (project.activeVariableModes?.[
                                                  collection.id
                                                ] ?? collection.modes[0]),
                                        },
                                      },
                                    );
                                  }}
                                />
                                {collection.modes.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`删除 ${mode} 模式`}
                                    onClick={() => {
                                      const nextModes = collection.modes.filter(
                                        (item) => item !== mode,
                                      );
                                      updateCollection(
                                        {
                                          ...collection,
                                          modes: nextModes,
                                          variables: collection.variables.map(
                                            (variable) => ({
                                              ...variable,
                                              values: Object.fromEntries(
                                                Object.entries(
                                                  variable.values,
                                                ).filter(
                                                  ([name]) => name !== mode,
                                                ),
                                              ),
                                            }),
                                          ),
                                        },
                                        {
                                          activeVariableModes: {
                                            ...project.activeVariableModes,
                                            [collection.id]:
                                              (project.activeVariableModes?.[
                                                collection.id
                                              ] ?? collection.modes[0]) === mode
                                                ? nextModes[0]
                                                : (project
                                                    .activeVariableModes?.[
                                                    collection.id
                                                  ] ?? nextModes[0]),
                                          },
                                        },
                                      );
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                )}
                              </div>
                            </th>
                          ))}
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {collection.variables.map((variable) => (
                          <tr key={variable.id}>
                            <td>
                              <Input
                                defaultValue={variable.name}
                                aria-label="变量名称"
                                onBlur={(event) => {
                                  const name = event.target.value.trim();
                                  if (name && name !== variable.name)
                                    updateCollection({
                                      ...collection,
                                      variables: collection.variables.map(
                                        (item) =>
                                          item.id === variable.id
                                            ? { ...item, name }
                                            : item,
                                      ),
                                    });
                                  else event.target.value = variable.name;
                                }}
                              />
                            </td>
                            <td>
                              <Badge variant="outline">{variable.type}</Badge>
                            </td>
                            {collection.modes.map((mode) => {
                              const value = variable.values[mode];
                              const setValue = (
                                next: string | number | boolean,
                              ) =>
                                updateCollection({
                                  ...collection,
                                  variables: collection.variables.map((item) =>
                                    item.id === variable.id
                                      ? {
                                          ...item,
                                          values: {
                                            ...item.values,
                                            [mode]: next,
                                          },
                                        }
                                      : item,
                                  ),
                                });
                              return (
                                <td key={mode}>
                                  {variable.type === "color" ? (
                                    <ColorValue
                                      value={String(value)}
                                      label={`${variable.name} ${mode}`}
                                      onChange={setValue}
                                    />
                                  ) : variable.type === "boolean" ? (
                                    <Switch
                                      checked={Boolean(value)}
                                      onCheckedChange={setValue}
                                      aria-label={`${variable.name} ${mode}`}
                                    />
                                  ) : (
                                    <Input
                                      aria-label={`${variable.name} ${mode}`}
                                      type={
                                        variable.type === "number"
                                          ? "number"
                                          : "text"
                                      }
                                      value={String(value ?? "")}
                                      onChange={(event) =>
                                        setValue(
                                          variable.type === "number"
                                            ? Number(event.target.value)
                                            : event.target.value,
                                        )
                                      }
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`删除变量 ${variable.name}`}
                                title={
                                  variableUsage(collection.id, variable.id)
                                    ? `有 ${variableUsage(collection.id, variable.id)} 个图层绑定此变量，请先解除绑定`
                                    : "删除变量"
                                }
                                disabled={
                                  variableUsage(collection.id, variable.id) > 0
                                }
                                onClick={() =>
                                  updateCollection({
                                    ...collection,
                                    variables: collection.variables.filter(
                                      (item) => item.id !== variable.id,
                                    ),
                                  })
                                }
                              >
                                <Trash2 size={14} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!collection.variables.length && (
                    <LibraryEmpty>
                      <Variable size={24} />
                      <h3>集合中还没有变量</h3>
                      <p>添加颜色、数值、文本或布尔变量。</p>
                      <Button
                        variant="outline"
                        onClick={() => create("variable")}
                      >
                        创建变量
                      </Button>
                    </LibraryEmpty>
                  )}
                  <p className="wk-panel-note">
                    在画布属性面板中绑定变量。切换当前模式会更新所有绑定图层；已有绑定的变量需先解除绑定才能删除。
                  </p>
                </>
              ) : (
                <LibraryEmpty>
                  <RinIllustration state="empty" size={80} />
                  <h3>创建你的第一个变量集合</h3>
                  <p>按品牌、平台或用途组织变量，并为每个模式设置值。</p>
                  <Button onClick={() => create("collection")}>
                    <Plus size={15} />
                    创建集合
                  </Button>
                </LibraryEmpty>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!creation}
        onOpenChange={(open) => {
          if (!open) setCreation(undefined);
        }}
      >
        <DialogContent className="wk-dialog">
          <DialogHeader>
            <DialogTitle>
              {creation === "mode"
                ? "添加主题模式"
                : creation === "collection"
                  ? "创建变量集合"
                  : creation === "collectionMode"
                    ? "添加变量模式"
                    : "创建变量"}
            </DialogTitle>
            <DialogDescription>
              {creation === "mode"
                ? "复制当前主题。使用 Dark 或深色作为名称会创建深色基础配色。"
                : creation === "collectionMode"
                  ? "复制现有模式的变量值，之后可独立编辑。"
                  : "变量使用名称组织，例如 color/brand 或 spacing/medium。"}
            </DialogDescription>
          </DialogHeader>
          <form
            className="wk-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitCreation();
            }}
          >
            <label>
              名称
              <Input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={
                  creation === "mode"
                    ? "Dark"
                    : creation === "collection"
                      ? "Primitives"
                      : "名称"
                }
                required
              />
            </label>
            {duplicateName && <p className="wk-error">该模式名称已存在。</p>}
            {creation === "variable" && (
              <label>
                类型
                <Choice
                  value={newType}
                  onChange={(value) =>
                    setNewType(value as DesignVariable["type"])
                  }
                  label="变量类型"
                  options={[
                    { value: "color", label: "Color · 颜色" },
                    { value: "number", label: "Number · 数值" },
                    { value: "string", label: "String · 文本" },
                    { value: "boolean", label: "Boolean · 布尔" },
                  ]}
                />
              </label>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setCreation(undefined)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={!newName.trim() || !!duplicateName}
              >
                创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {message && (
        <p className="wk-error" role="status">
          {message}
        </p>
      )}
    </LibrarySurface>
  );
}
