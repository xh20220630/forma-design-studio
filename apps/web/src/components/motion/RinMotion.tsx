import { useEffect, useRef, useState, type HTMLAttributes, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import { useStudioMotion } from '../../lib/motion';
import { rinMotionAssets, rinMotionEase, rinMotionTiming } from '../../lib/rin-motion';
import './rin-motion.css';

/** RinMotionScene 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface RinMotionSceneProps {
  /** 是否处于激活状态。 */
  active?: boolean;
  /** 调用方追加的 CSS 类名。 */
  className?: string;
  /** 面向用户显示的简短标签。 */
  label?: string;
  /** 当前动画或播放的控制入口。 */
  controls?: boolean;
}

/**
 * 呈现Rin 品牌动效场景，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.active - 是否处于激活状态。
 * @param props.className - 调用方追加的 CSS 类名。
 * @param props.label - 面向用户显示的简短标签。
 * @param props.controls - 当前动画或播放的控制入口。
 * @returns 供 React 渲染的界面内容。
 */
export function RinMotionScene({
  active,
  className = '',
  label = '凛与珍珠白设计图层',
  controls = active === undefined,
}: RinMotionSceneProps) {
  const { reduced } = useStudioMotion();
  const container = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  /** 界面状态：是否显示；节点缺省时按可见处理，还会受到祖先可见性的约束。通过状态更新驱动界面刷新。 */
  const [visible, setVisible] = useState(false);
  /** 界面状态：主要前景色，通常用于正文与图标。通过状态更新驱动界面刷新。 */
  const [foreground, setForeground] = useState(
    /** 在Rin 品牌动效场景首次挂载时建立初始状态，避免每次渲染重复初始化。 @returns 初始状态值。 */
    () => document.visibilityState === 'visible',
  );
  /** 界面状态：用户是否主动允许播放。通过状态更新驱动界面刷新。 */
  const [manualPlaying, setManualPlaying] = useState(false);
  /** 界面状态：媒体资源是否已加载。通过状态更新驱动界面刷新。 */
  const [loaded, setLoaded] = useState(false);
  /** 界面状态：当前是否处于播放状态。通过状态更新驱动界面刷新。 */
  const [playing, setPlaying] = useState(false);
  /** 界面状态：媒体资源是否加载失败。通过状态更新驱动界面刷新。 */
  const [failed, setFailed] = useState(false);
  const requested = active ?? manualPlaying;
  const canPlay = requested && visible && foreground && !reduced && !failed;

  useEffect(
    /**
     * 在Rin 品牌动效场景的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      const element = container.current;
      if (!element) return;
      const observer = new IntersectionObserver(
        /** 执行Rin 品牌动效场景传入的局部处理步骤，使调用处能够控制结果如何更新。 @param options - 按顺序解构的当前条目。 @param options.entry - 缓存的已编译场景条目。 @returns 当前步骤的处理结果。 */
        ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1),
        { threshold: 0.1 },
      );
      observer.observe(element);
      /**
       * 响应页面前后台切换，调整动画或视频的播放状态。
       * @returns 无返回值；更新播放条件。
       */
      const onVisibility = () => setForeground(document.visibilityState === 'visible');
      document.addEventListener('visibilitychange', onVisibility);
      /**
       * 结束Rin 品牌动效场景当前建立的监听或临时操作，避免后续重复执行。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
      };
    },
    [],
  );

  useEffect(
    /**
     * 在Rin 品牌动效场景的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (canPlay) setLoaded(true);
    },
    [canPlay],
  );

  useEffect(
    /**
     * 在Rin 品牌动效场景的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      const element = video.current;
      if (!element) return;
      let cancelled = false;
      if (!canPlay || !loaded) {
        element.pause();
        setPlaying(false);
        return;
      }
      element
        .play()
        .then(
          /**
           * 在Rin 品牌动效场景的异步步骤结束后处理结果。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          () => {
            if (!cancelled) setPlaying(true);
          },
        )
        .catch(
          /**
           * 处理Rin 品牌动效场景中的异步失败，按当前流程决定回退或继续抛出。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          () => {
            if (!cancelled) {
              setPlaying(false);
              setFailed(true);
            }
          },
        );
      /**
       * 结束Rin 品牌动效场景当前建立的监听或临时操作，避免后续重复执行。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      return () => {
        cancelled = true;
        element.pause();
      };
    },
    [canPlay, loaded],
  );

  return (
    <figure
      ref={container}
      className={`rin-motion-scene ${className}`}
      data-playing={playing}
      data-reduced={reduced}
    >
      <div className="rin-motion-scene__media">
        <img
          className="rin-motion-scene__poster"
          src={rinMotionAssets.poster}
          alt={label}
          loading="lazy"
          decoding="async"
        />
        <video
          ref={video}
          src={loaded ? rinMotionAssets.loop : undefined}
          poster={rinMotionAssets.poster}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          onError={
            /**
             * 响应 onError 交互，将用户操作应用到Rin 品牌动效场景。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {
              setFailed(true);
              setPlaying(false);
            }
          }
        />
      </div>
      {controls && active === undefined && (
        <button
          type="button"
          className="rin-motion-scene__control"
          aria-label={manualPlaying && !failed ? '暂停凛的工作室动效' : '播放凛的工作室动效'}
          aria-pressed={manualPlaying && !reduced && !failed}
          disabled={reduced}
          onClick={
            /**
             * 响应 onClick 交互，将用户操作应用到Rin 品牌动效场景。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            () => {
              if (failed) {
                video.current?.load();
                setFailed(false);
                setManualPlaying(true);
              } else
                setManualPlaying(
                  /** 基于最新状态计算 ManualPlaying 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
                  (value) => !value,
                );
            }
          }
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
          <span>
            {reduced ? '静态预览' : failed ? '重新播放' : manualPlaying ? '暂停动效' : '播放动效'}
          </span>
        </button>
      )}
    </figure>
  );
}

/** RinParallax 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface RinParallaxProps extends HTMLAttributes<HTMLDivElement> {
  /** 效果强度或混色比例。 */
  amount?: number;
}

