import type { StudioThemeSettings, StudioThemePreset } from './types.ts';

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
