# OpenCrab 多 Agent / Agent Team 调研

日期：2026-03-20
状态：调研草案

## 一句话结论

OpenCrab 适合做多 Agent，但不适合做成“工作流搭建器”或“开发者编排面板”。更合适的方向是：

- 保持聊天仍然是主入口
- 在聊天之上增加 `项目 / 团队模式`
- 让多个 Agent 在后台协作，但默认把内部沟通折叠起来
- 基于当前 `@openai/codex-sdk` 路线，自行实现 orchestration，而不是等待 Codex SDK 原生提供 team runtime

真正的难点不是“能不能让多个 Agent 说话”，而是：

- 怎么不把 UI 做乱
- 怎么让用户信任“为什么是这个 Agent 做了这件事”
- 怎么控制并发、成本、停机恢复和权限边界

## 0. 先看产品层面的核心判断

如果只从“产品长什么样”来看，市面上的多 Agent 其实主要分成 5 种形态：

### 0.1 形态 A：一个主助手，背后偷偷调多个 Agent

代表：

- Claude Cowork
- Claude Code Subagents

用户感知：

- 用户面对的还是“一个 Claude”
- 多 Agent 是后台实现，不是前台主角

优点：

- 最容易理解
- 最不吵
- 最适合普通用户

缺点：

- 团队感弱
- 内部协作不够可见

### 0.2 形态 B：一个异步 Agent 在外部协作工具里持续工作

代表：

- Devin
- Cursor Background Agents

用户感知：

- Agent 像一个长期运行的 teammate
- 在 Slack、GitHub、PR、线程里持续汇报、追问、交付

优点：

- 非常贴近真实工作流
- 异步感强
- 状态和进度比较自然

缺点：

- 更像“一个强代理”而不是“一个团队”
- 团队协作感通常不体现在 UI 上

### 0.3 形态 C：多个 agent 并行处理大批量相似任务

代表：

- Manus Wide Research

用户感知：

- 用户不是在“带团队开会”
- 而是在“一次性发动很多 worker 去分头处理”

优点：

- 在调研、比对、批处理类任务上非常强

缺点：

- 不适合作为默认聊天形态
- 不太有“协作团队”的情绪价值

### 0.4 形态 D：多 Agent 本质是多路由、多身份、多隔离

代表：

- OpenClaw

用户感知：

- 更像“一个 Gateway 里跑多个 brain”
- 而不是“一个项目团队一起讨论”

优点：

- 隔离清楚
- 身份、权限、会话边界明确

缺点：

- 更偏系统能力
- 不天然是一个好懂的消费级产品体验

### 0.5 形态 E：图编排 / Crew / Workflow Builder

代表：

- CrewAI
- LangGraph
- ADK
- Dify

用户感知：

- 用户在搭工作流、图、节点、路由

优点：

- 灵活
- 可控
- 适合专业用户和平台型产品

缺点：

- 普通用户门槛高
- 很容易把产品重心从“做事”带偏到“配流程”

## 0.6 OpenCrab 最适合哪一种

最适合的是混合型：

- 前台采用 A：用户感觉是在和“一个团队”对话，而不是点工作流
- 运行态借鉴 B：团队 run 是异步的、可持续追问和汇报的
- 特定任务借鉴 C：需要时支持并行 fan-out
- 底层隔离借鉴 D：每个 Agent 独立线程、权限、上下文

最不适合直接照搬的是 E。

OpenCrab 一旦把产品表面做成 builder-first，就会和当前“聊天主入口、普通用户可上手”的定位冲突。

## 0.7 产品对比总表

