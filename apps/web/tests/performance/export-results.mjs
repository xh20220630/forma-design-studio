import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../../../../docs/performance/', import.meta.url));
const date = process.argv[2] ?? '2026-10-04';
const suites = ['engine', 'editor', 'lifecycle', 'snapshot', 'stress', 'empty'];
const runs = await Promise.all(
  suites.map(async (suite) => ({
    suite,
    ...JSON.parse(await readFile(`${directory}${date}-${suite}.json`, 'utf8')),
  })),
);
const rows = runs.flatMap((run) => run.records.map((row) => ({ ...row, sourceSuite: run.suite })));
for (const row of rows) {
  if (
    row.action.n !== row.steps ||
    row.intervals.n !== row.steps ||
    row.samples.actionMs.length !== row.steps ||
    row.samples.intervalMs.length !== row.steps
  )
    throw new Error(`Incomplete samples: ${row.name}`);
  if (row.visibility !== 'visible') throw new Error(`Hidden document: ${row.name}`);
  if (row.rendering.tileCacheBytes.max > 128 * 1024 * 1024)
    throw new Error(`Tile budget exceeded: ${row.name}`);
}
if (runs.some((run) => run.environment.error)) throw new Error('A baseline contains an error');
const samples = rows.reduce((sum, row) => sum + row.steps, 0);
const csv = [
  [
    'suite',
    'name',
    'samples',
    'sync_p95_ms',
    'sync_max_ms',
    'raf_p95_ms',
    'raf_max_ms',
    'long_tasks',
    'draw_p95_ms',
    'clone_total_ms',
    'compare_json_total_ms',
  ],
  ...rows.map((row) => [
    row.sourceSuite,
    row.name,
    row.steps,
    row.action.p95,
    row.action.max,
    row.intervals.p95,
    row.intervals.max,
    row.longTasks.length,
    row.timings['engine.draw']?.p95 ?? '',
    row.timings['document.clone']?.total ?? '',
    row.timings['document.compare-json']?.total ?? '',
  ]),
]
  .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
  .join('\n');
await writeFile(`${directory}${date}-summary.csv`, csv + '\n');
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const row = (name) => rows.find((item) => item.name === name);
const embedded = JSON.parse(await readFile(`${directory}${date}-embedded-partial.json`, 'utf8'));
const crashCommit = embedded.records.find((item) => item.name === 'editor/mixed/5000/drag-commit');
const multi = row('editor/dense/10000/multi-pointerdown');
const cold = row('editor/mixed-url/10000/mount');
const snapshot = rows.filter((item) =>
  /^snapshot\/mixed\/1000\/run\d\/drag-commit$/.test(item.name),
);
const range = snapshot.map((item) => item.intervals.max);
const shortRange = rows
  .filter((item) => /^snapshot\/mixed-url\/1000\/run\d\/drag-commit$/.test(item.name))
  .map((item) => item.intervals.max);
const emptyRange = rows
  .filter((item) => /^editor\/empty\/0\/run\d\/wheel-zoom$/.test(item.name))
  .map((item) => item.intervals.p95);
