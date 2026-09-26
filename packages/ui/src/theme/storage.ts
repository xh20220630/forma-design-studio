import type { StudioThemeSettings } from './types.ts';
import { defaultStudioSettings } from './presets.ts';
import { parseStoredStudioSettings } from './settings.ts';

export const studioThemeStorageKey = 'forma-studio-theme-v1';

/**
 * 读取本地主题偏好并兼容旧默认值，读取失败时使用默认主题。
 * @returns 启动时采用的主题设置。
 */
export function loadSettings() {
  try {
    const stored = parseStoredStudioSettings(window.localStorage.getItem(studioThemeStorageKey));
    const legacyDefault: StudioThemeSettings = {
      preset: 'glacier',
      accent: '#38bdf8',
      cardStyle: 'soft',
      radius: 'balanced',
      density: 'comfortable',
      personality: 'immersive',
      motion: 'expressive',
    };
    const isLegacyDefault = (Object.keys(legacyDefault) as (keyof StudioThemeSettings)[]).every(
      (key) => stored[key] === legacyDefault[key],
    );
    return isLegacyDefault ? { ...defaultStudioSettings } : stored;
  } catch {
    return { ...defaultStudioSettings };
  }
}
