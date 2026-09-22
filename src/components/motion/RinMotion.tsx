import { useEffect, useRef, useState, type HTMLAttributes, type PointerEvent } from "react";
import { motion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useStudioMotion } from "../../lib/motion";
import { rinMotionAssets, rinMotionEase, rinMotionTiming } from "../../lib/rin-motion";
import "./rin-motion.css";

interface RinMotionSceneProps {
  active?: boolean;
  className?: string;
  label?: string;
  controls?: boolean;
}

export function RinMotionScene({
  active,
  className = "",
  label = "凛与珍珠白设计图层",
  controls = active === undefined,
}: RinMotionSceneProps) {
  const { reduced } = useStudioMotion();
  const container = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(() => document.visibilityState === "visible");
  const [manualPlaying, setManualPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const requested = active ?? manualPlaying;
  const canPlay = requested && visible && foreground && !reduced && !failed;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1), { threshold: 0.1 });
    observer.observe(element);
    const onVisibility = () => setForeground(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (canPlay) setLoaded(true);
  }, [canPlay]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    if (!canPlay || !loaded) {
      element.pause();
      setPlaying(false);
      return;
    }
    element.play().then(() => {
      if (!cancelled) setPlaying(true);
    }).catch(() => {
      if (!cancelled) { setPlaying(false); setFailed(true); }
    });
    return () => {
      cancelled = true;
      element.pause();
    };
  }, [canPlay, loaded]);

  return (
    <figure ref={container} className={`rin-motion-scene ${className}`} data-playing={playing} data-reduced={reduced}>
      <div className="rin-motion-scene__media">
        <img className="rin-motion-scene__poster" src={rinMotionAssets.poster} alt={label} loading="lazy" decoding="async" />
        <video ref={video} src={loaded ? rinMotionAssets.loop : undefined} poster={rinMotionAssets.poster} muted loop playsInline preload="none" aria-hidden="true" onError={() => { setFailed(true); setPlaying(false); }} />
      </div>
      {controls && active === undefined && (
        <button type="button" className="rin-motion-scene__control" aria-label={manualPlaying && !failed ? "暂停凛的工作室动效" : "播放凛的工作室动效"} aria-pressed={manualPlaying && !reduced && !failed} disabled={reduced} onClick={() => { if (failed) { video.current?.load(); setFailed(false); setManualPlaying(true); } else setManualPlaying((value) => !value); }}>
          {playing ? <Pause size={12} /> : <Play size={12} />}
          <span>{reduced ? "静态预览" : failed ? "重新播放" : manualPlaying ? "暂停动效" : "播放动效"}</span>
        </button>
      )}
    </figure>
  );
}

interface RinParallaxProps extends HTMLAttributes<HTMLDivElement> {
  amount?: number;
}

export function RinParallax({ amount = 2, className = "", children, onPointerMove, onPointerLeave, ...props }: RinParallaxProps) {
  const { reduced } = useStudioMotion();
  const surface = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const reset = () => {
    cancelAnimationFrame(frame.current);
    surface.current?.style.setProperty("--rin-tilt-x", "0deg");
    surface.current?.style.setProperty("--rin-tilt-y", "0deg");
  };
  useEffect(() => {
    if (reduced) reset();
    return () => cancelAnimationFrame(frame.current);
  }, [reduced]);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (event.defaultPrevented || event.buttons !== 0) { reset(); return; }
    if (reduced || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height - 0.5) * 2));
    const tilt = Math.max(0, Math.min(3, amount));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      surface.current?.style.setProperty("--rin-tilt-x", `${-y * tilt}deg`);
      surface.current?.style.setProperty("--rin-tilt-y", `${x * tilt}deg`);
    });
  };
  return <div ref={surface} className={`rin-parallax ${className}`} onPointerMove={move} onPointerLeave={(event) => { reset(); onPointerLeave?.(event); }} {...props}>{children}</div>;
}

export function RinSelectionIndicator({ layoutId, className = "" }: { layoutId: string; className?: string }) {
  const { reduced } = useStudioMotion();
  return <motion.span aria-hidden="true" className={`rin-selection-indicator ${className}`} layoutId={reduced ? undefined : layoutId} initial={false} transition={{ duration: reduced ? 0 : rinMotionTiming.selection, ease: rinMotionEase }} />;
}

export function RinTaskActivity({ running, label, className = "" }: { running: boolean; label?: string; className?: string }) {
  const { reduced } = useStudioMotion();
  return <span className={`rin-task-activity ${className}`} data-running={running} data-reduced={reduced} role="status"><span className="rin-task-activity__signal" aria-hidden="true"><i /><i /><i /></span><span>{label ?? (running ? "凛正在处理" : "等待任务")}</span></span>;
}
