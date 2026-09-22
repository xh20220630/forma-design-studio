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
} from "react";
import "./studio-tokens.css";

export interface StudioThemeSettings {
  preset: "paper" | "glacier" | "midnight";
  accent: string;
  cardStyle: "outline" | "soft" | "glass";
  radius: "compact" | "balanced" | "round";
  density: "comfortable" | "compact";
  personality: "subtle" | "signature" | "immersive";
  motion: "off" | "gentle" | "expressive";
}

export interface StudioThemePreset {
  id: StudioThemeSettings["preset"];
  name: string;
  description: string;
  colors: {
    background: string;
    surface: string;
    foreground: string;
    muted: string;
    border: string;
    accent: string;
  };
}

export const studioThemePresets: StudioThemePreset[] = [
  {
    id: "paper",
    name: "Paper / 素白",
    description: "珍珠白与冰蓝，让灵感轻盈落下。",
    colors: {
      background: "#f6f8fc",
      surface: "#ffffff",
      foreground: "#172134",
      muted: "#eef2f8",
      border: "#e2e8f1",
      accent: "#38bdf8",
    },
  },
  {
    id: "glacier",
    name: "Glacier / 冰川",
    description: "清爽的冷灰工作界面。",
    colors: {
      background: "#f5f6f8",
      surface: "#ffffff",
      foreground: "#142739",
      muted: "#eaf3f9",
      border: "#dce8f2",
      accent: "#38bdf8",
    },
  },
  {
    id: "midnight",
    name: "Midnight / 夜航",
    description: "柔和的深灰背景，适合暗光环境。",
    colors: {
      background: "#141b27",
      surface: "#1d2736",
      foreground: "#edf3fa",
      muted: "#273344",
      border: "#334156",
      accent: "#38bdf8",
    },
  },
];

export const defaultStudioSettings: StudioThemeSettings = {
  preset: "paper",
  accent: "#38bdf8",
  cardStyle: "outline",
  radius: "balanced",
  density: "comfortable",
  personality: "signature",
  motion: "gentle",
};
export const studioThemeStorageKey = "forma-studio-theme-v1";

