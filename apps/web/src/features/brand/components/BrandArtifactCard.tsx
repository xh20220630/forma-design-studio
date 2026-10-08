import { useState } from 'react';
import type { BrandArtifact } from '@forma/schema';
import { Button } from '@forma/ui/button';
import BrandSymbol from '../../../entities/project/ui/BrandSymbol';
import { downloadBrandPackage, downloadBrandPng, downloadBrandSvg } from '../model/download';

export default function BrandArtifactCard({
  artifact,
  projectId,
  onPreview,
}: {
  artifact: BrandArtifact;
  projectId: string;
  onPreview: () => void;
}) {
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const download = async (operation: () => Promise<void> | void) => {
    setError('');
    setDownloading(true);
    try {
      await operation();
    } catch (error) {
      setError(error instanceof Error ? error.message : '下载失败，请重试。');
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="brand-chat-artifact">
      {artifact.vector ? (
        <div className="brand-chat-vector" aria-label="品牌矢量稿">
          <BrandSymbol vector={artifact.vector} size={280} label={artifact.name} />
        </div>
      ) : (
        <button
          className="brand-chat-image"
          onClick={onPreview}
          aria-label={`查看${artifact.name}`}
        >
          <img src={artifact.imageUrl} alt={artifact.name} />
        </button>
      )}
      <div className="brand-chat-downloads">
        {artifact.vector ? (
          <>
            <Button
              variant="outline"
              disabled={downloading}
              onClick={() => void download(() => downloadBrandSvg(artifact.vector!, artifact.name))}
            >
              下载 SVG
            </Button>
            <Button
              variant="outline"
              disabled={downloading}
              onClick={() => void download(() => downloadBrandPng(artifact.vector!, artifact.name))}
            >
              下载 PNG
            </Button>
            <Button
              variant="ghost"
              disabled={downloading}
              onClick={() => void download(() => downloadBrandPackage(projectId, artifact.id))}
            >
              下载源文件包
            </Button>
            <button className="brand-chat-source" onClick={onPreview}>
              查看原图
            </button>
          </>
        ) : (
          <a
            href={artifact.imageUrl}
            download={`${artifact.name}.${artifact.imageUrl.split('.').at(-1)}`}
          >
            下载图片
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="ac-action-error">
          {error}
        </p>
      )}
    </div>
  );
}