| 产品 / 路线 | 用户看到的是什么 | 主要入口 | 多 Agent 是否显性 | 产品强项 | 产品弱点 | 对 OpenCrab 的借鉴价值 |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Cowork | 一个能做事的桌面助手 | Claude Desktop | 弱显性，更多在后台 | 对普通用户友好，强调权限和审批 | 团队感较弱，协作过程不够可见 | 很高，适合学“表达方式” |
| Claude Code Subagents | 一个主助手 + 专家助手 | CLI / IDE | 中等，偏专业用户 | 独立上下文、独立工具权限、自动委派 | 过于 developer-oriented | 很高，适合学“角色与上下文隔离” |
| Devin | 一个长期在线 teammate | Slack / Web / GitHub | 弱显性，更多是一条运行线程 | 异步持续协作、状态反馈自然 | 不是团队产品心智 | 很高，适合学“线程式 run 体验” |
| Cursor Background Agents | 一个可在后台跑的远程 agent | IDE / GitHub | 弱显性 | 异步、可 follow-up、可接管、和开发工具结合强 | 主要适用于工程场景 | 中高，适合学“后台 run 交互” |
| Manus Wide Research | 一批并行 worker | Chat / Research task | 强显性，但偏 batch | 大规模并行很强 | 不适合作为默认会话形态 | 中高，适合学“并行模板” |
| OpenClaw | 多个隔离 brain / 路由系统 | Gateway / Channels | 中等，但偏系统层 | agent 身份、权限、会话边界极清楚 | 前台产品心智弱 | 很高，适合学“隔离与路由” |
| CrewAI / LangGraph / ADK | 工作流 / 图 / crew | Builder / Code | 强显性 | 可控、灵活、可扩展 | 不像普通用户产品 | 中等，适合学后端，不适合学前台 |

## 0.8 如果只看产品体验，OpenCrab 最该避免什么

### 不要变成“看起来很强，其实很累”的群聊

如果 5 个 Agent 在主窗口里轮流刷屏，用户很快就会疲劳。

### 不要变成“配置比使用还复杂”

用户不是来学 orchestration 名词的，是来把事做完的。

### 不要让“多 Agent”只变成营销标签

如果本质只是线性流水线，就不要把它包装成团队。

### 不要让自治感超过信任感

越是多个 Agent 自发沟通，越要给用户明确的状态、预算、审批点和停止点。

## 1. 这次重点看了哪些类型的产品

这次我不只看 Agent 框架，也看了真实产品形态。可以分成三类：

### 1.1 框架 / SDK 型

- OpenAI Agents SDK
- CrewAI
- LangGraph Supervisor
- Google ADK

它们更适合借鉴“后端编排模型”和“抽象能力”。

### 1.2 IDE / Coding Agent 型

- Claude Code Subagents
- Cursor Background Agents / Bugbot
- Devin
- OpenClaw

它们更适合借鉴“多 Agent 如何进入实际工作流”“如何和线程、PR、Slack、GitHub、会话状态结合”。

### 1.3 非编程知识工作型

- Claude Cowork
- Manus Wide Research

它们更适合借鉴“非技术用户如何理解 agent team”“如何把并行执行包装成自然语言交互”。

## 2. 值得重点参考的产品

## 2.1 Claude Cowork

### 它是什么

Claude Cowork 是 Anthropic 在 Claude Desktop 里做的研究预览，定位不是“回答问题”，而是“替你把事情做完”。官方描述很明确：从 Chat 到 Code，再到 Cowork，目标是把 Claude Code 的执行能力带给非程序员知识工作者。

从官方页面能确认到的关键点：

- 面向知识工作，不要求终端
- 能处理多步骤任务
- 背后会协调多个 sub-agents 和工具调用
- 默认强调人仍然在控制中
- 会话历史保存在本地设备，不是 Anthropic 服务器
- 当前还是 research preview，且安全机制仍在演进

### 值得 OpenCrab 学的

- 产品语言非常好：不是“多 Agent”，而是“Claude 不只是回答，而是和你一起把工作做掉”
- 它把 agent 能力包装成普通用户能理解的“桌面协作”
- 它非常强调“先给权限、再看计划、再批准关键动作”
- 它把“能执行”放在前面，而不是把“编排结构”放在前面

### 不该照搬的

- Cowork 现在更像“一个主 Agent 背后调度 sub-agents”，而不是用户可见的团队聊天室
- 它当前没有成熟的跨会话 Projects / Memory / Artifacts
- 对团队/企业来说，官方自己也承认审计、导出、合规捕获还不完整

### 对 OpenCrab 的启发

如果 OpenCrab 要面向普通用户做多 Agent，最好学 Cowork 的“产品表达方式”，不要学工程术语。

用户更容易理解的是：

- “我建了一个小组帮我做这件事”
- 而不是“我配置了 supervisor + handoff + subagent graph”

参考：

