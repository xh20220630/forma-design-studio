import { useEffect, useRef, useState } from "react";
import { useStudioMotion } from "../../lib/motion";
import "./studio-sequence.css";

export const studioSequences = {
  foundry: {
    src: "/brand/rin/v5/motion/home-idea-foundry.webm",
    poster: "/brand/rin/v5/motion/home-idea-foundry-poster.webp",
  },
  atlas: {
    src: "/brand/rin/v5/motion/atlas-unfold.webm",
    poster: "/brand/rin/v5/motion/atlas-poster.webp",
  },
} as const;

type SequenceKind = keyof typeof studioSequences;

interface StudioSequenceProps {
  variant: SequenceKind;
  trigger?: string;
  autoplay?: boolean;
  reducedMotion?: boolean;
  className?: string;
  showRin?: boolean;
}

export function StudioSequence({ variant, trigger, autoplay = true, reducedMotion = false, className = "", showRin = false }: StudioSequenceProps) {
  const sequence = studioSequences[variant];
  const { reduced: preferenceReduced } = useStudioMotion();
  const container = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(() => document.visibilityState === "visible");
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = preferenceReduced || reducedMotion || systemReduced;
  const canPlay = autoplay && visible && foreground && !reduced && !failed && !finished;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      const inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
      if (!inView) video.current?.pause();
      setVisible(inView);
    }, { threshold: 0.2 });
    if (container.current) observer.observe(container.current);
    const onVisibility = () => {
      const active = document.visibilityState === "visible";
      if (!active) video.current?.pause();
      setForeground(active);
    };
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => {
      if (preference.matches) video.current?.pause();
      setSystemReduced(preference.matches);
    };
    document.addEventListener("visibilitychange", onVisibility);
    preference.addEventListener("change", onPreference);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      preference.removeEventListener("change", onPreference);
    };
  }, []);

  useEffect(() => {
    setFinished(false);
    setFailed(false);
    setRevealed(false);
    const element = video.current;
    if (!element) return;
    element.pause();
    if (element.error) element.load();
    else if (element.readyState >= 1) element.currentTime = 0;
  }, [variant, trigger]);

  useEffect(() => {
    if (canPlay) setLoaded(true);
  }, [canPlay]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    if (!canPlay || !loaded) {
      element.pause();
      return;
    }
    element.playbackRate = 1.25;
    element.play().catch(() => {
      if (!cancelled) {
        setFailed(true);
        setRevealed(false);
      }
    });
    return () => {
      cancelled = true;
      element.pause();
    };
  }, [canPlay, loaded, variant, trigger]);

  return (
    <figure ref={container} className={`studio-sequence studio-sequence--${variant} ${className}`} data-frame={revealed && !failed && !reduced} aria-hidden="true">
      <div className="studio-sequence__stage">
        <img className="studio-sequence__poster" src={sequence.poster} alt="" loading="lazy" decoding="async" draggable={false} />
        <video key={variant} ref={video} src={loaded ? sequence.src : undefined} muted playsInline controls={false} disablePictureInPicture disableRemotePlayback tabIndex={-1} preload={loaded ? "auto" : "none"}
          onPlaying={(event) => {
            if (canPlay) setRevealed(true);
            else event.currentTarget.pause();
          }}
          onEnded={() => setFinished(true)}
          onError={(event) => {
            event.currentTarget.pause();
            setFailed(true);
            setRevealed(false);
          }}
        />
        {showRin && <svg className="studio-sequence__rin" viewBox="0 0 960 640"><image href="/brand/rin/v4/rin-full-body-640.webp" x="505.86" y="198.66" width="167.35" height="276.74" /></svg>}
      </div>
    </figure>
  );
}
