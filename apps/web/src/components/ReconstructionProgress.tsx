import { useEffect, useState } from 'react';
import type { ReconstructionStatus } from '@forma/schema';
import { api } from '../lib/api';
import './reconstruction.css';

/**
 * 呈现素材还原进度，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.projectId - 动作、会话或记录所属项目的标识。
 * @param props.sourceImageUrl - 本次还原对应的参考图地址。
 * @param props.active - 是否处于激活状态。
 * @returns 供 React 渲染的界面内容。
 */
export function ReconstructionProgress({
  projectId,
  sourceImageUrl,
  active = false,
}: {
  /** 动作、会话或记录所属项目的标识。 */
  projectId: string;
  /** 本次还原对应的参考图地址。 */
  sourceImageUrl: string;
  /** 是否处于激活状态。 */
  active?: boolean;
}) {
  /** 界面状态：对象当前所处状态，决定后续可执行操作。通过状态更新驱动界面刷新。 */
  const [status, setStatus] = useState<ReconstructionStatus | null>(null);
  /** 界面状态：当前选择是否已不可用。通过状态更新驱动界面刷新。 */
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
