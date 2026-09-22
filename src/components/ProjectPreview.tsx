import type { CSSProperties } from 'react';
import type { DesignComponent, DesignNode, DesignTemplate, Project, ThemeTokens } from '../types';
import { NodeView, getProjectTokens } from './SceneRenderer';
import './library.css';

interface ProjectPreviewProps { project?: Project; template?: DesignTemplate; compact?: boolean }

export function DesignNodeVisual({ node, tokens, components, nodes = [], depth = 0, project }: { node: DesignNode; tokens: ThemeTokens; components: DesignComponent[]; nodes?: DesignNode[]; depth?: number; project?: Project }) {
  return <NodeView node={node} project={project ?? ({ tokens, components } as Project)} nodes={nodes} depth={depth} />;
}
export default function ProjectPreview({ project, template, compact }: ProjectPreviewProps) {
  const cover = project?.cover ?? template?.cover ?? 'blank';
  const tokens = project ? getProjectTokens(project) : template?.tokens;
  const style = { '--preview-primary': tokens?.primary ?? '#33795e', '--preview-bg': tokens?.background ?? '#f4f6f3', '--preview-surface': tokens?.surface ?? '#fff', '--preview-text': tokens?.text ?? '#25362d', '--preview-muted': tokens?.muted ?? '#88948c', '--preview-border': tokens?.border ?? '#e6eae6' } as CSSProperties;
  const label = template?.id === 'paper' ? 'paper & things' : 'moss.';
  const livePage = project?.pages[0];
  if (project && livePage) return <div className={`project-preview project-preview--live${compact ? ' project-preview--compact' : ''}`} style={style} aria-label={`${project.name}实时画布预览`}><svg className="project-preview-live-canvas" viewBox={`0 0 ${livePage.width} ${livePage.height}`} preserveAspectRatio="xMidYMin meet"><foreignObject x="0" y="0" width={livePage.width} height={livePage.height}><div style={{ width: livePage.width, height: livePage.height, background: livePage.background ?? tokens?.background, position: 'relative', overflow: 'hidden' }}>{livePage.nodes.map(node => <DesignNodeVisual key={node.id} node={node} tokens={project.tokens} components={project.components} nodes={livePage.nodes} project={project} />)}</div></foreignObject></svg><span className="project-preview-disclaimer">实时画布</span></div>;
  return <div className={`project-preview project-preview--${cover}${compact ? ' project-preview--compact' : ''}`} style={style} aria-label={`${project?.name ?? template?.name ?? '项目'}设计预览`}>
    {project && <span className="project-preview-disclaimer">主题预览</span>}
    {(cover === 'dashboard' || cover === 'finance') && <div className="project-preview-app">
      <aside className="project-preview-sidebar">
        <div className="project-preview-brand">{cover === 'finance' ? '◈ vault' : '◈ nexus'}</div>
        <div className="project-preview-overline">WORKSPACE</div>
        {['◫  Overview', '▥  Analytics', '▤  Projects', '◷  Activity'].map((label, index) => <div className={`project-preview-nav ${index === 0 ? 'is-active' : ''}`} key={label}>{label}</div>)}
        <div className="project-preview-team"><span>AC</span> Alex Chen <small>⌄</small></div>
      </aside>
      <div className="project-preview-main">
        <header><span>Workspace <b>/</b> Overview</span><span className="project-preview-avatar">A</span></header>
        <div className="project-preview-welcome"><div><h3>{cover === 'finance' ? 'Your money, at a glance.' : 'A little insight. A lot of possibility.'}</h3><p>{cover === 'finance' ? 'Welcome back, Alex. Here’s your financial overview.' : 'Welcome back, Alex. Here’s what’s happening today.'}</p></div><span className="project-preview-tiny-button">↗ {cover === 'finance' ? 'Add asset' : 'Export'}</span></div>
        <div className="project-preview-metrics">
          {(cover === 'finance' ? [['Total balance', '$128,450.00'], ['Monthly return', '$8,240.60'], ['Available cash', '$24,680.00']] : [['Total revenue', '$128,450'], ['Active users', '8,549'], ['Conversion rate', '4.28%']]).map(([name, value], i) => <div key={name}><label>{name}<span>↗</span></label><strong>{value}</strong><small>↗ {['18.6', '12.8', '2.4'][i]}% <em>vs. last month</em></small></div>)}
        </div>
        <div className="project-preview-chart-card">
          <div className="project-preview-chart-heading"><b>{cover === 'finance' ? 'Portfolio performance' : 'Revenue overview'}</b><span><i /> {cover === 'finance' ? 'Portfolio value' : 'Revenue'} <em>This year ⌄</em></span></div>
          <div className="project-preview-chart">
            <div className="project-preview-chart-labels"><span>40k</span><span>30k</span><span>20k</span><span>10k</span></div>
            <div className="project-preview-chart-grid">
              {cover === 'finance' ? <svg className="project-preview-line" viewBox="0 0 600 145" preserveAspectRatio="none"><defs><linearGradient id={`area-${project?.id ?? template?.id ?? 'vault'}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".2" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs><path d="M0 120 L22 108 L42 118 L69 84 L91 97 L115 78 L143 90 L165 47 L185 65 L210 49 L231 73 L258 53 L283 63 L308 28 L333 42 L357 33 L381 52 L412 30 L435 36 L463 15 L487 29 L515 16 L542 25 L573 4 L600 10 L600 145 L0 145 Z" fill={`url(#area-${project?.id ?? template?.id ?? 'vault'})`} /><path d="M0 120 L22 108 L42 118 L69 84 L91 97 L115 78 L143 90 L165 47 L185 65 L210 49 L231 73 L258 53 L283 63 L308 28 L333 42 L357 33 L381 52 L412 30 L435 36 L463 15 L487 29 L515 16 L542 25 L573 4 L600 10" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg> : <div className="project-preview-bars">{[38, 56, 46, 70, 54, 79, 63, 91, 73, 84, 69, 98].map((height, i) => <div key={i} style={{ height: `${height}%`, opacity: i === 8 ? 1 : .24 + i * .045 }} />)}</div>}
              <div className="project-preview-months">{['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map(month => <span key={month}>{month}</span>)}</div>
            </div>
          </div>
        </div>
        <div className="project-preview-table"><b>{cover === 'finance' ? 'Your assets' : 'Recent activity'}<span>View all ↗</span></b><div><span>{cover === 'finance' ? '◉  Global equity fund' : '◈  Website redesign'}</span><em>{cover === 'finance' ? '+ 8.42%' : 'In progress'}</em><span>{cover === 'finance' ? '$42,680.00' : 'Alex Chen'}</span></div></div>
      </div>
    </div>}
    {cover === 'commerce' && <div className={`project-preview-store ${template?.id === 'paper' ? 'project-preview-store--paper' : ''}`}>
      <header><strong>{label}</strong><nav>Shop all <span>Our story</span> Journal</nav><span>Bag (0)</span></header>
      <div className="project-preview-store-hero"><div className="project-preview-store-copy"><small>A LITTLE CLOSER TO NATURE</small><h3>{template?.id === 'paper' ? <>Objects with<br />a story to tell.</> : <>Less, but<br /><i>more lovely.</i></>}</h3><p>Considered essentials for a slower,<br />more intentional everyday.</p><span className="project-preview-shop-button">Discover the collection <span>↗</span></span></div><div className="project-preview-still-life"><div className="project-preview-sun" /><div className="project-preview-branch"><i /><i /><i /><i /><i /></div><div className="project-preview-vase" /><div className="project-preview-small-vase" /><div className="project-preview-stone" /></div></div>
      <div className="project-preview-store-bottom"><span>Good things, for everyday.</span><small>Explore our essentials ↗</small></div>
      <div className="project-preview-products"><div><i className="project-preview-bowl" /><small>Objects for your home</small></div><div><i className="project-preview-candle" /><small>A moment of calm</small></div><div><i className="project-preview-linen" /><small>Simple, naturally</small></div></div>
    </div>}
    {cover === 'travel' && <div className="project-preview-travel">
      <header><strong>roam<span>®</span></strong><nav>Destinations <span>Experiences</span> Our journal</nav><span>Find your escape ↗</span></header>
      <div className="project-preview-coast"><div className="project-preview-island" /><div className="project-preview-island-small" /><div className="project-preview-wave project-preview-wave--one" /><div className="project-preview-wave project-preview-wave--two" /><div className="project-preview-travel-copy"><small>LESS ORDINARY. MORE YOU.</small><h3>Somewhere<br /><i>worth getting lost.</i></h3><p>Extraordinary places. Unforgettable moments.</p><div className="project-preview-travel-search"><span>⌕ &nbsp; Where do you want to go?</span><b>Explore ↗</b></div></div><div className="project-preview-place-label">NUSA PENIDA, BALI <span>08°43′S 115°32′E</span></div></div>
      <div className="project-preview-travel-bottom"><small>THE WORLD IS WAITING</small><h4>Go where you feel most alive.</h4><span>Explore destinations ↗</span></div>
    </div>}
    {cover === 'blank' && <div className="project-preview-blank"><div className="project-preview-blank-art"><div /><div /><div /></div><strong>下一个好想法，从这里开始。</strong><span>{project?.name ?? 'Your next big thing'}</span></div>}
  </div>;
}


