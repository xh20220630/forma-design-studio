---
name: forma-ai-ui-designer
description: "面向多页面产品 UI 设计，维护系统级 Design Tokens、设计组件规范与业务流程，并把页面图片、转场和标注发布到 Forma 本地设计工作台。用于新系统设计、现有系统扩展和工作台浏览；不用于普通代码修复或把位图还原成 UI 图层。"
---

# Forma AI UI 设计师

交付可持续扩展的系统 UI，而不是彼此孤立的效果图。默认中文沟通和文档，沿用用户的品牌、语言、设备和业务约束。

## 工作入口

1. 确定设计资产根目录。优先读取已有 `DESIGN.md`、`tokens.json`、`components/index.json` 和 `flows/index.json`，不要重复建库。
2. 新系统或新增业务流程时读取 [工作流](references/workflow.md)。写入 JSON 时读取 [数据契约](references/data-contract.md)。出图时读取 [出图规范](references/generation.md)。发布交付时读取 [工作台交付](references/delivery.md)。
3. 如果设计目录尚未初始化，运行 `npx @forma/ai-design-workbench init`。如果工作台未运行，可在交付时执行 `npx @forma/ai-design-workbench open <design-root>`。

## 必须保持的约束

- 出图前先完成 `DESIGN.md` 和语义 Tokens，明确业务、框架、组件共性和交互规则。
- 先理解角色、目标、信息结构、状态和页面流转；只询问影响结构或视觉方向的未知项，其余假设写入 BRIEF。
- 先检索系统组件规范。设计组件是 Markdown 规范，不等同于代码组件；页面引用已批准的确切版本。
- 视觉方向未定时默认给出三张独立完整概念图；已有风格或用户已授权选择时直接沿用并记录来源。
- 每个页面、modal、drawer 和重要状态生成独立完整图片。桌面默认目标为 1920×1080；移动端记录逻辑视口与倍率。
- 页面图片不烧录业务标注。业务标注和转场保存在流程数据中；工作台不设置评审状态或审批流程。
- 页面图片在工作台中作为原生 Image Node 显示。不要声称图片已经转换为可编辑 UI 图层。
- 修改已有设计时保持稳定 ID，创建新图片版本，不覆盖历史图片。
- 每张图片记录真实路径、实际尺寸、主题版本、组件版本、Prompt、参考图和目视验收状态。
- 最终交付以 SDK 校验成功且所有流程可在 Forma 工作台中浏览为准；`review.html` 只是可选离线导出。

## 工具入口

```text
npx @forma/ai-design-workbench init
npx @forma/ai-design-workbench validate <design-root>
npx @forma/ai-design-workbench open <design-root>
npx @forma/ai-design-workbench export-html <design-root>
```

`init` 只创建不存在的资产骨架，并处理本 Skill 的项目级或全局安装。`validate` 校验引用、版本、路径和真实图片尺寸。工具检查不能代替业务正确性、视觉一致性和可读性的目视检查。

## 完成口径

简要说明设计的流程、页面、弹层和状态，复用的组件、主题版本、验收结果及未解决差异；给出设计根目录和工作台启动方式。缺少真实图片或存在阻塞视觉问题时标记为部分完成，不把初始化模板当成最终交付。
