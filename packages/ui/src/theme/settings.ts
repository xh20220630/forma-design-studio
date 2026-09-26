import type { StudioThemeSettings } from './types.ts';
import { defaultStudioSettings } from './presets.ts';

/**
 * 把三位或六位十六进制颜色统一为六位，拒绝无法计算对比度的输入。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @returns 规范化颜色；无效时返回 undefined。
 */
export function normalizeStudioAccent(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  const color = value.trim().toLowerCase();
  if (/^#[\da-f]{6}$/.test(color)) return color;
  if (/^#[\da-f]{3}$/.test(color))
    return '#' + [...color.slice(1)].map((character) => character.repeat(2)).join('');
}

/**
 * 逐项校验主题偏好，缺失或无效字段回退到默认设置。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param fallback - 输入缺失或无效时采用的回退值。
 * @returns 完整且可用的工作室主题设置。
 */
export function sanitizeStudioSettings(
  value: unknown,
  fallback: StudioThemeSettings = defaultStudioSettings,
): StudioThemeSettings {
  const input =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const select = <K extends keyof StudioThemeSettings>(
    key: K,
    options: readonly StudioThemeSettings[K][],
  ) =>
    options.includes(input[key] as StudioThemeSettings[K])
      ? (input[key] as StudioThemeSettings[K])
      : fallback[key];
  return {
    preset: select('preset', ['paper', 'glacier', 'midnight']),
    accent: normalizeStudioAccent(input.accent) ?? fallback.accent,
    cardStyle: select('cardStyle', ['outline', 'soft', 'glass']),
    radius: select('radius', ['compact', 'balanced', 'round']),
    density: select('density', ['comfortable', 'compact']),
    personality: select('personality', ['subtle', 'signature', 'immersive']),
    motion: select('motion', ['off', 'gentle', 'expressive']),
  };
}

/**
 * 兼容带版本的本地设置并处理损坏内容，避免主题配置导致页面无法启动。
 *
 * @param serialized - 从本地存储读取的 JSON 文本。
 * @returns 已校验的主题设置。
 */
export function parseStoredStudioSettings(serialized: string | null): StudioThemeSettings {
  if (!serialized || serialized.length > 4096) return { ...defaultStudioSettings };
  try {
    const decoded: unknown = JSON.parse(serialized);
    if (decoded && typeof decoded === 'object' && 'version' in decoded) {
      return decoded.version === 1 && 'settings' in decoded
        ? sanitizeStudioSettings(decoded.settings)
        : { ...defaultStudioSettings };
    }
    return sanitizeStudioSettings(decoded);
  } catch {
    return { ...defaultStudioSettings };
  }
}
