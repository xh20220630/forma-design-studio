import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useStudioMotion } from '../../lib/motion';
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
} from 'lucide-react';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@forma/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@forma/ui/select';
import { Switch } from '@forma/ui/switch';
import type { DesignNode, DesignPage, Project, ThemeTokens } from '@forma/schema';
import { containers, descendants, nodeCss } from '@forma/editor-core/geometry';
import { getProjectTokens } from '@forma/renderer';
import ComponentMasterDialog from './ComponentMasterDialog';
import { RinAvatar, RinIcon } from '../brand/RinBrand';

/**
 * 呈现选项选择控件，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.value - 当前字段、模式或控件的取值。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.options - 本次操作的配置选项。
 * @param props.label - 面向用户显示的简短标签。
 * @returns 供 React 渲染的界面内容。
 */
export function Choice({
  value,
  onChange,
  options,
  label,
}: {
  /** 当前字段、模式或控件的取值。 */
  value: string;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (value: string) => void;
  /** 本次操作的配置选项。 */
  options: [string, string][];
  /** 面向用户显示的简短标签。 */
  label: string;
}) {
  return (
    <Select
      value={value || '__none'}
      onValueChange={
        /** 响应 onValueChange 交互，将用户操作应用到选项选择控件。 @param value - 当前字段、模式或控件的取值。 @returns 无返回值；通过副作用完成当前操作。 */
        (value) => onChange(value === '__none' ? '' : value)
      }
    >
      <SelectTrigger aria-label={label} className="ed-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="ed-select-menu">
        {options.map(
          /**
           * 转换选项选择控件中的集合条目，供后续处理或展示。
           *
           * @param options - 按顺序解构的当前条目。
           * @param options.key - 要访问或更新的字段名。
           * @param options.text - 需要展示或编辑的文字内容。
           * @returns 当前条目转换后的结果。
           */
          ([key, text]) => (
            <SelectItem key={key || '__none'} value={key || '__none'}>
              {text}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
/**
 * 呈现数值属性输入框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.label - 面向用户显示的简短标签。
 * @param props.value - 当前字段、模式或控件的取值。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.min - 允许的最小值。
 * @param props.max - 允许的最大值。
 * @param props.step - 数值控件或标尺每步变化的间隔。
 * @returns 供 React 渲染的界面内容。
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  /** 面向用户显示的简短标签。 */
  label: string;
  /** 当前字段、模式或控件的取值。 */
  value: number;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (value: number) => void;
  /** 允许的最小值。 */
  min?: number;
  /** 允许的最大值。 */
  max?: number;
  /** 数值控件或标尺每步变化的间隔。 */
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
        onChange={
          /**
           * 响应 onChange 交互，将用户操作应用到数值属性输入框。
           *
           * @param event - 当前事件及其触发位置。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          (event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next))
              onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next)));
          }
        }
      />
    </label>
  );
}
/**
 * 呈现颜色属性输入框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.value - 当前字段、模式或控件的取值。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.label - 面向用户显示的简短标签。
 * @returns 供 React 渲染的界面内容。
 */
function ColorTextField({
  value,
  onChange,
  label,
}: {
  /** 当前字段、模式或控件的取值。 */
  value: string;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (value: string) => void;
  /** 面向用户显示的简短标签。 */
  label: string;
}) {
  return (
    <Input
      key={value}
      aria-label={label}
      defaultValue={value}
      onBlur={
        /**
         * 响应 onBlur 交互，将用户操作应用到颜色属性输入框。
         *
         * @param event - 当前事件及其触发位置。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (event) => {
          const next = event.target.value.trim();
          if (next && CSS.supports('color', next)) onChange(next);
          else event.target.value = value;
        }
      }
      onKeyDown={
        /**
         * 响应 onKeyDown 交互，将用户操作应用到颜色属性输入框。
         *
         * @param event - 当前事件及其触发位置。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }
      }
    />
  );
}
/**
 * 呈现属性分组，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.title - 界面显示的标题。
 * @param props.children - 由调用方放入组件的子内容。
 * @param props.action - 当前要执行的操作或操作结果分类。
 * @returns 供 React 渲染的界面内容。
 */
export function PropertySection({
  title,
  children,
  action,
}: {
  /** 界面显示的标题。 */
  title: string;
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
  /** 当前要执行的操作或操作结果分类。 */
  action?: ReactNode;
}) {
  /** 界面状态：已折叠的分组或节点集合。通过状态更新驱动界面刷新。 */
  const [collapsed, setCollapsed] = useState(false);
  const { reduced, transition } = useStudioMotion();
  return (
    <section className={`ed-property-section ${collapsed ? 'is-collapsed' : ''}`}>
      <h3>
        <button
          className="ed-property-heading"
          onClick={
            /**
             * 响应 onClick 交互，将用户操作应用到属性分组。
             * @returns 当前步骤的处理结果。
             */
            () =>
              setCollapsed(
                /** 基于最新状态计算 Collapsed 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
                (value) => !value,
              )
          }
          aria-expanded={!collapsed}
        >
          <motion.span animate={{ rotate: collapsed ? -90 : 0 }} transition={transition}>
            <ChevronDown size={12} />
          </motion.span>
          <span>{title}</span>
        </button>
        {action}
      </h3>
      <motion.div
        initial={false}
        animate={{ height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
        transition={transition}
        inert={collapsed}
        aria-hidden={collapsed}
        style={{ overflow: collapsed || !reduced ? 'hidden' : undefined }}
      >
        <div className="ed-property-body">{children}</div>
      </motion.div>
    </section>
  );
}
/** Inspector 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /** 当前正在展示或编辑的页面。 */
  page: DesignPage;
  /** 当前选区或所选对象。 */
  selection: DesignNode[];
  /**
   * 提交单个节点局部属性修改的入口。
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @param patch - 仅包含本次要修改字段的局部更新。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  updateNode: (id: string, patch: Partial<DesignNode>) => void;
  /**
   * 批量修改选中节点的入口。
   * @param patch - 仅包含本次要修改字段的局部更新。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  updateSelected: (patch: Partial<DesignNode>) => void;
  /**
   * 提交当前页面局部修改的入口。
   * @param patch - 仅包含本次要修改字段的局部更新。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  updatePage: (patch: Partial<DesignPage>) => void;
  /**
   * 正式保存项目修改的入口。
   * @param project - 当前设计项目或工作空间项目元信息。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  commit: (project: Project) => void;
  /**
   * 执行图层对齐或均匀分布的入口。
   * @param mode - 当前使用的模式或操作方式。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  align: (mode: string) => void;
  /**
   * 把选区转换为可复用组件的入口。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  createComponent: () => void;
  /**
   * 解除组件实例关联的入口。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  detach: () => void;
  /**
   * 当前分组或编组节点。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  group: () => void;
  /**
   * 解开当前编组的入口。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  ungroup: () => void;
  /**
   * 复制当前目标的入口。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  duplicate: () => void;
  /**
   * 删除当前目标的入口。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  remove: () => void;
  /**
   * 导出当前页面或选区的入口。
   * @param format - 导出内容采用的文件格式。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  exportFile: (format: 'svg' | 'png' | 'json') => void;
  /**
   * 在同步时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSync: () => void;
  /**
   * 在助手时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onAgent: () => void;
}
const colorKeys: (keyof ThemeTokens)[] = [
  'primary',
  'background',
  'surface',
  'text',
  'muted',
  'border',
];
/**
 * 呈现属性检查面板，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.page - 当前正在展示或编辑的页面。
 * @param props.selection - 当前选区或所选对象。
 * @param props.updateNode - 提交单个节点局部属性修改的入口。
 * @param props.updateSelected - 批量修改选中节点的入口。
 * @param props.updatePage - 提交当前页面局部修改的入口。
 * @param props.commit - 正式保存项目修改的入口。
 * @param props.align - 执行图层对齐或均匀分布的入口。
 * @param props.createComponent - 把选区转换为可复用组件的入口。
 * @param props.detach - 解除组件实例关联的入口。
 * @param props.group - 当前分组或编组节点。
 * @param props.ungroup - 解开当前编组的入口。
 * @param props.duplicate - 复制当前目标的入口。
 * @param props.remove - 删除当前目标的入口。
 * @param props.exportFile - 导出当前页面或选区的入口。
 * @param props.onSync - 在同步时通知调用方，由外层决定如何更新业务状态。
 * @param props.onAgent - 在助手时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
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
  /** 界面状态：当前激活的标签页。通过状态更新驱动界面刷新。 */
  const [tab, setTab] = useState('design');
  /** 界面状态：当前正在编辑的组件母版。通过状态更新驱动界面刷新。 */
  const [editingMaster, setEditingMaster] = useState(false);
  const tokens = getProjectTokens(project);
  /**
   * 把检查面板的主题修改提交到项目。
   *
   * @param patch - 仅包含本次要修改字段的局部更新。
   * @returns 无返回值；通过副作用完成当前操作。
   */
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
    /** 检查条目的标识等于 selected 的组件引用，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (item) => item.id === selected?.componentId,
  );
  /**
   * 更新当前输入草稿，保留原内容供保存时检测冲突。
   *
   * @param patch - 仅包含本次要修改字段的局部更新。
   * @returns 无返回值；更新编辑草稿。
   */
  const change = (patch: Partial<DesignNode>) => selected && updateNode(selected.id, patch);
  /**
   * 构建变量绑定控件，让属性面板可以选择集合与变量。
   *
   * @param key - 要访问或更新的字段名。
   * @param type - 用于区分数据形态或行为分支的类型。
   * @param title - 界面显示的标题。
   * @returns 当前步骤的处理结果。
   */
  const variableField = (
    key: string,
    type: 'color' | 'number' | 'string' | 'boolean',
    title: string,
  ) => {
    const variables = (project.variableCollections ?? []).flatMap(
      /**
       * 转换 variableField 中的集合条目并展开结果，供后续处理或展示。
       *
       * @param collection - 当前处理的设计变量集合。
       * @returns 当前条目展开后的结果。
       */
      (collection) =>
        collection.variables
          .filter(
            /** 检查 variable 的类型等于类型，供集合筛选或定位使用。 @param variable - 当前设计变量定义。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
            (variable) => variable.type === type,
          )
          .map(
            /**
             * 转换 variableField 中的集合条目，供后续处理或展示。
             *
             * @param variable - 当前设计变量定义。
             * @returns 当前条目转换后的结果。
             */
            (variable) => ({
              value: `${collection.id}:${variable.id}`,
              label: `${collection.name} / ${variable.name}`,
              collectionId: collection.id,
              variableId: variable.id,
            }),
          ),
    );
    if (!variables.length) return null;
    const current = selected.variableBindings?.[key];
    return (
      <Choice
        label={title}
        value={current ? `${current.collectionId}:${current.variableId}` : ''}
        options={[
          ['', `${title} · 不绑定`],
          ...variables.map(
            /** 转换 variableField 中的集合条目，供后续处理或展示。 @param variable - 当前设计变量定义。 @returns 当前条目转换后的结果。 */
            (variable) => [variable.value, variable.label] as [string, string],
          ),
        ]}
        onChange={
          /**
           * 响应 onChange 交互，将用户操作应用到variableField。
           *
           * @param value - 当前字段、模式或控件的取值。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          (value) => {
            const variableBindings = { ...selected.variableBindings };
            const next = variables.find(
              /** 检查 variable 的取值等于取值，供集合筛选或定位使用。 @param variable - 当前设计变量定义。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
              (variable) => variable.value === value,
            );
            if (next)
              variableBindings[key] = {
                collectionId: next.collectionId,
                variableId: next.variableId,
              };
            else delete variableBindings[key];
            change({ variableBindings });
          }
        }
      />
    );
  };
  /**
   * 校验模型绑定与供应商能力是否匹配。
   *
   * @param key - 要访问或更新的字段名。
   * @param token - 当前处理的设计 Token。
   * @returns 通过校验的模型绑定。
   */
  const binding = (key: string, token: string) => {
    if (!selected) return;
    const tokenBindings = { ...selected.tokenBindings };
    if (token) tokenBindings[key] = token as keyof ThemeTokens;
    else delete tokenBindings[key];
    change({ tokenBindings });
  };
  /**
   * 移除当前属性绑定，使直接填写的属性值重新生效。
   *
   * @param key - 要访问或更新的字段名。
   * @returns 当前步骤的处理结果。
   */
  const unbound = (key: string) => {
    const bindings = { ...selected.tokenBindings };
    delete bindings[key];
    return bindings;
  };
  /**
   * 构建颜色属性控件，统一颜色值和绑定入口。
   *
   * @param key - 要访问或更新的字段名。
   * @param label - 面向用户显示的简短标签。
   * @returns 当前步骤的处理结果。
   */
  const colorField = (key: 'fill' | 'color' | 'stroke', label: string) => {
    const token = selected.tokenBindings?.[key];
    const value = String(
      token ? tokens[token] : (selected[key] ?? (key === 'color' ? tokens.text : '#d9d9d9')),
    );
    return (
      <>
        <div className="ed-color-input">
          <input
            type="color"
            aria-label={`${label}拾色器`}
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
            onChange={
              /** 响应 onChange 交互，将用户操作应用到colorField。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
              (event) => change({ [key]: event.target.value, tokenBindings: unbound(key) })
            }
          />
          <ColorTextField
            label={label}
            value={value}
            onChange={
              /** 响应 onChange 交互，将用户操作应用到colorField。 @param color - 文字或视觉元素的颜色。 @returns 无返回值；通过副作用完成当前操作。 */
              (color) => change({ [key]: color, tokenBindings: unbound(key) })
            }
          />
          <span>100%</span>
        </div>
        <Choice
          label={`${label}变量`}
          value={String(token ?? '')}
          onChange={
            /** 响应 onChange 交互，将用户操作应用到colorField。 @param value - 当前字段、模式或控件的取值。 @returns 无返回值；通过副作用完成当前操作。 */
            (value) => binding(key, value)
          }
          options={[
            ['', '独立值 · 绑定变量'],
            ...colorKeys.map(
              /** 转换 colorField 中的集合条目，供后续处理或展示。 @param key - 要访问或更新的字段名。 @returns 当前条目转换后的结果。 */
              (key) => [key, `◇ ${key}`] as [string, string],
            ),
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
                      : selected.type === 'component'
                        ? '组件实例'
                        : '图层'
                  }
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      title="锁定图层"
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => updateSelected({ locked: !selected.locked })
                      }
                    >
                      <LockKeyhole size={13} />
                    </Button>
                  }
                >
                  <Input
                    aria-label="图层名称"
                    value={selected.name}
                    onChange={
                      /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                      (event) => change({ name: event.target.value })
                    }
                  />
                </PropertySection>
                <PropertySection title="位置">
                  <div className="ed-alignment">
                    {[
                      ['left', '左对齐', AlignStartVertical],
                      ['center', '水平居中', AlignCenterVertical],
                      ['right', '右对齐', AlignEndVertical],
                      ['top', '顶部对齐', AlignStartHorizontal],
                      ['middle', '垂直居中', AlignCenterHorizontal],
                      ['bottom', '底部对齐', AlignEndHorizontal],
                    ].map(
                      /**
                       * 转换属性检查面板中的集合条目，供后续处理或展示。
                       *
                       * @param options - 按顺序解构的当前条目。
                       * @param options.mode - 当前使用的模式或操作方式。
                       * @param options.title - 界面显示的标题。
                       * @param options.Icon - 作为控件图标渲染的 React 组件。
                       * @returns 当前条目转换后的结果。
                       */
                      ([mode, title, Icon]) => {
                        const Glyph = Icon as typeof AlignStartVertical;
                        return (
                          <Button
                            key={String(mode)}
                            size="icon"
                            variant="ghost"
                            title={String(title)}
                            onClick={
                              /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                              () => align(String(mode))
                            }
                          >
                            <Glyph size={15} />
                          </Button>
                        );
                      },
                    )}
                  </div>
                  <div className="ed-two-fields">
                    <NumberField
                      label="X"
                      value={selected.x}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param x - 水平方向的位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (x) => change({ x })
                      }
                    />
                    <NumberField
                      label="Y"
                      value={selected.y}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param y - 垂直方向的位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (y) => change({ y })
                      }
                    />
                    <NumberField
                      label="旋转"
                      value={selected.rotation ?? 0}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param rotation - 围绕中心旋转的角度，单位为度。 @returns 无返回值；通过副作用完成当前操作。 */
                        (rotation) => updateSelected({ rotation })
                      }
                    />
                    <div className="ed-inline-actions">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="水平翻转"
                        onClick={
                          /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                          () => updateSelected({ flipX: !selected.flipX })
                        }
                      >
                        <FlipHorizontal2 size={15} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="垂直翻转"
                        onClick={
                          /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                          () => updateSelected({ flipY: !selected.flipY })
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
                        onClick={
                          /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                          () => align('distributeX')
                        }
                      >
                        <AlignHorizontalDistributeCenter size={13} />
                        水平分布
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={
                          /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                          () => align('distributeY')
                        }
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
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                        () =>
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
                      onChange={
                        /**
                         * 响应 onChange 交互，将用户操作应用到属性检查面板。
                         *
                         * @param width - 对象的宽度。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        (width) =>
                          change({
                            width,
                            ...(selected.aspectRatioLocked
                              ? {
                                  height: (width / selected.width) * selected.height,
                                }
                              : {}),
                          })
                      }
                    />
                    <NumberField
                      label="H"
                      value={selected.height}
                      min={1}
                      onChange={
                        /**
                         * 响应 onChange 交互，将用户操作应用到属性检查面板。
                         *
                         * @param height - 对象的高度。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        (height) =>
                          change({
                            height,
                            ...(selected.aspectRatioLocked
                              ? {
                                  width: (height / selected.height) * selected.width,
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
                          value={selected.layout ?? 'none'}
                          onChange={
                            /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param layout - 容器的排列方式，决定是否自动计算子节点位置。 @returns 无返回值；通过副作用完成当前操作。 */
                            (layout) => change({ layout: layout as DesignNode['layout'] })
                          }
                          options={[
                            ['none', '自由布局'],
                            ['horizontal', '→ 水平'],
                            ['vertical', '↓ 垂直'],
                            ['wrap', '↳ 自动换行'],
                          ]}
                        />
                      </div>
                      {selected.layout && selected.layout !== 'none' && (
                        <>
                          <div className="ed-two-fields">
                            <NumberField
                              label="间距"
                              value={selected.gap ?? 16}
                              onChange={
                                /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param gap - 相邻子元素之间的间距。 @returns 无返回值；通过副作用完成当前操作。 */
                                (gap) => change({ gap })
                              }
                            />
                            <NumberField
                              label="内边距"
                              value={selected.padding ?? 16}
                              min={0}
                              onChange={
                                /**
                                 * 响应 onChange 交互，将用户操作应用到属性检查面板。
                                 *
                                 * @param padding - 四个方向共用的内边距。
                                 * @returns 无返回值；通过副作用完成当前操作。
                                 */
                                (padding) =>
                                  change({
                                    padding,
                                    paddingX: undefined,
                                    paddingY: undefined,
                                  })
                              }
                            />
                            <NumberField
                              label="水平边距"
                              value={selected.paddingX ?? selected.padding ?? 16}
                              min={0}
                              onChange={
                                /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param paddingX - 水平方向内边距，用于覆盖共用内边距。 @returns 无返回值；通过副作用完成当前操作。 */
                                (paddingX) => change({ paddingX })
                              }
                            />
                            <NumberField
                              label="垂直边距"
                              value={selected.paddingY ?? selected.padding ?? 16}
                              min={0}
                              onChange={
                                /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param paddingY - 垂直方向内边距，用于覆盖共用内边距。 @returns 无返回值；通过副作用完成当前操作。 */
                                (paddingY) => change({ paddingY })
                              }
                            />
                          </div>
                          <div className="ed-two-fields">
                            <Choice
                              label="交叉轴对齐"
                              value={selected.alignItems ?? 'start'}
                              onChange={
                                /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param alignItems - 子元素在布局交叉轴上的对齐方式。 @returns 无返回值；通过副作用完成当前操作。 */
                                (alignItems) =>
                                  change({
                                    alignItems: alignItems as DesignNode['alignItems'],
                                  })
                              }
                              options={[
                                ['start', '起点对齐'],
                                ['center', '居中对齐'],
                                ['end', '末端对齐'],
                                ['stretch', '拉伸填充'],
                              ]}
                            />
                            <Choice
                              label="主轴分布"
                              value={selected.justifyContent ?? 'start'}
                              onChange={
                                /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param justifyContent - 子元素在布局主轴上的对齐或分布方式。 @returns 无返回值；通过副作用完成当前操作。 */
                                (justifyContent) =>
                                  change({
                                    justifyContent: justifyContent as DesignNode['justifyContent'],
                                  })
                              }
                              options={[
                                ['start', '起点分布'],
                                ['center', '居中分布'],
                                ['end', '末端分布'],
                                ['space-between', '两端分布'],
                              ]}
                            />
                          </div>
                          <div className="ed-two-fields">
                            <Choice
                              label="容器宽度策略"
                              value={selected.sizingHorizontal ?? 'fixed'}
                              onChange={
                                /**
                                 * 响应 onChange 交互，将用户操作应用到属性检查面板。
                                 *
                                 * @param sizingHorizontal - 宽度策略：fixed 固定、hug 随内容、fill 填满可用空间。
                                 * @returns 无返回值；通过副作用完成当前操作。
                                 */
                                (sizingHorizontal) =>
                                  change({
                                    sizingHorizontal:
                                      sizingHorizontal as DesignNode['sizingHorizontal'],
                                  })
                              }
                              options={[
                                ['fixed', '固定宽度'],
                                ['hug', '适应内容宽度'],
                              ]}
                            />
                            <Choice
                              label="容器高度策略"
                              value={selected.sizingVertical ?? 'fixed'}
                              onChange={
                                /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param sizingVertical - 高度策略：fixed 固定、hug 随内容、fill 填满可用空间。 @returns 无返回值；通过副作用完成当前操作。 */
                                (sizingVertical) =>
                                  change({
                                    sizingVertical: sizingVertical as DesignNode['sizingVertical'],
                                  })
                              }
                              options={[
                                ['fixed', '固定高度'],
                                ['hug', '适应内容高度'],
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
                          onCheckedChange={
                            /** 响应 onCheckedChange 交互，将用户操作应用到属性检查面板。 @param clipContent - 是否裁剪超出容器边界的子内容。 @returns 无返回值；通过副作用完成当前操作。 */
                            (clipContent) => change({ clipContent })
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
                          value={selected.constraints?.horizontal ?? 'left'}
                          onChange={
                            /**
                             * 响应 onChange 交互，将用户操作应用到属性检查面板。
                             *
                             * @param horizontal - 水平方向的约束或布局设置。
                             * @returns 无返回值；通过副作用完成当前操作。
                             */
                            (horizontal) =>
                              change({
                                constraints: {
                                  horizontal: horizontal as 'left',
                                  vertical: selected.constraints?.vertical ?? 'top',
                                },
                              })
                          }
                          options={[
                            ['left', '固定左侧'],
                            ['right', '固定右侧'],
                            ['center', '水平居中'],
                            ['left-right', '左右拉伸'],
                            ['scale', '等比缩放'],
                          ]}
                        />
                        <Choice
                          label="垂直约束"
                          value={selected.constraints?.vertical ?? 'top'}
                          onChange={
                            /**
                             * 响应 onChange 交互，将用户操作应用到属性检查面板。
                             *
                             * @param vertical - 垂直方向的约束或布局设置。
                             * @returns 无返回值；通过副作用完成当前操作。
                             */
                            (vertical) =>
                              change({
                                constraints: {
                                  vertical: vertical as 'top',
                                  horizontal: selected.constraints?.horizontal ?? 'left',
                                },
                              })
                          }
                          options={[
                            ['top', '固定顶部'],
                            ['bottom', '固定底部'],
                            ['center', '垂直居中'],
                            ['top-bottom', '上下拉伸'],
                            ['scale', '等比缩放'],
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
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param opacity - 不透明度，0 为完全透明，1 为完全不透明。 @returns 无返回值；通过副作用完成当前操作。 */
                        (opacity) => updateSelected({ opacity: opacity / 100 })
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
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param radius - 圆角大小。 @returns 无返回值；通过副作用完成当前操作。 */
                        (radius) => change({ radius, tokenBindings: unbound('radius') })
                      }
                    />
                  </div>
                  <Choice
                    label="混合模式"
                    value={selected.blendMode ?? 'normal'}
                    onChange={
                      /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param blendMode - 图层与背景的颜色混合方式。 @returns 无返回值；通过副作用完成当前操作。 */
                      (blendMode) =>
                        updateSelected({
                          blendMode: blendMode as DesignNode['blendMode'],
                        })
                    }
                    options={[
                      ['normal', '正常'],
                      ['multiply', '正片叠底'],
                      ['screen', '滤色'],
                      ['overlay', '叠加'],
                      ['darken', '变暗'],
                      ['lighten', '变亮'],
                    ]}
                  />
                </PropertySection>
                {selected.type !== 'group' && (
                  <PropertySection
                    title="填充"
                    action={
                      <Button
                        size="icon"
                        variant="ghost"
                        title="移除填充"
                        onClick={
                          /**
                           * 响应 onClick 交互，将用户操作应用到属性检查面板。
                           * @returns 无返回值；通过副作用完成当前操作。
                           */
                          () =>
                            change({
                              fill: 'transparent',
                              gradient: undefined,
                              tokenBindings: unbound('fill'),
                            })
                        }
                      >
                        <X size={13} />
                      </Button>
                    }
                  >
                    <Choice
                      label="填充类型"
                      value={selected.gradient?.type ?? 'solid'}
                      onChange={
                        /**
                         * 响应 onChange 交互，将用户操作应用到属性检查面板。
                         *
                         * @param value - 当前字段、模式或控件的取值。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        (value) =>
                          change({
                            gradient:
                              value === 'solid'
                                ? undefined
                                : {
                                    type: value as 'linear' | 'radial',
                                    from: selected.fill?.startsWith('#')
                                      ? selected.fill
                                      : '#0d99ff',
                                    to: '#b9dfff',
                                    angle: 135,
                                  },
                          })
                      }
                      options={[
                        ['solid', '纯色'],
                        ['linear', '线性渐变'],
                        ['radial', '径向渐变'],
                      ]}
                    />
                    {selected.gradient ? (
                      <>
                        <div className="ed-two-fields">
                          {(['from', 'to'] as const).map(
                            /**
                             * 转换属性检查面板中的集合条目，供后续处理或展示。
                             *
                             * @param key - 要访问或更新的字段名。
                             * @returns 当前条目转换后的结果。
                             */
                            (key) => (
                              <label className="ed-gradient-stop" key={key}>
                                <input
                                  type="color"
                                  aria-label={key === 'from' ? '渐变起始色' : '渐变结束色'}
                                  value={selected.gradient![key]}
                                  onChange={
                                    /**
                                     * 响应 onChange 交互，将用户操作应用到属性检查面板。
                                     *
                                     * @param event - 当前事件及其触发位置。
                                     * @returns 无返回值；通过副作用完成当前操作。
                                     */
                                    (event) =>
                                      change({
                                        gradient: {
                                          ...selected.gradient!,
                                          [key]: event.target.value,
                                        },
                                      })
                                  }
                                />
                                <ColorTextField
                                  label={key === 'from' ? '渐变起始色' : '渐变结束色'}
                                  value={selected.gradient![key]}
                                  onChange={
                                    /**
                                     * 响应 onChange 交互，将用户操作应用到属性检查面板。
                                     *
                                     * @param color - 文字或视觉元素的颜色。
                                     * @returns 无返回值；通过副作用完成当前操作。
                                     */
                                    (color) =>
                                      change({
                                        gradient: {
                                          ...selected.gradient!,
                                          [key]: color,
                                        },
                                      })
                                  }
                                />
                              </label>
                            ),
                          )}
                        </div>
                        <NumberField
                          label="渐变角度"
                          value={selected.gradient.angle}
                          onChange={
                            /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param angle - 旋转或渐变方向的角度。 @returns 无返回值；通过副作用完成当前操作。 */
                            (angle) =>
                              change({
                                gradient: { ...selected.gradient!, angle },
                              })
                          }
                        />
                      </>
                    ) : (
                      colorField('fill', '填充颜色')
                    )}
                  </PropertySection>
                )}
                <PropertySection
                  title="描边"
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      title={selected.stroke ? '移除描边' : '添加描边'}
                      onClick={
                        /**
                         * 响应 onClick 交互，将用户操作应用到属性检查面板。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        () =>
                          change({
                            stroke: selected.stroke ? undefined : '#000000',
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
                      {colorField('stroke', '描边颜色')}
                      <div className="ed-two-fields">
                        <NumberField
                          label="粗细"
                          value={selected.strokeWidth ?? 1}
                          min={0}
                          onChange={
                            /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param strokeWidth - 描边宽度。 @returns 无返回值；通过副作用完成当前操作。 */
                            (strokeWidth) => change({ strokeWidth })
                          }
                        />
                        <Choice
                          label="描边样式"
                          value={selected.strokeDash ?? 'solid'}
                          onChange={
                            /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param strokeDash - 描边线型。 @returns 无返回值；通过副作用完成当前操作。 */
                            (strokeDash) =>
                              change({
                                strokeDash: strokeDash as DesignNode['strokeDash'],
                              })
                          }
                          options={[
                            ['solid', '实线'],
                            ['dashed', '虚线'],
                            ['dotted', '点线'],
                          ]}
                        />
                      </div>
                    </>
                  )}
                </PropertySection>
                {(selected.type === 'text' || selected.type === 'button') && (
                  <PropertySection title="文字">
                    <Textarea
                      aria-label="文字内容"
                      value={selected.text ?? ''}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (event) => change({ text: event.target.value })
                      }
                    />
                    <Choice
                      label="字体"
                      value={selected.fontFamily ?? ''}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param fontFamily - 字体族名称，可包含回退字体。 @returns 无返回值；通过副作用完成当前操作。 */
                        (fontFamily) => change({ fontFamily: fontFamily || undefined })
                      }
                      options={[
                        ['', `使用主题字体 · ${tokens.fontFamily.split(',')[0]}`],
                        ...[
                          ...new Set([
                            tokens.fontFamily,
                            'Inter, sans-serif',
                            'Arial, sans-serif',
                            'Georgia, serif',
                            'Microsoft YaHei, sans-serif',
                            'monospace',
                          ]),
                        ].map(
                          /** 转换属性检查面板中的集合条目，供后续处理或展示。 @param font - 用于文字测量和绘制的完整字体设置。 @returns 当前条目转换后的结果。 */
                          (font) => [font, font.split(',')[0]] as [string, string],
                        ),
                      ]}
                    />
                    <div className="ed-two-fields">
                      <Choice
                        label="字重"
                        value={String(selected.fontWeight ?? 400)}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param fontWeight - 字体粗细，通常使用 400 表示常规、700 表示加粗。 @returns 无返回值；通过副作用完成当前操作。 */
                          (fontWeight) => change({ fontWeight: Number(fontWeight) })
                        }
                        options={[
                          ['300', 'Light'],
                          ['400', 'Regular'],
                          ['500', 'Medium'],
                          ['600', 'Semibold'],
                          ['700', 'Bold'],
                          ['800', 'Extra bold'],
                        ]}
                      />
                      <NumberField
                        label="字号"
                        value={selected.fontSize ?? 14}
                        min={1}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param fontSize - 文字字号。 @returns 无返回值；通过副作用完成当前操作。 */
                          (fontSize) => change({ fontSize })
                        }
                      />
                      <NumberField
                        label="行高"
                        value={selected.lineHeight ?? 1.4}
                        min={0.5}
                        step={0.1}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param lineHeight - 行高设置，用于多行文字排版。 @returns 无返回值；通过副作用完成当前操作。 */
                          (lineHeight) => change({ lineHeight })
                        }
                      />
                      <NumberField
                        label="字间距"
                        value={selected.letterSpacing ?? 0}
                        step={0.1}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param letterSpacing - 文字字符之间的附加间距。 @returns 无返回值；通过副作用完成当前操作。 */
                          (letterSpacing) => change({ letterSpacing })
                        }
                      />
                    </div>
                    <div className="ed-two-fields">
                      <Choice
                        label="文本对齐"
                        value={selected.textAlign ?? 'left'}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param textAlign - 文字在行内的水平对齐方式。 @returns 无返回值；通过副作用完成当前操作。 */
                          (textAlign) =>
                            change({
                              textAlign: textAlign as DesignNode['textAlign'],
                            })
                        }
                        options={[
                          ['left', '左对齐'],
                          ['center', '居中'],
                          ['right', '右对齐'],
                          ['justify', '两端对齐'],
                        ]}
                      />
                      <Choice
                        label="文本装饰"
                        value={selected.textDecoration ?? 'none'}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param textDecoration - 文字的下划线或删除线样式。 @returns 无返回值；通过副作用完成当前操作。 */
                          (textDecoration) =>
                            change({
                              textDecoration: textDecoration as DesignNode['textDecoration'],
                            })
                        }
                        options={[
                          ['none', '无装饰'],
                          ['underline', '下划线'],
                          ['line-through', '删除线'],
                        ]}
                      />
                    </div>
                    <label className="ed-labeled-row">
                      <span>斜体</span>
                      <Switch
                        checked={selected.fontStyle === 'italic'}
                        onCheckedChange={
                          /** 响应 onCheckedChange 交互，将用户操作应用到属性检查面板。 @param italic - 是否使用斜体。 @returns 无返回值；通过副作用完成当前操作。 */
                          (italic) => change({ fontStyle: italic ? 'italic' : 'normal' })
                        }
                        aria-label="斜体"
                      />
                    </label>
                    {colorField('color', '文字颜色')}
                  </PropertySection>
                )}
                {(selected.type === 'polygon' || selected.type === 'star') && (
                  <PropertySection title="形状">
                    <NumberField
                      label={selected.type === 'star' ? '星角数量' : '边数'}
                      value={selected.polygonSides ?? 5}
                      min={3}
                      max={24}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param polygonSides - 正多边形的边数。 @returns 无返回值；通过副作用完成当前操作。 */
                        (polygonSides) => change({ polygonSides })
                      }
                    />
                    {selected.type === 'star' && (
                      <NumberField
                        label="内半径比例"
                        value={selected.starRatio ?? 0.45}
                        min={0.05}
                        max={0.95}
                        step={0.05}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param starRatio - 星形内半径与外半径的比例，控制尖角深度。 @returns 无返回值；通过副作用完成当前操作。 */
                          (starRatio) => change({ starRatio })
                        }
                      />
                    )}
                  </PropertySection>
                )}
                {selected.type === 'path' && (
                  <PropertySection title="矢量路径">
                    <label className="ed-labeled-row">
                      <span>闭合路径</span>
                      <Switch
                        aria-label="闭合路径"
                        checked={!!selected.closed}
                        onCheckedChange={
                          /** 响应 onCheckedChange 交互，将用户操作应用到属性检查面板。 @param closed - 路径是否闭合，决定首尾相连及填充行为。 @returns 无返回值；通过副作用完成当前操作。 */
                          (closed) => change({ closed })
                        }
                      />
                    </label>
                    <p className="ed-muted">双击路径可编辑锚点，拖动蓝色锚点调整矢量。</p>
                    {selected.points?.map(
                      /**
                       * 转换属性检查面板中的集合条目，供后续处理或展示。
                       *
                       * @param point - 当前处理的坐标点。
                       * @param index - 空间查询索引或当前条目的位置。
                       * @returns 当前条目转换后的结果。
                       */
                      (point, index) => (
                        <div className="ed-two-fields" key={index}>
                          <NumberField
                            label={`X${index + 1}`}
                            value={point.x}
                            onChange={
                              /**
                               * 响应 onChange 交互，将用户操作应用到属性检查面板。
                               *
                               * @param x - 水平方向的位置。
                               * @returns 无返回值；通过副作用完成当前操作。
                               */
                              (x) =>
                                change({
                                  points: selected.points!.map(
                                    /** 转换属性检查面板中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @param i - 当前循环位置，从 0 开始。 @returns 当前条目转换后的结果。 */
                                    (p, i) => (i === index ? { ...p, x } : p),
                                  ),
                                })
                            }
                          />
                          <NumberField
                            label={`Y${index + 1}`}
                            value={point.y}
                            onChange={
                              /**
                               * 响应 onChange 交互，将用户操作应用到属性检查面板。
                               *
                               * @param y - 垂直方向的位置。
                               * @returns 无返回值；通过副作用完成当前操作。
                               */
                              (y) =>
                                change({
                                  points: selected.points!.map(
                                    /** 转换属性检查面板中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @param i - 当前循环位置，从 0 开始。 @returns 当前条目转换后的结果。 */
                                    (p, i) => (i === index ? { ...p, y } : p),
                                  ),
                                })
                            }
                          />
                        </div>
                      ),
                    )}
                  </PropertySection>
                )}
                {selected.type === 'image' && (
                  <PropertySection title="图片">
                    <Input
                      aria-label="图片地址"
                      value={selected.src ?? ''}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (event) => change({ src: event.target.value })
                      }
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
                      title={selected.shadow ? '移除阴影' : '添加阴影'}
                      onClick={
                        /**
                         * 响应 onClick 交互，将用户操作应用到属性检查面板。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        () =>
                          change({
                            shadow: selected.shadow
                              ? undefined
                              : {
                                  x: 0,
                                  y: 4,
                                  blur: 12,
                                  spread: 0,
                                  color: '#00000026',
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
                        {(['x', 'y', 'blur', 'spread'] as const).map(
                          /**
                           * 转换属性检查面板中的集合条目，供后续处理或展示。
                           *
                           * @param key - 要访问或更新的字段名。
                           * @returns 当前条目转换后的结果。
                           */
                          (key) => (
                            <NumberField
                              key={key}
                              label={{ x: 'X', y: 'Y', blur: '模糊', spread: '扩展' }[key]}
                              value={selected.shadow![key]}
                              onChange={
                                /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param value - 当前字段、模式或控件的取值。 @returns 无返回值；通过副作用完成当前操作。 */
                                (value) =>
                                  change({
                                    shadow: { ...selected.shadow!, [key]: value },
                                  })
                              }
                            />
                          ),
                        )}
                      </div>
                      <ColorTextField
                        label="阴影颜色"
                        value={selected.shadow.color}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param color - 文字或视觉元素的颜色。 @returns 无返回值；通过副作用完成当前操作。 */
                          (color) => change({ shadow: { ...selected.shadow!, color } })
                        }
                      />
                    </>
                  )}
                  <NumberField
                    label="图层模糊"
                    value={selected.blur ?? 0}
                    min={0}
                    max={100}
                    onChange={
                      /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param blur - 模糊半径。 @returns 无返回值；通过副作用完成当前操作。 */
                      (blur) => change({ blur })
                    }
                  />
                </PropertySection>
                {component && (
                  <PropertySection title="组件实例">
                    <Button
                      variant="secondary"
                      className="ed-wide"
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 当前步骤的处理结果。 */
                        () => setEditingMaster(true)
                      }
                    >
                      <Component size={13} />
                      编辑主组件
                    </Button>
                    <Choice
                      label="交换组件"
                      value={component.id}
                      onChange={
                        /**
                         * 响应 onChange 交互，将用户操作应用到属性检查面板。
                         *
                         * @param componentId - 引用的组件母版标识。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        (componentId) => {
                          const next = project.components.find(
                            /** 检查条目的标识等于组件引用，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                            (item) => item.id === componentId,
                          );
                          if (next)
                            change({
                              componentId,
                              name: next.name,
                              overrides: undefined,
                            });
                        }
                      }
                      options={project.components.map(
                        /**
                         * 转换属性检查面板中的集合条目，供后续处理或展示。
                         *
                         * @param item - 当前遍历的条目。
                         * @returns 当前条目转换后的结果。
                         */
                        (item) => [
                          item.id,
                          `${item.name}${item.setId && item.setId === component.setId ? ' · ' + Object.values(item.variantProperties ?? {}).join(' / ') : ''}`,
                        ],
                      )}
                    />
                    {component.nodes
                      .filter(
                        /** 检查节点的文字内容不等于未设置值，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                        (node) => node.text !== undefined,
                      )
                      .map(
                        /**
                         * 转换属性检查面板中的集合条目，供后续处理或展示。
                         *
                         * @param node - 当前处理的设计节点。
                         * @returns 当前条目转换后的结果。
                         */
                        (node) => (
                          <label className="ed-stack-label" key={node.id}>
                            {node.name}
                            <Input
                              aria-label={`${node.name}实例文字`}
                              value={selected.overrides?.[node.id]?.text ?? node.text ?? ''}
                              onChange={
                                /**
                                 * 响应 onChange 交互，将用户操作应用到属性检查面板。
                                 *
                                 * @param event - 当前事件及其触发位置。
                                 * @returns 无返回值；通过副作用完成当前操作。
                                 */
                                (event) =>
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
                        ),
                      )}
                    <div className="ed-row-buttons">
                      <Button
                        variant="secondary"
                        onClick={
                          /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                          () => change({ overrides: undefined })
                        }
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
                    {variableField('fill', 'color', '填充变量')}
                    {variableField('color', 'color', '文字颜色变量')}
                    {variableField('radius', 'number', '圆角变量')}
                    {variableField('fontSize', 'number', '字号变量')}
                    {variableField('text', 'string', '文本变量')}
                    {variableField('visible', 'boolean', '可见性变量')}
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
                        !selection.some(
                          /** 检查containers包含节点的类型，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                          (node) => containers.has(node.type),
                        )
                      }
                    >
                      取消编组
                    </Button>
                  </div>
                  {selected.type !== 'component' && (
                    <Button variant="secondary" className="ed-wide" onClick={createComponent}>
                      <Component size={13} />
                      创建组件
                    </Button>
                  )}
                  <Choice
                    label="父级容器"
                    value={selected.parentId ?? ''}
                    onChange={
                      /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param parentId - 父节点标识；未设置时表示根层级。 @returns 无返回值；通过副作用完成当前操作。 */
                      (parentId) => change({ parentId: parentId || undefined })
                    }
                    options={[
                      ['', '页面'],
                      ...page.nodes
                        .filter(
                          /**
                           * 检查containers包含节点的类型且包含节点的标识不成立，供集合筛选或定位使用。
                           *
                           * @param node - 当前处理的设计节点。
                           * @returns 用于判断条件的值；真值表示该条目符合条件。
                           */
                          (node) =>
                            containers.has(node.type) &&
                            !descendants(
                              page.nodes,
                              selection.map(
                                /** 提取节点的标识，供后续计算或展示使用。 @param n - 当前节点或数值。 @returns 节点的标识。 */
                                (n) => n.id,
                              ),
                            ).includes(node.id),
                        )
                        .map(
                          /** 转换属性检查面板中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
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
                    onChange={
                      /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                      (event) => updatePage({ name: event.target.value })
                    }
                  />
                  <div className="ed-two-fields">
                    <NumberField
                      label="宽度"
                      value={page.width}
                      min={100}
                      max={20000}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param width - 对象的宽度。 @returns 无返回值；通过副作用完成当前操作。 */
                        (width) => updatePage({ width })
                      }
                    />
                    <NumberField
                      label="高度"
                      value={page.height}
                      min={100}
                      max={20000}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param height - 对象的高度。 @returns 无返回值；通过副作用完成当前操作。 */
                        (height) => updatePage({ height })
                      }
                    />
                  </div>
                  <Choice
                    label="设备预设"
                    value=""
                    onChange={
                      /**
                       * 响应 onChange 交互，将用户操作应用到属性检查面板。
                       *
                       * @param value - 当前字段、模式或控件的取值。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      (value) => {
                        const [width, height] = value.split('x').map(Number);
                        if (width && height) updatePage({ width, height });
                      }
                    }
                    options={[
                      ['', '选择画布尺寸'],
                      ['1440x1000', 'Desktop · 1440 × 1000'],
                      ['1920x1080', 'Desktop · 1920 × 1080'],
                      ['834x1194', 'Tablet · 834 × 1194'],
                      ['390x844', 'Mobile · 390 × 844'],
                      ['430x932', 'Mobile · 430 × 932'],
                    ]}
                  />
                  <div className="ed-color-input">
                    <input
                      type="color"
                      aria-label="画布背景颜色"
                      value={page.background ?? tokens.background}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                        (event) => updatePage({ background: event.target.value })
                      }
                    />
                    <ColorTextField
                      label="画布背景"
                      value={page.background ?? tokens.background}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param background - 背景颜色或背景类型。 @returns 无返回值；通过副作用完成当前操作。 */
                        (background) => updatePage({ background })
                      }
                    />
                  </div>
                </PropertySection>
                <PropertySection
                  title="布局网格"
                  action={
                    <Switch
                      aria-label="显示布局网格"
                      checked={!!page.grid?.enabled}
                      onCheckedChange={
                        /** 响应 onCheckedChange 交互，将用户操作应用到属性检查面板。 @param enabled - 是否启用该项能力。 @returns 无返回值；通过副作用完成当前操作。 */
                        (enabled) => updatePage({ grid: { size: 8, ...page.grid, enabled } })
                      }
                    />
                  }
                >
                  <Choice
                    label="网格类型"
                    value={page.grid?.type ?? 'grid'}
                    onChange={
                      /**
                       * 响应 onChange 交互，将用户操作应用到属性检查面板。
                       *
                       * @param type - 用于区分数据形态或行为分支的类型。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      (type) =>
                        updatePage({
                          grid: {
                            size: 8,
                            enabled: true,
                            ...page.grid,
                            type: type as 'grid' | 'columns',
                          },
                        })
                    }
                    options={[
                      ['grid', '网格'],
                      ['columns', '列'],
                    ]}
                  />
                  {page.grid?.type === 'columns' ? (
                    <div className="ed-two-fields">
                      <NumberField
                        label="列数"
                        value={page.grid.columns ?? 12}
                        min={1}
                        max={32}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param columns - 布局网格的列数。 @returns 无返回值；通过副作用完成当前操作。 */
                          (columns) => updatePage({ grid: { ...page.grid!, columns } })
                        }
                      />
                      <NumberField
                        label="栏间距"
                        value={page.grid.gutter ?? 20}
                        min={0}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param gutter - 网格列之间的间距。 @returns 无返回值；通过副作用完成当前操作。 */
                          (gutter) => updatePage({ grid: { ...page.grid!, gutter } })
                        }
                      />
                      <NumberField
                        label="边距"
                        value={page.grid.margin ?? 32}
                        min={0}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param margin - 网格与页面边缘的留白。 @returns 无返回值；通过副作用完成当前操作。 */
                          (margin) => updatePage({ grid: { ...page.grid!, margin } })
                        }
                      />
                    </div>
                  ) : (
                    <NumberField
                      label="网格尺寸"
                      value={page.grid?.size ?? 8}
                      min={1}
                      max={256}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param size - 当前对象的尺寸或尺寸规格。 @returns 无返回值；通过副作用完成当前操作。 */
                        (size) =>
                          updatePage({
                            grid: { enabled: true, ...page.grid, size },
                          })
                      }
                    />
                  )}
                </PropertySection>
                <PropertySection title="本地变量">
                  <div className="ed-token-list">
                    {colorKeys.map(
                      /**
                       * 转换属性检查面板中的集合条目，供后续处理或展示。
                       *
                       * @param key - 要访问或更新的字段名。
                       * @returns 当前条目转换后的结果。
                       */
                      (key) => (
                        <label key={key}>
                          <input
                            type="color"
                            aria-label={`${key}主题颜色`}
                            value={String(tokens[key])}
                            onChange={
                              /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
                              (event) => updateTokens({ [key]: event.target.value })
                            }
                          />
                          <span>{key}</span>
                          <code>{tokens[key]}</code>
                        </label>
                      ),
                    )}
                  </div>
                  <div className="ed-two-fields">
                    <NumberField
                      label="圆角"
                      value={tokens.radius}
                      min={0}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param radius - 圆角大小。 @returns 无返回值；通过副作用完成当前操作。 */
                        (radius) => updateTokens({ radius })
                      }
                    />
                    <NumberField
                      label="间距"
                      value={tokens.spacing}
                      min={0}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param spacing - 布局间距的基准值或语义 Token 分组。 @returns 无返回值；通过副作用完成当前操作。 */
                        (spacing) => updateTokens({ spacing })
                      }
                    />
                  </div>
                </PropertySection>
                <PropertySection title="与凛协作">
                  <div className="ed-rin-collaborator">
                    <RinAvatar size={28} />
                    <div>
                      <strong>Rin / 设计搭档</strong>
                      <span>从想法，到可编辑的界面。</span>
                    </div>
                  </div>
                  <p className="ed-muted">描述页面需求，生成设计并转换为可编辑图层。</p>
                  <Button variant="secondary" className="ed-wide" onClick={onAgent}>
                    <RinIcon kind="agent" size={15} />
                    与凛协作
                  </Button>
                </PropertySection>
              </>
            )}
            <PropertySection title="导出">
              <div className="ed-row-buttons">
                <Button
                  variant="secondary"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => exportFile('png')
                  }
                >
                  PNG
                </Button>
                <Button
                  variant="secondary"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => exportFile('svg')
                  }
                >
                  SVG
                </Button>
                <Button
                  variant="secondary"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => exportFile('json')
                  }
                >
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
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到属性检查面板。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => change({ prototype: undefined })
                      }
                    >
                      <X size={13} />
                    </Button>
                  }
                >
                  <Choice
                    label="触发方式"
                    value={selected.prototype?.trigger ?? 'click'}
                    onChange={
                      /**
                       * 响应 onChange 交互，将用户操作应用到属性检查面板。
                       *
                       * @param trigger - 触发跳转或动作的交互条件。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      (trigger) =>
                        change({
                          prototype: {
                            action: 'navigate',
                            ...selected.prototype,
                            trigger: trigger as 'click' | 'hover',
                          },
                        })
                    }
                    options={[
                      ['click', '点击时'],
                      ['hover', '悬停时'],
                    ]}
                  />
                  <Choice
                    label="原型动作"
                    value={selected.prototype?.action ?? ''}
                    onChange={
                      /**
                       * 响应 onChange 交互，将用户操作应用到属性检查面板。
                       *
                       * @param action - 当前要执行的操作或操作结果分类。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      (action) =>
                        change({
                          prototype: action
                            ? {
                                action: action as 'navigate',
                                target: project.pages.find(
                                  /** 检查当前项的标识不等于页面的标识，供集合筛选或定位使用。 @param p - 当前坐标点或内容片段。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                                  (p) => p.id !== page.id,
                                )?.id,
                                trigger: 'click',
                                animation: 'instant',
                                duration: 300,
                              }
                            : undefined,
                        })
                    }
                    options={[
                      ['', '添加交互'],
                      ['navigate', '跳转页面'],
                      ['overlay', '打开浮层'],
                      ['back', '返回'],
                      ['url', '打开链接'],
                    ]}
                  />
                  {selected.prototype && (
                    <>
                      {['navigate', 'overlay'].includes(selected.prototype.action) && (
                        <Choice
                          label="目标页面"
                          value={selected.prototype.target ?? ''}
                          onChange={
                            /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param target - 操作作用的目标。 @returns 无返回值；通过副作用完成当前操作。 */
                            (target) =>
                              change({
                                prototype: { ...selected.prototype!, target },
                              })
                          }
                          options={[
                            ['', '选择目标页面'],
                            ...project.pages.map(
                              /** 转换属性检查面板中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
                              (p) => [p.id, p.name] as [string, string],
                            ),
                          ]}
                        />
                      )}
                      {selected.prototype.action === 'url' && (
                        <Input
                          aria-label="目标网址"
                          placeholder="https://example.com"
                          value={selected.prototype.target ?? ''}
                          onChange={
                            /**
                             * 响应 onChange 交互，将用户操作应用到属性检查面板。
                             *
                             * @param event - 当前事件及其触发位置。
                             * @returns 无返回值；通过副作用完成当前操作。
                             */
                            (event) =>
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
                        value={selected.prototype.animation ?? 'instant'}
                        onChange={
                          /**
                           * 响应 onChange 交互，将用户操作应用到属性检查面板。
                           *
                           * @param animation - 原型切换采用的动画方式。
                           * @returns 无返回值；通过副作用完成当前操作。
                           */
                          (animation) =>
                            change({
                              prototype: {
                                ...selected.prototype!,
                                animation: animation as 'instant',
                              },
                            })
                        }
                        options={[
                          ['instant', '即时'],
                          ['dissolve', '淡入淡出'],
                          ['slide', '滑动'],
                        ]}
                      />
                      <NumberField
                        label="时长 ms"
                        value={selected.prototype.duration ?? 300}
                        min={0}
                        max={5000}
                        onChange={
                          /** 响应 onChange 交互，将用户操作应用到属性检查面板。 @param duration - 动画持续时间。 @returns 无返回值；通过副作用完成当前操作。 */
                          (duration) =>
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
                    onCheckedChange={
                      /**
                       * 响应 onCheckedChange 交互，将用户操作应用到属性检查面板。
                       *
                       * @param prototypeStart - 是否作为原型预览的起始页面。
                       * @returns 无返回值；通过副作用完成当前操作。
                       */
                      (prototypeStart) =>
                        commit({
                          ...project,
                          pages: project.pages.map(
                            /** 转换属性检查面板中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
                            (p) => ({
                              ...p,
                              prototypeStart: p.id === page.id ? prototypeStart : false,
                            }),
                          ),
                        })
                    }
                  />
                </label>
                <p className="ed-muted">选择图层后添加点击或悬停交互，支持页面跳转、浮层和返回。</p>
              </PropertySection>
            )}
            <PropertySection title="页面流程">
              {project.pages.map(
                /**
                 * 转换属性检查面板中的集合条目，供后续处理或展示。
                 *
                 * @param p - 当前坐标点或内容片段。
                 * @returns 当前条目转换后的结果。
                 */
                (p) => (
                  <div className="ed-prototype-page" key={p.id}>
                    <span>
                      {p.prototypeStart ? '▶' : '◇'} {p.name}
                    </span>
                    <span>
                      {
                        p.nodes.filter(
                          /** 检查节点的原型交互，供集合筛选或定位使用。 @param n - 当前节点或数值。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                          (n) => n.prototype,
                        ).length
                      }{' '}
                      个交互
                    </span>
                  </div>
                ),
              )}
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
                  onClick={
                    /**
                     * 响应 onClick 交互，将用户操作应用到属性检查面板。
                     * @returns 完成当前异步操作的 Promise，不携带业务数据。
                     */
                    () =>
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
                  {project.workspace?.kind === 'github'
                    ? 'GitHub'
                    : project.workspace
                      ? '本地项目'
                      : '未绑定'}
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
          onClose={
            /** 响应 onClose 交互，将用户操作应用到属性检查面板。 @returns 当前步骤的处理结果。 */
            () => setEditingMaster(false)
          }
        />
      )}
    </aside>
  );
}
