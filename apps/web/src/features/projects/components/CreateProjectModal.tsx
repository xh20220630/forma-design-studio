import { useState } from 'react';
import { Check, Frame, LoaderCircle, Plus } from 'lucide-react';
import type { DesignTemplate } from '@forma/schema';
import Modal from '../../../shared/ui/Modal';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';

/**
 * 呈现新建项目对话框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.templates - 可供选择的设计模板集合。
 * @param props.template - 用于创建项目的模板定义。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onCreate - 在创建时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function CreateProjectModal({
  templates,
  template,
  onClose,
  onCreate,
}: {
  /** 可供选择的设计模板集合。 */
  templates: DesignTemplate[];
  /** 用于创建项目的模板定义。 */
  template?: DesignTemplate;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在创建时通知调用方，由外层决定如何更新业务状态。
   * @param name - 面向用户展示的名称。
   * @param description - 用于解释内容或用途的说明文字。
   * @param template - 用于创建项目的模板定义。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  onCreate: (name: string, description: string, template?: DesignTemplate) => Promise<void>;
}) {
  /** 界面状态：面向用户展示的名称。通过状态更新驱动界面刷新。 */
  const [name, setName] = useState('');
  /** 界面状态：用于解释内容或用途的说明文字。通过状态更新驱动界面刷新。 */
  const [description, setDescription] = useState('');
  /** 界面状态：项目采用的主题标识。通过状态更新驱动界面刷新。 */
  const [themeId, setThemeId] = useState(template?.id ?? 'blank');
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState(false);
  /** 界面状态：当前操作的失败信息，供界面反馈或重试判断。通过状态更新驱动界面刷新。 */
  const [error, setError] = useState('');
  return (
    <Modal title="新建项目" subtitle="为你的下一个想法，建立一个创作空间。" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onCreate(
              name.trim(),
              description.trim(),
              templates.find((t) => t.id === themeId),
            );
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
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
              placeholder="例如：客户管理平台"
            />
          </label>
          <label className="field-label">
            描述<span>可选</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这个产品要解决什么问题？"
              rows={2}
            />
          </label>
          <div className="field-label">起始模板</div>
          <div className="theme-options">
            <Button
              type="button"
              variant="outline"
              className={`theme-option ${themeId === 'blank' ? 'selected' : ''}`}
              onClick={() => setThemeId('blank')}
            >
              <Frame />
              <span>空白项目</span>
              {themeId === 'blank' && <Check size={14} />}
            </Button>
            {templates.map((t) => (
              <Button
                type="button"
                variant="outline"
                className={`theme-option ${themeId === t.id ? 'selected' : ''}`}
                key={t.id}
                onClick={() => setThemeId(t.id)}
              >
                <span className="theme-option-colors">
                  {[t.tokens.primary, t.tokens.background, t.tokens.text].map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
                </span>
                <span>{t.name.split(' / ')[0]}</span>
                {themeId === t.id && <Check size={14} />}
              </Button>
            ))}
          </div>
          {error && <p className="inline-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button variant="outline" type="button" onClick={onClose}>
            取消
          </Button>
          <Button className="blue-button" disabled={busy || !name.trim()} type="submit">
            {busy ? <LoaderCircle className="spin" /> : <Plus />}创建项目
          </Button>
        </div>
      </form>
    </Modal>
  );
}
