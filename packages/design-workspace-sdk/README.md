# Design Workspace SDK

`@forma/design-workspace-sdk` 提供本地设计资产的读取、校验、编辑和修订监听，供工作台与 CLI 共用。

## 目录结构

```text
design-workspace-sdk/
├── src/
│   ├── index.ts                    # SDK 公共入口
│   ├── server.ts                   # HTTP 服务公共入口
│   ├── static-review.ts            # 离线导出公共入口
│   ├── types/                      # SDK 接口与内部 JSON 类型
│   ├── errors/                     # 校验、输入和冲突错误
│   ├── domain/                     # 纯领域规则：布局、Tokens、引用与变更校验
│   ├── services/                   # 工作区用例：读取、提交、本机状态
│   │   └── loading/                # 项目、组件和流程资产加载
│   ├── infrastructure/
│   │   ├── filesystem/             # 路径检查、JSON、写锁、回滚、监听与校验和
│   │   └── images/                 # 图片尺寸解析
│   ├── adapters/
│   │   ├── http/                   # HTTP、SSE 和静态文件服务
│   │   └── static-review/          # 含内嵌图片的离线 HTML 导出
│   └── utils/                      # 通用取值、字符串、版本比较和诊断收集
├── tests/
│   ├── integration/               # 通过公开包入口验证工作区与服务行为
│   └── helpers/                   # 临时设计资产夹具
├── package.json
└── tsconfig.json
```

## 分层约定

- `types`、`errors`、`utils` 提供共享契约和基础函数，不依赖上层实现；设计资产契约继续由 `@forma/schema/workbench` 维护。
- `domain` 只处理数据和规则，不读取文件，不依赖服务、基础设施或适配器。
- `infrastructure` 封装文件系统和图片格式细节，不依赖领域规则、工作区服务或适配器。
- `services` 编排领域规则和基础设施，负责完整的工作区用例；`loading` 负责加载资源并组装运行时文档。
- `adapters` 将工作区能力接入 HTTP 和离线 HTML；协议处理和展示格式留在适配器内。
- 顶层三个入口只做显式导出。内部模块直接引用所属模块，不经公共入口反向导入，避免循环依赖。

新增规则放到 `domain`，新增文件操作放到 `infrastructure`，跨资源业务操作放到 `services`。不要把实现堆回入口文件，也不要为内部目录新增包级导出。

## 公共入口

现有导入路径和导出名称保持兼容：

| 导入路径                                    | 导出                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@forma/design-workspace-sdk`               | `openDesignWorkspace`、`DesignWorkspace`（类型）、`WorkspaceValidationError`、`WorkspaceConflictError`、`WorkspaceInputError`、`checksumDirectory` |
| `@forma/design-workspace-sdk/server`        | `createWorkbenchServer`、`WorkbenchServer`（类型）                                                                                                 |
| `@forma/design-workspace-sdk/static-review` | `exportStaticReview`                                                                                                                               |

```ts
import { openDesignWorkspace } from '@forma/design-workspace-sdk';

const workspace = await openDesignWorkspace({ root: './design' });
const document = await workspace.read();
const report = await workspace.validate();
```

打开工作区时解析真实根目录；读取与校验按需执行。`read()` 不写入资产，`apply()` 要求携带 `baseRevision`。写入使用跨进程锁、临时文件和备份回滚，最后替换 `project.json` 作为修订提交标记。共享布局和本机 `.forma/local-state.json` 分开保存。

## 验证

在本包目录运行：

```sh
node --test tests/integration/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

集成测试覆盖 v1 兼容读取、布局与内容编辑、版本冲突、修订通知、路径边界、HTTP 服务和离线导出。SDK 直接导出 TypeScript 源码，由工作台 CLI 在发行构建时打包。
