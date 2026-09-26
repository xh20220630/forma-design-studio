# @forma/ai-ui-designer-plugin · 技能插件资源

本包交付技能资源，并为工作台 CLI 提供资源位置、技能 ID 和版本信息。

## 目录结构

- `.codex-plugin/plugin.json`：插件清单。
- `skills/forma-ai-ui-designer/SKILL.md`：技能主入口。
- `skills/forma-ai-ui-designer/agents/`：Agent 配置。
- `skills/forma-ai-ui-designer/references/`：工作流、生成和交付契约。
- `src/index.ts`：资源定位与元数据导出。

这是资源插件，保留现有的清单、技能目录和轻量代码入口。安装、升级和完整性检查由工作台 CLI 负责，不在资源包中引入服务层。

`src/index.ts` 同时支持仓库源码和 CLI 的 `dist/skills/` 发行布局；调整文件位置时需同步检查 CLI 打包和技能安装。技能源码只维护这一份，修改其资源内容会改变安装校验和。
