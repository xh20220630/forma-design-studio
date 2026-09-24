import { Frame, Type } from 'lucide-react';
import { RinIcon } from '../brand/RinBrand';

/** CanvasEmptyState 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 背景颜色或背景类型。 */
  background: string;
  /**
   * 在逐帧更新时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onFrame: () => void;
  /**
   * 在文字修改时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onText: () => void;
  /**
   * 在打开助手时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onOpenAgent: () => void;
}

/**
 * 呈现空白画布引导，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.background - 背景颜色或背景类型。
 * @param props.onFrame - 在逐帧更新时通知调用方，由外层决定如何更新业务状态。
 * @param props.onText - 在文字修改时通知调用方，由外层决定如何更新业务状态。
 * @param props.onOpenAgent - 在打开助手时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export default function CanvasEmptyState({ background, onFrame, onText, onOpenAgent }: Props) {
  const hex = background.replace(/^#/, '');
  const rgb = /^[\da-f]{6}$/i.test(hex)
    ? [0, 2, 4].map(
        /** 转换空白画布引导中的集合条目，供后续处理或展示。 @param offset - 相对起点的偏移量。 @returns 当前条目转换后的结果。 */
        (offset) => parseInt(hex.slice(offset, offset + 2), 16),
      )
    : [255, 255, 255];
  const dark = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 140;
  return (
    <div
      className={`ed-start-design${dark ? ' is-dark' : ''}`}
      onPointerDown={
        /** 响应 onPointerDown 交互，将用户操作应用到空白画布引导。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
        (event) => event.stopPropagation()
      }
    >
      <img
        className="ed-start-illustration"
        src="/brand/rin/editor/rin-start-design.png"
        alt="凛坐在设计画框旁，轻触半透明布局面板"
        draggable={false}
      />
      <h2>开始设计</h2>
      <p>从一个画框开始，把想法放上画布。</p>
      <div className="ed-start-actions">
        <button type="button" onClick={onFrame}>
          <Frame size={14} />
          画框<kbd>F</kbd>
        </button>
        <button type="button" onClick={onText}>
          <Type size={14} />
          文字<kbd>T</kbd>
        </button>
      </div>
      <button type="button" className="ed-start-with-rin" onClick={onOpenAgent}>
        <RinIcon kind="agent" size={14} />
        与凛一起设计<span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}
