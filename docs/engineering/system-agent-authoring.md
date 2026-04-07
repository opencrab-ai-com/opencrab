# System Agent Authoring

更新时间：2026-04-07

这份文档定义 OpenCrab V2 的系统智能体源码规范。

V2 的核心原则只有两条：

- `system agents` 只保留 10 个核心岗位
- 每个 agent 都必须是“岗位合同 + 运行时说明”，而不是泛化人设

## 目录约定

系统智能体源码放在：

```text
agents-src/system/<slug>/
  agent.yaml
  identity.md
  contract.md
  execution.md
  quality.md
  handoff.md
```

系统岗位家族注册表放在：

```text
agents-src/system-groups.json
```

当前只允许使用 `families` 注册表，不再维护旧的扩展角色库产品概念。

## 当前仅保留的 10 个系统智能体

- `project-manager`
- `product-manager`
- `ui-designer`
- `frontend-engineer`
- `backend-engineer`
- `ios-engineer`
- `content-operator`
- `growth-operator`
- `hr-manager`
- `support-specialist`

其他历史 system agents 已从源码目录移除；如需回溯，请查看 git 历史。

## agent.yaml

`agent.yaml` 存结构化岗位合同。

最小示例：

```yaml
id: "frontend-engineer"
name: "前端开发"
summary: "负责把界面需求交付成可运行、可验证的前端实现。"
roleLabel: "FE"
description: "在职责范围内对实现、验证结果和风险说明负责。"
familyId: "engineering"
availability: "both"
teamRole: "specialist"
defaultModel: null
defaultReasoningEffort: null
defaultSandboxMode: "workspace-write"
avatarFileName: null
promoted: true
ownedOutcomes:
  - "前端页面与交互实现"
deliverables:
  - "代码改动"
  - "验证结果"
qualityGates:
  - "关键路径已验证"
handoffTargets:
  - "product-manager"
  - "ui-designer"
starterPrompts:
  - "直接把这个前端任务做到可交付，并附验证结果。"
```

## 必填字段

- `id`
- `name`
- `summary`
- `familyId`

## 推荐字段

- `roleLabel`
- `description`
- `availability`
- `teamRole`
- `defaultSandboxMode`
- `promoted`
- `ownedOutcomes`
- `deliverables`
- `qualityGates`
- `handoffTargets`
- `starterPrompts`

## 六类关键合同字段

这些字段决定一个 agent 是否真的是“岗位产品”：

- `ownedOutcomes`
  该岗位对什么结果负责
- `outOfScope`
  哪些事情明确不归这个岗位负责
- `deliverables`
  默认交付物；当前支持字符串数组，运行时会规范化
- `defaultSkillIds`
  该岗位默认挂载的能力
- `qualityGates`
  交付前必须满足的完成条件
- `handoffTargets`
  超出职责边界时优先交接给谁

## 五个 markdown 文件

每个系统智能体必须且只能包含下面 5 个源码文件：

- `identity.md`
- `contract.md`
- `execution.md`
- `quality.md`
- `handoff.md`

各自职责如下：

- `identity.md`
  角色定位、判断风格、沟通姿态
- `contract.md`
  负责什么、不负责什么、默认交付物
- `execution.md`
  默认工作流、工具优先级、执行要求
- `quality.md`
  完成定义、质量门、禁止事项
- `handoff.md`
  何时转交、交接要求、边界规则

运行时仍会把这 5 个文件编译到兼容的 agent prompt sections 中，但作者不需要关心兼容层。

## 岗位家族

当前允许的岗位家族定义在 `agents-src/system-groups.json`：

- `strategy-delivery`
- `design`
- `engineering`
- `growth-operations`
- `people-support`

## 命令

校验系统智能体源码目录：

```bash
npm run check:system-agents
```

## 迁移说明

OpenCrab 不再把从上游仓库批量导入的大量角色当作正式 system agents。

V2 的产品定义是：

- 前台只展示 10 个核心岗位
- 每个岗位必须能在职责范围内形成可直接交付的结果
- `skills` 是岗位的执行能力，不再是 system agent 产品定义的核心
