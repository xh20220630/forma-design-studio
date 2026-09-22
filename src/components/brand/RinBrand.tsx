import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
  type CSSProperties,
} from "react";
import { motion, useInView } from "motion/react";
import { motionEase, motionTiming, useStudioMotion } from "../../lib/motion";
import "./rin-brand.css";

export type RinState =
  "idle" | "empty" | "thinking" | "success" | "error" | "theme";
export type RinIconKind =
  | "projects"
  | "components"
  | "tokens"
  | "canvas"
  | "sync"
  | "agent"
  | "theme"
  | "materials"
  | "motion";
export type RinIconVariant = "functional" | "sculptural";

const master = "/brand/rin/forma-rin-chibi-v1.png";
const illustrations: Record<RinState, string> = {
  idle: "/brand/rin/v4/rin-full-body-640.webp",
  empty: "/brand/rin/v4/rin-empty-320.webp",
  thinking: "/brand/rin/v4/rin-thinking-320.webp",
  success: "/brand/rin/v4/rin-success-320.webp",
  error: "/brand/rin/v4/rin-error-320.webp",
  theme: "/brand/rin/v4/rin-theme-640.webp",
};
const descriptions: Record<RinState, string> = {
  idle: "Rin，设计助手",
  empty: "Rin 正在等待新的设计",
  thinking: "Rin 正在处理设计",
  success: "Rin 已完成这次操作",
  error: "Rin 提醒你检查当前操作",
  theme: "Rin 和她的主题材质收藏",
};
function fallback(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallback) return;
  image.dataset.fallback = "true";
  image.src = master;
}
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

export function RinAvatar({
  size = 32,
  className = "",
  ready = false,
}: {
  size?: number;
  className?: string;
  ready?: boolean;
}) {
  const { reduced } = useStudioMotion();
  return (
    <motion.span
      className={`rin-avatar ${ready ? "rin-avatar--ready" : ""} ${className}`}
      style={{ width: size, height: size }}
      whileHover={reduced ? undefined : { scale: 1.045 }}
      transition={{ duration: motionTiming.feedback, ease: motionEase }}
    >
      <img
        src="/brand/rin/v4/rin-avatar-128.webp"
        alt="Rin"
        width={size}
        height={size}
        onError={fallback}
        draggable={false}
      />
      {ready && <span className="rin-avatar__ready" aria-label="Rin 已就绪" />}
    </motion.span>
  );
}

