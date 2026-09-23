# Forma 工作台交付

运行：

```text
npx @forma/ai-design-workbench validate <design-root>
npx @forma/ai-design-workbench open <design-root>
```

工作台把每个页面图片作为锁定 Image Node 放进页面 Frame。Transition 生成正交连接线；annotation 生成独立序号、引导线和按需展开气泡；Tokens 与组件规范在系统面板和检查器展示。

交付前实际浏览并检查：

- 流程切换、搜索、拖动、缩放和适应画布；
- 页面、modal、drawer、state 和所有真实转场；
- 回路、关闭路径和跨流程出口；
- 原图加载、比例和实际尺寸；
- 标注气泡默认隐藏、边缘定位和目标跳转；
- 页面使用的组件版本和主题版本；

最终提供设计根目录和工作台启动命令。需要离线分享时可以运行：

```text
npx @forma/ai-design-workbench export-html <design-root>
```

HTML 导出用于离线浏览；工作台没有评审状态和评审写回。

缩放使用原始图片直接按目标显示尺寸绘制，文字标注和连接线独立渲染。PNG、JPEG、WebP 仍受原图分辨率限制，不承诺位图任意放大无损。
