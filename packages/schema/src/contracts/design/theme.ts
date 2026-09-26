/** 项目的基础视觉主题；节点通过绑定引用这些值，切换主题时无需逐个改样式。 */
export interface ThemeTokens {
  /** 项目的主要强调色。 */
  primary: string;
  /** 背景颜色或背景类型。 */
  background: string;
  /** 卡片或面板的表面颜色。 */
  surface: string;
  /** 需要展示或编辑的文字内容。 */
  text: string;
  /** 次要文字或弱化表面使用的颜色。 */
  muted: string;
  /** 边框使用的颜色。 */
  border: string;
  /** 圆角大小。 */
  radius: number;
  /** 字体族名称，可包含回退字体。 */
  fontFamily: string;
  /** 布局间距的基准值或语义 Token 分组。 */
  spacing: number;
}