export function RinIllustration({
  state,
  size = 184,
  className = "",
}: {
  state: RinState;
  size?: number;
  className?: string;
}) {
  const { reduced } = useStudioMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const pageVisible = usePageVisible();
  const visible = inView && pageVisible;
  const active = state === "thinking" && !reduced && inView && pageVisible;
  return (
    <span
      ref={ref}
      className={`rin-illustration rin-illustration--${state} ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="rin-illustration__ground" aria-hidden="true" />
      <motion.img
        key={state}
        className="rin-illustration__art"
        src={illustrations[state]}
        alt={descriptions[state]}
        width={size}
        height={size}
        onError={fallback}
        draggable={false}
        initial={reduced ? false : { opacity: 0, y: 7, scale: 0.985 }}
        animate={
          visible || reduced
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 0, y: 7, scale: 0.985 }
        }
        transition={{
          duration: reduced ? 0 : motionTiming.enter,
          ease: motionEase,
        }}
      />
      {state === "thinking" && (
        <span className="rin-illustration__signal" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <motion.i
              key={index}
              initial={false}
              animate={
                active
                  ? { opacity: [0.2, 1, 0.2], scaleY: [0.5, 1, 0.5] }
                  : { opacity: 0.6, scaleY: 1 }
              }
              transition={
                active
                  ? {
                      duration: 1.4,
                      delay: index * 0.15,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  : { duration: 0 }
              }
            />
          ))}
        </span>
      )}
      {(state === "success" || state === "error") && (
        <motion.span
          key={`${state}-cue`}
          className={`rin-illustration__cue rin-illustration__cue--${state}`}
          aria-hidden="true"
          initial={reduced ? false : { opacity: 0, scale: 0.8 }}
          animate={
            visible || reduced
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.8 }
          }
          transition={{
            duration: reduced ? 0 : motionTiming.settle,
            ease: motionEase,
          }}
        >
          {state === "success" ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="m3.5 8 3 3 6-6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            "!"
          )}
        </motion.span>
      )}
    </span>
  );
}

const iconPaths: Record<RinIconKind, ReactNode> = {
  theme: (
    <>
      <path d="M4 8V4h10v10H4zM9 14v6h11V10h-6" />
      <path d="M7 7h4M16 16h1" />
      <path className="rin-icon__accent" d="M17 3h4v4h-4z" />
    </>
  ),
  materials: (
    <>
      <path d="m3 9 9-5 9 5-9 5-9-5ZM3 13l9 5 9-5M3 17l9 5 9-5" />
      <path className="rin-icon__accent" d="M17 2h4v4h-4z" />
    </>
  ),
  motion: (
    <>
      <path d="M3 16c4 0 3-9 8-9s4 10 9 10M16 13l4 4-4 3M3 10h2M3 21h7" />
      <path className="rin-icon__accent" d="M17 3h4v4h-4z" />
    </>
  ),
  projects: (
    <>
      <path d="M3.5 7V5.5H9l2 2h9.5V19H3.5V7Z" />
      <path d="M3.5 10h17M7 13.5v2.5h5" />
      <path className="rin-icon__accent" d="M16 3.5h4.5V8H16z" />
    </>
  ),
  components: (
    <>
      <path d="m12 2.8 6 3.5v7l-6 3.5-6-3.5v-7l6-3.5Z" />
      <path d="m6 6.3 6 3.5 6-3.5M12 9.8v7M3 11v6l6 3.5M21 11v6l-6 3.5" />
      <path className="rin-icon__accent" d="M16.5 3h4.5v4.5h-4.5z" />
    </>
  ),
  tokens: (
    <>
      <path d="M4 6h8M4 12h16M4 18h16" />
      <path d="M7 3.5v5M15 9.5v5M9 15.5v5" />
      <path className="rin-icon__accent" d="M16 3.5h4.5V8H16z" />
    </>
  ),
  canvas: (
    <>
      <path d="M8 3.5H3.5V8M3.5 16v4.5H8M16 20.5h4.5V16" />
      <path d="M7 7h9.5v9.5H7z" />
      <path d="m12 11 5 6-3 .3-1.2 2.2L12 11Z" fill="white" />
      <path className="rin-icon__accent" d="M16 3.5h4.5V8H16z" />
    </>
  ),
  sync: (
    <>
      <path d="M4 8.5a8 8 0 0 1 12-4M20 15.5a8 8 0 0 1-12 4M3.5 4v4.5H8M20.5 20v-4.5H16" />
      <path d="M7.5 12H16M13.5 9.5 16 12l-2.5 2.5" />
      <path className="rin-icon__accent" d="M17 3.5h3.5V7H17z" />
    </>
  ),
  agent: (
    <>
      <path d="M5 8.5V5h10l4 4v10H5V8.5Z" />
      <path d="M9 10h5v5H9zM15 5v4h4M3 12H1.5M12 3V1.5" />
      <path className="rin-icon__accent" d="M16.5 3h4.5v4.5h-4.5z" />
    </>
  ),
};
export function RinIcon({
  kind,
  size = 20,
  className = "",
  variant = "functional",
}: {
  kind: RinIconKind;
  size?: number;
  className?: string;
  variant?: RinIconVariant;
}) {
  const sculptural = variant === "sculptural";
  return (
    <svg
      className={`rin-icon rin-icon--${kind} rin-icon--${variant} ${className}`}
      width={size}
      height={size}
      viewBox={sculptural ? "0 0 32 32" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth={sculptural ? 1.35 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {sculptural && (
        <>
          <path
            className="rin-icon__volume-side"
            d="m4 25 3 3h21V7l-3-3v21H4Z"
          />
          <path className="rin-icon__volume-face" d="M4 4h21v21H4z" />
          <path className="rin-icon__volume-edge" d="M25 4 28 7M25 25l3 3" />
        </>
      )}
      <g transform={sculptural ? "translate(4 4) scale(.875)" : undefined}>
        {iconPaths[kind]}
      </g>
    </svg>
  );
}

export function RinThemeCompanion({
  size = 220,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const { reduced, expressive } = useStudioMotion();
  return (
    <motion.figure
      className={`rin-theme-companion ${className}`}
      style={{ "--rin-companion-size": `${size}px` } as CSSProperties}
      aria-label="凛的主题收藏"
      initial={false}
      animate="rest"
      whileHover={reduced ? undefined : "hover"}
    >
      <span className="rin-theme-companion__orbit" aria-hidden="true" />
      <RinIllustration state="theme" size={size} />
      <motion.span
        className="rin-theme-companion__chip rin-theme-companion__chip--material"
        aria-hidden="true"
        variants={{
          rest: { rotate: -8, x: 0, y: 0 },
          hover: { rotate: 0, x: expressive ? -7 : 0, y: expressive ? -6 : -1 },
        }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 250, damping: 19 }
        }
      >
        <RinIcon kind="materials" size={16} />
        <span>YOUR STYLE</span>
      </motion.span>
      <motion.span
        className="rin-theme-companion__chip rin-theme-companion__chip--motion"
        aria-hidden="true"
        variants={{
          rest: { rotate: 6, x: 0, y: 0 },
          hover: { rotate: 0, x: expressive ? 7 : 0, y: expressive ? 5 : 1 },
        }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 250, damping: 19 }
        }
      >
        <RinIcon kind="motion" size={16} />
        <span>WITH RIN</span>
      </motion.span>
    </motion.figure>
  );
}

function StudioVideo({
  active,
  className = "",
  onPlayback,
}: {
  active: boolean;
  className?: string;
  onPlayback?: (playing: boolean) => void;
}) {
  const { reduced } = useStudioMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const pageVisible = usePageVisible();
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    if (active && !reduced && inView && pageVisible) {
      void video.play().catch(() => {
        if (!cancelled) onPlayback?.(false);
      });
    } else {
      video.pause();
      if (!active || reduced) video.load();
    }
    return () => {
      cancelled = true;
      video.pause();
    };
  }, [active, reduced, inView, pageVisible, onPlayback]);
  return (
    <video
      ref={ref}
      className={`rin-studio-video ${className}`}
      width="720"
      height="480"
      muted
      loop
      playsInline
      preload="none"
      poster="/brand/rin/rin-studio-poster.png"
      aria-label="Rin 工作室，设计变量、组件与界面归位演示"
      onPlay={() => onPlayback?.(true)}
      onPause={() => onPlayback?.(false)}
    >
      <source src="/brand/rin/rin-studio-loop.webm" type="video/webm" />
    </video>
  );
}
export function RinAssembly({
  active = false,
  className = "",
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <StudioVideo active={active} className={`rin-assembly ${className}`} />
  );
}
export function RinStudioScene({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { reduced } = useStudioMotion();
  const [requested, setRequested] = useState(false);
  const [playing, setPlaying] = useState(false);
  return (
    <figure
      className={`rin-studio-scene ${compact ? "rin-studio-scene--compact" : ""} ${className}`}
    >
      <div className="rin-studio-scene__visual">
        <StudioVideo active={requested} onPlayback={setPlaying} />
      </div>
      <figcaption className="rin-studio-scene__caption">
        <span className="rin-studio-scene__label">
          <span aria-hidden="true">R</span>
          <span>
            RIN STUDIO<small>Token · Component · Canvas</small>
          </span>
        </span>
        <button
          type="button"
          className="rin-studio-scene__control"
          disabled={Boolean(reduced)}
          aria-pressed={requested && !reduced}
          onClick={() => setRequested((value) => !value)}
          aria-label={
            reduced
              ? "已遵循减少动态效果设置"
              : requested
                ? "停止工作室演示"
                : "播放工作室演示"
          }
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            {playing ? (
              <path d="M3 2h2v8H3zm4 0h2v8H7z" />
            ) : (
              <path d="m3 2 7 4-7 4V2Z" />
            )}
          </svg>
          {reduced ? "静态演示" : requested ? "停止演示" : "播放演示"}
        </button>
      </figcaption>
    </figure>
  );
}
