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
