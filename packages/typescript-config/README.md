# @forma/typescript-config · TypeScript 配置

集中维护共享编译约定，应用和源码包通过 workspace 依赖复用。

`base.json`：ES2022、严格检查、Bundler 解析、不输出产物；`react.json`：在基础配置上启用 DOM 和 React JSX；`node.json`：NodeNext 解析、Node 类型、显式类型导入和可擦除语法，供 API 直接运行 TypeScript。

使用 `"extends": "@forma/typescript-config/react.json"` 或 `base.json`。`include`、应用别名和环境类型由使用方定义。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 目录约定

配置包保持根目录平铺：`base.json` 是共享基础，`react.json` 和 `node.json` 按运行环境继承。三个公共 JSON 子路径保持稳定。此包没有运行时代码，无需增加 `src/`、服务层或构建产物；项目自己的目录范围与路径别名留在消费方配置中。
