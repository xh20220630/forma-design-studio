import { useState } from 'react';
import { Button } from '@forma/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@forma/ui/dialog';
import './reconstruction.css';

/**
 * 呈现参考图查看器，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.image - 图片数据、图片模型绑定或页面图片节点。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function ReferenceImagePreview({
  image,
  onClose,
}: {
  /** 图片数据、图片模型绑定或页面图片节点。 */
  image?: {
    /** 资源或服务的访问地址。 */
    url: string;
    /** 界面显示的标题。 */
    title: string;
  };
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!image}
      onOpenChange={
        /**
         * 响应 onOpenChange 交互，将用户操作应用到参考图查看器。
         *
         * @param open - 弹层或面板当前是否打开。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (open) => {
          if (!open) onClose();
        }
      }
    >
      <DialogContent className="reference-image-dialog">
        <DialogHeader>
          <DialogTitle>{image?.title ?? '参考图'}</DialogTitle>
          <DialogDescription>完整显示原图，按宽度查看可滚动检查细节。</DialogDescription>
        </DialogHeader>
        {image && <ImageView key={image.url} image={image} />}
      </DialogContent>
    </Dialog>
  );
}
/**
 * 呈现图片查看区域，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.image - 图片数据、图片模型绑定或页面图片节点。
 * @returns 供 React 渲染的界面内容。
 */
function ImageView({
  image,
}: {
  /** 图片数据、图片模型绑定或页面图片节点。 */
  image: {
    /** 资源或服务的访问地址。 */
    url: string;
    /** 界面显示的标题。 */
    title: string;
  };
}) {
  /** 界面状态：图片或画布当前采用的适配方式。通过状态更新驱动界面刷新。 */
  const [fit, setFit] = useState(true);
  return (
    <>
      <div className="reference-image-tools">
        <Button
          variant="outline"
          size="sm"
          onClick={
            /** 响应 onClick 交互，将用户操作应用到图片查看区域。 @returns 当前步骤的处理结果。 */
            () => setFit(!fit)
          }
        >
          {fit ? '按宽度查看' : '显示全图'}
        </Button>
        <a href={image.url} target="_blank" rel="noreferrer">
          打开原图 ↗
        </a>
      </div>
      <div className={`reference-image-viewport ${fit ? 'fit' : 'width'}`}>
        <img src={image.url} alt={image.title} />
      </div>
    </>
  );
}
