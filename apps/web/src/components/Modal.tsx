import type { ReactNode } from 'react';
import { AlertTriangle, FolderGit2, Search } from 'lucide-react';
import { RinAvatar } from './brand/RinBrand';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@forma/ui/dialog';

export default function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const destructive = title.startsWith('删除');
  const symbol = destructive ? <AlertTriangle size={24} /> : title === '连接工作空间' ? <FolderGit2 size={24} /> : title === '搜索工作空间' ? <Search size={23} /> : <RinAvatar size={48} />;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className={`modal ${wide ? 'modal-wide' : ''} ${destructive ? 'modal-destructive' : ''}`}><DialogHeader className="modal-header"><div className="modal-heading"><span className="modal-symbol">{symbol}</span><div><DialogTitle>{title}</DialogTitle><DialogDescription className={subtitle ? '' : 'sr-only'}>{subtitle || title}</DialogDescription></div></div></DialogHeader>{children}</DialogContent></Dialog>;
}
