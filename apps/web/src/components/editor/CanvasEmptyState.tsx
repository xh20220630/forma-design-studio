import { Frame, Type } from "lucide-react";
import { RinIcon } from "../brand/RinBrand";

interface Props {
  background: string;
  onFrame: () => void;
  onText: () => void;
  onOpenAgent: () => void;
}

export default function CanvasEmptyState({ background, onFrame, onText, onOpenAgent }: Props) {
  const hex = background.replace(/^#/, "");
  const rgb = /^[\da-f]{6}$/i.test(hex) ? [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) : [255, 255, 255];
  const dark = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 < 140;
  return (
    <div className={`ed-start-design${dark ? " is-dark" : ""}`} onPointerDown={(event) => event.stopPropagation()}>
      <img
        className="ed-start-illustration"
        src="/brand/rin/editor/rin-start-design.png"
        alt="凛坐在设计画框旁，轻触半透明布局面板"
        draggable={false}
      />
      <h2>开始设计</h2>
      <p>从一个画框开始，把想法放上画布。</p>
      <div className="ed-start-actions">
        <button type="button" onClick={onFrame}><Frame size={14} />画框<kbd>F</kbd></button>
        <button type="button" onClick={onText}><Type size={14} />文字<kbd>T</kbd></button>
      </div>
      <button type="button" className="ed-start-with-rin" onClick={onOpenAgent}>
        <RinIcon kind="agent" size={14} />与凛一起设计<span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}
