import type { ReactNode } from 'react';
import { Copy, Download, FolderGit2, FolderOpen, Settings2, Star, Trash2 } from 'lucide-react';
import type { Project } from '@forma/schema';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@forma/ui/context-menu';

interface Props {
  project: Project;
  favorite: boolean;
  busy: boolean;
  children: ReactNode;
  onOpen: () => void;
  onFavorite: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onBind: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export default function ProjectContextMenu({
  project,
  favorite,
  busy,
  children,
  onOpen,
  onFavorite,
  onRename,
  onDuplicate,
  onBind,
  onExport,
  onDelete,
}: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56" aria-label={`${project.name} 项目操作`}>
        <ContextMenuLabel className="truncate" title={project.name}>
          {project.name}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onOpen}>
          <FolderOpen />
          打开项目
        </ContextMenuItem>
        <ContextMenuItem onSelect={onFavorite}>
          <Star fill={favorite ? 'currentColor' : 'none'} />
          {favorite ? '取消收藏' : '添加到收藏'}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onRename} disabled={busy}>
          <Settings2 />
          项目设置
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate}>
          <Copy />
          创建副本
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onBind} disabled={busy}>
          <FolderGit2 />
          连接工作空间
        </ContextMenuItem>
        <ContextMenuItem onSelect={onExport}>
          <Download />
          导出项目
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDelete} variant="destructive" disabled={busy}>
          <Trash2 />
          删除项目
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
