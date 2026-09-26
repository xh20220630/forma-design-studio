import { useEffect, useRef, useState } from 'react';

// Keep the edit snapshot separate from live data arriving through workspace events.
/**
 * 集中管理编辑草稿、提交与取消，防止不同文档编辑器行为不一致。
 *
 * @param current - 更新前的当前值。
 * @param revision - 当前修订号，每次持久化修改后递增，用于拒绝过期提交。
 * @param onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @returns 编辑会话状态和操作方法。
 */
export function useEditSession<T>(current: T, revision: number, onClose: () => void) {
  /** 界面状态：编辑开始时的原文、修订号和当前草稿。通过状态更新驱动界面刷新。 */
  const [session, setSession] = useState<{
    /** 编辑或计算之前的原始数据。 */
    original: T;
    /** 尚未提交的编辑内容或待组装的设计草稿。 */
    draft: T;
    /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
    revision: number;
  }>();
  /** 界面状态：是否正在保存，防止重复提交。通过状态更新驱动界面刷新。 */
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  /** 界面状态：当前操作的失败信息，供界面反馈或重试判断。通过状态更新驱动界面刷新。 */
  const [error, setError] = useState('');
  /** 界面状态：最近一次成功保存的值或状态。通过状态更新驱动界面刷新。 */
  const [saved, setSaved] = useState(false);
  const dirty = !!session && JSON.stringify(session.original) !== JSON.stringify(session.draft);
  const changed = !!session && JSON.stringify(session.original) !== JSON.stringify(current);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  const cancel = () => {
    if (savingRef.current || (dirty && !window.confirm('放弃尚未保存的修改？'))) return false;
    setSession(undefined);
    setError('');
    return true;
  };
  return {
    session,
    saving,
    error,
    saved,
    dirty,
    changed,
    start() {
      setSession({ original: current, draft: current, revision });
      setError('');
      setSaved(false);
    },
    change(draft: T) {
      setSession((value) => (value ? { ...value, draft } : value));
    },
    cancel,
    close() {
      if (cancel()) onClose();
    },
    async save(action: () => Promise<void>) {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      setError('');
      try {
        await action();
        setSession(undefined);
        setSaved(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '保存失败，请重试。');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
  };
}
