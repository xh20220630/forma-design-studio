import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChromaticLoom } from '@/components/motion/ChromaticLoom';
import '@fontsource-variable/geist';
import './preview.css';

/**
 * 呈现动效研究预览页，将展示与交互入口放在同一个组件中维护。
 * @returns 供 React 渲染的界面内容。
 */
function MotionStudy() {
  /** 界面状态：工作室基础配色预设。通过状态更新驱动界面刷新。 */
  const [preset, setPreset] = useState<'paper' | 'glacier' | 'midnight'>('paper');
  /** 界面状态：界面强调色，供按钮、选中态和动效使用。通过状态更新驱动界面刷新。 */
  const [accent, setAccent] = useState('#38bdf8');
  /** 界面状态：是否采用减少动态效果的表现。通过状态更新驱动界面刷新。 */
  const [reduced, setReduced] = useState(false);
  return (
    <main>
      <header>
        <span>FORMA · MATERIAL STUDIES / 03</span>
        <h1>色彩织机</h1>
        <p>主题切换不是换一块背景，而是重新组织一组材料。</p>
      </header>
      <section className="study-stage">
        <div className="study-copy">
          <small>CHROMATIC LOOM</small>
          <h2>
            打开。交换。
            <br />
            重新成形。
          </h2>
          <p>10 枚带铰链的材质瓣片、5 块样本与一枚穿梭梁，随真实的主题和颜色变化完成一次联动。</p>
          <span className="study-duration">2.9s / CSS 3D + Motion</span>
        </div>
        <ChromaticLoom preset={preset} accent={accent} reducedMotion={reduced} />
      </section>
      <div className="study-controls">
        <div>
          <label>主题材质</label>
          <div>
            {(['paper', 'glacier', 'midnight'] as const).map(
              /**
               * 转换动效研究预览页中的集合条目，供后续处理或展示。
               *
               * @param value - 当前字段、模式或控件的取值。
               * @param index - 空间查询索引或当前条目的位置。
               * @returns 当前条目转换后的结果。
               */
              (value, index) => (
                <button
                  key={value}
                  aria-pressed={preset === value}
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到动效研究预览页。 @returns 当前步骤的处理结果。 */
                    () => setPreset(value)
                  }
                >
                  {['素白', '冰川', '夜航'][index]}
                </button>
              ),
            )}
          </div>
        </div>
        <div>
          <label>真实强调色</label>
          <div>
            {['#38bdf8', '#8463f8', '#f29c55', '#29ae8d'].map(
              /**
               * 转换动效研究预览页中的集合条目，供后续处理或展示。
               *
               * @param value - 当前字段、模式或控件的取值。
               * @returns 当前条目转换后的结果。
               */
              (value) => (
                <button
                  className="study-swatch"
                  key={value}
                  aria-label={value}
                  aria-pressed={value === accent}
                  style={{ backgroundColor: value }}
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到动效研究预览页。 @returns 当前步骤的处理结果。 */
                    () => setAccent(value)
                  }
                />
              ),
            )}
          </div>
        </div>
        <label className="study-reduced">
          <input
            type="checkbox"
            checked={reduced}
            onChange={
              /** 响应 onChange 交互，将用户操作应用到动效研究预览页。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
              (event) => setReduced(event.target.checked)
            }
          />{' '}
          减少动态效果
        </label>
      </div>
      <footer>进入视野时自然展开 · 随主题与配色变化重新组合 · 动画结束后保持静止</footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<MotionStudy />);
