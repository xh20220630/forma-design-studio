import { useEffect, useState } from 'react';
import type { ReconstructionStatus } from '@forma/schema';
import { api } from '../../../shared/api/client';
import '../styles/reconstruction.css';

export function ReconstructionProgress({
  projectId,
  sourceImageUrl,
  active = false,
}: {
  projectId: string;
  sourceImageUrl: string;
  active?: boolean;
}) {
  const [status, setStatus] = useState<ReconstructionStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setStatus(null);
    setUnavailable(false);
    let ongoing = false;
    const poll = async () => {
      try {
        const next = await api<ReconstructionStatus | null>(
          `/projects/${projectId}/reconstruction`,
        );
        if (cancelled) return;
        const current = next?.sourceImageUrl === sourceImageUrl ? next : null;
        setStatus(current);
        setUnavailable(false);
        ongoing = !!current && !['completed', 'failed'].includes(current.phase);
      } catch {
        if (cancelled) return;
        setUnavailable(true);
      }
      if (!cancelled && (active || ongoing)) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [projectId, sourceImageUrl, active]);
  if (!status || status.sourceImageUrl !== sourceImageUrl)
    return unavailable && active ? (
      <p className="reconstruction-progress">暂时无法读取素材进度，正在重连…</p>
    ) : null;
  const completed = status.assets.filter((asset) => asset.status === 'completed').length;
  const elapsed =
    status.startedAt && !['completed', 'failed'].includes(status.phase)
      ? Math.max(0, Math.floor((Date.now() - Date.parse(status.startedAt)) / 1000))
      : undefined;
  const label = {
    analyzing: '正在分析参考图与素材',
    assets: `正在重建素材 · ${completed}/${status.assets.length}`,
    assembling: '正在组装可编辑页面',
    completed: '素材已就绪',
    failed: '还原需要重试',
  }[status.phase];
  return (
    <section className="reconstruction-progress" aria-label="参考图还原进度">
      <strong role="status">{label}</strong>
      {elapsed !== undefined && Number.isFinite(elapsed) && <p>本次还原已运行 {elapsed} 秒</p>}
      {unavailable && <p>暂时无法更新进度，正在重连…</p>}
      {status.assets.length > 0 && (
        <ul>
          {status.assets.map((asset) => (
            <li key={asset.id}>
              {asset.url ? (
                <a href={asset.url} target="_blank" rel="noreferrer">
                  <img src={asset.url} alt={asset.name} loading="lazy" />
                </a>
              ) : (
                <span className="reconstruction-placeholder" aria-hidden="true">
                  ◇
                </span>
              )}
              <span>
                {asset.name}
                <small>
                  {
                    {
                      pending: '等待重建',
                      generating: '重建中',
                      completed: '已保存',
                      failed: '重建失败',
                    }[asset.status]
                  }
                  {asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ''}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {status.error && <p role="alert">{status.error}</p>}
    </section>
  );
}
