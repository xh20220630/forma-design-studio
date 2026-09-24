import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, MoveUpRight, Pause, Play } from 'lucide-react';
import { StudioThemeProvider } from '@/theme/StudioTheme';
import { StudioSequence } from '@/components/motion/StudioSequence';
import { ChromaticLoom } from '@/components/motion/ChromaticLoom';
import './showcase.css';

const scenes = [
  {
    number: '01',
    title: '灵感成形',
    english: 'IDEA FOUNDRY',
    surface: '项目首页',
    description: '散落的零件沿弧线汇聚。铰链展开、界面逐层搭建，一束光沿节点走完最后一笔。',
    beats: ['轨道汇聚 / 独立自转', '折叠展开 / 分层装配', '节点点亮 / 稳定成形'],
    href: '/',
    source: 'home/home-idea-foundry.blend',
  },
  {
    number: '02',
    title: '模板展卷',
    english: 'TEMPLATE ATLAS',
    surface: '模板库',
    description: '一本立体的设计卡册徐徐展开。画板依次翻面，随后脱离书脊，重新排成一面作品墙。',
    beats: ['卡册展开 / 连锁转动', '逐张翻面 / 显露版式', '磁吸归位 / 作品墙'],
    href: '/#/templates',
    source: 'atlas/atlas-scene.blend',
  },
  {
    number: '03',
    title: '色彩织机',
    english: 'CHROMATIC LOOM',
    surface: '主题工作室',
    description:
      '每一次配色变化，都会重新组织这座材质雕塑。瓣片翻转、样本交叉换位，再嵌合成新的色彩关系。',
    beats: ['瓣片开合 / 错峰翻转', '样本交换 / 材质重组', '材质归位 / 保持静止'],
    href: '/#/theme',
    source: 'chromatic/README.md',
  },
];

/**
 * 呈现动效展示页，将展示与交互入口放在同一个组件中维护。
 * @returns 供 React 渲染的界面内容。
 */
