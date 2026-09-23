import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ChromaticLoom } from "@/components/motion/ChromaticLoom";
import "@fontsource-variable/geist";
import "./preview.css";

function MotionStudy() {
  const [preset, setPreset] = useState<"paper" | "glacier" | "midnight">("paper");
  const [accent, setAccent] = useState("#38bdf8");
  const [reduced, setReduced] = useState(false);
  return <main>
    <header><span>FORMA · MATERIAL STUDIES / 03</span><h1>色彩织机</h1><p>主题切换不是换一块背景，而是重新组织一组材料。</p></header>
    <section className="study-stage"><div className="study-copy"><small>CHROMATIC LOOM</small><h2>打开。交换。<br/>重新成形。</h2><p>10 枚带铰链的材质瓣片、5 块样本与一枚穿梭梁，随真实的主题和颜色变化完成一次联动。</p><span className="study-duration">2.9s / CSS 3D + Motion</span></div><ChromaticLoom preset={preset} accent={accent} reducedMotion={reduced}/></section>
    <div className="study-controls"><div><label>主题材质</label><div>{(["paper", "glacier", "midnight"] as const).map((value, index) => <button key={value} aria-pressed={preset === value} onClick={() => setPreset(value)}>{["素白", "冰川", "夜航"][index]}</button>)}</div></div><div><label>真实强调色</label><div>{["#38bdf8", "#8463f8", "#f29c55", "#29ae8d"].map((value) => <button className="study-swatch" key={value} aria-label={value} aria-pressed={value === accent} style={{ backgroundColor: value }} onClick={() => setAccent(value)}/>)}</div></div><label className="study-reduced"><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)}/> 减少动态效果</label></div>
    <footer>进入视野时自然展开 · 随主题与配色变化重新组合 · 动画结束后保持静止</footer>
  </main>;
}

createRoot(document.getElementById("root")!).render(<MotionStudy/>);
