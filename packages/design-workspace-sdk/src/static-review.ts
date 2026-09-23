import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openDesignWorkspace } from './index.ts';

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export async function exportStaticReview(options: { designRoot: string; output?: string }) {
  const workspace = await openDesignWorkspace({ root: options.designRoot });
  const document = await workspace.read();
  const embeddedAssets = new Map<string, string>();
  for (const assetPath of new Set(document.flows.flatMap(flow => flow.nodes.map(node => node.image.assetPath)))) {
    const extension = path.extname(assetPath).toLowerCase();
    const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    embeddedAssets.set(assetPath, `data:${mime};base64,${(await readFile(await workspace.resolveAsset(assetPath))).toString('base64')}`);
  }
  const tabs = document.flows.map((flow, index) => `<button data-flow="${escapeHtml(flow.id)}" class="${index === 0 ? 'active' : ''}">${escapeHtml(flow.name)}</button>`).join('');
  const flows = document.flows.map((flow, index) => {
    const nodes = flow.nodes.map(node => `<article class="node" data-node="${escapeHtml(node.id)}" style="left:${node.frame.x}px;top:${node.frame.y}px;width:${node.frame.width}px">
      <header><strong>${escapeHtml(node.name)}</strong><span>${escapeHtml(node.kind)}</span></header>
      <div class="image"><img src="${embeddedAssets.get(node.image.assetPath)}" width="${node.image.width}" height="${node.image.height}" alt="${escapeHtml(node.name)}">${node.annotations.map((annotation, annotationIndex) => `<button class="pin" style="left:${annotation.labelX * 100}%;top:${annotation.labelY * 100}%" data-text="${escapeHtml(annotation.text)}">${annotationIndex + 1}</button>`).join('')}</div>
    </article>`).join('');
    return `<section class="flow ${index === 0 ? 'active' : ''}" data-flow-panel="${escapeHtml(flow.id)}"><div class="world">${nodes}</div><aside>${flow.edges.map(edge => `<div><strong>${escapeHtml(edge.trigger)}</strong><br>${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}<br><small>${escapeHtml(edge.condition)} · ${escapeHtml(edge.effect)}</small></div>`).join('')}</aside></section>`;
  }).join('');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(document.project.name)} · Forma Review</title><style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,"Noto Sans SC",sans-serif;color:#18181b;background:#f4f4f5}.top{height:56px;background:#fff;border-bottom:1px solid #e4e4e7;display:flex;align-items:center;padding:0 20px;gap:24px;position:fixed;inset:0 0 auto;z-index:4}.tabs{display:flex;gap:6px}.tabs button{border:0;background:transparent;padding:8px 12px;border-radius:7px}.tabs button.active{background:#18181b;color:#fff}.flow{display:none;position:fixed;inset:56px 0 0;overflow:auto;background-image:radial-gradient(#d4d4d8 1px,transparent 1px);background-size:20px 20px}.flow.active{display:block}.world{position:relative;min-width:8000px;min-height:6000px;transform:scale(.24);transform-origin:top left}.node{position:absolute;background:#fff;border:4px solid #fff;border-radius:22px;box-shadow:0 16px 50px #18181b24;overflow:hidden}.node header{height:70px;padding:15px 22px;display:flex;justify-content:space-between;align-items:center;font-size:28px}.node header span{font-size:22px;color:#71717a}.image{position:relative}.image img{display:block;width:100%;height:auto}.pin{position:absolute;width:44px;height:44px;margin:-22px;border:3px solid #fff;border-radius:50%;background:#2563eb;color:#fff;font-weight:700;font-size:20px}aside{position:fixed;right:18px;top:74px;width:310px;max-height:calc(100vh - 92px);overflow:auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:12px;box-shadow:0 8px 24px #18181b18}aside div{padding:12px;border-bottom:1px solid #eee}aside small{color:#71717a}.bubble{position:fixed;z-index:9;max-width:320px;padding:12px 14px;background:#18181b;color:#fff;border-radius:10px;box-shadow:0 10px 30px #0004}
</style></head><body><div class="top"><strong>${escapeHtml(document.project.name)}</strong><div class="tabs">${tabs}</div><small>离线设计导出 · revision ${document.revision}</small></div>${flows}<script>
document.querySelectorAll('[data-flow]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-flow]').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('[data-flow-panel]').forEach(item=>item.classList.toggle('active',item.dataset.flowPanel===button.dataset.flow));}));
document.addEventListener('click',event=>{document.querySelector('.bubble')?.remove();const pin=event.target.closest('.pin');if(!pin)return;const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=pin.dataset.text;document.body.append(bubble);const rect=pin.getBoundingClientRect();bubble.style.left=Math.min(innerWidth-340,Math.max(12,rect.left))+'px';bubble.style.top=Math.max(62,rect.top-70)+'px';});
</script></body></html>`;
  const output = path.resolve(options.output || path.join(options.designRoot, 'review.html'));
  await writeFile(output, html);
  return output;
}
