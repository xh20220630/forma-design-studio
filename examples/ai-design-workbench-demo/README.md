# Forma AI Design Workbench Demo

这是一个面向单项目的完整设计交付样例，包含两条业务流程、一个弹层、跨流程跳转、业务标注、系统级 Design Tokens 和版本化组件规范。页面以原生 Image Node 在画布上呈现。

```bash
pnpm --filter @forma/ai-design-workbench-ui build
pnpm --filter @forma/ai-design-workbench build
pnpm design open ./examples/ai-design-workbench-demo/design
```

也可以从 CLI package 的工作目录运行原始形式：

```bash
pnpm --filter @forma/ai-design-workbench exec forma-design open ../../examples/ai-design-workbench-demo/design
```

项目根目录是当前目录，设计资产根目录是 `design/`。
