import type { ReactNode } from 'react';
import { AlertTriangle, FolderGit2, Search } from 'lucide-react';
import { RinAvatar } from './brand/RinBrand';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@forma/ui/dialog';

/**
 * 呈现通用弹层，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.title - 界面显示的标题。
 * @param props.subtitle - 标题下方的辅助说明。
 * @param props.children - 由调用方放入组件的子内容。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.wide - 是否使用较宽的展示布局。
 * @returns 供 React 渲染的界面内容。
 */
export default function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  /** 界面显示的标题。 */
  title: string;
  /** 标题下方的辅助说明。 */
  subtitle?: string;
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /** 是否使用较宽的展示布局。 */
  wide?: boolean;
}) {
  const destructive = title.startsWith('删除');
  const symbol = destructive ? (
    <AlertTriangle size={24} />
  ) : title === '连接工作空间' ? (
    <FolderGit2 size={24} />
  ) : title === '搜索工作空间' ? (
    <Search size={23} />
  ) : (
    <RinAvatar size={48} />
  );
  return (
    <Dialog
      open
      onOpenChange={
        /**
         * 响应 onOpenChange 交互，将用户操作应用到通用弹层。
         *
         * @param open - 弹层或面板当前是否打开。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (open) => {
          if (!open) onClose();
        }
      }
    >
      <DialogContent
        className={`modal ${wide ? 'modal-wide' : ''} ${destructive ? 'modal-destructive' : ''}`}
      >
        <DialogHeader className="modal-header">
          <div className="modal-heading">
            <span className="modal-symbol">{symbol}</span>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className={subtitle ? '' : 'sr-only'}>
                {subtitle || title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
