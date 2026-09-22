# Forma Design Studio

设计与实现的统一工作空间。

A local-first, AI-assisted UI design workspace with an editable canvas, design tokens, reusable components, and React code export.

[GitHub 仓库](https://github.com/xh20220630/forma-design-studio) · [API 文档](./docs/API.md) · [架构说明](./docs/ARCHITECTURE.md)

Forma 是一个本地运行的 Web 设计系统原型：以项目为单位管理页面、组件与主题，通过图片审批流程生成可编辑 UI，再将同一份设计数据同步为 React 界面。

界面采用基于 Radix 的 shadcn/ui 组件与 Tailwind CSS，使用中性色工作台、蓝色选中状态、独立图层面板与属性面板。画布、项目缩略图和代码导出共享节点渲染逻辑。当前版本提供完整的本地设计与交付流程，尚未达到 Figma 的全部功能范围，也没有接入真实 Figma 文件的实时同步。

## 启动

需要 Node.js 22+。绑定 GitHub 仓库还需要本机安装 Git。

```bash
git clone https://github.com/xh20220630/forma-design-studio.git
cd forma-design-studio
npm ci
npm run dev
```

- 工作台：[http://127.0.0.1:5173](http://127.0.0.1:5173)
- 本地 API：[http://127.0.0.1:4310/api/health](http://127.0.0.1:4310/api/health)

`npm run dev` 同时启动 Vite 前端和 Express API。只启动前端使用 `npm run dev:web`，只启动 API 使用 `npm run dev:api`。只有前端时可以查看和编辑本地缓存，模型生成、工作空间绑定和文件同步需要 API 服务。

首次进入会创建 Nexus、Moss、Roam、Vault 四个示例项目。所有项目卡片展示真实页面节点的实时缩略图；模板库中的图片是主题风格示意。

## 建议体验顺序

1. 在“所有项目”中创建或打开项目，进入项目概览。每个项目独立拥有页面、组件库、Design Tokens 和绑定的代码工作空间；从概览中新建、复制、重命名或打开页面。
2. 进入项目下的“Design Tokens”，修改语义 Token 或创建 Light / Dark 模式。也可以创建颜色、数值、文本、布尔变量集合，在画布属性面板绑定变量；切换集合模式会同步更新绑定图层。
3. 在项目组件库创建按钮或卡片，或在画布中将选区创建为组件。通过组件菜单添加变体，在属性编辑中设置 State、Size 等变体属性；主组件修改会更新关联实例。
4. 从模板市场选择现有主题创建项目；配置模型服务后，还可以用自然语言生成主题。
5. 使用右侧 Agent 聊天描述需求。全局会话可创建项目，项目会话读取当前项目上下文，可修改 Tokens、创建组件、生成 UI 设计图和预览代码。页面设计依次完成“生成设计图 → 对话中确认 → 还原可编辑 UI”，服务端会校验审批顺序。
6. 绑定本地 Web 项目目录或 GitHub 仓库，查看同步差异，再同步到生成目录。首次同步完成后可开启自动同步。

## 配置模型服务

在“工作空间设置”中填写 API Base URL、API Key、支持视觉输入的文本模型和图片生成模型。也可以将 [.env.example](./.env.example) 复制为 `.env`，填写环境变量后重启服务。

模型服务需兼容以下接口：

- `POST /images/generations`：从项目主题和需求生成设计图。
- `POST /chat/completions`：支持 `image_url` 视觉输入及结构化 JSON 输出，用于还原设计和生成主题。

密钥由本地服务端使用，不随设置读取接口返回。设置页保存的密钥位于 `.data/settings.json`；该目录已被 Git 忽略。使用你有访问权限的模型名称和服务地址。未配置模型时会明确提示，不会用示例内容冒充生成结果。

目前图片生成请求的尺寸是 `1536x1024`。如果服务提供商不支持该尺寸、视觉输入或接口格式，需要替换为兼容模型，或调整 [模型适配器](./server/provider.mjs)。

## 设计与代码如何保持一致

项目的 `tokens + components + pages` 是生成界面的共同来源。同步器在绑定的目录下生成：

```text
forma-generated/
  design.json    页面、组件和主题数据
  tokens.css     主题 CSS 变量
  index.tsx      React 页面/组件渲染器
  manifest.json  项目版本和文件哈希
  README.md      集成说明
```

真实业务应用导入生成的 `FormaPage` 或 `FormaComponent`，在生成目录外处理业务状态、路由和数据：

```tsx
import { FormaPage } from './forma-generated';

export function App() {
  return (
    <FormaPage
      pageId="page-home"
      onAction={(nodeId) => {
        handleDesignAction(nodeId);
      }}
    />
  );
}
```

示例中的 `handleDesignAction` 由消费应用实现，用稳定的节点 ID 映射业务行为。消费应用需要 React、TypeScript，并启用 `resolveJsonModule`。

导出的是固定画布尺寸的 UI 渲染层，不会自动生成业务后端、响应式规则、路由或真实数据。设计更新会修改生成目录，开发服务器可以检测文件变化；生产环境仍需走应用自己的构建与部署流程。

同步前会检查文件哈希。生成文件被人工修改时，会停止覆盖并提示冲突。业务代码应保留在生成目录之外。GitHub 绑定会真实克隆仓库到本地；当前不自动提交、推送、合并或部署。

## Agent 接入

内置侧边 Agent 聊天使用设置中的文本模型，将自然语言转换为受验证的设计操作。支持多会话和本地历史持久化；全局与项目会话分开显示。图片审批与同步写入通过对话中的结果卡片执行，代码同步绑定到具体预览版本。模型未配置或调用失败时显示真实错误。

任何能够发起 HTTP 请求的 Agent 都可以读写项目、生成主题、执行图片审批流程和同步代码。使用本地 REST API，并遵循 [项目类型](./src/types.ts) 与版本号校验。可通过 `FORMA_AGENT_TOKEN` 为外部本地请求配置 Bearer Token。

- [API 文档与 Agent 示例](./docs/API.md)
- [架构、数据流与同步边界](./docs/ARCHITECTURE.md)

当前没有内置独立的 MCP Server 或完整 Agent 编排 SDK。Agent 的代码编辑、测试和其他开发工具由接入方提供。

## 已实现与后续边界

| 能力 | 当前实现 |
| --- | --- |
| 项目与工作空间 | 项目管理、浏览器缓存、本地文件持久化、本地目录/GitHub 绑定 |
| 工作台 UI | shadcn/ui + Radix 组件；中性色导航、项目网格、紧凑数据表格与可访问对话框 |
| 主题与变量 | 六套主题模板、自然语言生成、语义 Token、主题模式、变量集合、颜色/数值/文本/布尔变量、多模式切换与画布绑定 |
| 组件 | 创建、复制、删除并解除实例关联、主组件与实例、变体组与属性、Token / 变量绑定、实例覆盖 |
| 画布与图层 | 多页面、缩放与平移、框选与多选、分组、重排、对齐与分布、锁定与隐藏、撤销重做、快捷键、标尺与吸附 |
| 绘制与属性 | 画框、分区、矩形、椭圆、直线、多边形、星形、钢笔路径、自由绘制、图片、文本排版、旋转、描边、渐变与阴影；形状合并/减去/交集/排除布尔运算 |
| 布局与检查 | 横向/纵向/换行 Auto Layout、间距和内边距、对齐、尺寸约束、裁切、属性与代码检查 |
| 原型与记录 | 页面连接、原型预览、画布评论、命名版本快照、SVG / PNG / JSON 导出 |
| AI 设计 | 真实图片生成、人工确认、视觉模型还原、还原结果二次编辑 |
| Agent 聊天 | 全局 / 项目会话、持久化历史、创建项目、修改 Tokens、创建组件、图片设计与确认、代码预览和同步 |
| 同步 | React 导出、差异预览、文件冲突保护、首次确认后的自动更新 |

目前仍未覆盖 Figma 的全部能力：真实 Figma 文件导入与双向连接、完整矢量网络和可编辑布尔操作树、复杂组件属性继承、完整响应式布局、多人实时协作、团队权限、插件生态和商业模板交易。已有钢笔与自由绘制属于基础路径编辑；布尔运算生成扁平路径，椭圆和圆角以分段近似处理，不支持曲线与保留操作树。SVG 导出使用 foreignObject 承载设计内容，兼容性与纯矢量 SVG 不同。模板市场目前是内置及本地自定义模板库。

主题和已有组件会进入生成约束，但模型生成结果仍需校对；目前不能保证不同图片之间完全一致，也不能保证视觉模型对每张设计图的像素级还原。

服务默认仅监听本机回环地址，是个人本地工作空间架构，不是可直接公开部署的多租户服务。项目数据默认保存在 `.data/`，自定义模板保存在当前浏览器，工作空间设置可以导出备份。

## 检查命令

```bash
npm run typecheck
npm run build
npm test
```

后端测试使用临时目录和本地模拟模型，不需要真实模型密钥。它们验证流程与同步机制，真实模型质量需要实际服务配置后体验。

## 设计参考

产品方向参考 [OpenDesign 官方资料](https://open-design.ai/official/) 的设计系统与本地 Agent 工作空间，以及 [Claude Design](https://claude.com/product/design) 的自然语言设计与持续迭代流程。Forma 是独立实现，未复制这些产品的源码，也不是其官方集成。


