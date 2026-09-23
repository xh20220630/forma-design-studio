import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import "./chromatic-loom.css";

export interface ChromaticLoomProps {
  preset: "paper" | "glacier" | "midnight";
  accent: string;
  className?: string;
  reducedMotion?: boolean;
}

const leaves = [
  { x: -66, y: -60, angle: 0 },
  { x: -22, y: -60, angle: 0 },
  { x: 22, y: -60, angle: 0 },
  { x: 66, y: -60, angle: 0 },
  { x: 101, y: 0, angle: 90 },
  { x: 66, y: 60, angle: 180 },
  { x: 22, y: 60, angle: 180 },
  { x: -22, y: 60, angle: 180 },
  { x: -66, y: 60, angle: 180 },
  { x: -101, y: 0, angle: 270 },
];

const fragments = [
  { x: -42, y: -20, width: 45, height: 34, radius: 7 },
  { x: 14, y: -25, width: 52, height: 24, radius: 5 },
  { x: 50, y: 9, width: 27, height: 48, radius: 6 },
  { x: -10, y: 22, width: 55, height: 26, radius: 5 },
  { x: -50, y: 26, width: 26, height: 26, radius: 26 },
];

const palettes = {
  paper: { surface: "#ffffff", pearl: "#edf2f8", ink: "#253045", metal: "#b9c6d7", label: "素白" },
  glacier: { surface: "#e5f4ff", pearl: "#cde6f4", ink: "#294d68", metal: "#96bcd3", label: "冰川" },
  midnight: { surface: "#3a4b64", pearl: "#26364c", ink: "#152235", metal: "#7086a5", label: "夜航" },
};

const loomEase = [0.22, 1, 0.36, 1] as const;

