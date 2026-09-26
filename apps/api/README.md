# @forma/api · 本地 API

Express + TypeScript ESM 服务，负责 JSON 持久化、模型调用、Agent 会话、工作空间绑定和代码同步。

`pnpm --filter @forma/api dev` 使用 Node watch；`pnpm --filter @forma/api start` 直接运行 `src/index.ts`。使用 Node.js 22.18+ 的原生类型擦除，无需运行时转译依赖。根 `.env`、`.data/` 与 `apps/web/dist/` 使用固定路径，不依赖进程工作目录。

源码使用 `@forma/typescript-config/node.json` 开启严格类型检查与 NodeNext 模块解析，复用 `@forma/schema` 的项目和 Agent 契约。HTTP 请求与模型 JSON 在边界校验后进入业务操作；错误捕获使用 `unknown`。

通过 `@forma/renderer/source` 取得独立 React 导出源码；不得读取 Web 应用的内部源码。

## 源码布局

```text
src/
  index.ts                  直接执行时启动服务，保留 createApp 导出
  app.ts                    中间件、路由、静态文件和错误处理装配
  config/runtime.ts         根目录、环境变量、端口和来源配置
  http/
    middleware/             本机访问、JSON 正文校验、错误映射
    routes/                 system、agent、projects、providers、generation、workspace
    types.ts                HTTP 请求类型
  services/                 Agent、生成、还原、导出、同步、绑定和输入校验
  domain/                   设计上下文与生成结果归一化
  infrastructure/
    storage/                JSON 文件与串行事务
    assets/                 本地素材解析与生成素材保存
    providers/              供应商配置、密钥与协议传输
  shared/                   错误约定与内部契约
tests/                      HTTP、存储、Agent、生成和运行路径集成测试
```

路由负责 HTTP 参数与响应，调用服务及存储适配器；服务协调设计规则和基础设施。领域规则、基础设施与服务不依赖 Express 路由。相对 TypeScript 导入保留 `.ts` 扩展名。

中间件顺序为本机访问限制、JSON 解析、正文校验、业务路由、素材、API 404、Web 静态文件、错误处理。新增路由不能绕过前置限制。移动 `config/runtime.ts` 时必须同步验证基于 `import.meta.url` 的仓库定位。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
