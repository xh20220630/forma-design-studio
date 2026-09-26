# @forma/ai-design-workbench · 工作台 CLI

本地单项目工作台的命令行入口，负责初始化项目、校验设计、离线导出、技能管理和本地服务生命周期。

## 目录结构

- `src/cli.ts`：可执行入口、直接执行判断和顶层错误处理。
- `src/cli/`：参数解析、命令分发、终端输出与交互提示。
- `src/commands/`：`init`、`open`、`validate`、`export-html`、`skill` 子命令。
- `src/services/`：项目初始化与技能安装用例。
- `src/infrastructure/`：文件操作、安装标记、本机状态、配置读取和浏览器启动。
- `src/templates/`：初始化项目的文件模板。
- `src/types/`：技能安装和管理标记契约。
- `src/paths.ts`：源码与单文件发行产物共用的包根目录定位。
- `tooling/build.ts`：打包 CLI 并复制工作台前端与技能资源。
- `tests/integration/`：入口、项目初始化、技能管理和打包后运行测试。

子命令组合服务与基础设施；终端交互留在 CLI 层，模板不执行写入。设计资产的读取与修改继续交给 `@forma/design-workspace-sdk`。

## 发行与验证

可执行文件仍为 `dist/cli.js`，命令名仍为 `forma-design`。资源定位模块保留在 `src/` 下一层，与打包后的 `dist/cli.js` 相对于包根目录的深度一致。移动该模块或调整打包输出时，必须同时验证打包后的 `open` 命令能读取前端资源。

在本包目录执行 `node --test tests/integration/*.test.ts` 和 `node node_modules/typescript/bin/tsc --noEmit`。打包回归测试在系统临时目录创建安装结构，验证初始化、校验、HTML 导出以及 HTTP 访问，并在结束后清理。
