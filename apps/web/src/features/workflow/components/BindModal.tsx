import { useState } from 'react';
import { FolderOpen, Github, Link2, LoaderCircle } from 'lucide-react';
import type { Project } from '@forma/schema';
import Modal from '../../../shared/ui/Modal';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';

/**
 * 呈现工作空间绑定对话框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onBind - 在绑定时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function BindModal({
  project,
  onClose,
  onBind,
}: {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在绑定时通知调用方，由外层决定如何更新业务状态。
   * @param body - 请求正文或文档内容。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  onBind: (body: {
    /** 用于决定展示或处理分支的类别。取值：local（本地目录）、github（GitHub 仓库）。 */
    kind: 'local' | 'github';
    /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
    path?: string;
    /** 关联的 GitHub 仓库地址。 */
    repo?: string;
    /** 使用的 Git 分支名称。 */
    branch?: string;
  }) => Promise<void>;
}) {
  /** 界面状态：用于决定展示或处理分支的类别。通过状态更新驱动界面刷新。 */
  const [kind, setKind] = useState<'local' | 'github'>(project.workspace?.kind ?? 'local');
  /** 界面状态：文件路径或矢量路径内容，具体格式由所属对象约定。通过状态更新驱动界面刷新。 */
  const [path, setPath] = useState(project.workspace?.path ?? '');
  /** 界面状态：关联的 GitHub 仓库地址。通过状态更新驱动界面刷新。 */
  const [repo, setRepo] = useState(project.workspace?.repo ?? '');
  /** 界面状态：使用的 Git 分支名称。通过状态更新驱动界面刷新。 */
  const [branch, setBranch] = useState(project.workspace?.branch ?? '');
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState(false);
  /** 界面状态：当前操作的失败信息，供界面反馈或重试判断。通过状态更新驱动界面刷新。 */
  const [error, setError] = useState('');
  return (
    <Modal
      title="连接工作空间"
      subtitle={`为「${project.name}」绑定本地项目或 GitHub 仓库。`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onBind({
              kind,
              ...(kind === 'local'
                ? { path }
                : {
                    repo,
                    ...(branch.trim() ? { branch: branch.trim() } : {}),
                  }),
            });
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <div className="form-body">
          <div className="binding-kind">
            <Button
              type="button"
              variant="outline"
              className={kind === 'local' ? 'active' : ''}
              onClick={() => setKind('local')}
            >
              <FolderOpen />
              <strong>本地文件夹</strong>
              <span>连接已有 Web 项目</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={kind === 'github' ? 'active' : ''}
              onClick={() => setKind('github')}
            >
              <Github />
              <strong>GitHub 仓库</strong>
              <span>克隆到本地工作空间</span>
            </Button>
          </div>
          {kind === 'local' ? (
            <label className="field-label">
              文件夹绝对路径
              <Input
                required
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="D:\\projects\\my-web-app"
              />
              <small>目录需已存在；设计代码写入 forma-generated 文件夹。</small>
            </label>
          ) : (
            <>
              <label className="field-label">
                GitHub 仓库地址
                <Input
                  required
                  type="url"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="https://github.com/username/repository"
                />
              </label>
              <label className="field-label">
                分支<span>留空使用默认分支</span>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                />
              </label>
              <p className="form-hint">私有仓库使用系统 Git 凭据。同步后可自行审阅、提交与推送。</p>
            </>
          )}
          {error && <p className="inline-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" className="blue-button" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : <Link2 />}
            {busy ? '正在连接…' : '连接工作空间'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
