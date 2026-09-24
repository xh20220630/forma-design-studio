import { Maximize } from 'lucide-react';
import type { PointerEvent } from 'react';

/** canvas-rulers 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 缩放倍率，1 表示原始尺寸。 */
  zoom: number;
  /** 本次操作开始时的位置或状态。 */
  origin: {
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
  };
  /** 画布可见区域的尺寸或相机状态。 */
  viewport: {
    /** 对象的宽度。 */
    width: number;
    /** 对象的高度。 */
    height: number;
  };
  /**
   * 在视图适配时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onFit: () => void;
  /**
   * 在辅助线变化时通知调用方，由外层决定如何更新业务状态。
   * @param axis - 辅助线或计算所沿用的坐标轴。
   * @param event - 当前事件及其触发位置。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onGuide?: (axis: 'x' | 'y', event: PointerEvent<HTMLDivElement>) => void;
}

/**
 * 按缩放倍率选择刻度密度，避免缩小时文字和刻度挤在一起。
 *
 * @param length - 集合长度或允许的文本长度。
 * @param origin - 本次操作开始时的位置或状态。
 * @param zoom - 缩放倍率，1 表示原始尺寸。
 * @returns 当前可见范围内的标尺刻度。
 */
function rulerTicks(length: number, origin: number, zoom: number) {
  const target = 72 / zoom;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step =
    [1, 2, 5, 10].find(
      /** 检查取值乘以magnitude不小于目标，供集合筛选或定位使用。 @param value - 当前字段、模式或控件的取值。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (value) => value * magnitude >= target,
    )! * magnitude;
  const minor = step / 5;
  const start = Math.floor((20 - origin) / zoom / minor);
  const end = Math.ceil((length - origin) / zoom / minor);
  return Array.from(
    { length: Math.max(0, end - start + 1) },
    /**
     * 执行 rulerTicks 传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param _ - 当前步骤不使用的占位参数。
     * @param index - 空间查询索引或当前条目的位置。
     * @returns 当前步骤的处理结果。
     */
    (_, index) => {
      const tick = start + index;
      return {
        position: origin + tick * minor * zoom,
        label: tick % 5 === 0 ? String(Math.round(tick * minor)) : undefined,
      };
    },
  );
}

/**
 * 呈现画布标尺，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.zoom - 缩放倍率，1 表示原始尺寸。
 * @param props.origin - 本次操作开始时的位置或状态。
 * @param props.viewport - 画布可见区域的尺寸或相机状态。
 * @param props.onFit - 在视图适配时通知调用方，由外层决定如何更新业务状态。
 * @param props.onGuide - 在辅助线变化时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export default function CanvasRulers({ zoom, origin, viewport, onFit, onGuide }: Props) {
  return (
    <div className="ed-viewport-rulers">
      <div
        className="ed-viewport-ruler is-horizontal"
        title={onGuide ? '点击添加垂直参考线' : '水平标尺'}
        onPointerDown={
          /** 响应 onPointerDown 交互，将用户操作应用到画布标尺。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
          (event) => onGuide?.('x', event)
        }
      >
        {rulerTicks(viewport.width, origin.x, zoom).map(
          /**
           * 转换画布标尺中的集合条目，供后续处理或展示。
           *
           * @param tick - 当前标尺刻度。
           * @returns 当前条目转换后的结果。
           */
          (tick) => (
            <span
              key={tick.position}
              className={tick.label !== undefined ? 'is-major' : ''}
              style={{ left: tick.position }}
            >
              {tick.label}
            </span>
          ),
        )}
      </div>
      <div
        className="ed-viewport-ruler is-vertical"
        title={onGuide ? '点击添加水平参考线' : '垂直标尺'}
        onPointerDown={
          /** 响应 onPointerDown 交互，将用户操作应用到画布标尺。 @param event - 当前事件及其触发位置。 @returns 无返回值；通过副作用完成当前操作。 */
          (event) => onGuide?.('y', event)
        }
      >
        {rulerTicks(viewport.height, origin.y, zoom).map(
          /**
           * 转换画布标尺中的集合条目，供后续处理或展示。
           *
           * @param tick - 当前标尺刻度。
           * @returns 当前条目转换后的结果。
           */
          (tick) => (
            <span
              key={tick.position}
              className={tick.label !== undefined ? 'is-major' : ''}
              style={{ top: tick.position }}
            >
              {tick.label}
            </span>
          ),
        )}
      </div>
      <button
        type="button"
        className="ed-ruler-origin"
        title="适应画布"
        aria-label="适应画布"
        onClick={onFit}
      >
        <Maximize size={11} />
      </button>
    </div>
  );
}