export function normalizeStudioAccent(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const color = value.trim().toLowerCase();
  if (/^#[\da-f]{6}$/.test(color)) return color;
  if (/^#[\da-f]{3}$/.test(color))
    return (
      "#" + [...color.slice(1)].map((character) => character.repeat(2)).join("")
    );
}

export function sanitizeStudioSettings(
  value: unknown,
  fallback: StudioThemeSettings = defaultStudioSettings,
): StudioThemeSettings {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
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
    preset: select("preset", ["paper", "glacier", "midnight"]),
    accent: normalizeStudioAccent(input.accent) ?? fallback.accent,
    cardStyle: select("cardStyle", ["outline", "soft", "glass"]),
    radius: select("radius", ["compact", "balanced", "round"]),
    density: select("density", ["comfortable", "compact"]),
    personality: select("personality", ["subtle", "signature", "immersive"]),
    motion: select("motion", ["off", "gentle", "expressive"]),
  };
}

export function parseStoredStudioSettings(
  serialized: string | null,
): StudioThemeSettings {
  if (!serialized || serialized.length > 4096)
    return { ...defaultStudioSettings };
  try {
    const decoded: unknown = JSON.parse(serialized);
    if (decoded && typeof decoded === "object" && "version" in decoded) {
      return decoded.version === 1 && "settings" in decoded
        ? sanitizeStudioSettings(decoded.settings)
        : { ...defaultStudioSettings };
    }
    return sanitizeStudioSettings(decoded);
  } catch {
    return { ...defaultStudioSettings };
  }
}

function loadSettings() {
  try {
    const stored = parseStoredStudioSettings(
      window.localStorage.getItem(studioThemeStorageKey),
    );
    const legacyDefault: StudioThemeSettings = {
      preset: "glacier",
      accent: "#38bdf8",
      cardStyle: "soft",
      radius: "balanced",
      density: "comfortable",
      personality: "immersive",
      motion: "expressive",
    };
    const isLegacyDefault = (Object.keys(legacyDefault) as (keyof StudioThemeSettings)[])
      .every((key) => stored[key] === legacyDefault[key]);
    return isLegacyDefault ? { ...defaultStudioSettings } : stored;
  } catch {
    return { ...defaultStudioSettings };
  }
}

function rgb(hex: string) {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
}
function mix(a: string, b: string, amount: number) {
  const second = rgb(b);
  return (
    "#" +
    rgb(a)
      .map((channel, index) =>
        Math.round(channel * (1 - amount) + second[index] * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function luminance(color: string) {
  return rgb(color)
    .map((channel) => channel / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort(
    (left, right) => right - left,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function createStudioTokens(
  settings: StudioThemeSettings,
): Record<string, string> {
  const palette = studioThemePresets.find(
    (preset) => preset.id === settings.preset,
  )!.colors;
  const dark = settings.preset === "midnight";
  const accentSoft = mix(palette.surface, settings.accent, dark ? 0.18 : 0.1);
  let accentInk = settings.accent;
  for (
    let step = 0;
    step <= 20 && contrast(accentInk, accentSoft) < 4.5;
    step++
  )
    accentInk = mix(settings.accent, dark ? "#ffffff" : "#101820", step / 20);
  let focusRing = settings.accent;
  for (
    let step = 0;
    step <= 20 && contrast(focusRing, palette.background) < 3;
    step++
  )
    focusRing = mix(settings.accent, dark ? "#ffffff" : "#101820", step / 20);
  const cardRadius = { compact: 6, balanced: 14, round: 22 }[settings.radius];
  const controlRadius = { compact: 4, balanced: 8, round: 12 }[settings.radius];
  const cardBg =
    settings.cardStyle === "glass"
      ? `rgba(${rgb(palette.surface).join(", ")}, ${dark ? 0.74 : 0.78})`
      : palette.surface;
  const shadow =
    settings.cardStyle === "outline"
      ? "none"
      : dark
        ? "0 2px 4px #00000014, 0 12px 32px -20px #00000080"
        : "0 2px 4px #17233604, 0 12px 30px -20px #17233624";
  const hoverShadow =
    settings.cardStyle === "outline"
      ? "0 4px 18px #0000000a"
      : dark
        ? "0 8px 28px -12px #000000a0"
        : "0 9px 28px -14px #17233632";
  const tokens: Record<string, string> = {
    "--studio-surface": palette.background,
    "--studio-surface-raised": palette.surface,
    "--studio-surface-muted": palette.muted,
    "--studio-text": palette.foreground,
    "--studio-text-secondary": dark ? "#c0ccdd" : "#5c6d85",
    "--studio-text-muted": dark ? "#a0b0c6" : "#718097",
    "--studio-border": palette.border,
    "--studio-border-strong": dark ? "#506078" : "#c5d1e1",
    "--studio-accent": settings.accent,
    "--studio-accent-soft": accentSoft,
    "--studio-accent-ink": accentInk,
    "--studio-focus-ring": focusRing,
    "--studio-accent-contrast":
      contrast(settings.accent, "#101820") >=
      contrast(settings.accent, "#ffffff")
        ? "#101820"
        : "#ffffff",
    "--studio-card-radius": `${cardRadius}px`,
    "--studio-card-shadow": shadow,
    "--studio-card-hover-shadow": hoverShadow,
    "--studio-card-bg": cardBg,
    "--studio-card-blur": settings.cardStyle === "glass" ? "18px" : "0px",
    "--studio-card-border":
      settings.cardStyle === "outline"
        ? palette.border
        : dark
          ? "#ffffff0d"
          : "#1723360b",
    "--studio-control-radius": `${controlRadius}px`,
    "--studio-sidebar-bg": dark ? "#25282c" : "#edf0f2",
    "--studio-sidebar-text": dark ? "#e5e8ec" : "#343b45",
    "--studio-sidebar-secondary": dark ? "#b6bdc6" : "#5b6673",
    "--studio-sidebar-muted": dark ? "#adb6c1" : "#5b6673",
    "--studio-sidebar-border": dark ? "#383e46" : "#d6dce2",
    "--studio-sidebar-border-strong": dark ? "#515b66" : "#bac4cf",
    "--studio-sidebar-raised": dark ? "#30353c" : "#e5e9ed",
    "--studio-sidebar-hover": dark ? "#353c45" : "#e2e7ec",
    "--studio-sidebar-active-bg": dark ? "#3b4653" : "#dde5ed",
    "--studio-sidebar-active-ink": dark ? "#e0e8f1" : "#31445b",
    "--studio-sidebar-active-mark": dark ? "#a1b3c8" : "#73889e",
    "--studio-canvas-bg": dark
      ? "#101620"
      : settings.preset === "glacier"
        ? "#e7eff5"
        : "#edf0f6",
    "--studio-ip-opacity": { subtle: "0.4", signature: "0.76", immersive: "1" }[
      settings.personality
    ],
    "--studio-ip-scale": { subtle: "0.76", signature: "0.9", immersive: "1" }[
      settings.personality
    ],
    "--studio-ip-glow":
      settings.personality === "subtle" ? "transparent" : accentSoft,
    "--studio-card-padding": settings.density === "compact" ? "14px" : "20px",
    "--studio-row-height": settings.density === "compact" ? "34px" : "42px",
    "--studio-control-height": settings.density === "compact" ? "32px" : "38px",
    "--studio-space-sm": settings.density === "compact" ? "6px" : "8px",
    "--studio-space-md": settings.density === "compact" ? "12px" : "16px",
    "--studio-space-lg": settings.density === "compact" ? "18px" : "24px",
    "--studio-motion-duration": {
      off: "0ms",
      gentle: "180ms",
      expressive: "320ms",
    }[settings.motion],
    "--studio-motion-distance": {
      off: "0px",
      gentle: "4px",
      expressive: "10px",
    }[settings.motion],
    "--studio-motion-ease": "cubic-bezier(.22,1,.36,1)",
    "--background": palette.background,
    "--foreground": palette.foreground,
    "--card": cardBg,
    "--card-foreground": palette.foreground,
    "--popover": palette.surface,
    "--popover-foreground": palette.foreground,
    "--primary": settings.accent === "#38bdf8" ? (dark ? "#79ceff" : "#0875e1") : accentInk,
    "--primary-foreground": dark ? "#142739" : "#ffffff",
    "--secondary": palette.muted,
    "--secondary-foreground": palette.foreground,
    "--muted": palette.muted,
    "--muted-foreground": dark ? "#a0b0c6" : "#718097",
    "--accent": accentSoft,
    "--accent-foreground": accentInk,
    "--destructive": dark ? "#fb7185" : "#dc2626",
    "--border": palette.border,
    "--input": palette.border,
    "--ring": focusRing,
    "--radius": `${controlRadius}px`,
    "--sky": settings.accent,
    "--sky-soft": accentSoft,
    "--sky-ink": accentInk,
  };
  return tokens;
}

interface StudioThemeContextValue {
  settings: StudioThemeSettings;
  presets: StudioThemePreset[];
  updateSettings: (patch: Partial<StudioThemeSettings>) => void;
  resetSettings: () => void;
}
const StudioThemeContext = createContext<StudioThemeContextValue | null>(null);

export function StudioThemeProvider({ children }: { children: ReactNode }) {
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
      commit(
        sanitizeStudioSettings(
          { ...settingsRef.current, ...patch },
          settingsRef.current,
        ),
      ),
    [commit],
  );
  const resetSettings = useCallback(
    () => commit({ ...defaultStudioSettings }),
    [commit],
  );

  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key !== studioThemeStorageKey && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== window.localStorage)
          return;
      } catch {
        return;
      }
      const next = parseStoredStudioSettings(
        event.key === null ? null : event.newValue,
      );
      settingsRef.current = next;
      setSettings(next);
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const tokens = createStudioTokens(settings);
    const attributes = {
      "data-studio-theme": settings.preset,
      "data-card-style": settings.cardStyle,
      "data-density": settings.density,
      "data-personality": settings.personality,
      "data-motion": settings.motion,
    };
    const previousVariables = Object.keys(tokens).map((key) => [
      key,
      root.style.getPropertyValue(key),
    ]);
    const previousAttributes = Object.keys(attributes).map((key) => [
      key,
      root.getAttribute(key),
    ]);
    const wasDark = root.classList.contains("dark");
    for (const [name, value] of Object.entries(tokens))
      root.style.setProperty(name, value);
    for (const [name, value] of Object.entries(attributes))
      root.setAttribute(name, value);
    root.classList.toggle("dark", settings.preset === "midnight");
    return () => {
      for (const [name, value] of previousVariables)
        value
          ? root.style.setProperty(name, value)
          : root.style.removeProperty(name);
      for (const [name, value] of previousAttributes)
        value === null
          ? root.removeAttribute(name!)
          : root.setAttribute(name!, value!);
      root.classList.toggle("dark", wasDark);
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
  return (
    <StudioThemeContext.Provider value={value}>
      {children}
    </StudioThemeContext.Provider>
  );
}

export function useStudioTheme() {
  const context = useContext(StudioThemeContext);
  if (!context)
    throw new Error("useStudioTheme must be used inside StudioThemeProvider");
  return context;
}
