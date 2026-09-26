# 共享包目录约定

各包按自身职责组织代码，公共导出路径由包内 `package.json` 管理。应用通过包入口引用能力；包内模块直接引用实际实现，避免反向依赖公共入口。

| 包                                                       | 组织方式       | 说明                                         |
| -------------------------------------------------------- | -------------- | -------------------------------------------- |
| [design-workspace-sdk](./design-workspace-sdk/README.md) | SDK 分层       | 类型、错误、领域规则、服务、基础设施、适配器 |
| [editor-core](./editor-core/README.md)                   | 算法能力划分   | 节点、几何、布局、布尔运算、视口、序列化     |
| [renderer](./renderer/README.md)                         | 渲染后端划分   | 共享取值、DOM、Canvas、Node 源码导出         |
| [schema](./schema/README.md)                             | 业务域契约划分 | 设计、Agent、工作台契约与 Node 源码导出      |
| [ui](./ui/README.md)                                     | 组件库结构     | 基础控件、组合组件、主题、样式和工具         |
| [workbench-cli](./workbench-cli/README.md)               | 命令行应用结构 | 入口、解析、子命令、服务、文件操作和模板     |
| [forma-ai-ui-designer](./forma-ai-ui-designer/README.md) | 插件资源结构   | 插件清单、技能、参考资料与资源元数据         |
| [typescript-config](./typescript-config/README.md)       | 配置包结构     | 根目录基础配置与环境配置继承                 |

## 维护边界

- 不为简单的资源或配置包添加空的分层目录。
- 算法与数据契约不依赖 React；纯主题计算与 React 生命周期分开维护。
- 面向浏览器的入口不引入 Node 专用源码读取模块；Node 能力使用独立子路径。
- 原有公共导入方式、命令名、CSS 入口和数据类型保持兼容。
- 单元测试放入 `tests/unit/`，跨模块与发行验证放入 `tests/integration/`，夹具放入 `tests/helpers/`；只为实际需要的测试建立目录。
- 移动源码时同时检查相对导入、包导出、CSS 扫描、源码拼接及 `import.meta.url` 资源定位。
