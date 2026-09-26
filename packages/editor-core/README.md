# @forma/editor-core · 画布算法

不依赖 React 的几何、自动布局、布尔运算与视口换算。依赖 `@forma/schema` 和 polygon-clipping。

源码包，浏览器由 Vite 编译；Node.js 22.18+ 可直接擦除 TS 类型运行算法测试。

公开子路径：`@forma/editor-core/geometry`、`@forma/editor-core/boolean`、`@forma/editor-core/viewport`。测试与算法同属本包的 `tests/`。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 目录与依赖

`src/geometry.ts`、`src/boolean.ts`、`src/viewport.ts` 是兼容的公共导出入口。算法按能力组织：

- `nodes/`：节点标识、层级查询、移动与复制。
- `geometry/`：包围盒和路径缩放。
- `layout/`：约束缩放与自动布局；两者互相递归，保留在同一模块。
- `boolean/`：轮廓、线性路径和布尔操作。
- `viewport/`：视口类型与相机计算。
- `serialization/`：节点 CSS 序列化。

内部直接引用具体模块，不通过公共入口反向导入；不依赖 React、浏览器渲染器或文件系统。测试位于 `tests/unit/`，通过公开包子路径验证算法。
