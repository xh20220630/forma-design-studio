import { useEffect, useRef, useState } from 'react';
import { useStudioMotion } from '../../lib/motion';
import './studio-sequence.css';

export const studioSequences = {
  foundry: {
    src: '/brand/rin/v5/motion/home-idea-foundry.webm',
    poster: '/brand/rin/v5/motion/home-idea-foundry-poster.webp',
  },
  atlas: {
    src: '/brand/rin/v5/motion/atlas-unfold.webm',
    poster: '/brand/rin/v5/motion/atlas-poster.webp',
  },
} as const;

/** 动画片段，集中定义允许的分支以保持调用方一致。 */
type SequenceKind = keyof typeof studioSequences;

/** StudioSequence 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface StudioSequenceProps {
  /** 组件的外观变体。 */
  variant: SequenceKind;
  /** 触发跳转或动作的交互条件。 */
  trigger?: string;
  /** 资源满足播放条件时是否自动播放。 */
  autoplay?: boolean;
  /** 是否减少动态效果，供动画降级使用。 */
  reducedMotion?: boolean;
  /** 调用方追加的 CSS 类名。 */
  className?: string;
  /** 是否展示 Rin 品牌形象。 */
  showRin?: boolean;
}

/**
 * 呈现工作室场景动画，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.variant - 组件的外观变体。
 * @param props.trigger - 触发跳转或动作的交互条件。
 * @param props.autoplay - 资源满足播放条件时是否自动播放。
 * @param props.reducedMotion - 是否减少动态效果，供动画降级使用。
 * @param props.className - 调用方追加的 CSS 类名。
 * @param props.showRin - 是否展示 Rin 品牌形象。
 * @returns 供 React 渲染的界面内容。
 */
export function StudioSequence({
  variant,
  trigger,
  autoplay = true,
  reducedMotion = false,
  className = '',
  showRin = false,
}: StudioSequenceProps) {
  const sequence = studioSequences[variant];
  const { reduced: preferenceReduced } = useStudioMotion();
  const container = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  /** 界面状态：系统是否要求减少动态效果。通过状态更新驱动界面刷新。 */
  const [systemReduced, setSystemReduced] = useState(
    /** 在工作室场景动画首次挂载时建立初始状态，避免每次渲染重复初始化。 @returns 初始状态值。 */
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  /** 界面状态：是否显示；节点缺省时按可见处理，还会受到祖先可见性的约束。通过状态更新驱动界面刷新。 */
  const [visible, setVisible] = useState(false);
  /** 界面状态：主要前景色，通常用于正文与图标。通过状态更新驱动界面刷新。 */
  const [foreground, setForeground] = useState(
    /** 在工作室场景动画首次挂载时建立初始状态，避免每次渲染重复初始化。 @returns 初始状态值。 */
    () => document.visibilityState === 'visible',
  );
  /** 界面状态：媒体资源是否已加载。通过状态更新驱动界面刷新。 */
  const [loaded, setLoaded] = useState(false);
  /** 界面状态：入场内容是否已经展示。通过状态更新驱动界面刷新。 */
  const [revealed, setRevealed] = useState(false);
  /** 界面状态：当前动画是否已经播放结束。通过状态更新驱动界面刷新。 */
  const [finished, setFinished] = useState(false);
  /** 界面状态：媒体资源是否加载失败。通过状态更新驱动界面刷新。 */
  const [failed, setFailed] = useState(false);
  const reduced = preferenceReduced || reducedMotion || systemReduced;
  const canPlay = autoplay && visible && foreground && !reduced && !failed && !finished;

  useEffect(
    /**
     * 在工作室场景动画的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      const observer = new IntersectionObserver(
        /**
         * 执行工作室场景动画传入的局部处理步骤，使调用处能够控制结果如何更新。
         *
         * @param options - 按顺序解构的当前条目。
         * @param options.entry - 缓存的已编译场景条目。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        ([entry]) => {
          const inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
          if (!inView) video.current?.pause();
          setVisible(inView);
        },
        { threshold: 0.2 },
      );
      if (container.current) observer.observe(container.current);
      /**
       * 响应页面前后台切换，调整动画或视频的播放状态。
       * @returns 无返回值；更新播放条件。
       */
      const onVisibility = () => {
        /** 集中维护 active 的进行中任务，防止同一目标被重复执行。 */
        const active = document.visibilityState === 'visible';
        if (!active) video.current?.pause();
        setForeground(active);
      };
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      /**
       * 响应减少动态效果的系统偏好，及时切换播放策略。
       * @returns 无返回值；更新动效偏好。
       */
      const onPreference = () => {
        if (preference.matches) video.current?.pause();
        setSystemReduced(preference.matches);
      };
      document.addEventListener('visibilitychange', onVisibility);
      preference.addEventListener('change', onPreference);
      /**
       * 结束工作室场景动画当前建立的监听或临时操作，避免后续重复执行。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        preference.removeEventListener('change', onPreference);
      };
    },
    [],
  );

  useEffect(
    /**
     * 在工作室场景动画的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      setFinished(false);
      setFailed(false);
      setRevealed(false);
      const element = video.current;
      if (!element) return;
      element.pause();
      if (element.error) element.load();
      else if (element.readyState >= 1) element.currentTime = 0;
    },
    [variant, trigger],
  );

  useEffect(
    /**
     * 在工作室场景动画的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      if (canPlay) setLoaded(true);
    },
    [canPlay],
  );

  useEffect(
    /**
     * 在工作室场景动画的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      const element = video.current;
      if (!element) return;
      let cancelled = false;
      if (!canPlay || !loaded) {
        element.pause();
        return;
      }
      element.playbackRate = 1.25;
      element.play().catch(
        /**
         * 处理工作室场景动画中的异步失败，按当前流程决定回退或继续抛出。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        () => {
          if (!cancelled) {
            setFailed(true);
            setRevealed(false);
          }
        },
      );
      /**
       * 结束工作室场景动画当前建立的监听或临时操作，避免后续重复执行。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      return () => {
        cancelled = true;
        element.pause();
      };
    },
    [canPlay, loaded, variant, trigger],
  );

  return (
    <figure
      ref={container}
      className={`studio-sequence studio-sequence--${variant} ${className}`}
      data-frame={revealed && !failed && !reduced}
      aria-hidden="true"
    >
      <div className="studio-sequence__stage">
        <img
          className="studio-sequence__poster"
          src={sequence.poster}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        <video
          key={variant}
          ref={video}
          src={loaded ? sequence.src : undefined}
          muted
          playsInline
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          preload={loaded ? 'auto' : 'none'}
          onPlaying={
            /**
             * 响应 onPlaying 交互，将用户操作应用到工作室场景动画。
             *
             * @param event - 当前事件及其触发位置。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            (event) => {
              if (canPlay) setRevealed(true);
              else event.currentTarget.pause();
            }
          }
          onEnded={
            /** 响应 onEnded 交互，将用户操作应用到工作室场景动画。 @returns 当前步骤的处理结果。 */
            () => setFinished(true)
          }
          onError={
            /**
             * 响应 onError 交互，将用户操作应用到工作室场景动画。
             *
             * @param event - 当前事件及其触发位置。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            (event) => {
              event.currentTarget.pause();
              setFailed(true);
              setRevealed(false);
            }
          }
        />
        {showRin && (
          <svg className="studio-sequence__rin" viewBox="0 0 960 640">
            <image
              href="/brand/rin/v4/rin-full-body-640.webp"
              x="505.86"
              y="198.66"
              width="167.35"
              height="276.74"
            />
          </svg>
        )}
      </div>
    </figure>
  );
}
