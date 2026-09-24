# 开发与目录约定

## 注释与格式

函数使用中文 JSDoc，说明用途、采用这种处理方式的原因、每个入参和返回值；没有业务返回值时也要明确说明。Python 函数采用同样内容的 docstring。简短回调可以用紧凑注释，复杂流程应说明版本检查、失败恢复、坐标空间和资源释放等关键约束。

接口和类型说明它们在业务中的用途；类属性、接口字段和嵌套对象字段说明数据含义。状态联合类型应解释各个取值，坐标、时长、倍率等容易混淆的参数应注明单位或坐标系。注释需要随实现一起更新，不把“计划执行”写成“已经成功”，也不把兜底处理写成所有错误都会被忽略。

仓库使用根目录的 `.prettierrc.json` 和 `.editorconfig` 统一缩进、引号与换行。依赖、构建产物、本地状态及 pnpm 锁文件不交给格式化器处理。

```sh
pnpm format
pnpm format:check
```

`docs/` 中的 Python 素材脚本使用 Ruff 0.9.7，配置在根目录 `ruff.toml`。安装该版本后执行 `pnpm format:python` 或 `pnpm format:python:check`。格式化不会运行 Blender、重新生成图片或视频。

## 环境与常用命令

使用 Node.js 22.18+、pnpm 10.20.0。从根目录执行 `corepack enable`、`pnpm install --frozen-lockfile`、`pnpm dev`。依赖版本由 `packageManager`、workspace catalog 和唯一的 `pnpm-lock.yaml` 管理。

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm start` 启动 API 并提供 `apps/web/dist/`。共享包采用源码消费，API 使用 TypeScript ESM 和 Node.js 原生类型擦除，只有 Web 产生构建目录；不需要为内部包维护额外编译和监听进程。

AI 设计工作台使用 `pnpm design open ./examples/ai-design-workbench-demo/design` 启动。根目录的 `pnpm design` 会先执行 `build:design`，依次构建工作台前端和包含 SDK、前端副本的 CLI，再执行传入的命令，避免使用旧的打包内容。单独构建前端不会更新 `packages/workbench-cli/dist/web` 或已经运行的 CLI 服务；更新后需要重启服务并刷新浏览器。

## 包的职责

| 位置                         | 包                         | 职责                                    |
| ---------------------------- | -------------------------- | --------------------------------------- |
| `apps/web`                   | `@forma/web`               | 页面、编辑器交互、应用状态、静态资源    |
| `apps/api`                   | `@forma/api`               | HTTP、持久化、模型调用、Agent、代码同步 |
| `packages/schema`            | `@forma/schema`            | 设计模型、Agent 请求/响应类型           |
| `packages/renderer`          | `@forma/renderer`          | 场景渲染与独立 React 导出源码           |
| `packages/editor-core`       | `@forma/editor-core`       | 不依赖 React 的画布计算                 |
| `packages/ui`                | `@forma/ui`                | shadcn/Radix 基础组件、样式工具         |
| `packages/typescript-config` | `@forma/typescript-config` | TypeScript 公共配置                     |

API 和共享 Node 入口统一使用 `.ts`。API 复用 `@forma/typescript-config/node.json`，启用 strict、NodeNext、verbatimModuleSyntax 和 erasableSyntaxOnly。相对模块导入必须带 `.ts` 扩展名，类型依赖使用 `import type`；不使用依赖编译转换的 enum 或构造器参数属性。

包内实现放 `src/`，包级测试放 `tests/`，包配置留在包根目录。Web 独有业务组件继续留在 `apps/web/src/components`，不为了复用而把应用逻辑放进基础 UI 包。文档和素材制作工程放根目录 `docs/`，上线资源放 `apps/web/public/`。

## 依赖边界

- `apps/*` 可以依赖 `packages/*`；共享包不得依赖应用。
- 内部依赖必须在使用方的 `package.json` 中声明 `workspace:*`，并通过包 `exports` 导入。禁止通过 `../../other-package/src` 访问其他包。
- 类型使用 `import type`；浏览器代码不得导入 `@forma/schema/source` 或 `@forma/renderer/source`，这两个入口使用 Node 文件系统。
- 公共 React 包把 React/ReactDOM 放在 `peerDependencies`，本地类型检查所需版本放 `devDependencies`；应用提供实际运行时。
- 工具与运行时依赖各归所属包，不依赖根目录提升的幽灵依赖。根目录仅负责仓库任务编排。
- `@forma/ui` 提供按组件的子路径，例如 `@forma/ui/button`；组件不依赖 Web 的 `@/` 别名。应用引入 `@forma/ui/styles.css`，样式显式扫描共享 UI 源码。

```sh
# 新增内部依赖
pnpm --filter @forma/web add '@forma/ui@workspace:*'
# 添加外部依赖并存入共享 catalog
pnpm --filter @forma/web add <package> --save-catalog
# 单包运行
pnpm --filter @forma/api test
pnpm --filter @forma/editor-core typecheck
```

新增包时使用 `@forma/<name>` 命名、`private: true`、`type: module`，声明公开 `exports`，复用 `@forma/typescript-config`，按需提供 `typecheck`、`test`、`build` 脚本。安装后提交根锁文件，不提交 `node_modules`、`dist`、`.data` 或密钥。

## 路径与设计数据

根 `.env` 由 API 明确加载；默认 `.data/` 及相对 `FORMA_DATA_DIR` 都以仓库根目录解析。`pnpm --filter` 会改变进程工作目录，新增文件系统操作不能假设当前目录就是仓库根目录。

设计字段变更需同时考虑 schema、API 校验、编辑器属性和 renderer。渲染器的浏览器入口和 Node 源码入口共同维护导出一致性；导出结果应能在只有 React/TypeScript 的消费项目中使用。

`/docs/` 预览由 Web 开发服务映射到根文档目录；工程素材不复制进生产产物。文档预览的应用组件使用 `@/` 引用，由 Web 的 Vite 配置解析。
