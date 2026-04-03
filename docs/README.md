# OpenCrab Docs

更新时间：2026-04-02

这份索引用于回答一个很实际的问题：

`后续协作时，应该先去哪里找文档？`

目标是把文档按“产品 / 工程 / 任务 / Team / 博客”分层，减少在 `docs/` 根目录里来回翻找的成本。

## 目录结构

```text
docs/
  README.md
  blogs/
  engineering/
    codex-context-optimization/
  product/
  screenshots/
  tasks/
  team/
```

## 快速导航

### 想理解 OpenCrab 是什么产品

- [产品定位](./product/product-positioning.md)
- [产品范围](./product/product-scope.md)

### 想看工程实现与运行边界

- [从 Git 安装 OpenCrab](./engineering/install-from-git.md)
- [Install OpenCrab From Git](./engineering/install-from-git-en.md)
- [Web / Desktop 双端升级唯一操作指南](./engineering/web-desktop-upgrade-operations-guide.md)
- [Desktop Smoke And Release Checklist](./engineering/desktop-smoke-and-release-checklist.md)
- [Architecture](./engineering/architecture.md)
- [Development Guide](./engineering/development.md)
- [隐私与数据边界](./engineering/privacy-and-data.md)
- [运维与排障](./engineering/operations.md)
- [Startup Behavior](./engineering/startup-behavior.md)
- [System Agent Authoring](./engineering/system-agent-authoring.md)
- [Codex Integration](./engineering/codex-sdk-integration.md)
- [Codex Harness Feasibility](./engineering/codex-harness-feasibility.md)
- [Codex Context Optimization](./engineering/codex-context-optimization/README.md)
- [Prompt And Memory Optimization Backlog](./engineering/codex-context-optimization/optimization-backlog.md)

### 想看定时任务的产品判断与执行设计

- [Scheduled Task Execution Plan](./tasks/scheduled-task-execution-plan.md)

### 想看 Team Mode 与多 Agent 路线

- [OpenCrab Team Mode 详细执行计划](./team/team-mode-execution-plan.md)
- [OpenCrab Team Runtime 设计方案](./team/multi-agent-design.md)
- [OpenCrab Team Runtime 调研补充](./team/multi-agent-research.md)
- [OpenCrab Team OS 设计稿](./team/team-os-design.md)
- [OpenCrab Task Graph 设计稿](./team/task-graph-design.md)
- [OpenCrab Learning Loop 设计稿](./team/learning-loop-design.md)

### 想看路线判断和技术博客

- [OpenCrab 不做 Subagents，而是要走向比 Agent Teams 更像真实团队的模式](./blogs/opencrab-beyond-agent-teams.md)
- [OpenCrab 对 gstack 的调研：它不是一个技能仓库，而是一套 AI 软件工厂运行时](./blogs/opencrab-gstack-research.md)
- [OpenCrab 的系统 Agents 构建策略：从 6 个角色到一个可生长的角色库](./blogs/opencrab-system-agents-build-strategy.md)
- [OpenCrab 对 runtime home 的重新思考：本地优先 AI 工作台，为什么一定要有自己的运行时主目录](./blogs/opencrab-runtime-home-local-first.md)
- [OpenCrab 对浏览器能力的重新思考：它不该只是一次性工具，而应该是一层可复用的 session layer](./blogs/opencrab-browser-session-layer.md)
- [OpenCrab 对多模型支持的判断：这不是多接几个 provider，而是要抽象自己的 agent harness](./blogs/opencrab-agent-harness-not-just-model-switching.md)
- [OpenCrab 要不要自建 Agent Loop / Harness：一轮更完整的开源调研](./blogs/opencrab-open-source-agent-harness-research.md)
- [OpenCrab 对 Team Memory 与 Autonomy Gate 的判断：数字团队不能只有聊天记录](./blogs/opencrab-team-memory-and-autonomy.md)
- [OpenCrab 对 Skills 的重新思考：它不该只是 prompt 碎片，而应该是宿主可治理的能力包](./blogs/opencrab-skills-capability-packages.md)

## 归档约定

- `product/`
  产品定位、范围、体验策略、信息架构
- `engineering/`
  架构、开发、运维、隐私、集成、运行机制
- `team/`
  Team Mode、Team OS、任务图、治理、记忆、学习
- `tasks/`
  定时任务的执行模型、状态流转、界面与运行边界
- `blogs/`
  判断性长文、技术博客、路线思考

如果一篇文档跨多个主题，优先放到“主要服务决策的那一层”。
