# opencrab

`opencrab` 是一个面向普通用户的开源 Web 助手产品。

产品目标：
- 基于 Codex SDK 构建
- 以中文为主
- 交互体验尽量简单，参考 ChatGPT Web
- 聚焦稳定提供对话、Channels、定时任务、Skills 等核心能力

当前仓库已经完成了第一版 Web 骨架，并已接入 Codex SDK 的基础对话链路。

本地启动：
- `npm install`
- 先执行 `codex login`
- 参考 [`.env.example`](/Users/sky/SkyProjects/opencrab/.env.example) 配置环境变量
- `npm run dev`

Codex SDK：
- [Codex SDK 接入说明](./docs/codex-sdk-integration.md)

产品规划文档：
- [V1 产品规划](./docs/v1-product-plan.md)
- [V1 核心对象与数据模型草案](./docs/v1-core-objects-and-data-model.md)
- [V1 前端视角的数据视图模型](./docs/v1-frontend-view-models.md)
- [V1 API 资源设计草案](./docs/v1-api-resource-design.md)
- [V1 初版路由结构](./docs/v1-route-structure.md)
- [V1 前端工程初始化方案](./docs/v1-frontend-engineering-bootstrap.md)
