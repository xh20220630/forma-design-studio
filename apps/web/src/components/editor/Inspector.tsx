import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useStudioMotion } from "../../lib/motion";
import {
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Code2,
  ChevronDown,
  Component,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  Link2,
  LockKeyhole,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@forma/ui/button";
import { Input } from "@forma/ui/input";
import { Textarea } from "@forma/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@forma/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@forma/ui/select";
import { Switch } from "@forma/ui/switch";
import type { DesignNode, DesignPage, Project, ThemeTokens } from "@forma/schema";
import { containers, descendants, nodeCss } from "@forma/editor-core/geometry";
import { getProjectTokens } from "@forma/renderer";
import ComponentMasterDialog from "./ComponentMasterDialog";
import { RinAvatar, RinIcon } from "../brand/RinBrand";

export function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select
      value={value || "__none"}
      onValueChange={(value) => onChange(value === "__none" ? "" : value)}
    >
      <SelectTrigger aria-label={label} className="ed-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="ed-select-menu">
        {options.map(([key, text]) => (
          <SelectItem key={key || "__none"} value={key || "__none"}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="ed-number">
      <span>{label}</span>
      <Input
        type="number"
        aria-label={label}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next))
            onChange(
              Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next)),
            );
        }}
      />
    </label>
  );
}
function ColorTextField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <Input
      key={value}
      aria-label={label}
      defaultValue={value}
      onBlur={(event) => {
        const next = event.target.value.trim();
        if (next && CSS.supports("color", next)) onChange(next);
        else event.target.value = value;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
export function PropertySection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { reduced, transition } = useStudioMotion();
  return (
    <section
      className={`ed-property-section ${collapsed ? "is-collapsed" : ""}`}
    >
      <h3>
        <button
          className="ed-property-heading"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
        >
          <motion.span
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={transition}
          >
            <ChevronDown size={12} />
          </motion.span>
          <span>{title}</span>
        </button>
        {action}
      </h3>
      <motion.div
        initial={false}
        animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
        transition={transition}
        inert={collapsed}
        aria-hidden={collapsed}
        style={{ overflow: collapsed || !reduced ? "hidden" : undefined }}
      >
        <div className="ed-property-body">{children}</div>
      </motion.div>
    </section>
  );
}
interface Props {
  project: Project;
  page: DesignPage;
  selection: DesignNode[];
  updateNode: (id: string, patch: Partial<DesignNode>) => void;
  updateSelected: (patch: Partial<DesignNode>) => void;
  updatePage: (patch: Partial<DesignPage>) => void;
  commit: (project: Project) => void;
  align: (mode: string) => void;
  createComponent: () => void;
  detach: () => void;
  group: () => void;
  ungroup: () => void;
  duplicate: () => void;
  remove: () => void;
  exportFile: (format: "svg" | "png" | "json") => void;
  onSync: () => void;
  onAgent: () => void;
}
const colorKeys: (keyof ThemeTokens)[] = [
  "primary",
  "background",
  "surface",
  "text",
  "muted",
  "border",
];
export default function Inspector({
  project,
  page,
  selection,
  updateNode,
  updateSelected,
  updatePage,
  commit,
  align,
  createComponent,
  detach,
  group,
  ungroup,
  duplicate,
  remove,
  exportFile,
  onSync,
  onAgent,
}: Props) {
  const [tab, setTab] = useState("design");
  const [editingMaster, setEditingMaster] = useState(false);
  const tokens = getProjectTokens(project);
  const updateTokens = (patch: Partial<ThemeTokens>) => {
    const next = { ...tokens, ...patch };
    commit({
      ...project,
      tokens: next,
      themeModes: project.activeMode
        ? { ...project.themeModes, [project.activeMode]: next }
        : project.themeModes,
    });
  };
  const selected = selection[0];
  const component = project.components.find(
    (item) => item.id === selected?.componentId,
  );
  const change = (patch: Partial<DesignNode>) =>
    selected && updateNode(selected.id, patch);
  const variableField = (
    key: string,
    type: "color" | "number" | "string" | "boolean",
    title: string,
  ) => {
    const variables = (project.variableCollections ?? []).flatMap(
      (collection) =>
        collection.variables
          .filter((variable) => variable.type === type)
          .map((variable) => ({
            value: `${collection.id}:${variable.id}`,
            label: `${collection.name} / ${variable.name}`,
            collectionId: collection.id,
            variableId: variable.id,
          })),
    );
    if (!variables.length) return null;
    const current = selected.variableBindings?.[key];
    return (
      <Choice
        label={title}
        value={current ? `${current.collectionId}:${current.variableId}` : ""}
        options={[
          ["", `${title} · 不绑定`],
          ...variables.map(
            (variable) => [variable.value, variable.label] as [string, string],
          ),
        ]}
        onChange={(value) => {
          const variableBindings = { ...selected.variableBindings };
          const next = variables.find((variable) => variable.value === value);
          if (next)
            variableBindings[key] = {
              collectionId: next.collectionId,
              variableId: next.variableId,
            };
          else delete variableBindings[key];
          change({ variableBindings });
        }}
      />
    );
  };
  const binding = (key: string, token: string) => {
    if (!selected) return;
    const tokenBindings = { ...selected.tokenBindings };
    if (token) tokenBindings[key] = token as keyof ThemeTokens;
    else delete tokenBindings[key];
    change({ tokenBindings });
  };
  const unbound = (key: string) => {
    const bindings = { ...selected.tokenBindings };
    delete bindings[key];
    return bindings;
  };
  const colorField = (key: "fill" | "color" | "stroke", label: string) => {
    const token = selected.tokenBindings?.[key];
    const value = String(
      token
        ? tokens[token]
        : (selected[key] ?? (key === "color" ? tokens.text : "#d9d9d9")),
    );
    return (
      <>
        <div className="ed-color-input">
          <input
            type="color"
            aria-label={`${label}拾色器`}
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
            onChange={(event) =>
              change({ [key]: event.target.value, tokenBindings: unbound(key) })
            }
          />
          <ColorTextField
            label={label}
            value={value}
            onChange={(color) =>
              change({ [key]: color, tokenBindings: unbound(key) })
            }
          />
          <span>100%</span>
        </div>
        <Choice
          label={`${label}变量`}
          value={String(token ?? "")}
          onChange={(value) => binding(key, value)}
          options={[
            ["", "独立值 · 绑定变量"],
            ...colorKeys.map((key) => [key, `◇ ${key}`] as [string, string]),
          ]}
        />
      </>
    );
  };
  return (
    <aside className="ed-inspector">
      <Tabs value={tab} onValueChange={setTab} className="ed-panel-tabs">
        <TabsList>
          <TabsTrigger value="design">设计</TabsTrigger>
          <TabsTrigger value="prototype">原型</TabsTrigger>
          <TabsTrigger value="inspect">开发</TabsTrigger>
        </TabsList>
        <div className="ed-inspector-scroll">
          <TabsContent value="design">
            {selected ? (
              <>
                <PropertySection
                  title={
                    selection.length > 1
                      ? `已选择 ${selection.length} 个图层`
                      : selected.type === "component"
                        ? "组件实例"
                        : "图层"
                  }
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      title="锁定图层"
                      onClick={() =>
                        updateSelected({ locked: !selected.locked })
                      }
                    >
                      <LockKeyhole size={13} />
                    </Button>
                  }
                >
                  <Input
                    aria-label="图层名称"
                    value={selected.name}
                    onChange={(event) => change({ name: event.target.value })}
                  />
                </PropertySection>
                <PropertySection title="位置">
                  <div className="ed-alignment">
                    {[
                      ["left", "左对齐", AlignStartVertical],
                      ["center", "水平居中", AlignCenterVertical],
                      ["right", "右对齐", AlignEndVertical],
                      ["top", "顶部对齐", AlignStartHorizontal],
                      ["middle", "垂直居中", AlignCenterHorizontal],
                      ["bottom", "底部对齐", AlignEndHorizontal],
                    ].map(([mode, title, Icon]) => {
                      const Glyph = Icon as typeof AlignStartVertical;
                      return (
                        <Button
                          key={String(mode)}
                          size="icon"
                          variant="ghost"
                          title={String(title)}
                          onClick={() => align(String(mode))}
                        >
                          <Glyph size={15} />
                        </Button>
                      );
                    })}
                  </div>
                  <div className="ed-two-fields">
                    <NumberField
                      label="X"
                      value={selected.x}
                      onChange={(x) => change({ x })}
                    />
                    <NumberField
                      label="Y"
                      value={selected.y}
                      onChange={(y) => change({ y })}
                    />
                    <NumberField
                      label="旋转"
                      value={selected.rotation ?? 0}
                      onChange={(rotation) => updateSelected({ rotation })}
                    />
                    <div className="ed-inline-actions">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="水平翻转"
                        onClick={() =>
                          updateSelected({ flipX: !selected.flipX })
                        }
                      >
                        <FlipHorizontal2 size={15} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="垂直翻转"
                        onClick={() =>
                          updateSelected({ flipY: !selected.flipY })
                        }
                      >
                        <FlipVertical2 size={15} />
                      </Button>
                    </div>
                  </div>
                  {selection.length > 2 && (
                    <div className="ed-row-buttons">
                      <Button
                        variant="secondary"
                        onClick={() => align("distributeX")}
                      >
                        <AlignHorizontalDistributeCenter size={13} />
                        水平分布
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => align("distributeY")}
                      >
                        <AlignVerticalDistributeCenter size={13} />
                        垂直分布
                      </Button>
                    </div>
                  )}
                </PropertySection>
                <PropertySection
                  title="布局"
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      title="锁定宽高比"
                      data-active={selected.aspectRatioLocked}
                      onClick={() =>
                        change({
                          aspectRatioLocked: !selected.aspectRatioLocked,
                        })
                      }
                    >
                      <Link2 size={13} />
                    </Button>
                  }
                >
                  <div className="ed-two-fields">
                    <NumberField
                      label="W"
                      value={selected.width}
                      min={1}
                      onChange={(width) =>
                        change({
                          width,
                          ...(selected.aspectRatioLocked
                            ? {
                                height:
                                  (width / selected.width) * selected.height,
                              }
                            : {}),
                        })
                      }
                    />
                    <NumberField
                      label="H"
                      value={selected.height}
                      min={1}
                      onChange={(height) =>
                        change({
                          height,
                          ...(selected.aspectRatioLocked
                            ? {
                                width:
                                  (height / selected.height) * selected.width,
                              }
                            : {}),
                        })
                      }
                    />
                  </div>
                  {containers.has(selected.type) && (
                    <>
                      <div className="ed-labeled-row">
                        <span>自动布局</span>
                        <Choice
                          label="自动布局方向"
                          value={selected.layout ?? "none"}
                          onChange={(layout) =>
                            change({ layout: layout as DesignNode["layout"] })
                          }
                          options={[
                            ["none", "自由布局"],
                            ["horizontal", "→ 水平"],
                            ["vertical", "↓ 垂直"],
                            ["wrap", "↳ 自动换行"],
                          ]}
                        />
                      </div>
                      {selected.layout && selected.layout !== "none" && (
                        <>
                          <div className="ed-two-fields">
                            <NumberField
                              label="间距"
                              value={selected.gap ?? 16}
                              onChange={(gap) => change({ gap })}
                            />
                            <NumberField
                              label="内边距"
                              value={selected.padding ?? 16}
                              min={0}
                              onChange={(padding) =>
                                change({
                                  padding,
                                  paddingX: undefined,
                                  paddingY: undefined,
                                })
                              }
                            />
                            <NumberField
                              label="水平边距"
                              value={
                                selected.paddingX ?? selected.padding ?? 16
                              }
                              min={0}
                              onChange={(paddingX) => change({ paddingX })}
                            />
                            <NumberField
                              label="垂直边距"
                              value={
                                selected.paddingY ?? selected.padding ?? 16
                              }
                              min={0}
                              onChange={(paddingY) => change({ paddingY })}
                            />
                          </div>
                          <div className="ed-two-fields">
                            <Choice
                              label="交叉轴对齐"
                              value={selected.alignItems ?? "start"}
                              onChange={(alignItems) =>
                                change({
                                  alignItems:
                                    alignItems as DesignNode["alignItems"],
                                })
                              }
                              options={[
                                ["start", "起点对齐"],
                                ["center", "居中对齐"],
                                ["end", "末端对齐"],
                                ["stretch", "拉伸填充"],
                              ]}
                            />
                            <Choice
                              label="主轴分布"
                              value={selected.justifyContent ?? "start"}
                              onChange={(justifyContent) =>
                                change({
                                  justifyContent:
                                    justifyContent as DesignNode["justifyContent"],
                                })
                              }
                              options={[
                                ["start", "起点分布"],
                                ["center", "居中分布"],
                                ["end", "末端分布"],
                                ["space-between", "两端分布"],
                              ]}
                            />
                          </div>
                          <div className="ed-two-fields">
                            <Choice
                              label="容器宽度策略"
                              value={selected.sizingHorizontal ?? "fixed"}
                              onChange={(sizingHorizontal) =>
                                change({
                                  sizingHorizontal:
                                    sizingHorizontal as DesignNode["sizingHorizontal"],
                                })
                              }
                              options={[
                                ["fixed", "固定宽度"],
                                ["hug", "适应内容宽度"],
                              ]}
                            />
                            <Choice
                              label="容器高度策略"
                              value={selected.sizingVertical ?? "fixed"}
                              onChange={(sizingVertical) =>
                                change({
                                  sizingVertical:
                                    sizingVertical as DesignNode["sizingVertical"],
                                })
                              }
                              options={[
                                ["fixed", "固定高度"],
                                ["hug", "适应内容高度"],
                              ]}
                            />
                          </div>
                        </>
                      )}
                      <label className="ed-labeled-row">
                        <span>裁剪内容</span>
                        <Switch
                          aria-label="裁剪内容"
                          checked={!!selected.clipContent}
                          onCheckedChange={(clipContent) =>
                            change({ clipContent })
                          }
                        />
                      </label>
                    </>
                  )}
                  {selected.parentId && (
                    <>
                      <div className="ed-two-fields">
                        <Choice
                          label="水平约束"
                          value={selected.constraints?.horizontal ?? "left"}
                          onChange={(horizontal) =>
                            change({
                              constraints: {
                                horizontal: horizontal as "left",
                                vertical:
                                  selected.constraints?.vertical ?? "top",
                              },
                            })
                          }
                          options={[
                            ["left", "固定左侧"],
                            ["right", "固定右侧"],
                            ["center", "水平居中"],
                            ["left-right", "左右拉伸"],
                            ["scale", "等比缩放"],
                          ]}
                        />
                        <Choice
                          label="垂直约束"
                          value={selected.constraints?.vertical ?? "top"}
                          onChange={(vertical) =>
                            change({
                              constraints: {
                                vertical: vertical as "top",
                                horizontal:
                                  selected.constraints?.horizontal ?? "left",
                              },
                            })
                          }
                          options={[
                            ["top", "固定顶部"],
                            ["bottom", "固定底部"],
                            ["center", "垂直居中"],
                            ["top-bottom", "上下拉伸"],
                            ["scale", "等比缩放"],
                          ]}
                        />
                      </div>
                    </>
                  )}
                </PropertySection>
                <PropertySection title="外观">
                  <div className="ed-two-fields">
                    <NumberField
                      label="透明度 %"
                      value={(selected.opacity ?? 1) * 100}
                      min={0}
                      max={100}
                      onChange={(opacity) =>
                        updateSelected({ opacity: opacity / 100 })
                      }
                    />
                    <NumberField
                      label="圆角"
                      value={
                        selected.tokenBindings?.radius
                          ? Number(tokens[selected.tokenBindings.radius])
                          : (selected.radius ?? 0)
                      }
                      min={0}
                      onChange={(radius) =>
                        change({ radius, tokenBindings: unbound("radius") })
                      }
                    />
                  </div>
                  <Choice
                    label="混合模式"
                    value={selected.blendMode ?? "normal"}
                    onChange={(blendMode) =>
                      updateSelected({
                        blendMode: blendMode as DesignNode["blendMode"],
                      })
                    }
                    options={[
                      ["normal", "正常"],
                      ["multiply", "正片叠底"],
                      ["screen", "滤色"],
                      ["overlay", "叠加"],
                      ["darken", "变暗"],
                      ["lighten", "变亮"],
                    ]}
                  />
                </PropertySection>
                {selected.type !== "group" && (
                  <PropertySection
                    title="填充"
                    action={
                      <Button
                        size="icon"
                        variant="ghost"
                        title="移除填充"
                        onClick={() =>
                          change({
                            fill: "transparent",
                            gradient: undefined,
                            tokenBindings: unbound("fill"),
                          })
                        }
                      >
                        <X size={13} />
                      </Button>
                    }
                  >
                    <Choice
                      label="填充类型"
                      value={selected.gradient?.type ?? "solid"}
                      onChange={(value) =>
                        change({
                          gradient:
                            value === "solid"
                              ? undefined
                              : {
                                  type: value as "linear" | "radial",
                                  from: selected.fill?.startsWith("#")
                                    ? selected.fill
                                    : "#0d99ff",
                                  to: "#b9dfff",
                                  angle: 135,
                                },
                        })
                      }
                      options={[
                        ["solid", "纯色"],
                        ["linear", "线性渐变"],
                        ["radial", "径向渐变"],
                      ]}
                    />
                    {selected.gradient ? (
                      <>
                        <div className="ed-two-fields">
                          {(["from", "to"] as const).map((key) => (
                            <label className="ed-gradient-stop" key={key}>
                              <input
                                type="color"
                                aria-label={
                                  key === "from" ? "渐变起始色" : "渐变结束色"
                                }
                                value={selected.gradient![key]}
                                onChange={(event) =>
                                  change({
                                    gradient: {
                                      ...selected.gradient!,
                                      [key]: event.target.value,
                                    },
                                  })
                                }
                              />
                              <ColorTextField
                                label={
                                  key === "from" ? "渐变起始色" : "渐变结束色"
                                }
                                value={selected.gradient![key]}
                                onChange={(color) =>
                                  change({
                                    gradient: {
                                      ...selected.gradient!,
                                      [key]: color,
                                    },
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <NumberField
                          label="渐变角度"
                          value={selected.gradient.angle}
                          onChange={(angle) =>
                            change({
                              gradient: { ...selected.gradient!, angle },
                            })
                          }
                        />
                      </>
                    ) : (
                      colorField("fill", "填充颜色")
                    )}
                  </PropertySection>
                )}
                <PropertySection
                  title="描边"
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      title={selected.stroke ? "移除描边" : "添加描边"}
                      onClick={() =>
                        change({
                          stroke: selected.stroke ? undefined : "#000000",
                          strokeWidth: selected.stroke ? undefined : 1,
                        })
                      }
                    >
                      {selected.stroke ? <X size={13} /> : <Plus size={13} />}
                    </Button>
                  }
                >
                  {selected.stroke && (
                    <>
                      {colorField("stroke", "描边颜色")}
                      <div className="ed-two-fields">
                        <NumberField
                          label="粗细"
                          value={selected.strokeWidth ?? 1}
                          min={0}
                          onChange={(strokeWidth) => change({ strokeWidth })}
                        />
                        <Choice
                          label="描边样式"
                          value={selected.strokeDash ?? "solid"}
                          onChange={(strokeDash) =>
                            change({
                              strokeDash:
                                strokeDash as DesignNode["strokeDash"],
                            })
                          }
                          options={[
                            ["solid", "实线"],
                            ["dashed", "虚线"],
                            ["dotted", "点线"],
                          ]}
                        />
                      </div>
                    </>
                  )}
                </PropertySection>
                {(selected.type === "text" || selected.type === "button") && (
                  <PropertySection title="文字">
                    <Textarea
                      aria-label="文字内容"
                      value={selected.text ?? ""}
                      onChange={(event) => change({ text: event.target.value })}
                    />
                    <Choice
                      label="字体"
                      value={selected.fontFamily ?? ""}
                      onChange={(fontFamily) =>
                        change({ fontFamily: fontFamily || undefined })
                      }
                      options={[
                        [
                          "",
                          `使用主题字体 · ${tokens.fontFamily.split(",")[0]}`,
                        ],
                        ...[
                          ...new Set([
                            tokens.fontFamily,
                            "Inter, sans-serif",
                            "Arial, sans-serif",
                            "Georgia, serif",
                            "Microsoft YaHei, sans-serif",
                            "monospace",
                          ]),
                        ].map(
                          (font) =>
                            [font, font.split(",")[0]] as [string, string],
                        ),
                      ]}
                    />
                    <div className="ed-two-fields">
                      <Choice
                        label="字重"
                        value={String(selected.fontWeight ?? 400)}
                        onChange={(fontWeight) =>
                          change({ fontWeight: Number(fontWeight) })
                        }
                        options={[
                          ["300", "Light"],
                          ["400", "Regular"],
                          ["500", "Medium"],
                          ["600", "Semibold"],
                          ["700", "Bold"],
                          ["800", "Extra bold"],
                        ]}
                      />
                      <NumberField
                        label="字号"
                        value={selected.fontSize ?? 14}
                        min={1}
                        onChange={(fontSize) => change({ fontSize })}
                      />
                      <NumberField
                        label="行高"
                        value={selected.lineHeight ?? 1.4}
                        min={0.5}
                        step={0.1}
                        onChange={(lineHeight) => change({ lineHeight })}
                      />
                      <NumberField
                        label="字间距"
                        value={selected.letterSpacing ?? 0}
                        step={0.1}
                        onChange={(letterSpacing) => change({ letterSpacing })}
                      />
                    </div>
                    <div className="ed-two-fields">
                      <Choice
                        label="文本对齐"
                        value={selected.textAlign ?? "left"}
                        onChange={(textAlign) =>
                          change({
                            textAlign: textAlign as DesignNode["textAlign"],
                          })
                        }
                        options={[
                          ["left", "左对齐"],
                          ["center", "居中"],
                          ["right", "右对齐"],
                          ["justify", "两端对齐"],
                        ]}
                      />
                      <Choice
                        label="文本装饰"
                        value={selected.textDecoration ?? "none"}
                        onChange={(textDecoration) =>
                          change({
                            textDecoration:
                              textDecoration as DesignNode["textDecoration"],
                          })
                        }
                        options={[
                          ["none", "无装饰"],
                          ["underline", "下划线"],
                          ["line-through", "删除线"],
                        ]}
                      />
                    </div>
                    <label className="ed-labeled-row">
                      <span>斜体</span>
                      <Switch
                        checked={selected.fontStyle === "italic"}
                        onCheckedChange={(italic) =>
                          change({ fontStyle: italic ? "italic" : "normal" })
                        }
                        aria-label="斜体"
                      />
                    </label>
                    {colorField("color", "文字颜色")}
                  </PropertySection>
                )}
                {(selected.type === "polygon" || selected.type === "star") && (
                  <PropertySection title="形状">
                    <NumberField
                      label={selected.type === "star" ? "星角数量" : "边数"}
                      value={selected.polygonSides ?? 5}
                      min={3}
                      max={24}
                      onChange={(polygonSides) => change({ polygonSides })}
                    />
                    {selected.type === "star" && (
                      <NumberField
                        label="内半径比例"
                        value={selected.starRatio ?? 0.45}
                        min={0.05}
                        max={0.95}
                        step={0.05}
                        onChange={(starRatio) => change({ starRatio })}
                      />
                    )}
                  </PropertySection>
                )}
                {selected.type === "path" && (
                  <PropertySection title="矢量路径">
                    <label className="ed-labeled-row">
                      <span>闭合路径</span>
                      <Switch
                        aria-label="闭合路径"
                        checked={!!selected.closed}
                        onCheckedChange={(closed) => change({ closed })}
                      />
                    </label>
                    <p className="ed-muted">
                      双击路径可编辑锚点，拖动蓝色锚点调整矢量。
                    </p>
                    {selected.points?.map((point, index) => (
                      <div className="ed-two-fields" key={index}>
                        <NumberField
                          label={`X${index + 1}`}
                          value={point.x}
                          onChange={(x) =>
                            change({
                              points: selected.points!.map((p, i) =>
                                i === index ? { ...p, x } : p,
                              ),
                            })
                          }
                        />
                        <NumberField
                          label={`Y${index + 1}`}
                          value={point.y}
                          onChange={(y) =>
                            change({
                              points: selected.points!.map((p, i) =>
                                i === index ? { ...p, y } : p,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </PropertySection>
                )}
                {selected.type === "image" && (
                  <PropertySection title="图片">
                    <Input
                      aria-label="图片地址"
                      value={selected.src ?? ""}
                      onChange={(event) => change({ src: event.target.value })}
                      placeholder="图片 URL 或 data URL"
                    />
                  </PropertySection>
                )}
                <PropertySection
                  title="效果"
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      title={selected.shadow ? "移除阴影" : "添加阴影"}
                      onClick={() =>
                        change({
                          shadow: selected.shadow
                            ? undefined
                            : {
                                x: 0,
                                y: 4,
                                blur: 12,
                                spread: 0,
                                color: "#00000026",
                              },
                        })
                      }
                    >
                      {selected.shadow ? <X size={13} /> : <Plus size={13} />}
                    </Button>
                  }
                >
                  {selected.shadow && (
                    <>
                      <div className="ed-effect-label">投影</div>
                      <div className="ed-two-fields">
                        {(["x", "y", "blur", "spread"] as const).map((key) => (
                          <NumberField
                            key={key}
                            label={
                              { x: "X", y: "Y", blur: "模糊", spread: "扩展" }[
                                key
                              ]
                            }
                            value={selected.shadow![key]}
                            onChange={(value) =>
                              change({
                                shadow: { ...selected.shadow!, [key]: value },
                              })
                            }
                          />
                        ))}
                      </div>
                      <ColorTextField
                        label="阴影颜色"
                        value={selected.shadow.color}
                        onChange={(color) =>
                          change({ shadow: { ...selected.shadow!, color } })
                        }
                      />
                    </>
                  )}
                  <NumberField
                    label="图层模糊"
                    value={selected.blur ?? 0}
                    min={0}
                    max={100}
                    onChange={(blur) => change({ blur })}
                  />
                </PropertySection>
                {component && (
                  <PropertySection title="组件实例">
                    <Button
                      variant="secondary"
                      className="ed-wide"
                      onClick={() => setEditingMaster(true)}
                    >
                      <Component size={13} />
                      编辑主组件
                    </Button>
                    <Choice
                      label="交换组件"
                      value={component.id}
                      onChange={(componentId) => {
                        const next = project.components.find(
                          (item) => item.id === componentId,
                        );
                        if (next)
                          change({
                            componentId,
                            name: next.name,
                            overrides: undefined,
                          });
                      }}
                      options={project.components.map((item) => [
                        item.id,
                        `${item.name}${item.setId && item.setId === component.setId ? " · " + Object.values(item.variantProperties ?? {}).join(" / ") : ""}`,
                      ])}
                    />
                    {component.nodes
                      .filter((node) => node.text !== undefined)
                      .map((node) => (
                        <label className="ed-stack-label" key={node.id}>
                          {node.name}
                          <Input
                            aria-label={`${node.name}实例文字`}
                            value={
                              selected.overrides?.[node.id]?.text ??
                              node.text ??
                              ""
                            }
                            onChange={(event) =>
                              change({
                                overrides: {
                                  ...selected.overrides,
                                  [node.id]: {
                                    ...selected.overrides?.[node.id],
                                    text: event.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    <div className="ed-row-buttons">
                      <Button
                        variant="secondary"
                        onClick={() => change({ overrides: undefined })}
                      >
                        <RotateCcw size={13} />
                        重置
                      </Button>
                      <Button variant="secondary" onClick={detach}>
                        分离实例
                      </Button>
                    </div>
                  </PropertySection>
                )}
                {!!project.variableCollections?.length && (
                  <PropertySection title="变量绑定">
                    {variableField("fill", "color", "填充变量")}
                    {variableField("color", "color", "文字颜色变量")}
                    {variableField("radius", "number", "圆角变量")}
                    {variableField("fontSize", "number", "字号变量")}
                    {variableField("text", "string", "文本变量")}
                    {variableField("visible", "boolean", "可见性变量")}
                  </PropertySection>
                )}
                <PropertySection title="组织图层">
                  <div className="ed-row-buttons">
                    <Button variant="secondary" onClick={group}>
                      编组
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={ungroup}
                      disabled={
                        !selection.some((node) => containers.has(node.type))
                      }
                    >
                      取消编组
                    </Button>
                  </div>
                  {selected.type !== "component" && (
                    <Button
                      variant="secondary"
                      className="ed-wide"
                      onClick={createComponent}
                    >
                      <Component size={13} />
                      创建组件
                    </Button>
                  )}
                  <Choice
                    label="父级容器"
                    value={selected.parentId ?? ""}
                    onChange={(parentId) =>
                      change({ parentId: parentId || undefined })
                    }
                    options={[
                      ["", "页面"],
                      ...page.nodes
                        .filter(
                          (node) =>
                            containers.has(node.type) &&
                            !descendants(
                              page.nodes,
                              selection.map((n) => n.id),
                            ).includes(node.id),
                        )
                        .map(
                          (node) => [node.id, node.name] as [string, string],
                        ),
                    ]}
                  />
                  <div className="ed-row-buttons">
                    <Button variant="ghost" onClick={duplicate}>
                      <Copy size={13} />
                      创建副本
                    </Button>
                    <Button variant="ghost" onClick={remove}>
                      <Trash2 size={13} />
                      删除
                    </Button>
                  </div>
                </PropertySection>
              </>
            ) : (
              <>
                <PropertySection title="页面">
                  <Input
                    aria-label="页面名称"
                    value={page.name}
                    onChange={(event) =>
                      updatePage({ name: event.target.value })
                    }
                  />
                  <div className="ed-two-fields">
                    <NumberField
                      label="宽度"
                      value={page.width}
                      min={100}
                      max={20000}
                      onChange={(width) => updatePage({ width })}
                    />
                    <NumberField
                      label="高度"
                      value={page.height}
                      min={100}
                      max={20000}
                      onChange={(height) => updatePage({ height })}
                    />
                  </div>
                  <Choice
                    label="设备预设"
                    value=""
                    onChange={(value) => {
                      const [width, height] = value.split("x").map(Number);
                      if (width && height) updatePage({ width, height });
                    }}
                    options={[
                      ["", "选择画布尺寸"],
                      ["1440x1000", "Desktop · 1440 × 1000"],
                      ["1920x1080", "Desktop · 1920 × 1080"],
                      ["834x1194", "Tablet · 834 × 1194"],
                      ["390x844", "Mobile · 390 × 844"],
                      ["430x932", "Mobile · 430 × 932"],
                    ]}
                  />
                  <div className="ed-color-input">
                    <input
                      type="color"
                      aria-label="画布背景颜色"
                      value={page.background ?? tokens.background}
                      onChange={(event) =>
                        updatePage({ background: event.target.value })
                      }
                    />
                    <ColorTextField
                      label="画布背景"
                      value={page.background ?? tokens.background}
                      onChange={(background) => updatePage({ background })}
                    />
                  </div>
                </PropertySection>
                <PropertySection
                  title="布局网格"
                  action={
                    <Switch
                      aria-label="显示布局网格"
                      checked={!!page.grid?.enabled}
                      onCheckedChange={(enabled) =>
                        updatePage({ grid: { size: 8, ...page.grid, enabled } })
                      }
                    />
                  }
                >
                  <Choice
                    label="网格类型"
                    value={page.grid?.type ?? "grid"}
                    onChange={(type) =>
                      updatePage({
                        grid: {
                          size: 8,
                          enabled: true,
                          ...page.grid,
                          type: type as "grid" | "columns",
                        },
                      })
                    }
                    options={[
                      ["grid", "网格"],
                      ["columns", "列"],
                    ]}
                  />
                  {page.grid?.type === "columns" ? (
                    <div className="ed-two-fields">
                      <NumberField
                        label="列数"
                        value={page.grid.columns ?? 12}
                        min={1}
                        max={32}
                        onChange={(columns) =>
                          updatePage({ grid: { ...page.grid!, columns } })
                        }
                      />
                      <NumberField
                        label="栏间距"
                        value={page.grid.gutter ?? 20}
                        min={0}
                        onChange={(gutter) =>
                          updatePage({ grid: { ...page.grid!, gutter } })
                        }
                      />
                      <NumberField
                        label="边距"
                        value={page.grid.margin ?? 32}
                        min={0}
                        onChange={(margin) =>
                          updatePage({ grid: { ...page.grid!, margin } })
                        }
                      />
                    </div>
                  ) : (
                    <NumberField
                      label="网格尺寸"
                      value={page.grid?.size ?? 8}
                      min={1}
                      max={256}
                      onChange={(size) =>
                        updatePage({
                          grid: { enabled: true, ...page.grid, size },
                        })
                      }
                    />
                  )}
                </PropertySection>
                <PropertySection title="本地变量">
                  <div className="ed-token-list">
                    {colorKeys.map((key) => (
                      <label key={key}>
                        <input
                          type="color"
                          aria-label={`${key}主题颜色`}
                          value={String(tokens[key])}
                          onChange={(event) =>
                            updateTokens({ [key]: event.target.value })
                          }
                        />
                        <span>{key}</span>
                        <code>{tokens[key]}</code>
                      </label>
                    ))}
                  </div>
                  <div className="ed-two-fields">
                    <NumberField
                      label="圆角"
                      value={tokens.radius}
                      min={0}
                      onChange={(radius) => updateTokens({ radius })}
                    />
                    <NumberField
                      label="间距"
                      value={tokens.spacing}
                      min={0}
                      onChange={(spacing) => updateTokens({ spacing })}
                    />
                  </div>
                </PropertySection>
                <PropertySection title="与凛协作">
                  <div className="ed-rin-collaborator">
                    <RinAvatar size={28} />
                    <div><strong>Rin / 设计搭档</strong><span>从想法，到可编辑的界面。</span></div>
                  </div>
                  <p className="ed-muted">
                    描述页面需求，生成设计并转换为可编辑图层。
                  </p>
                  <Button
                    variant="secondary"
                    className="ed-wide"
                    onClick={onAgent}
                  >
                    <RinIcon kind="agent" size={15} />
                    与凛协作
                  </Button>
                </PropertySection>
              </>
            )}
            <PropertySection title="导出">
              <div className="ed-row-buttons">
                <Button variant="secondary" onClick={() => exportFile("png")}>
                  PNG
                </Button>
                <Button variant="secondary" onClick={() => exportFile("svg")}>
                  SVG
                </Button>
                <Button variant="secondary" onClick={() => exportFile("json")}>
                  JSON
                </Button>
              </div>
            </PropertySection>
          </TabsContent>
          <TabsContent value="prototype">
            {selected ? (
              <>
                <PropertySection
                  title="交互"
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      title="移除交互"
                      onClick={() => change({ prototype: undefined })}
                    >
                      <X size={13} />
                    </Button>
                  }
                >
                  <Choice
                    label="触发方式"
                    value={selected.prototype?.trigger ?? "click"}
                    onChange={(trigger) =>
                      change({
                        prototype: {
                          action: "navigate",
                          ...selected.prototype,
                          trigger: trigger as "click" | "hover",
                        },
                      })
                    }
                    options={[
                      ["click", "点击时"],
                      ["hover", "悬停时"],
                    ]}
                  />
                  <Choice
                    label="原型动作"
                    value={selected.prototype?.action ?? ""}
                    onChange={(action) =>
                      change({
                        prototype: action
                          ? {
                              action: action as "navigate",
                              target: project.pages.find(
                                (p) => p.id !== page.id,
                              )?.id,
                              trigger: "click",
                              animation: "instant",
                              duration: 300,
                            }
                          : undefined,
                      })
                    }
                    options={[
                      ["", "添加交互"],
                      ["navigate", "跳转页面"],
                      ["overlay", "打开浮层"],
                      ["back", "返回"],
                      ["url", "打开链接"],
                    ]}
                  />
                  {selected.prototype && (
                    <>
                      {["navigate", "overlay"].includes(
                        selected.prototype.action,
                      ) && (
                        <Choice
                          label="目标页面"
                          value={selected.prototype.target ?? ""}
                          onChange={(target) =>
                            change({
                              prototype: { ...selected.prototype!, target },
                            })
                          }
                          options={[
                            ["", "选择目标页面"],
                            ...project.pages.map(
                              (p) => [p.id, p.name] as [string, string],
                            ),
                          ]}
                        />
                      )}
                      {selected.prototype.action === "url" && (
                        <Input
                          aria-label="目标网址"
                          placeholder="https://example.com"
                          value={selected.prototype.target ?? ""}
                          onChange={(event) =>
                            change({
                              prototype: {
                                ...selected.prototype!,
                                target: event.target.value,
                              },
                            })
                          }
                        />
                      )}
                      <Choice
                        label="过渡动画"
                        value={selected.prototype.animation ?? "instant"}
                        onChange={(animation) =>
                          change({
                            prototype: {
                              ...selected.prototype!,
                              animation: animation as "instant",
                            },
                          })
                        }
                        options={[
                          ["instant", "即时"],
                          ["dissolve", "淡入淡出"],
                          ["slide", "滑动"],
                        ]}
                      />
                      <NumberField
                        label="时长 ms"
                        value={selected.prototype.duration ?? 300}
                        min={0}
                        max={5000}
                        onChange={(duration) =>
                          change({
                            prototype: { ...selected.prototype!, duration },
                          })
                        }
                      />
                    </>
                  )}
                  <p className="ed-muted">
                    点击顶部播放按钮运行原型。蓝色交互标记会显示可点击的图层。
                  </p>
                </PropertySection>
              </>
            ) : (
              <PropertySection title="原型设置">
                <label className="ed-labeled-row">
                  <span>设为流程起点</span>
                  <Switch
                    checked={!!page.prototypeStart}
                    aria-label="原型起点"
                    onCheckedChange={(prototypeStart) =>
                      commit({
                        ...project,
                        pages: project.pages.map((p) => ({
                          ...p,
                          prototypeStart:
                            p.id === page.id ? prototypeStart : false,
                        })),
                      })
                    }
                  />
                </label>
                <p className="ed-muted">
                  选择图层后添加点击或悬停交互，支持页面跳转、浮层和返回。
                </p>
              </PropertySection>
            )}
            <PropertySection title="页面流程">
              {project.pages.map((p) => (
                <div className="ed-prototype-page" key={p.id}>
                  <span>
                    {p.prototypeStart ? "▶" : "◇"} {p.name}
                  </span>
                  <span>
                    {p.nodes.filter((n) => n.prototype).length} 个交互
                  </span>
                </div>
              ))}
            </PropertySection>
          </TabsContent>
          <TabsContent value="inspect">
            <PropertySection title="开发交付">
              <div className="ed-inspect-title">
                <Code2 size={14} />
                CSS
                <Button
                  variant="ghost"
                  size="icon"
                  title="复制 CSS"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      selected
                        ? nodeCss(selected, tokens)
                        : `width: ${page.width}px;\nheight: ${page.height}px;`,
                    )
                  }
                >
                  <Copy size={13} />
                </Button>
              </div>
              <pre className="ed-code">
                {selected
                  ? nodeCss(selected, tokens)
                  : `width: ${page.width}px;\nheight: ${page.height}px;\nbackground: var(--forma-background);`}
              </pre>
              <Button className="ed-wide" onClick={onSync}>
                同步到代码项目
              </Button>
            </PropertySection>
            <PropertySection title="设计数据">
              <div className="ed-info-row">
                <span>版本</span>
                <code>v{project.revision}</code>
              </div>
              <div className="ed-info-row">
                <span>工作空间</span>
                <span>
                  {project.workspace?.kind === "github"
                    ? "GitHub"
                    : project.workspace
                      ? "本地项目"
                      : "未绑定"}
                </span>
              </div>
              {selected && (
                <>
                  <div className="ed-info-row">
                    <span>节点 ID</span>
                    <code className="ed-truncate">{selected.id}</code>
                  </div>
                  <div className="ed-info-row">
                    <span>类型</span>
                    <code>{selected.type}</code>
                  </div>
                </>
              )}
            </PropertySection>
          </TabsContent>
        </div>
      </Tabs>
      <footer className="ed-inspector-footer">
        <SlidersHorizontal size={12} />
        <span>{page.nodes.length} 个图层</span>
        <span>v{project.revision}</span>
      </footer>
      {editingMaster && component && (
        <ComponentMasterDialog
          project={project}
          componentId={component.id}
          onChange={commit}
          onClose={() => setEditingMaster(false)}
        />
      )}
    </aside>
  );
}
