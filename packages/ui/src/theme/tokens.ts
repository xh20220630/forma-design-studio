import type { StudioThemeSettings } from './types.ts';
import { studioThemePresets } from './presets.ts';

/**
 * 把十六进制颜色拆成颜色通道，供混色与亮度计算使用。
 *
 * @param hex - 十六进制颜色字符串。
 * @returns 红、绿、蓝通道值。
 */
export function rgb(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

/**
 * 按比例混合两种颜色，生成同一强调色下的背景与边框层次。
 *
 * @param a - 第一个比较或计算对象。
 * @param b - 第二个比较或计算对象。
 * @param amount - 效果强度或混色比例。
 * @returns 混合后的颜色。
 */
export function mix(a: string, b: string, amount: number) {
  const second = rgb(b);
  return (
    '#' +
    rgb(a)
      .map((channel, index) =>
        Math.round(channel * (1 - amount) + second[index] * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/**
 * 计算颜色的相对亮度，供前景文字对比度选择使用。
 *
 * @param color - 文字或视觉元素的颜色。
 * @returns 相对亮度值。
 */
export function luminance(color: string) {
  return rgb(color)
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

/**
 * 比较前景和背景的亮度差，帮助选择可读的文字颜色。
 *
 * @param a - 第一个比较或计算对象。
 * @param b - 第二个比较或计算对象。
 * @returns 两种颜色的对比度。
 */
export function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

/**
 * 从主题预设和用户偏好生成 CSS 变量，统一全局外观。
 *
 * @param settings - 当前生效的设置。
 * @returns 工作室主题的 CSS 变量集合。
 */
export function createStudioTokens(settings: StudioThemeSettings): Record<string, string> {
  const palette = studioThemePresets.find((preset) => preset.id === settings.preset)!.colors;
  const dark = settings.preset === 'midnight';
  const accentSoft = mix(palette.surface, settings.accent, dark ? 0.18 : 0.1);
  let accentInk = settings.accent;
  for (let step = 0; step <= 20 && contrast(accentInk, accentSoft) < 4.5; step++)
    accentInk = mix(settings.accent, dark ? '#ffffff' : '#101820', step / 20);
  let focusRing = settings.accent;
  for (let step = 0; step <= 20 && contrast(focusRing, palette.background) < 3; step++)
    focusRing = mix(settings.accent, dark ? '#ffffff' : '#101820', step / 20);
  const cardRadius = { compact: 6, balanced: 14, round: 22 }[settings.radius];
  const controlRadius = { compact: 4, balanced: 8, round: 12 }[settings.radius];
  const cardBg =
    settings.cardStyle === 'glass'
      ? `rgba(${rgb(palette.surface).join(', ')}, ${dark ? 0.74 : 0.78})`
      : palette.surface;
  const shadow =
    settings.cardStyle === 'outline'
      ? 'none'
      : dark
        ? '0 2px 4px #00000014, 0 12px 32px -20px #00000080'
        : '0 2px 4px #17233604, 0 12px 30px -20px #17233624';
  const hoverShadow =
    settings.cardStyle === 'outline'
      ? '0 4px 18px #0000000a'
      : dark
        ? '0 8px 28px -12px #000000a0'
        : '0 9px 28px -14px #17233632';
  const tokens: Record<string, string> = {
    '--studio-surface': palette.background,
    '--studio-surface-raised': palette.surface,
    '--studio-surface-muted': palette.muted,
    '--studio-text': palette.foreground,
    '--studio-text-secondary': dark ? '#c0ccdd' : '#5c6d85',
    '--studio-text-muted': dark ? '#a0b0c6' : '#718097',
    '--studio-border': palette.border,
    '--studio-border-strong': dark ? '#506078' : '#c5d1e1',
    '--studio-accent': settings.accent,
    '--studio-accent-soft': accentSoft,
    '--studio-accent-ink': accentInk,
    '--studio-focus-ring': focusRing,
    '--studio-accent-contrast':
      contrast(settings.accent, '#101820') >= contrast(settings.accent, '#ffffff')
        ? '#101820'
        : '#ffffff',
    '--studio-card-radius': `${cardRadius}px`,
    '--studio-card-shadow': shadow,
    '--studio-card-hover-shadow': hoverShadow,
    '--studio-card-bg': cardBg,
    '--studio-card-blur': settings.cardStyle === 'glass' ? '18px' : '0px',
    '--studio-card-border':
      settings.cardStyle === 'outline' ? palette.border : dark ? '#ffffff0d' : '#1723360b',
    '--studio-control-radius': `${controlRadius}px`,
    '--studio-sidebar-bg': dark ? '#25282c' : '#edf0f2',
    '--studio-sidebar-text': dark ? '#e5e8ec' : '#343b45',
    '--studio-sidebar-secondary': dark ? '#b6bdc6' : '#5b6673',
    '--studio-sidebar-muted': dark ? '#adb6c1' : '#5b6673',
    '--studio-sidebar-border': dark ? '#383e46' : '#d6dce2',
    '--studio-sidebar-border-strong': dark ? '#515b66' : '#bac4cf',
    '--studio-sidebar-raised': dark ? '#30353c' : '#e5e9ed',
    '--studio-sidebar-hover': dark ? '#353c45' : '#e2e7ec',
    '--studio-sidebar-active-bg': dark ? '#3b4653' : '#dde5ed',
    '--studio-sidebar-active-ink': dark ? '#e0e8f1' : '#31445b',
    '--studio-sidebar-active-mark': dark ? '#a1b3c8' : '#73889e',
    '--studio-canvas-bg': dark ? '#101620' : settings.preset === 'glacier' ? '#e7eff5' : '#edf0f6',
    '--studio-ip-opacity': { subtle: '0.4', signature: '0.76', immersive: '1' }[
      settings.personality
    ],
    '--studio-ip-scale': { subtle: '0.76', signature: '0.9', immersive: '1' }[settings.personality],
    '--studio-ip-glow': settings.personality === 'subtle' ? 'transparent' : accentSoft,
    '--studio-card-padding': settings.density === 'compact' ? '14px' : '20px',
    '--studio-row-height': settings.density === 'compact' ? '34px' : '42px',
    '--studio-control-height': settings.density === 'compact' ? '32px' : '38px',
    '--studio-space-sm': settings.density === 'compact' ? '6px' : '8px',
    '--studio-space-md': settings.density === 'compact' ? '12px' : '16px',
    '--studio-space-lg': settings.density === 'compact' ? '18px' : '24px',
    '--studio-motion-duration': {
      off: '0ms',
      gentle: '180ms',
      expressive: '320ms',
    }[settings.motion],
    '--studio-motion-distance': {
      off: '0px',
      gentle: '4px',
      expressive: '10px',
    }[settings.motion],
    '--studio-motion-ease': 'cubic-bezier(.22,1,.36,1)',
    '--background': palette.background,
    '--foreground': palette.foreground,
    '--card': cardBg,
    '--card-foreground': palette.foreground,
    '--popover': palette.surface,
    '--popover-foreground': palette.foreground,
    '--primary': settings.accent === '#38bdf8' ? (dark ? '#79ceff' : '#0875e1') : accentInk,
    '--primary-foreground': dark ? '#142739' : '#ffffff',
    '--secondary': palette.muted,
    '--secondary-foreground': palette.foreground,
    '--muted': palette.muted,
    '--muted-foreground': dark ? '#a0b0c6' : '#718097',
    '--accent': accentSoft,
    '--accent-foreground': accentInk,
    '--destructive': dark ? '#fb7185' : '#dc2626',
    '--border': palette.border,
    '--input': palette.border,
    '--ring': focusRing,
    '--radius': `${controlRadius}px`,
    '--sky': settings.accent,
    '--sky-soft': accentSoft,
    '--sky-ink': accentInk,
  };
  return tokens;
}
