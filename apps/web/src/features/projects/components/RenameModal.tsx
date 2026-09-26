import { useState } from 'react';
import type { Project } from '@forma/schema';
import Modal from '../../../shared/ui/Modal';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';

/**
 * 呈现项目重命名对话框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onSave - 在保存时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function RenameModal({
  project,
  onClose,
  onSave,
}: {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在保存时通知调用方，由外层决定如何更新业务状态。
   * @param name - 面向用户展示的名称。
   * @param description - 用于解释内容或用途的说明文字。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSave: (name: string, description: string) => void;
}) {
  /** 界面状态：面向用户展示的名称。通过状态更新驱动界面刷新。 */
  const [name, setName] = useState(project.name);
  /** 界面状态：用于解释内容或用途的说明文字。通过状态更新驱动界面刷新。 */
  const [description, setDescription] = useState(project.description);
  return (
    <Modal title="文件设置" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim(), description.trim());
        }}
      >
        <div className="form-body">
          <label className="field-label">
            项目名称
            <Input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field-label">
            描述
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button className="blue-button" type="submit">
            保存修改
          </Button>
        </div>
      </form>
    </Modal>
  );
}
