/**
 * 应用视图，集中定义允许的分支以保持调用方一致。
 * 取值：projects（项目列表）、project（当前项目）、templates（模板库）、components（组件库）、tokens（主题 Token）、agents（助手设置）、sync（代码同步）、settings（设置）、theme（主题）、editor（设计编辑器）。
 */
export type View =
  | 'projects'
  | 'project'
  | 'templates'
  | 'components'
  | 'tokens'
  | 'agents'
  | 'sync'
  | 'settings'
  | 'theme'
  | 'editor';