function Showcase() {
  /** 界面状态：当前选择的对象或选中状态。通过状态更新驱动界面刷新。 */
  const [selected, setSelected] = useState(0);
  /** 界面状态：是否使用深色展示。通过状态更新驱动界面刷新。 */
  const [dark, setDark] = useState(false);
  /** 界面状态：是否展示静态画面而不播放动画。通过状态更新驱动界面刷新。 */
  const [staticMode, setStaticMode] = useState(false);
  /** 界面状态：工作室基础配色预设。通过状态更新驱动界面刷新。 */
  const [preset, setPreset] = useState<'paper' | 'glacier' | 'midnight'>('paper');
  /** 界面状态：界面强调色，供按钮、选中态和动效使用。通过状态更新驱动界面刷新。 */
  const [accent, setAccent] = useState('#38bdf8');
  const scene = scenes[selected];
  return (
    <main className={`motion-studies ${dark ? 'motion-studies--dark' : ''}`}>
      <header className="ms-header">
        <a href="/" className="ms-wordmark">
          FORMA<span> / MOTION STUDIES</span>
        </a>
        <a href="/docs/ui-motion-v5/README.md">
          制作与验收记录 <ArrowUpRight size={14} />
        </a>
      </header>
      <div className="ms-introduction">
        <div>
          <span className="ms-eyebrow">VOL. 02 — CHOREOGRAPHY IN SPACE</span>
          <h1>从想法，到成形。</h1>
        </div>
        <p>
          三套场景，三种运动语言。
          <br />
          每个动作，都有下一步。
        </p>
      </div>
      <nav className="ms-navigation" aria-label="动效场景">
        {scenes.map(
          /**
           * 转换动效展示页中的集合条目，供后续处理或展示。
           *
           * @param item - 当前遍历的条目。
           * @param index - 空间查询索引或当前条目的位置。
           * @returns 当前条目转换后的结果。
           */
          (item, index) => (
            <button
              key={item.number}
              aria-pressed={selected === index}
              onClick={
                /** 响应 onClick 交互，将用户操作应用到动效展示页。 @returns 当前步骤的处理结果。 */
                () => setSelected(index)
              }
            >
              <span>{item.number}</span>
              <strong>{item.title}</strong>
              <small>{item.english}</small>
              <MoveUpRight size={17} />
            </button>
          ),
        )}
      </nav>
      <section className="ms-screen">
        <div className="ms-stage-header">
          <span>
            <i />
            {scene.english}
          </span>
          <div>
            <button
              aria-pressed={dark}
              onClick={
                /**
                 * 响应 onClick 交互，将用户操作应用到动效展示页。
                 * @returns 当前步骤的处理结果。
                 */
                () =>
                  setDark(
                    /** 基于最新状态计算 Dark 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
                    (value) => !value,
                  )
              }
            >
              {dark ? '浅色背景' : '深色背景'}
            </button>
            <button
              aria-pressed={staticMode}
              onClick={
                /**
                 * 响应 onClick 交互，将用户操作应用到动效展示页。
                 * @returns 当前步骤的处理结果。
                 */
                () =>
                  setStaticMode(
                    /** 基于最新状态计算 StaticMode 的下一份值，避免连续更新时读到旧状态。 @param value - 当前字段、模式或控件的取值。 @returns 供 React 保存的新状态。 */
                    (value) => !value,
                  )
              }
            >
              {staticMode ? <Play size={12} /> : <Pause size={12} />}
              {staticMode ? '开启动效' : '静态模式'}
            </button>
          </div>
        </div>
        <div className="ms-presentation">
          <div className="ms-canvas">
            {selected < 2 ? (
              <StudioSequence
                key={selected}
                variant={selected === 0 ? 'foundry' : 'atlas'}
                reducedMotion={staticMode}
                showRin={selected === 0}
              />
            ) : (
              <div className="ms-loom-wrap">
                <ChromaticLoom preset={preset} accent={accent} reducedMotion={staticMode} />
                <div className="ms-loom-options">
                  <div>
                    {(
                      [
                        ['paper', '素白'],
                        ['glacier', '冰川'],
                        ['midnight', '夜航'],
                      ] as const
                    ).map(
                      /**
                       * 转换动效展示页中的集合条目，供后续处理或展示。
                       *
                       * @param options - 按顺序解构的当前条目。
                       * @param options.id - 唯一标识，用于查找、更新和建立引用。
                       * @param options.name - 面向用户展示的名称。
                       * @returns 当前条目转换后的结果。
                       */
                      ([id, name]) => (
                        <button
                          key={id}
                          aria-pressed={preset === id}
                          onClick={
                            /** 响应 onClick 交互，将用户操作应用到动效展示页。 @returns 当前步骤的处理结果。 */
                            () => setPreset(id)
                          }
                        >
                          {name}
                        </button>
                      ),
                    )}
                  </div>
                  <div aria-label="雕塑强调色">
                    {['#38bdf8', '#7959ef', '#dd5895', '#2aad85'].map(
                      /**
                       * 转换动效展示页中的集合条目，供后续处理或展示。
                       *
                       * @param color - 文字或视觉元素的颜色。
                       * @returns 当前条目转换后的结果。
                       */
                      (color) => (
                        <button
                          key={color}
                          className="ms-color"
                          aria-label={`雕塑色彩 ${color}`}
                          aria-pressed={accent === color}
                          style={{ background: color }}
                          onClick={
                            /** 响应 onClick 交互，将用户操作应用到动效展示页。 @returns 当前步骤的处理结果。 */
                            () => setAccent(color)
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <aside className="ms-description">
            <span className="ms-eyebrow">{scene.surface}</span>
            <h2>{scene.title}</h2>
            <p>{scene.description}</p>
            <ol>
              {scene.beats.map(
                /** 转换动效展示页中的集合条目，供后续处理或展示。 @param beat - 当前展示的动画节拍或阶段。 @returns 当前条目转换后的结果。 */
                (beat) => (
                  <li key={beat}>{beat}</li>
                ),
              )}
            </ol>
            <a href={scene.href}>
              在工作台中体验 <ArrowUpRight size={14} />
            </a>
            <a className="ms-source" href={`/docs/ui-motion-v5/${scene.source}`}>
              查看源文件 ↗
            </a>
          </aside>
        </div>
      </section>
      <footer className="ms-footer">
        <span>BLENDER × REACT · ORIGINAL RIN IDENTITY</span>
        <p>
          {selected === 2
            ? '材质随主题和颜色自然重组，完成后静止。'
            : '进入视野时自然播放一次，完成后停留；静态模式保留完成态。'}
        </p>
      </footer>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StudioThemeProvider>
    <Showcase />
  </StudioThemeProvider>,
);