/**
 * 呈现指针视差容器，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.amount - 效果强度或混色比例。
 * @param props.className - 调用方追加的 CSS 类名。
 * @param props.children - 由调用方放入组件的子内容。
 * @param props.onPointerMove - 在PointerMove时通知调用方，由外层决定如何更新业务状态。
 * @param props.onPointerLeave - 在PointerLeave时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function RinParallax({
  amount = 2,
  className = '',
  children,
  onPointerMove,
  onPointerLeave,
  ...props
}: RinParallaxProps) {
  const { reduced } = useStudioMotion();
  const surface = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  /**
   * 把指针视差恢复到初始位置，避免离开区域后视觉元素仍保持倾斜。
   * @returns 无返回值；重置视差状态。
   */
  const reset = () => {
    cancelAnimationFrame(frame.current);
    surface.current?.style.setProperty('--rin-tilt-x', '0deg');
    surface.current?.style.setProperty('--rin-tilt-y', '0deg');
  };
  useEffect(
    /**
     * 在指针视差容器的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      if (reduced) reset();
      /** 结束指针视差容器当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => cancelAnimationFrame(frame.current);
    },
    [reduced],
  );
  /**
   * 按指针位置更新轻量视差效果，使品牌元素响应用户移动。
   *
   * @param event - 当前事件及其触发位置。
   * @returns 无返回值；更新视觉偏移。
   */
  const move = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (event.defaultPrevented || event.buttons !== 0) {
      reset();
      return;
    }
    if (
      reduced ||
      event.pointerType !== 'mouse' ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
      return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height - 0.5) * 2));
    const tilt = Math.max(0, Math.min(3, amount));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(
      /**
       * 在下一帧刷新move，让多次界面变化合并到一次绘制。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      () => {
        surface.current?.style.setProperty('--rin-tilt-x', `${-y * tilt}deg`);
        surface.current?.style.setProperty('--rin-tilt-y', `${x * tilt}deg`);
      },
    );
  };
  return (
    <div
      ref={surface}
      className={`rin-parallax ${className}`}
      onPointerMove={move}
      onPointerLeave={
        /**
         * 响应 onPointerLeave 交互，将用户操作应用到指针视差容器。
         *
         * @param event - 当前事件及其触发位置。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (event) => {
          reset();
          onPointerLeave?.(event);
        }
      }
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 呈现选择状态动效，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.layoutId - 用于关联布局过渡的稳定标识。
 * @param props.className - 调用方追加的 CSS 类名。
 * @returns 供 React 渲染的界面内容。
 */
export function RinSelectionIndicator({
  layoutId,
  className = '',
}: {
  /** 用于关联布局过渡的稳定标识。 */
  layoutId: string;
  /** 调用方追加的 CSS 类名。 */
  className?: string;
}) {
  const { reduced } = useStudioMotion();
  return (
    <motion.span
      aria-hidden="true"
      className={`rin-selection-indicator ${className}`}
      layoutId={reduced ? undefined : layoutId}
      initial={false}
      transition={{ duration: reduced ? 0 : rinMotionTiming.selection, ease: rinMotionEase }}
    />
  );
}

/**
 * 呈现任务执行动效，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.running - 当前任务或动效是否正在执行。
 * @param props.label - 面向用户显示的简短标签。
 * @param props.className - 调用方追加的 CSS 类名。
 * @returns 供 React 渲染的界面内容。
 */
export function RinTaskActivity({
  running,
  label,
  className = '',
}: {
  /** 当前任务或动效是否正在执行。 */
  running: boolean;
  /** 面向用户显示的简短标签。 */
  label?: string;
  /** 调用方追加的 CSS 类名。 */
  className?: string;
}) {
  const { reduced } = useStudioMotion();
  return (
    <span
      className={`rin-task-activity ${className}`}
      data-running={running}
      data-reduced={reduced}
      role="status"
    >
      <span className="rin-task-activity__signal" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{label ?? (running ? '凛正在处理' : '等待任务')}</span>
    </span>
  );
}
