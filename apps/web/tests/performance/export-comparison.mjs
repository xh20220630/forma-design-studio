import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../../../../docs/performance/', import.meta.url));
const date = process.argv[2] ?? '2026-10-04';
const suites = ['engine', 'editor', 'lifecycle', 'snapshot', 'stress', 'empty'];
const rows = [];
for (const suite of suites) {
  const load = async (suffix) =>
    JSON.parse(await readFile(`${directory}${date}-${suffix}${suite}.json`, 'utf8'));
  const [before, after] = await Promise.all([load(''), load('optimized-')]);
  if (before.environment.error || after.environment.error) throw new Error(`${suite}: failed run`);
  const oldRows = new Map(before.records.map((row) => [row.name, row]));
  if (oldRows.size !== after.records.length) throw new Error(`${suite}: phase count changed`);
  for (const current of after.records) {
    const previous = oldRows.get(current.name);
    if (!previous || previous.steps !== current.steps)
      throw new Error(`${current.name}: unmatched`);
    if (
      current.visibility !== 'visible' ||
      current.action.n !== current.steps ||
      current.intervals.n !== current.steps ||
      current.samples.actionMs.length !== current.steps ||
      current.samples.intervalMs.length !== current.steps
    )
      throw new Error(`${current.name}: incomplete or hidden measurement`);
    if (current.rendering.tileCacheBytes.max > 128 * 1024 * 1024)
      throw new Error(`${current.name}: tile budget exceeded`);
    rows.push({ suite, previous, current });
  }
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const samples = rows.reduce((sum, row) => sum + row.current.steps, 0);
const columns = [
  ['同步 p95', (r) => r.action.p95],
  ['rAF p95', (r) => r.intervals.p95],
  ['rAF max', (r) => r.intervals.max],
  ['总时长', (r) => r.elapsedMs],
];
const csvRows = [
  [
    'suite',
    'phase',
    'samples',
    ...columns.flatMap(([name]) => [`before_${name}_ms`, `after_${name}_ms`]),
    'completion_tail_ms',
    'long_tasks',
  ],
  ...rows.map(({ suite, previous, current }) => [
    suite,
    current.name,
    current.steps,
    ...columns.flatMap(([, value]) => [value(previous), value(current)]),
    current.completionTailMs,
    current.longTasks.length,
  ]),
];
await writeFile(
  `${directory}${date}-optimized-comparison.csv`,
  csvRows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n') + '\n',
);
const features = [
  ['空白画布缩放', 'editor/empty/0/run1/wheel-zoom', (r) => r.intervals.p95, 'rAF p95'],
  ['一万节点启动全选拖动', 'editor/dense/10000/multi-pointerdown', (r) => r.action.p95, '同步事件'],
  ['一万节点持续拖动', 'editor/dense/10000/multi-drag', (r) => r.intervals.p95, 'rAF p95'],
  ['五千子节点编组拖动', 'editor/group/5000/drag-with-snap', (r) => r.intervals.p95, 'rAF p95'],
  [
    '内嵌图片拖动提交',
    'snapshot/mixed/1000/run1/drag-commit',
    (r) => r.intervals.p95,
    '单次 rAF 间隔',
  ],
];
const cards = features
  .map(([label, name, value, metric]) => {
    const pair = rows.find((row) => row.current.name === name);
    if (!pair) throw new Error(`Missing highlight: ${name}`);
    return `<article><p>${label}</p><div class="numbers"><del>${value(pair.previous)}</del><span>→</span><strong>${value(pair.current)}<small> ms</small></strong></div><small>${metric} · 对应首轮样本</small></article>`;
  })
  .join('');
const table = rows
  .map(
    ({ suite, previous, current }) =>
      `<tr data-suite="${suite}"><td>${escape(current.name)}</td><td>${current.steps}</td>${columns.map(([, value]) => `<td><span class="before">${value(previous)}</span><b>${value(current)}</b></td>`).join('')}<td>${current.completionTailMs}</td><td>${current.longTasks.length}</td></tr>`,
  )
  .join('');
const html = `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>设计画布 · 性能优化复测</title>
<style>
:root{font-family:system-ui,"Microsoft YaHei",sans-serif;color:#e9eff9;background:#101621;color-scheme:dark}*{box-sizing:border-box}body{margin:0;padding:40px;max-width:1600px;margin:auto}header{display:flex;align-items:end;justify-content:space-between;gap:24px}h1{font-size:32px;margin:8px 0}p{color:#aebdd1;line-height:1.7}.tag{font-size:12px;letter-spacing:2px;color:#61dfc2}.meta{color:#8fa3bf;font-size:13px}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:30px 0}article{background:#1a2434;padding:20px;border:1px solid #2a3950;border-radius:12px}article p{margin:0 0 18px;color:#d8e2ef;font-size:14px}.numbers{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}del{font-size:20px;color:#92a2b9}strong{font-size:32px;color:#61dfc2}small{font-size:12px;color:#9caec5}.note{border-left:3px solid #eaba72;background:#211f20;padding:14px 20px;margin-bottom:24px;line-height:1.8;color:#c8c6ca}.links a{color:#83b8ff;margin-right:20px}input,select{padding:12px;border:1px solid #35465f;border-radius:8px;background:#182335;color:#eff4fb;font:inherit}input{width:360px}.filters{display:flex;gap:12px;align-items:center;margin:28px 0 12px}.table{overflow:auto;max-height:640px;border:1px solid #2a3950;border-radius:8px}table{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums}th{background:#233047;position:sticky;top:0;text-align:left;z-index:1}td,th{padding:12px;border-bottom:1px solid #28364a;white-space:nowrap}td:first-child{font-family:monospace}td b{color:#73dfc7;margin-left:12px}.before{color:#8fa3bf}tr:hover{background:#1d2a3d}h2{font-size:20px;margin-top:30px}footer{color:#95a7c1;line-height:1.8;font-size:13px;margin-top:20px}@media(max-width:1100px){.cards{grid-template-columns:repeat(3,1fr)}body{padding:24px}}
</style>
<header><div><div class="tag">FORMA / 2D RENDERING</div><h1>画布性能优化复测</h1><p>相机隔离 · 不可变历史 · 有序分层拖动 · 渐进栅格化</p></div><div class="meta">${date}<br>${rows.length} 个匹配阶段 · ${samples.toLocaleString()} 次动作</div></header>
<div class="cards">${cards}</div>
<div class="note">同机、同类样本前后对比。rAF 是浏览器回调间隔，不是屏幕 FPS 或 GPU 完成时间。同步提交、输入帧间隔、渐进绘制完成时间分开记录；数字不能互相替代。高光卡片展示首轮，全部重复结果见下表。</div>
<div class="links"><a href="${date}-optimization.md">完整结论与边界</a><a href="${date}-optimized-comparison.csv">下载对照 CSV</a><a href="${date}-overview.html">保留的优化前审计</a></div>
<h2>全部阶段的前后数据</h2><p>各指标显示：<span class="before">优化前</span> → <b style="color:#73dfc7">优化后</b>，单位 ms。总时长包含整个采样循环与收尾，不能直接视为单次操作耗时。</p>
<div class="filters"><input id="search" placeholder="筛选：zoom、group、10000…" aria-label="搜索阶段"><select id="suite" aria-label="测试组"><option value="">全部测试组</option>${suites.map((s) => `<option>${s}</option>`).join('')}</select><span id="count"></span></div>
<div class="table"><table><thead><tr><th>阶段</th><th>动作数</th>${columns.map(([name]) => `<th>${name} 前 → 后</th>`).join('')}<th>细化尾延迟</th><th>长任务数</th></tr></thead><tbody>${table}</tbody></table></div>
<footer>优化后额外等待 pending tiles 归零，并记录细化尾延迟；优化前仅等待三帧。因此冷启动需看总时长与尾延迟，不使用同步首帧作为完成速度。复杂结构全量替换、冷图片加载及高 DPI 效果仍可能出现长帧，详见报告。测试使用实际编辑器及渲染器，无项目保存请求。</footer>
<script>const search=document.querySelector('#search'),suite=document.querySelector('#suite'),rows=[...document.querySelectorAll('tbody tr')];function filter(){let count=0;for(const row of rows){row.hidden=!row.textContent.toLowerCase().includes(search.value.toLowerCase())||Boolean(suite.value&&row.dataset.suite!==suite.value);if(!row.hidden)count++}document.querySelector('#count').textContent=count+' 个阶段'}search.addEventListener('input',filter);suite.addEventListener('change',filter);filter();</script></html>`;
await writeFile(`${directory}${date}-optimized-overview.html`, html);
console.log(JSON.stringify({ phases: rows.length, actionSamples: samples, validated: true }));
