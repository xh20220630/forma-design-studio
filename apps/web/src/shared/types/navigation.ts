/**
 * 应用视图，集中定义允许的分支以保持调用方一致。
 * 项目中的品牌设计独立于页面画布与主题变量流程。
 */
export type View =
  | 'projects'
  | 'project'
  | 'brand'
  | 'templates'
  | 'components'
  | 'tokens'
  | 'agents'
  | 'sync'
  | 'settings'
  | 'theme'
  | 'editor';
