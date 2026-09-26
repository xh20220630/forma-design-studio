# 应用目录

`apps/` 保存可启动的产品应用。各应用根据运行环境组织源码，共享 SDK、契约、算法和基础组件放在 `packages/`。

| 应用 | 结构 | 职责 |
| --- | --- | --- |
| [web](./web/README.md) | `app → features → entities/shared` | 完整设计工作台、项目管理、画布编辑和 Agent 交互 |
| [ai-design-workbench](./ai-design-workbench/README.md) | `app → features → shared` | CLI 托管的流程画布、设计系统浏览和文档编辑 |
| [api](./api/README.md) | HTTP、服务、领域规则、基础设施 | 本地 API、项目持久化、模型适配和代码同步 |

## React 应用

- `src/main.tsx` 负责挂载 React；`app/` 负责应用装配、跨功能状态、导航、Provider 和全局样式。
- `features/<功能>/` 收拢该功能的组件、模型、hooks 和样式；仅在有实际内容时建立子目录。
- `entities/` 保存跨功能复用的业务对象能力；`shared/` 保存应用内公共请求客户端、类型、主题和展示组件。
- 依赖由应用装配层指向功能层，再指向业务对象和共享能力；底层不导入 `app/` 或上层功能。功能之间已有的组合依赖保持单向。
- 跨应用复用进入 `packages/` 的公开导出，不直接引用另一个应用的 `src/`。

目录按现有业务职责划分，组件拆分遵循 [React 的组件层级与单向数据流说明](https://react.dev/learn/thinking-in-react)。不为较小应用建立空的路由、状态或服务目录。

## Express 服务

- `index.ts` 启动监听；`app.ts` 装配 Express，并支持测试独立创建实例。
- `http/routes/` 使用 [Express Router](https://expressjs.com/en/guide/routing/) 按资源组织端点；`http/middleware/` 负责访问限制、请求正文和错误处理。
- `services/` 协调业务用例；`domain/` 保存不依赖持久化和 HTTP 的设计规则。
- `infrastructure/` 实现文件存储、素材处理、供应商配置和网络协议；`config/` 与 `shared/` 提供运行配置和公共契约。
- 服务、领域规则和基础设施不反向依赖 HTTP；领域规则和共享模块不依赖业务服务。

应用配置留在各项目根目录。`public/` 保持浏览器资源 URL，`tooling/` 放开发工具，`tests/` 放可独立执行的测试。构建产物仍输出到各应用的 `dist/`。
