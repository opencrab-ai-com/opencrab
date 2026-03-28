# System Agent Authoring

更新时间：2026-03-25

这份文档定义 OpenCrab 系统智能体的源码层规范。

这次已经收束到最终形态：

```text
agents-src/system-groups.json
  -> 定义 collection / group 注册表
agents-src/system/<slug>/
  -> agent.yaml + 5 个 section markdown
OpenCrab runtime
  -> 启动时直接读取源码目录并在内存里编译
```

也就是说：

- `agents-src/system` 是唯一事实源
- 不再提交 `config/system-agents/*.json` 这类重复运行时产物
- 修改源码目录后，运行时读取的就是当前源码内容

## 目录约定

系统智能体源码放在：

```text
agents-src/system/<slug>/
  agent.yaml
  soul.md
  responsibility.md
  tools.md
  user.md
  knowledge.md
```

系统分组注册表放在：

```text
agents-src/system-groups.json
```

从 `agency-agents` 导入的草稿默认也会写成同样的目录结构。

## 单个 agent 的文件结构

`agent.yaml` 只存元信息。

最小示例：

```yaml
id: "project-manager"
name: "PM-小马哥"
summary: "像创业型总指挥一样抓第一性目标、关键杠杆和执行速度"
roleLabel: "PM"
description: "默认作为 Team Mode 的总协调者，擅长拉高目标并推进节奏"
groupId: "opencrab-core"
availability: "team"
teamRole: "lead"
defaultModel: null
defaultReasoningEffort: null
defaultSandboxMode: "workspace-write"
avatarFileName: "project-manager.png"
promoted: false
starterPrompts:
  - "基于当前目标，用第一性原理帮我判断这轮最该打的点。"
  - "作为 Team PM，帮我把团队重新对齐到最关键的杠杆和最小闭环。"
```

`soul.md / responsibility.md / tools.md / user.md / knowledge.md` 只存该 section 的正文，不再包外层 frontmatter，也不需要再写 `## Soul` 这类总标题。

示例：

```md
### Identity
你是 PM-小马哥。

### Core Temperament
- 目标密度高
- 节奏快
- 方向明确
```

## 必填字段

- `id`
- `name`
- `summary`

## 可选字段

- `groupId`
  推荐必填；指向 [system-groups.json](../../agents-src/system-groups.json) 里的职能组
- `roleLabel`
  默认 `Specialist`
- `description`
  默认回退到 `summary`
- `availability`
  可选 `solo` / `team` / `both`，默认 `both`
- `teamRole`
  可选 `lead` / `research` / `writer` / `specialist`，默认 `specialist`
- `defaultModel`
  默认 `null`
- `defaultReasoningEffort`
  可选 `minimal` / `low` / `medium` / `high` / `xhigh`
- `defaultSandboxMode`
  可选 `read-only` / `workspace-write` / `danger-full-access`，默认 `workspace-write`
- `avatarFileName`
  对应 [public/agent-avatars/system](../../public/agent-avatars/system)
- `promoted`
  默认 `false`
- `starterPrompts`
  字符串数组
- `upstreamAgentName`
  上游角色名称
- `upstreamSourceUrl`
  上游来源地址
- `upstreamLicense`
  上游许可证

## 固定 section 文件

每个系统智能体必须且只能包含这 5 个 section 文件：

- `soul.md`
- `responsibility.md`
- `tools.md`
- `user.md`
- `knowledge.md`

文件内部可以自由使用 `###`、列表、代码块等 Markdown 结构。

运行时会在内存里自动拼接兼容头：

```md
---
agent: "..."
role: "..."
file: "soul.md"
purpose: "..."
---

# Soul
```

作者不需要手写这层包装。

## 分组与集合

OpenCrab 把系统智能体拆成两层：

- `collection`
  角色库层，比如 `OpenCrab Core`、`Agency Agents`
- `group`
  职能层，比如 `工程 Engineering`、`产品 Product`、`设计 Design`

其中：

- `collection` 信息统一定义在 [system-groups.json](../../agents-src/system-groups.json)
- 单个 agent 只写 `groupId`
- 运行时会自动把 `groupLabel / groupDescription / collectionLabel / collectionDescription` 灌进系统 agent 元数据

## 命令

校验系统智能体源码目录：

```bash
npm run check:system-agents
```

导入一个 `agency-agents` 单文件 Markdown：

```bash
npm run import:agency-agent -- \
  --input https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-frontend-developer.md
```

导入后会生成：

```text
agents-src/imports/agency/<slug>/
  agent.yaml
  soul.md
  responsibility.md
  tools.md
  user.md
  knowledge.md
```

如果你要从本地 clone 的 `agency-agents` 仓库批量同步：

```bash
npm run import:agency-catalog -- --source-dir /path/to/agency-agents
```

当前仓库里已经把 `agency-agents` 的 157 个可识别 agent 文件迁成了 OpenCrab 的目录式 system source，并统一归到 `Agency Agents` 集合下的职能分组里。

## agency-agents 映射

导入器当前使用下面这套映射：

- `Identity & Memory` / `Critical Rules` / `Personality`
  -> `soul.md`
- `Core Mission` / `Success Metrics`
  -> `responsibility.md`
- `Workflow Process` / `External Services`
  -> `tools.md`
- `Communication Style`
  -> `user.md`
- `Technical Deliverables` / `Learning & Memory` / `Advanced Capabilities` / 其他未识别章节
  -> `knowledge.md`

这一步是“结构迁移”，不是“产品化完成”。

导入后的草稿通常还要继续做三件事：

- 压缩冗长示例，避免上下文过重
- 改写成 OpenCrab 的角色语境，而不是照搬上游措辞
- 决定它应该进 `system`、`imports`，还是未来的 pack 体系
