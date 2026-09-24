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
import './studio-tokens.css';

/** 工作室本身的外观偏好，与被编辑项目的设计主题分开保存。 */
export interface StudioThemeSettings {
  /** 工作室基础配色预设。取值：paper（素白）、glacier（冰川）、midnight（夜航）。 */
  preset: 'paper' | 'glacier' | 'midnight';
  /** 界面强调色，供按钮、选中态和动效使用。 */
  accent: string;
  /** 卡片表面风格。取值：outline（边框卡片）、soft（柔和底色卡片）、glass（半透明卡片）。 */
  cardStyle: 'outline' | 'soft' | 'glass';
  /** 圆角大小。取值：compact（紧凑）、balanced（均衡）、round（大圆角）。 */
  radius: 'compact' | 'balanced' | 'round';
  /** 控件间距与信息密度偏好。取值：comfortable（舒适间距）、compact（紧凑）。 */
  density: 'comfortable' | 'compact';
  /** 品牌视觉出现的强度。取值：subtle（低调品牌呈现）、signature（标准品牌呈现）、immersive（沉浸式品牌呈现）。 */
  personality: 'subtle' | 'signature' | 'immersive';
  /** 动画强度偏好或动效 Token 分组。取值：off（关闭动效）、gentle（轻柔动效）、expressive（明显动效）。 */
  motion: 'off' | 'gentle' | 'expressive';
}

/** 一套命名的工作室配色基础，用于生成全局 CSS 变量。 */
export interface StudioThemePreset {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id: StudioThemeSettings['preset'];
  /** 面向用户展示的名称。 */
  name: string;
  /** 用于解释内容或用途的说明文字。 */
  description: string;
  /** 主题使用的一组语义颜色。 */
  colors: {
    /** 背景颜色或背景类型。 */
    background: string;
    /** 卡片或面板的表面颜色。 */
    surface: string;
    /** 主要前景色，通常用于正文与图标。 */
    foreground: string;
    /** 次要文字或弱化表面使用的颜色。 */
    muted: string;
    /** 边框使用的颜色。 */
    border: string;
    /** 界面强调色，供按钮、选中态和动效使用。 */
    accent: string;
  };
}

