import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { StudioThemeSettings, StudioThemePreset } from './types.ts';
import { studioThemePresets, defaultStudioSettings } from './presets.ts';
import { sanitizeStudioSettings, parseStoredStudioSettings } from './settings.ts';
import { studioThemeStorageKey, loadSettings } from './storage.ts';
import { createStudioTokens } from './tokens.ts';
import './studio-tokens.css';

/** 主题上下文对外提供的设置、派生值和修改入口。 */
export interface StudioThemeContextValue {
  /** 当前生效的设置。 */
  settings: StudioThemeSettings;
  /** 可供选择的主题预设集合。 */
  presets: StudioThemePreset[];
  /**
   * 合并并保存主题偏好的入口。
   * @param patch - 仅包含本次要修改字段的局部更新。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  updateSettings: (patch: Partial<StudioThemeSettings>) => void;
  /**
   * 恢复默认工作室主题的入口。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  resetSettings: () => void;
}

export const StudioThemeContext = createContext<StudioThemeContextValue | null>(null);

/**
 * 呈现共享主题上下文，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.children - 由调用方放入组件的子内容。
 * @returns 供 React 渲染的界面内容。
 */
export function StudioThemeProvider({
  children,
}: {
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
}) {
  /** 界面状态：当前生效的设置。通过状态更新驱动界面刷新。 */
  const [settings, setSettings] = useState<StudioThemeSettings>(loadSettings);
  const settingsRef = useRef(settings);
  const commit = useCallback((next: StudioThemeSettings) => {
    settingsRef.current = next;
    setSettings(next);
    try {
      window.localStorage.setItem(
        studioThemeStorageKey,
        JSON.stringify({ version: 1, settings: next }),
      );
    } catch {
      /* The theme remains usable when browser persistence is unavailable. */
    }
  }, []);
  const updateSettings = useCallback(
    (patch: Partial<StudioThemeSettings>) =>
      commit(sanitizeStudioSettings({ ...settingsRef.current, ...patch }, settingsRef.current)),
    [commit],
  );
  const resetSettings = useCallback(() => commit({ ...defaultStudioSettings }), [commit]);

  useEffect(() => {
    // 接收其他窗口的主题变更时只更新本地状态，避免再次写入存储。
    const receive = (event: StorageEvent) => {
      if (event.key !== studioThemeStorageKey && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      const next = parseStoredStudioSettings(event.key === null ? null : event.newValue);
      settingsRef.current = next;
      setSettings(next);
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const tokens = createStudioTokens(settings);
    const attributes = {
      'data-studio-theme': settings.preset,
      'data-card-style': settings.cardStyle,
      'data-density': settings.density,
      'data-personality': settings.personality,
      'data-motion': settings.motion,
    };
    const previousVariables = Object.keys(tokens).map((key) => [
      key,
      root.style.getPropertyValue(key),
    ]);
    const previousAttributes = Object.keys(attributes).map((key) => [key, root.getAttribute(key)]);
    const wasDark = root.classList.contains('dark');
    for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
    for (const [name, value] of Object.entries(attributes)) root.setAttribute(name, value);
    root.classList.toggle('dark', settings.preset === 'midnight');
    return () => {
      for (const [name, value] of previousVariables)
        value ? root.style.setProperty(name, value) : root.style.removeProperty(name);
      for (const [name, value] of previousAttributes)
        value === null ? root.removeAttribute(name!) : root.setAttribute(name!, value!);
      root.classList.toggle('dark', wasDark);
    };
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,
      presets: studioThemePresets,
      updateSettings,
      resetSettings,
    }),
    [settings, updateSettings, resetSettings],
  );
  return <StudioThemeContext.Provider value={value}>{children}</StudioThemeContext.Provider>;
}

/**
 * 读取共享主题上下文，避免组件各自维护不一致的偏好状态。
 * @returns 主题设置及更新入口。
 */
export function useStudioTheme() {
  const context = useContext(StudioThemeContext);
  if (!context) throw new Error('useStudioTheme must be used inside StudioThemeProvider');
  return context;
}
