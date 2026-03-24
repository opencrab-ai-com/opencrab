# OpenCrab Docs

更新时间：2026-03-23

这份索引用于回答一个很实际的问题：

`后续协作时，应该先去哪里找文档？`

目标是把文档按“产品 / 工程 / Team / 博客”分层，减少在 `docs/` 根目录里来回翻找的成本。

## 目录结构

```text
docs/
  README.md
  blogs/
  engineering/
  product/
  screenshots/
  team/
```

## 快速导航

### 想理解 OpenCrab 是什么产品

- [产品定位](/Users/sky/SkyProjects/opencrab/docs/product/product-positioning.md)
- [产品范围](/Users/sky/SkyProjects/opencrab/docs/product/product-scope.md)

### 想看工程实现与运行边界

- [Architecture](/Users/sky/SkyProjects/opencrab/docs/engineering/architecture.md)
- [Development Guide](/Users/sky/SkyProjects/opencrab/docs/engineering/development.md)
- [隐私与数据边界](/Users/sky/SkyProjects/opencrab/docs/engineering/privacy-and-data.md)
- [运维与排障](/Users/sky/SkyProjects/opencrab/docs/engineering/operations.md)
- [Startup Behavior](/Users/sky/SkyProjects/opencrab/docs/engineering/startup-behavior.md)
- [System Agent Authoring](/Users/sky/SkyProjects/opencrab/docs/engineering/system-agent-authoring.md)
- [Codex Integration](/Users/sky/SkyProjects/opencrab/docs/engineering/codex-sdk-integration.md)
- [Codex Harness Feasibility](/Users/sky/SkyProjects/opencrab/docs/engineering/codex-harness-feasibility.md)

### 想看 Team Mode 与多 Agent 路线

- [OpenCrab Team Mode 详细执行计划](/Users/sky/SkyProjects/opencrab/docs/team/team-mode-execution-plan.md)
- [OpenCrab Team Runtime 设计方案](/Users/sky/SkyProjects/opencrab/docs/team/multi-agent-design.md)
- [OpenCrab Team Runtime 调研补充](/Users/sky/SkyProjects/opencrab/docs/team/multi-agent-research.md)
- [OpenCrab Team OS 设计稿](/Users/sky/SkyProjects/opencrab/docs/team/team-os-design.md)
- [OpenCrab Task Graph 设计稿](/Users/sky/SkyProjects/opencrab/docs/team/task-graph-design.md)
- [OpenCrab Learning Loop 设计稿](/Users/sky/SkyProjects/opencrab/docs/team/learning-loop-design.md)

### 想看路线判断和技术博客

- [OpenCrab 不做 Subagents，而是要走向比 Agent Teams 更像真实团队的模式](/Users/sky/SkyProjects/opencrab/docs/blogs/opencrab-beyond-agent-teams.md)
- [OpenCrab 对 gstack 的调研：它不是一个技能仓库，而是一套 AI 软件工厂运行时](/Users/sky/SkyProjects/opencrab/docs/blogs/opencrab-gstack-research.md)
- [OpenCrab 的系统 Agents 构建策略：从 6 个角色到一个可生长的角色库](/Users/sky/SkyProjects/opencrab/docs/blogs/opencrab-system-agents-build-strategy.md)

## 归档约定

- `product/`
  产品定位、范围、体验策略、信息架构
- `engineering/`
  架构、开发、运维、隐私、集成、运行机制
- `team/`
  Team Mode、Team OS、任务图、治理、记忆、学习
- `blogs/`
  判断性长文、技术博客、路线思考

如果一篇文档跨多个主题，优先放到“主要服务决策的那一层”。
