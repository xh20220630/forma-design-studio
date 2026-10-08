import { useState } from 'react';
import { Check, Image, Layers3, RefreshCw } from 'lucide-react';
import type { Project } from '@forma/schema';
import { Button } from '@forma/ui/button';
import { ReferenceImagePreview } from '../../reconstruction/components/ReferenceImagePreview';
import '../styles/page-design-queue.css';

interface PageDesignQueueProps {
  project: Project;
  busy: boolean;
  canGenerate: boolean;
  canReconstruct: boolean;
  onGenerate: (pageId: string) => void;
  onApprove: () => void;
  onReconstruct: () => void;
}

export function PageDesignQueue({
  project,
  busy,
  canGenerate,
  canReconstruct,
  onGenerate,
  onApprove,
  onReconstruct,
}: PageDesignQueueProps) {
  const [preview, setPreview] = useState<{ url: string; title: string }>();
  const plan = project.generationPlan;
  if (!plan || plan.pages.length < 2) return null;
  const next = plan.pages.find((page) => !page.reconstructedImageUrl);
  const completed = plan.pages.filter((page) => page.reconstructedImageUrl).length;
  return (
    <section className="page-design-queue" aria-label="逐页设计队列">
      <header>
        <Layers3 size={16} />
        <strong>逐页设计</strong>
        <span>
          {completed} / {plan.pages.length} 已还原
        </span>
      </header>
      <p>每页单独生成、确认和还原，沿用同一套视觉规范。</p>
      <ol>
        {plan.pages.map((page, index) => {
          const active = page.id === next?.id;
          const generation =
            page.id === project.generation?.pageId ? project.generation : page.generation;
          const done = !!page.reconstructedImageUrl;
          const status = done
            ? '已还原'
            : generation?.imageUrl
              ? generation.approved
                ? '待还原'
                : '待确认'
              : '待生成';
          return (
            <li
              key={page.id}
              className={`${active ? 'is-current' : ''} ${done ? 'is-complete' : ''}`}
            >
              {generation?.imageUrl ? (
                <button
                  className="pdq-thumbnail"
                  aria-label={`查看${page.name}独立设计图`}
                  onClick={() => setPreview({ url: generation.imageUrl!, title: page.name })}
                >
                  <img src={generation.imageUrl} alt={page.name} />
                </button>
              ) : (
                <span className="pdq-number">{index + 1}</span>
              )}
              <div className="pdq-page">
                <strong>{page.name}</strong>
                <small>
                  {page.width} × {page.height} · {status}
                </small>
                {active && (
                  <div className="pdq-actions">
                    {generation?.imageUrl ? (
                      <>
                        <Button
                          size="sm"
                          disabled={busy || (!!generation.approved && !canReconstruct)}
                          onClick={generation.approved ? onReconstruct : onApprove}
                        >
                          {generation.approved ? <Layers3 size={12} /> : <Check size={12} />}
                          {generation.approved ? '还原此页' : '确认此页'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || !canGenerate}
                          onClick={() => onGenerate(page.id)}
                          aria-label={`重新生成${page.name}`}
                        >
                          <RefreshCw size={12} />
                          重新生成
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy || !canGenerate}
                        onClick={() => onGenerate(page.id)}
                      >
                        <Image size={12} />
                        生成此页
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {done && <Check className="pdq-done" size={15} aria-label="已还原" />}
            </li>
          );
        })}
      </ol>
      {!next && (
        <div className="pdq-finished">
          <Check size={14} />
          全部页面已分别还原到画布
        </div>
      )}
      <ReferenceImagePreview image={preview} onClose={() => setPreview(undefined)} />
    </section>
  );
}