export const studioThemePresets: StudioThemePreset[] = [
  {
    id: 'paper',
    name: 'Paper / 素白',
    description: '珍珠白与冰蓝，让灵感轻盈落下。',
    colors: {
      background: '#f6f8fc',
      surface: '#ffffff',
      foreground: '#172134',
      muted: '#eef2f8',
      border: '#e2e8f1',
      accent: '#38bdf8',
    },
  },
  {
    id: 'glacier',
    name: 'Glacier / 冰川',
    description: '清爽的冷灰工作界面。',
    colors: {
      background: '#f5f6f8',
      surface: '#ffffff',
      foreground: '#142739',
      muted: '#eaf3f9',
      border: '#dce8f2',
      accent: '#38bdf8',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight / 夜航',
    description: '柔和的深灰背景，适合暗光环境。',
    colors: {
      background: '#141b27',
      surface: '#1d2736',
      foreground: '#edf3fa',
      muted: '#273344',
      border: '#334156',
      accent: '#38bdf8',
    },
  },
];

export const defaultStudioSettings: StudioThemeSettings = {
  preset: 'paper',
  accent: '#38bdf8',
  cardStyle: 'outline',
  radius: 'balanced',
  density: 'comfortable',
  personality: 'signature',
  motion: 'gentle',
};
export const studioThemeStorageKey = 'forma-studio-theme-v1';

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
    return (
      '#' +
      [...color.slice(1)]
        .map(
          /** 转换 normalizeStudioAccent 中的集合条目，供后续处理或展示。 @param character - 当前文本字符。 @returns 当前条目转换后的结果。 */
          (character) => character.repeat(2),
        )
        .join('')
    );
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
  /**
   * 选择当前目标，更新后续编辑所使用的上下文。
   *
   * @param key - 要访问或更新的字段名。
   * @param options - 本次操作的配置选项。
   * @returns 当前步骤的处理结果。
   */
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

/**
 * 读取本地主题偏好并兼容旧默认值，读取失败时使用默认主题。
 * @returns 启动时采用的主题设置。
 */
function loadSettings() {
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
      /** 检查stored中指定项等于legacyDefault中指定项，供集合筛选或定位使用。 @param key - 要访问或更新的字段名。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (key) => stored[key] === legacyDefault[key],
    );
    return isLegacyDefault ? { ...defaultStudioSettings } : stored;
  } catch {
    return { ...defaultStudioSettings };
  }
}

/**
 * 把十六进制颜色拆成颜色通道，供混色与亮度计算使用。
 *
 * @param hex - 十六进制颜色字符串。
 * @returns 红、绿、蓝通道值。
 */
function rgb(hex: string) {
  return [1, 3, 5].map(
    /** 转换 rgb 中的集合条目，供后续处理或展示。 @param offset - 相对起点的偏移量。 @returns 当前条目转换后的结果。 */
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
}
/**
 * 按比例混合两种颜色，生成同一强调色下的背景与边框层次。
 *
 * @param a - 第一个比较或计算对象。
 * @param b - 第二个比较或计算对象。
 * @param amount - 效果强度或混色比例。
 * @returns 混合后的颜色。
 */
function mix(a: string, b: string, amount: number) {
  const second = rgb(b);
  return (
    '#' +
    rgb(a)
      .map(
        /** 转换 mix 中的集合条目，供后续处理或展示。 @param channel - 文字或图片任务通道。 @param index - 空间查询索引或当前条目的位置。 @returns 当前条目转换后的结果。 */
        (channel, index) =>
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
function luminance(color: string) {
  return rgb(color)
    .map(
      /** 提取channel除以255，供后续计算或展示使用。 @param channel - 文字或图片任务通道。 @returns channel除以255。 */
      (channel) => channel / 255,
    )
    .map(
      /** 转换 luminance 中的集合条目，供后续处理或展示。 @param channel - 文字或图片任务通道。 @returns 当前条目转换后的结果。 */
      (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4),
    )
    .reduce(
      /**
       * 累积 luminance 中的条目结果，供后续计算使用。
       *
       * @param sum - 累加到当前项之前的结果。
       * @param value - 当前字段、模式或控件的取值。
       * @param index - 空间查询索引或当前条目的位置。
       * @returns 纳入当前条目后的累计结果。
       */
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}
/**
 * 比较前景和背景的亮度差，帮助选择可读的文字颜色。
 *
 * @param a - 第一个比较或计算对象。
 * @param b - 第二个比较或计算对象。
 * @returns 两种颜色的对比度。
 */
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort(
    /** 比较right减去左侧坐标，确定条目顺序。 @param left - 比较或计算时的左侧对象。 @param right - 比较或计算时的右侧对象。 @returns 排序用的差值。 */
    (left, right) => right - left,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

/**
 * 从主题预设和用户偏好生成 CSS 变量，统一全局外观。
 *
 * @param settings - 当前生效的设置。
 * @returns 工作室主题的 CSS 变量集合。
 */
export function createStudioTokens(settings: StudioThemeSettings): Record<string, string> {
  const palette = studioThemePresets.find(
    /** 检查 preset 的标识等于 settings 的preset，供集合筛选或定位使用。 @param preset - 工作室基础配色预设。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (preset) => preset.id === settings.preset,
  )!.colors;
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

/** 主题上下文对外提供的设置、派生值和修改入口。 */
interface StudioThemeContextValue {
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
const StudioThemeContext = createContext<StudioThemeContextValue | null>(null);

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
  const commit = useCallback(
    /**
     * 校验并保存工作室主题，同时更新引用与存储，避免多窗口同步时重复写入。
     *
     * @param next - 后续值或中间件入口。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (next: StudioThemeSettings) => {
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
    },
    [],
  );
  const updateSettings = useCallback(
    /** 封装共享主题上下文的交互操作，使函数引用随依赖更新。 @param patch - 仅包含本次要修改字段的局部更新。 @returns 当前步骤的处理结果。 */
    (patch: Partial<StudioThemeSettings>) =>
      commit(sanitizeStudioSettings({ ...settingsRef.current, ...patch }, settingsRef.current)),
    [commit],
  );
  const resetSettings = useCallback(
    /** 封装共享主题上下文的交互操作，使函数引用随依赖更新。 @returns 当前步骤的处理结果。 */
    () => commit({ ...defaultStudioSettings }),
    [commit],
  );

  useEffect(
    /**
     * 在共享主题上下文的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      /**
       * 处理其他浏览器窗口的主题变更，让多窗口偏好保持一致。
       *
       * @param event - 当前事件及其触发位置。
       * @returns 无返回值；更新当前窗口主题。
       */
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
      /** 结束共享主题上下文当前建立的监听或临时操作，避免后续重复执行。 @returns 无返回值；通过副作用完成当前操作。 */
      return () => window.removeEventListener('storage', receive);
    },
    [],
  );

  useLayoutEffect(
    /**
     * 在共享主题上下文的依赖变化后同步外部资源或界面状态。
     * @returns 用于结束当前订阅或恢复现场的清理函数。
     */
    () => {
      const root = document.documentElement;
      const tokens = createStudioTokens(settings);
      const attributes = {
        'data-studio-theme': settings.preset,
        'data-card-style': settings.cardStyle,
        'data-density': settings.density,
        'data-personality': settings.personality,
        'data-motion': settings.motion,
      };
      const previousVariables = Object.keys(tokens).map(
        /** 转换共享主题上下文中的集合条目，供后续处理或展示。 @param key - 要访问或更新的字段名。 @returns 当前条目转换后的结果。 */
        (key) => [key, root.style.getPropertyValue(key)],
      );
      const previousAttributes = Object.keys(attributes).map(
        /** 转换共享主题上下文中的集合条目，供后续处理或展示。 @param key - 要访问或更新的字段名。 @returns 当前条目转换后的结果。 */
        (key) => [key, root.getAttribute(key)],
      );
      const wasDark = root.classList.contains('dark');
      for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
      for (const [name, value] of Object.entries(attributes)) root.setAttribute(name, value);
      root.classList.toggle('dark', settings.preset === 'midnight');
      /**
       * 结束共享主题上下文当前建立的监听或临时操作，避免后续重复执行。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      return () => {
        for (const [name, value] of previousVariables)
          value ? root.style.setProperty(name, value) : root.style.removeProperty(name);
        for (const [name, value] of previousAttributes)
          value === null ? root.removeAttribute(name!) : root.setAttribute(name!, value!);
        root.classList.toggle('dark', wasDark);
      };
    },
    [settings],
  );

  const value = useMemo(
    /** 计算共享主题上下文的派生数据，并在依赖未变化时复用结果。 @returns 当前步骤的处理结果。 */
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
