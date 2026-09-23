import { Maximize } from "lucide-react";
import type { PointerEvent } from "react";

interface Props {
  zoom: number;
  origin: { x: number; y: number };
  viewport: { width: number; height: number };
  onFit: () => void;
  onGuide?: (axis: "x" | "y", event: PointerEvent<HTMLDivElement>) => void;
}

function rulerTicks(length: number, origin: number, zoom: number) {
  const target = 72 / zoom;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].find((value) => value * magnitude >= target)! * magnitude;
  const minor = step / 5;
  const start = Math.floor((20 - origin) / zoom / minor);
  const end = Math.ceil((length - origin) / zoom / minor);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
    const tick = start + index;
    return {
      position: origin + tick * minor * zoom,
      label: tick % 5 === 0 ? String(Math.round(tick * minor)) : undefined,
    };
  });
}

export default function CanvasRulers({ zoom, origin, viewport, onFit, onGuide }: Props) {
  return (
    <div className="ed-viewport-rulers">
      <div className="ed-viewport-ruler is-horizontal" title={onGuide ? "点击添加垂直参考线" : "水平标尺"} onPointerDown={(event) => onGuide?.("x", event)}>
        {rulerTicks(viewport.width, origin.x, zoom).map((tick) => (
          <span key={tick.position} className={tick.label !== undefined ? "is-major" : ""} style={{ left: tick.position }}>
            {tick.label}
          </span>
        ))}
      </div>
      <div className="ed-viewport-ruler is-vertical" title={onGuide ? "点击添加水平参考线" : "垂直标尺"} onPointerDown={(event) => onGuide?.("y", event)}>
        {rulerTicks(viewport.height, origin.y, zoom).map((tick) => (
          <span key={tick.position} className={tick.label !== undefined ? "is-major" : ""} style={{ top: tick.position }}>
            {tick.label}
          </span>
        ))}
      </div>
      <button type="button" className="ed-ruler-origin" title="适应画布" aria-label="适应画布" onClick={onFit}>
        <Maximize size={11} />
      </button>
    </div>
  );
}