function safeAccent(value: string) {
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  if (/^#[\da-f]{3}$/i.test(value)) return `#${[...value.slice(1)].map((part) => part.repeat(2)).join("")}`;
  return "#38bdf8";
}

export function ChromaticLoom({ preset, accent, className = "", reducedMotion = false }: ChromaticLoomProps) {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion || Boolean(systemReduced);
  const stageRef = useRef<HTMLElement>(null);
  const inView = useInView(stageRef, { amount: 0.2 });
  const hasEntered = useRef(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const palette = palettes[preset];
  const color = safeAccent(accent);
  const [cycle, setCycle] = useState(0);
  const [playing, setPlaying] = useState(false);
  // A hidden cycle stays completed when the sample table returns into view.
  const [completedCycle, setCompletedCycle] = useState(0);
  const colors = useMemo(() => [palette.surface, color, palette.pearl, palette.ink, palette.metal], [palette, color]);
  const staticFrame = reduced || !inView || !pageVisible;
  const resting = staticFrame || completedCycle === cycle;

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    setCycle((value) => value + 1);
  }, [preset, color]);

  useEffect(() => {
    if (inView) hasEntered.current = true;
    if (staticFrame || cycle === 0) {
      setPlaying(false);
      if (hasEntered.current || reduced) setCompletedCycle(cycle);
      return;
    }
    if (completedCycle === cycle) return;
    setPlaying(true);
    const timeout = window.setTimeout(() => {
      setPlaying(false);
      setCompletedCycle(cycle);
    }, 2950);
    return () => window.clearTimeout(timeout);
  }, [cycle, staticFrame, completedCycle, inView, reduced]);

  const rootStyle = {
    "--loom-accent": color,
    "--loom-pearl": palette.pearl,
    "--loom-ink": palette.ink,
    "--loom-surface": palette.surface,
    "--loom-metal": palette.metal,
  } as CSSProperties;

  return (
    <section ref={stageRef} className={`chromatic-loom ${className}`} data-preset={preset} data-playing={playing} style={rootStyle} aria-label="色彩织机">
      <div className="chromatic-loom__viewport" aria-hidden="true">
        <div className="chromatic-loom__ground" aria-hidden="true" />
        <div className="chromatic-loom__world" style={{ transform: "translate(-50%, -50%) rotateX(48deg) rotateZ(-27deg)" }} aria-hidden="true">
          <div className="chromatic-loom__base chromatic-loom__base--bottom" />
          <div className="chromatic-loom__base chromatic-loom__base--top"><i /><i /><i /><i /></div>
          <div className="chromatic-loom__track chromatic-loom__track--horizontal" />
          <div className="chromatic-loom__track chromatic-loom__track--vertical" />
          <div className="chromatic-loom__well" />
          {leaves.map((leaf, index) => (
            <div className="chromatic-loom__hinge" key={index} style={{ transform: `translate3d(${leaf.x}px, ${leaf.y}px, 9px) rotateZ(${leaf.angle}deg)` }}>
              <span className="chromatic-loom__pin" />
              <motion.div
                key={`${cycle}-${index}`}
                className="chromatic-loom__leaf"
                initial={false}
                animate={{ rotateX: resting ? 0 : [0, -108, -166, -166, -62, 0] }}
                transition={{ duration: resting ? 0 : 2.48, delay: resting ? 0 : index * 0.035, times: [0, 0.21, 0.4, 0.64, 0.82, 1], ease: loomEase }}
              >
                <span className="chromatic-loom__leaf-face chromatic-loom__leaf-face--front" style={{ backgroundColor: index % 3 === 0 ? color : palette.surface }}><i /><b>{String(index + 1).padStart(2, "0")}</b></span>
                <span className="chromatic-loom__leaf-face chromatic-loom__leaf-face--back" style={{ backgroundColor: colors[(index + 2) % colors.length] }}><i /></span>
                <span className="chromatic-loom__leaf-edge" />
              </motion.div>
            </div>
          ))}
          {fragments.map((fragment, index) => {
            const shifted = preset === "glacier" ? index % 2 === 0 ? 6 : -6 : preset === "midnight" ? index % 2 === 0 ? -5 : 5 : 0;
            const destinationX = fragment.x + shifted;
            return (
              <motion.div
                key={`fragment-${cycle}-${index}`}
                className={`chromatic-loom__fragment chromatic-loom__fragment--${index}`}
                initial={false}
                style={{ width: fragment.width, height: fragment.height, borderRadius: fragment.radius, "--fragment-color": colors[index] } as CSSProperties}
                animate={{
                  x: resting ? destinationX : [fragment.x, fragment.x, -fragment.x * 0.65, destinationX, destinationX],
                  y: resting ? fragment.y : [fragment.y, fragment.y, -fragment.y, fragment.y, fragment.y],
                  z: resting ? 15 : [15, 15, 70 + index * 7, 15, 15],
                  rotateZ: resting ? 0 : [0, 0, index % 2 === 0 ? 90 : -90, 0, 0],
                  rotateY: resting ? 0 : [0, 0, index % 2 === 0 ? 24 : -24, 0, 0],
                }}
                transition={{ duration: resting ? 0 : 2.55, delay: resting ? 0 : index * 0.06, times: [0, 0.23, 0.5, 0.83, 1], ease: loomEase }}
              >
                <span className="chromatic-loom__fragment-side" />
                <span className="chromatic-loom__fragment-face"><i />{index === 0 && <b>Aa</b>}{index === 2 && <b>↗</b>}</span>
              </motion.div>
            );
          })}
          <motion.div
            key={`shuttle-${cycle}`}
            className="chromatic-loom__shuttle"
            initial={false}
            animate={{ x: resting ? -95 : [-95, -95, 95, 95, -95], z: resting ? 21 : [21, 21, 90, 21, 21] }}
            transition={{ duration: resting ? 0 : 2.7, times: [0, 0.18, 0.46, 0.72, 1], ease: loomEase }}
          ><i /><i /><i /></motion.div>
        </div>
      </div>
      <footer className="chromatic-loom__footer">
        <span className="chromatic-loom__material"><i />{palette.label}<span aria-hidden="true"> / </span><code>{color.toUpperCase()}</code></span>
      </footer>
      <span className="chromatic-loom__status" role="status" aria-live="polite">{playing ? `正在编织${palette.label}色彩` : `${palette.label}色彩组合已就绪`}</span>
    </section>
  );
}

export default ChromaticLoom;