const report = `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>设计画布性能审计 · ${date}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f1f4f9;color:#17263c;font:14px/1.6 system-ui,'Microsoft YaHei',sans-serif}main{max-width:1220px;margin:auto;padding:32px 24px}h1{font-size:28px;margin:0}h2{font-size:18px;margin:24px 0 10px}p{margin:6px 0;color:#536278}.eyebrow{font-size:12px;color:#5a718f;font-weight:600;letter-spacing:1px}.lead{font-size:16px;color:#263f5d}.meta{display:flex;gap:20px;margin:16px 0;font-size:12px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{background:white;border:1px solid #dce4ef;border-radius:10px;padding:16px}.value{font-size:30px;font-weight:700;color:#b33637;line-height:1.3}.card small{color:#697990;font-size:11px}.label{font-size:12px;color:#536278}.diagnosis{display:grid;grid-template-columns:1.3fr 1fr;gap:20px;margin-top:20px}.panel{background:white;border:1px solid #dce4ef;border-radius:10px;padding:18px}ol{padding-left:20px;margin:0}li{margin:5px 0}.good{color:#247557}.pill{display:inline-block;background:#fff0ee;color:#a63739;padding:2px 9px;border-radius:4px;font-size:12px}.tools{display:flex;gap:12px;margin-bottom:12px}input,select{border:1px solid #b8c7d9;border-radius:5px;padding:8px;background:white}input{width:420px}table{border-collapse:collapse;width:100%;font-size:12px;background:white}th,td{border-bottom:1px solid #e3e9f2;padding:8px 12px;text-align:right}th:first-child,td:first-child{text-align:left}th{background:#e9eff7}td:first-child{font-family:ui-monospace,monospace}a{color:#2368ad}.foot{font-size:12px}button{cursor:pointer}
</style><main><div class="eyebrow">FORMA / CANVAS PERFORMANCE AUDIT / ${date}</div><h1>设计画布存在明确的性能瓶颈</h1><p class="lead">优先修复相机与 UI、项目快照、批量交互和集中重绘。</p>
<div class="meta"><span>${rows.length} 个完成的测量阶段 · ${samples.toLocaleString()} 个动作样本</span><span>生产构建 · i5-12600KF · GTX 750 Ti</span><span>Chromium 154 · 空闲 rAF ≈ 180 Hz</span></div>
<div class="cards">
<div class="card"><div class="label">真实空白画布 · 连续缩放</div><div class="value">${Math.round(Math.min(...emptyRange))}–${Math.round(Math.max(...emptyRange))} ms</div><small>三轮 rAF p95；引擎绘制仅约 2–3 ms</small></div>
<div class="card"><div class="label">10,000 矩形 · 全选开始拖动</div><div class="value">${Math.round(multi.intervals.max)} ms</div><small>普通图形也有阻塞，非图片专属问题</small></div>
<div class="card"><div class="label">10,000 混合节点 · 挂载</div><div class="value">${(cold.action.max / 1000).toFixed(2)} s</div><small>同步调用；图片使用短资源地址</small></div>
<div class="card"><div class="label">1,000 节点 · 图片快照三轮对照</div><div class="value">${Math.round(Math.min(...range))}–${Math.round(Math.max(...range))} ms</div><small>短资源地址版本约 ${Math.round(Math.min(...shortRange))}–${Math.round(Math.max(...shortRange))} ms</small></div></div>
<div class="diagnosis"><section class="panel"><span class="pill">修复顺序</span><ol><li><b>相机与 UI：</b>60 次缩放引发 120 次视图更新。</li><li><b>资源与历史：</b>整项目复制、JSON 比较放大图片数据。</li><li><b>批量交互：</b>数组嵌套查找，编组拖动反复更新整场景。</li><li><b>绘制预算：</b>缩放跨档集中栅格化/上传，GPU 同步阻塞。</li></ol></section>
<section class="panel"><span class="pill good">表现正常的部分</span><p class="good">缓存平移 p95 约 1.6 ms；图层列表约 30 个 DOM 行。</p><p>瓦片与节点位图守住 128 / 64 MiB 预算；释放后资源计数归零。</p><p class="foot">rAF 间隔不是呈现 FPS / INP；单次值不是稳定分位数。真实空白页面、文字、路径、组件、撤销/重做和双倍像素负载均有记录。</p></section></div>
<h2>完整测量明细</h2><div class="tools"><input id="search" aria-label="搜索测量阶段" placeholder="搜索场景：zoom、drag、empty、text…"><select id="suite" aria-label="筛选测试组"><option value="">全部 ${rows.length} 项</option>${suites.map((suite) => `<option>${suite}</option>`).join('')}</select><a href="${date}-canvas-performance.md">详细分析报告</a><a href="${date}-summary.csv">CSV</a></div>
<p class="foot">按最大观测帧间隔排序。sync 为动作同步耗时；异步 React 绘制另见原始数据。输入循环后续三帧的函数和长任务有记录，但不进入 rAF 分位数。后台负载未隔离，各轮绝对值存在波动；本页展示最终基线，早期数据另行保留。</p>
<table><thead><tr><th>测量阶段</th><th>样本</th><th>sync p95</th><th>rAF p95</th><th>rAF 最大</th><th>长任务</th></tr></thead><tbody>${[
  ...rows,
]
  .sort((a, b) => b.intervals.max - a.intervals.max)
  .map(
    (item) =>
      `<tr data-suite="${item.sourceSuite}"><td>${escape(item.name)}</td><td>${item.steps}</td><td>${item.action.p95} ms</td><td>${item.intervals.p95} ms</td><td>${item.intervals.max} ms</td><td>${item.longTasks.length}</td></tr>`,
  )
  .join('')}</tbody></table>
<p class="foot">5,000 节点内嵌图片压力运行在崩溃前捕获 ${Math.round(crashCommit.intervals.max)} ms 帧间隔，单独保留部分记录。各基线 JSON 与复现说明在同目录。已执行测试入口 typecheck / build，未运行 lint。</p></main>
<script>const search=document.querySelector('#search'),suite=document.querySelector('#suite');function filter(){for(const row of document.querySelectorAll('tbody tr'))row.hidden=!(row.textContent.toLowerCase().includes(search.value.toLowerCase())&&(!suite.value||row.dataset.suite===suite.value));}search.addEventListener('input',filter);suite.addEventListener('change',filter);</script></html>`;
await writeFile(`${directory}${date}-overview.html`, report);
console.log(
  JSON.stringify(
    {
      suites: runs.map((run) => ({ suite: run.suite, phases: run.records.length })),
      phases: rows.length,
      samples,
      allSamplesComplete: true,
      tileBudgetsRespected: true,
    },
    null,
    2,
  ),
);