- [Anthropic Webinar: Introducing Cowork](https://www.anthropic.com/webinars/future-of-ai-at-work-introducing-cowork)
- [Claude Cowork product page](https://claude.com/product/cowork)

## 2.2 Claude Code Subagents

### 它是什么

Claude Code 已经把“子 Agent 委派”做成了一个非常实用的 coding 产品能力。官方文档明确写了：

- subagent 有单独的上下文窗口
- 可以配置单独的工具权限
- 可以自动委派，也可以显式点名调用
- project 级和 user 级都能配置

### 值得 OpenCrab 学的

- “单独上下文窗口”是非常重要的设计，能避免主线程被污染
- “按角色限制工具权限”非常关键，这会直接影响安全性和可解释性
- 自动委派和显式调用可以同时存在
- project-scope 和 user-scope 的 agent 配置分层很合理

### 不该照搬的

- Claude Code 的 subagent 主要还是围绕 coding workflow 设计
- 它默认交互还是命令式和专业用户导向
- 对普通用户来说，直接暴露 subagent 文件和工具白名单会太硬核

### 对 OpenCrab 的启发

OpenCrab 很适合借鉴它的底层模型：

- 一个项目房间里有多个专长 Agent
- 每个 Agent 有自己的 context、权限、工具集
- 主房间不一定展示全部内部上下文

但前台 UI 应该继续用“角色卡片 / 团队成员”的说法，而不是“subagent markdown config”。

参考：

- [Claude Code subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [Claude Code common workflows](https://docs.anthropic.com/en/docs/claude-code/common-workflows)

## 2.3 OpenClaw

### 它是什么

OpenClaw 当前文档里把“多 Agent”首先定义成“多隔离脑 + 多路由”，而不是“一个群聊里大家自由合作”。

官方文档强调的重点是：

- 每个 agent 都有独立 workspace
- 每个 agent 都有独立 `agentDir`
- 每个 agent 都有独立 session store
- 每个 agent 都有独立 auth profile
- 不同 channel / account / peer 的消息可以 deterministic routing 到不同 agent
- agent-to-agent messaging 默认是关闭的，需要显式开启
- 每个 agent 可以单独配置 sandbox 和 tool restrictions

### 值得 OpenCrab 学的

- 多 Agent 的第一原则不是“会说话”，而是“隔离”
- 每个 Agent 的身份、权限、会话、技能、工作区边界要先分清
- 消息路由规则最好 deterministic，而不是每次都让模型自由猜
- agent-to-agent 默认关闭是非常成熟的保守设计

### 不该照搬的

- OpenClaw 的多 Agent 更偏“多人格 / 多账号 / 多路由入口”，并不等于真正的协作团队产品
- 它的很多能力对普通用户来说太偏 infra / gateway / channel binding
- 它会让产品更像一个 agent runtime，而不是一个好用的工作台

### 对 OpenCrab 的启发

OpenCrab 最应该借鉴 OpenClaw 的，不是前台产品形态，而是以下三件事：

1. 每个 Agent 独立线程、独立权限、独立会话目录
2. agent-to-agent 通信必须可控，而且默认保守
3. routing 和 collaboration 是两回事，不能混为一谈

这点很关键。OpenClaw 告诉我们：

- “多 Agent 路由”不是“多 Agent 协作”
- “多个入口分别到不同 agent”也不是“一个团队一起完成一件事”

OpenCrab 真正要做的是后者。

参考：

- [OpenClaw Multi-Agent Routing](https://openclawlab.com/en/docs/concepts/multi-agent/)

## 2.4 Cursor Background Agents / Bugbot

### 它是什么

Cursor 这条线最值得看的是“异步 Agent 工作流”：

- Background Agent 可以从 GitHub / Slack 等入口被触发
- Agent 在后台运行，产出 PR 或结果
- Bugbot 做 PR review，再进一步可触发修复
- Slack 里可以 follow-up、删除、查看 request id、接管

### 值得 OpenCrab 学的

- 很多真实协作不是在主聊天窗口里完成的，而是在 GitHub / Slack / PR 线程里被唤起
- Agent 最好有“状态可见性”，比如运行中、等待你、完成、失败
- follow-up 很重要，用户不一定重新开一个新 run，而是补一句要求
- request id / verbose logs / status checks 很适合做问题排查

### 不该照搬的

- Cursor 的核心语境还是工程团队和代码仓库
- 它更像“把 agent 嵌进已有开发协作工具”，不是做一个多 Agent 群聊产品

### 对 OpenCrab 的启发

OpenCrab 已经有 `Channels`、`Tasks`、`Conversations`。这反而是很大的优势。你不应该只做网页里的团队聊天，而应该支持：

- Telegram / 飞书 / Slack 式入口触发团队
- 定时任务触发团队 run
- 当前对话升级为 team mode

换句话说，OpenCrab 应该像 Cursor 一样，把 Agent Team 当作“可被外部入口唤醒的后台执行单元”。

参考：

- [Cursor GitHub integration for Background Agents](https://docs.cursor.com/en/github)
- [Cursor Slack integration](https://docs.cursor.com/pt-BR/slack)
- [Cursor Bugbot](https://docs.cursor.com/en/bugbot)

## 2.5 Devin

### 它是什么

Devin 已经把“Agent 在 Slack 线程里工作、追问、汇报、等待你”的产品动作做得非常明确。官方文档里：

- 你可以在 Slack 里直接 `@Devin`
- 它会在同一个 thread 里持续回报进度和提问
- 有 `!ask`、`!deep` 这种不同深度模式
- 最近更新里也一直在补“session 状态可见性”

### 值得 OpenCrab 学的

- 一个 Agent run 不只是开始和结束，中间还有很多“等待用户”“补充上下文”“继续执行”的状态
- 在原上下文 thread 里持续追踪 run 非常重要
- 快速问答和完整 agent run 可以分层

### 不该照搬的

- Devin 的产品仍然偏软件工程和公司协作语境
- 它强调的是一个强 Agent 生命周期，而不一定是多个 Agent 群体协作的可视化

### 对 OpenCrab 的启发

OpenCrab 未来的 team run 很适合借鉴 Devin 的 thread 模型：

- 一个 team run 不是一次性 output
- 它应该能回来追问、更新状态、继续执行
- 用户应该能在原线程里 `继续说一句`，而不是每次重新发起

参考：

- [Devin Slack integration](https://docs.devin.ai/Integrations/slack)
- [Devin recent updates](https://docs.devin.ai/release-notes/overview)

## 2.6 Manus Wide Research

### 它是什么

Manus 的 `Wide Research` 不是“群聊式多 Agent”，而是“海量并行 agent 分治”。官方文档写得非常直白：

- 这是一个 parallel multi-agent system
- 适合研究很多相似对象
- 每个 agent 拿自己的上下文独立处理
- 能扩到数十、数百个并行单元

### 值得 OpenCrab 学的

- 并行多 Agent 最有价值的场景，往往不是自由讨论，而是大规模 fan-out
- 每个 agent 独立 context 很关键
- 面向“20 个公司 / 100 个商品 / 50 份简历”的批量处理，是多 Agent 很强的用武之地

### 不该照搬的

- 这种模式不适合作为默认交互
- 如果把所有任务都包装成并行 worker，会失去“团队协作感”

### 对 OpenCrab 的启发

OpenCrab 可以把并行多 Agent 作为某些任务模式，而不是默认会话模式：

- 批量竞品调研
- 多文章摘要比较
- 多渠道数据收集
- 多候选方案生成后再汇总

这很适合作为未来 Team Mode 里的一个运行模板。

参考：

- [Manus Wide Research](https://manus.im/docs/features/wide-research)

## 2.7 OpenAI Agents SDK

### 它是什么

OpenAI Agents SDK 是目前最清晰的官方多 Agent 概念模型之一，明确支持：

- agents
- tools
- handoffs
- code-driven orchestration
- multi-agent orchestration

### 值得 OpenCrab 学的

- handoff 是一等概念
- orchestration 可以是模型驱动，也可以是代码驱动
- “agents as tools” 很适合把 specialist 封装起来
- tracing / observability 思维很成熟

### 不该照搬的

- 不要把 SDK 概念直接暴露给普通用户
- 不要把前台做成“低代码搭建 agent graph”

### 对 OpenCrab 的启发

它最适合作为 OpenCrab orchestration 层的概念参照，不适合作为前端产品表达。

参考：

- [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/)
- [OpenAI multi-agent guide](https://openai.github.io/openai-agents-js/guides/multi-agent/)

## 2.8 CrewAI / LangGraph / Google ADK

这三类框架的价值主要是“后端设计模式”，不是产品界面。

### CrewAI 值得借鉴

- manager + specialist 结构
- crew 和 flow 的分层
- memory / metrics / process 是显式能力

### LangGraph 值得借鉴

- supervisor 模式
- full history / last message 的 history policy
- 多层团队与 human-in-the-loop

### Google ADK 值得借鉴

- sequential / parallel / loop / hierarchy 的模式清晰
- workflow agents 和 llm agents 的边界明确

### 共同不该照搬

- 不要把前台做成图编排
- 不要让普通用户先学习节点和路由概念

参考：

- [CrewAI docs](https://docs.crewai.com/en/concepts/crews)
- [LangGraph Supervisor](https://langchain-ai.github.io/langgraphjs/reference/modules/langgraph-supervisor.html)
- [Google ADK multi-agent](https://google.github.io/adk-docs/agents/multi-agents/)

## 3. 哪些产品不应该学

不是说这些产品不好，而是它们不适合 OpenCrab 当前定位。

### 3.1 不要学成“Builder First”

典型风险：

- 用户一上来先配置 agent、节点、连接器、工作流
- 真正做事前先学术语
- 对普通用户门槛太高

OpenCrab 当前优势恰恰是：

- 聊天主入口
- 配置低频
- 中文普通用户也能上手

所以如果多 Agent 一来就把产品推向 workflow builder，反而会把现在积累的优势破坏掉。

### 3.2 不要学成“伪多 Agent”

很多产品把线性流水线包装成“agent team”。这类做法的问题是：

- 用户以为多个 agent 在协作，实际上只是串行 prompt 链
- 很难解释失败原因
- 群聊界面一旦暴露内部过程会显得很假

OpenCrab 如果做多 Agent，至少要做到下面三点中的两点：

- 真正独立上下文
- 独立权限或独立工具集
- 明确 delegation / parallel / review 行为

### 3.3 不要学成“无限自治”

让 agent 自发互相沟通是对的，但必须有边界。不能做成：

- 无限轮对话
- 无限并发
- 不设预算
- 自动跨权限执行

多 Agent 产品一旦缺少 cap，会立刻从“聪明”变成“吓人”。

## 4. OpenCrab 当前产品会和多 Agent 冲突在哪里

当前仓库的主链路还是单线程单助手模型，具体冲突点很明确：

- `ConversationItem` 只有一个 `codexThreadId`
- `ConversationMessage` 只有 `user | assistant` 两类角色
- 当前线程视图默认把 assistant 统一显示成 `OpenCrab`
- 当前 streaming 状态管理默认一条 conversation 只有一个 active assistant stream
- 当前 composer 的模型 / 推理强度是 conversation 级，不是 agent 级

对应代码位置：

- [lib/seed-data.ts](../lib/seed-data.ts#L19)
- [lib/codex/sdk.ts](../lib/codex/sdk.ts#L71)
- [components/conversation/conversation-thread.tsx](../components/conversation/conversation-thread.tsx#L91)
- [components/app-shell/opencrab-provider.tsx](../components/app-shell/opencrab-provider.tsx#L880)

这说明多 Agent 不是一个小功能，而是一个新的数据模型层。

## 5. 产品交互要不要大改

要改，但不应该推翻重来。

最合理的方案是“双模式”：

- 普通对话模式：保留今天的单助手对话
- 项目 / 团队模式：一个项目房间里有多个 Agent 协作

### 推荐的交互结构

一个项目房间建议至少有这几个区域：

- 顶部：项目目标、当前状态、预算 / 权限摘要
- 左侧或右侧：Agent roster，展示每个 Agent 的角色、权限、模型、职责
- 中间：用户可见主对话
- 折叠面板：backstage 内部协作流
- 底部：继续提要求、停止、继续运行、批准关键步骤
- 辅助区域：Artifacts，沉淀计划、文档、研究结果、草稿

### 最重要的交互原则

- 用户对“团队”发话，不要逼他手动管每次 handoff
- 但用户随时能看见“谁做了什么、为什么这么做”

换句话说：

- 前台要像一个团队
- 后台要像一个可审计的 orchestrator

## 6. 技术上 Codex SDK 现在支不支持多 Agent

结论：不原生支持 OpenCrab 需要的那种 team runtime。

我直接检查了你仓库里当前安装的包：

- `@openai/codex-sdk` 版本是 `0.114.0`
- 主要原语仍然是 `startThread()` 和 `resumeThread()`
- 它提供 thread 级别的 run / runStreamed
- 但没有内置的 team、agent registry、handoff runtime、group orchestration 抽象

所以现在如果 OpenCrab 要做多 Agent，最现实的路线是：

- OpenCrab 自己做 orchestrator
- 每个 Agent 绑定一个独立 Codex thread
- OpenCrab 负责决定谁接下一棒、把哪些上下文发给谁、哪些消息展示给用户

当前这条结论对应你仓库里的实现：

- [lib/codex/sdk.ts](../lib/codex/sdk.ts#L87)
- [node_modules/@openai/codex-sdk/README.md](../node_modules/@openai/codex-sdk/README.md)

## 7. 那 OpenAI 有没有别的多 Agent 路线

有，但和你现在这条集成路线不是一回事。

OpenAI Agents SDK 确实支持多 Agent orchestration，但：

- 它不是你当前 OpenCrab 的主接入层
- 你现在网页产品依赖的是 `Codex SDK + ChatGPT 登录`
- Agents SDK 那一套更像是未来扩展路线，而不是当前直接替换路线

所以对 OpenCrab 来说：

- 近中期最可行：自己在 OpenCrab 里实现 team orchestration
- 长期可评估：是否把某些 team runtime 抽到 Agents SDK 风格能力上

## 8. 推荐的技术架构

### 8.1 MVP 级推荐架构

建议模型：

- 一个 `ProjectRoom`
- 多个 `AgentProfile`
- 每个 `AgentProfile` 一个独立 `codexThreadId`
- 一个 OpenCrab orchestrator
- 一套协调事件流 `CoordinationEvent`

### 8.2 最好拆出来的新实体

- `ProjectRoom`
- `AgentProfile`
- `ProjectAgentMembership`
- `AgentRun`
- `CoordinationEvent`
- `Artifact`
- `ApprovalRequest`
- `RunBudget`

### 8.3 编排层需要支持的行为

- sequential delegation
- parallel fan-out / gather
- reviewer / critic loop
- pause / resume / retry / cancel
- timeout / max-turn / max-cost cap
- 人工审批点

### 8.4 上下文层需要分开

- 项目共享 brief
- 每个 Agent 的工作记忆
- 用户可见摘要层
- backstage 协调层
- artifacts 层

如果这些混在一个 transcript 里，后面一定会炸。

## 9. 主要风险

### 9.1 产品风险

- UI 变吵
- 用户搞不清到底谁在做事
- team chat 看起来像演戏
- 自动协作让用户产生不安全感

### 9.2 技术风险

- agent 互相拉扯形成死循环
- parallel run 引发状态竞争
- token / 时间 / 成本失控
- 停止、重试、恢复行为不一致
- 崩溃重启后 run 状态不一致

### 9.3 安全风险

- 高权限 agent 被低质量 delegation 拖着跑
- 自动后台运行超出用户预期
- 渠道 / 任务触发团队时越权

### 9.4 解决思路

- 默认保守：agent-to-agent 不要无限开放
- 明确预算：轮数、并发数、时长、成本
- 关键动作必须 approval
- 每次 delegation / artifact 写入 / 工具调用都要可审计
- 每个 Agent 权限和工具集独立配置

## 10. OpenCrab 最值得创新的地方

## 10.1 Frontstage / Backstage 双层会话

这是最值得做成产品特色的一点。

大多数产品只有两种极端：

- 全隐藏，看不见 agent 内部过程
- 全暴露，变得极其吵

OpenCrab 完全可以做：

- Frontstage：用户可见主房间，只展示必要结果、问题、结论
- Backstage：可展开查看内部协作、delegation、review、parallel runs

这会比简单的“群聊里 5 个 agent 疯狂刷屏”高级得多。

## 10.2 Chat-Native Team Setup

不要让用户先点 20 个配置项。可以直接支持：

`帮我建一个产品研究小组：1 个 PM、1 个 竞品分析师、1 个 文案，围绕这个项目长期协作。`

系统把它转换成：

- 团队成员
- 各自职责
- 默认权限
- 推荐工具
- 默认协作模式

这样比 builder-first 体验自然太多。

## 10.3 Team Runs 接入现有入口

你现在产品里已经有：

- Conversations
- Tasks
- Channels

所以 OpenCrab 的 team mode 最强的地方不应该只是“新页面”，而应该是：

- 从当前对话升级成团队模式
- 定时任务可以唤起一个团队
- 渠道消息可以路由到某个团队

这会比很多从零搭工作流的产品更自然。

## 10.4 Artifact-First Teamwork

多 Agent 的核心产物不应该只有消息。更好的设计是把成果落成 artifact：

- 调研表
- 计划
- 摘要
- PR 草稿
- 回复草稿
- 方案对比

消息只是过程，artifact 才是结果。

## 11. 推荐的 MVP 范围

### 做

- 新增 `项目 / 团队模式`
- 支持 2 到 4 个 Agent
- manager + specialist 模式
- 每个 Agent 独立模型 / 推理强度 / sandbox / tools
- 一个用户可见主房间
- 一个可展开 backstage 面板
- delegation / review / simple parallel 三种基本模式
- 任务触发团队 run

### 先别做

- 无限动态生成 agent
- 复杂图编排 UI
- 跨项目共享记忆图谱
- 多人权限体系
- 完全自治的长期无人值守团队
- 外部协议互通作为 V1 核心

## 12. 如果现在开始做，项目计划怎么排

## Phase 0：产品定义与原型

时间：4 到 7 天

输出：

- 产品术语统一
- team room 线框图
- orchestration 状态机草案

## Phase 1：数据模型与存储层

时间：1 到 2 周

输出：

- `ProjectRoom / AgentProfile / CoordinationEvent` 等新结构
- 一个项目对应多个 thread id
- run 状态持久化

## Phase 2：最小多 Agent Runtime

时间：1 到 2 周

输出：

- manager + specialist
- sequential delegation
- 一个 parallel fan-out 模式
- stop / retry / timeout / cap

## Phase 3：前端 Team Room

时间：1 到 2 周

输出：

- team room 页面
- agent roster
- backstage 活动流
- approvals / status UI

## Phase 4：Tasks / Channels 接入

时间：4 到 7 天

输出：

- task 触发 team run
- channel 路由到 team room
- 后台 run 的展示与回流

## Phase 5：安全与评估

时间：4 到 7 天

输出：

- 审计日志
- 预算控制
- 失败与循环场景回归集

## 13. 最终建议

如果 OpenCrab 做多 Agent，我建议你坚持下面这个原则：

不要做成“一个更复杂的 AI IDE”，而要做成“一个让普通用户也能真正用起来的 AI 团队工作台”。

最合适的路线是：

- 保持聊天主入口
- 增加团队模式，而不是替换所有会话
- 用多线程、多权限、多上下文实现真正协作
- 默认隐藏内部噪音，只在需要时展开
- 通过 Tasks / Channels / Conversations 把团队运行和现有入口打通

如果做对了，OpenCrab 的差异化不会是“我们也支持多 Agent”，而是：

“我们把多 Agent 做成了普通用户也能理解、也愿意信任、也能真正长期使用的产品。”

## 14. 关键来源

外部产品 / 文档：

- [Claude Cowork](https://claude.com/product/cowork)
- [Anthropic Webinar: Introducing Cowork](https://www.anthropic.com/webinars/future-of-ai-at-work-introducing-cowork)
- [Claude Code subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [Claude Code common workflows](https://docs.anthropic.com/en/docs/claude-code/common-workflows)
- [OpenClaw Multi-Agent Routing](https://openclawlab.com/en/docs/concepts/multi-agent/)
- [Cursor GitHub integration](https://docs.cursor.com/en/github)
- [Cursor Slack integration](https://docs.cursor.com/pt-BR/slack)
- [Cursor Bugbot](https://docs.cursor.com/en/bugbot)
- [Devin Slack integration](https://docs.devin.ai/Integrations/slack)
- [Devin recent updates](https://docs.devin.ai/release-notes/overview)
- [Manus Wide Research](https://manus.im/docs/features/wide-research)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/)
- [OpenAI multi-agent guide](https://openai.github.io/openai-agents-js/guides/multi-agent/)
- [CrewAI crews](https://docs.crewai.com/en/concepts/crews)
- [LangGraph Supervisor](https://langchain-ai.github.io/langgraphjs/reference/modules/langgraph-supervisor.html)
- [Google ADK multi-agent](https://google.github.io/adk-docs/agents/multi-agents/)

本仓库内现状代码参考：

- [lib/seed-data.ts](../lib/seed-data.ts)
- [lib/codex/sdk.ts](../lib/codex/sdk.ts)
- [components/conversation/conversation-thread.tsx](../components/conversation/conversation-thread.tsx)
- [components/app-shell/opencrab-provider.tsx](../components/app-shell/opencrab-provider.tsx)
