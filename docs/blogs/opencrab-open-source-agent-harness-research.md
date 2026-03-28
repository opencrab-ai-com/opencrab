# OpenCrab 要不要自建 Agent Loop / Harness：一轮更完整的开源调研

更新时间：2026-03-28

这篇文章不是某个框架的安利，也不是一份“我们改天再研究”的工具清单。

它想认真回答 4 个问题：

1. 今天开源世界里，围绕 `agent loop / harness` 到底已经做到了什么
2. 哪些项目真正拥有的是 runtime，哪些只是 orchestration SDK，哪些更像 gateway / control plane
3. 对 `OpenCrab` 来说，后续自建 agent loop / harness 是否可行
4. 如果可行，真正难的地方到底在哪里

## 一句话结论

`可行，而且从 OpenCrab 的产品方向看，长期几乎是必经之路。`

但这里说的“自建”，不是明天就把 `Codex` 扔掉，也不是重写一套巨大的 framework。

更准确地说：

- 不要试图复制某一个现成项目
- 也不要把问题理解成“多接几个模型 API”
- 应该逐步拥有 `OpenCrab 自己的 runtime contract`

也就是逐步拥有这些东西：

- run / thread / session 语义
- tool router
- approval / sandbox / policy
- event log / streaming
- context compaction / memory
- recovery / checkpoint
- delivery target
- orchestration mode

换句话说：

`OpenCrab 后面真正要拥有的，不是“更多 provider”，而是“自己的 agent 宿主层”。`

## 一、先把问题说清楚：什么才叫 agent loop / harness

很多讨论里，“agent”被说得太轻了，好像只要：

- 给模型一个 system prompt
- 再加几个 tools
- 最后做一层 function calling

就算拥有了 agent。

这在 demo 阶段也许可行。  
但一旦产品开始承接真实工作，就会立刻暴露出更多层。

我更倾向把 `agent loop / harness` 理解成 9 层东西：

### 1. Prompt Assembly

负责把这些信息拼成每轮真正输入：

- base instructions
- developer constraints
- 用户消息
- 历史上下文
- 附件摘要
- skills / agent profile / team state
- policy / budget / sandbox 约束

### 2. Run / Thread Runtime

负责：

- thread / run / session 的生命周期
- resume / retry / cancel / interrupt
- conversation id 与底层 runtime id 的映射

### 3. Tool Router

负责：

- 命令执行
- 文件修改
- 浏览器 / MCP / 自定义能力
- 工具结果的结构化回填

### 4. Context Management

负责：

- 历史压缩
- 关键约束保留
- token 预算
- session memory 与长期 memory 分层

### 5. Safety / Approval Layer

负责：

- sandbox
- network policy
- allowlist / denylist
- human approval
- 停止条件

### 6. Event Protocol

负责把过程变成产品能消费的事件：

- assistant text
- tool started / completed
- file changed
- approval requested
- turn completed / failed

### 7. Recovery / Durability

负责：

- 进程重启后恢复
- 长任务 checkpoint
- 崩溃 / 超时 /失败后的继续执行

### 8. Orchestration

负责：

- 单 Agent
- manager + specialists
- handoff
- agents-as-tools
- workflow agents

### 9. Evaluation / Observability

负责：

- tracing
- replay
- regression checks
- 不同模型 / 不同 compaction 策略的对比

这 9 层合在一起，才更接近一个真正的 `harness`。

## 二、这一轮调研里，我把开源工作分成了 5 大类

如果把视野只盯在 `Codex` 或者“某个 coding agent”，很容易把问题看窄。

这一轮调研里，真正有参考价值的开源路线，至少分成下面 5 类：

1. `本地 coding-agent runtime`
   代表：`Codex CLI`、`OpenHands`、`Goose`、`Open Interpreter`
2. `durable agent framework`
   代表：`LangGraph`、`AutoGen`
3. `workflow / app-layer orchestration`
   代表：`CrewAI`、`Google ADK`、`OpenAI Agents SDK`
4. `typed tool + durable execution substrate`
   代表：`PydanticAI`、`smolagents`
5. `gateway / ambient assistant runtime`
   代表：`OpenClaw`

这 5 类项目解决的问题不一样。  
真正危险的，不是“不知道它们”，而是把它们误当成同一类东西。

## 三、哪些项目最值得参考，它们真正强在哪一层

下面这张表是这轮调研里最重要的压缩版结论。

| 项目 | 真正强在哪一层 | 最值得借的点 | 不该直接照搬的点 |
| --- | --- | --- | --- |
| `Codex CLI / SDK` | 本地 coding harness | 本地 agent loop、事件协议、线程续接、工具回路、App Server 边界 | 过于绑定 coding 语境；不能直接等于 OpenCrab 的全产品 runtime |
| `OpenHands` | durable coding runtime | append-only 事件流、状态机、sandbox、headless / API 化 | 更偏软件工程 agent，不天然适合渠道 / 任务 / ambient collaboration |
| `LangGraph` | durable execution | checkpoint、持久化、interrupt、time travel、显式状态图 | 它是框架，不是现成产品宿主 |
| `AutoGen` | multi-agent orchestration | event-driven / actor 风格、teams、消息路由 | 很容易退化成“agent 之间一直聊天” |
| `CrewAI` | productized orchestration | `Crews` 与 `Flows` 的分层、把协作与流程拆开 | 更像 builder / workflow 平台，不是本地工作台 runtime |
| `Google ADK` | workflow agents + sessions | `Sequential / Parallel / Loop` 明确化，session / memory / eval 作为正式层 | 更像应用开发 SDK，不是面向普通用户的本地宿主 |
| `OpenAI Agents SDK` | app-layer primitives | agents、tools、handoffs、guardrails、sessions、tracing 的小而稳原语 | 它不是 shell / browser / file host runtime |
| `PydanticAI` | typed agent substrate | tool approval、toolsets、durable execution 接入方式 | 更像可靠执行底座，不是完整产品 runtime |
| `smolagents` | 极简 loop | 用非常少的抽象证明“agent loop 不需要特别重” | 太轻，不足以直接承接工作台产品 |
| `Goose` | 轻量本地 agent | extension 治理、subagents、recipes 的轻委派思路 | 更像开发者 agent，不是 OpenCrab 这种多表面产品 |
| `OpenClaw` | gateway / control plane | channels / cron / queue / ACP / security boundary 一体化 | 强在 ingress/egress，不等于深度 reasoning host |
| `Open Interpreter` | computer-use / local exec | 证明“本地执行”和“桌面能力”可以是一类原生能力 | 在 durability、治理、产品协议上仍然偏轻 |

## 四、逐个看：每一类项目到底说明了什么

## 1. Codex：最像“本地 coding harness”成品的参考

OpenAI 最近把 `Codex CLI` 的很多关键边界都说得更清楚了：

- `Codex CLI` 是开源的
- 本地有真实的 agent loop
- SDK 只是对 CLI 的编程封装
- 还专门推出了 `Codex App Server`，把客户端交互协议稳定下来

这说明了三件事：

1. `agent harness` 不是纯服务端黑盒
2. 本地 runtime 完全可以成为正式产品层
3. 客户端不应该直接缠着模型 API，而应该对着一个稳定的本地 agent server / protocol

对 `OpenCrab` 来说，`Codex` 最重要的启发不是“模型强”，而是：

`真正成熟的 agent 产品，会拥有清晰的 runtime boundary。`

也就是：

- UI 不直接碰模型
- 外部入口不直接碰模型
- 中间一定有一个可恢复、可治理、可观测的宿主层

但 `Codex` 也有明显边界：

- 它首先是 coding agent
- 它的很多默认策略围绕仓库、命令、补丁和浏览器
- 它并不天然等于 `OpenCrab` 未来想要的“任务 + 渠道 + Team Mode + ambient collaboration”一体 runtime

所以：

`Codex 值得学，但不适合被复制成 OpenCrab 的全部答案。`

## 2. OpenHands：最值得借鉴的不是“会写代码”，而是事件与状态

`OpenHands` 很值得研究，因为它不是只做“工具调用”。

它把很多正式 runtime 才会认真处理的问题拉到了台面上：

- append-only event stream
- conversation state architecture
- sandbox / isolation
- headless mode / API 化
- condenser / history compaction

这类设计说明了一件很重要的事：

`一旦 agent 不止跑一个 HTTP 请求，它就必须拥有自己的状态机。`

对 `OpenCrab` 的价值主要有三点：

1. `event log` 应该是一等对象，而不是界面附带产物
2. `sandbox` 不是“安全补丁”，而是 runtime 主结构
3. `history compaction` 不该晚到最后才补

但 `OpenHands` 也有边界：

- 它的主舞台仍然是软件工程
- 它强在仓库工作和 headless automation
- 它并不天然回答 `channel / task / project room / delivery` 这类产品语义

所以对 `OpenCrab` 来说，`OpenHands` 更像：

`要借它的 durable runtime 思路，而不是借它的产品表面。`

## 3. LangGraph：它提醒我们，durability 不是高级功能，而是基础设施

`LangGraph` 的价值非常稳定：

- persistence
- checkpoints
- human-in-the-loop interrupts
- time travel
- 显式 state graph

这套思想很重要，因为它把一个很多团队不愿意正视的问题说透了：

`agent 一旦跨越“单请求回答”，就已经不是普通聊天，而是长事务。`

长事务意味着：

- 中间可能要停
- 可能被打断
- 可能要审批
- 可能几分钟后再继续
- 可能失败后要从节点恢复

这和 `OpenCrab` 后面的产品方向高度相关：

- 定时任务
- Team Mode
- 渠道追问
- 后台自动推进

这些都要求 runtime 拥有 durable execution 能力。

但 `LangGraph` 的边界也很清楚：

- 它提供的是结构化执行框架
- 不是面向普通用户的完整宿主层
- 它不会替你决定产品协议、审批 UX、delivery target 或 memory policy

所以：

`LangGraph 适合借 durability 思想，不适合直接当 OpenCrab 的产品内核。`

## 4. AutoGen：它说明 multi-agent 的核心不是“多人说话”，而是消息系统

`AutoGen` 的长处在于：

- event-driven / actor-like 设计
- teams / group chat
- agent orchestration
- distributed multi-agent thinking

很多人看 `AutoGen`，第一反应是“多 agent 群聊”。  
我反而觉得它更有价值的地方是：

`它逼你承认 multi-agent 的本质更接近消息系统，而不是对话 UI。`

也就是说，真正重要的是：

- 谁向谁发消息
- 谁拥有状态
- 谁负责终止
- 哪个 agent 只是工具，哪个 agent 是正式 participant

这对 `OpenCrab Team Mode` 很关键。  
因为如果不把这件事想明白，Team Mode 很容易退化成：

- 几个角色轮流发言
- 表面上像团队
- 实际上没有真正的 runtime ownership

但 `AutoGen` 也有风险：

`太容易让产品团队过度迷恋“agent 互聊”这个表象。`

而这恰恰是 `OpenCrab` 现在最不该走的路。

## 5. CrewAI：它最有价值的地方，是把“协作”和“流程”拆开

`CrewAI` 的关键词其实不是“多 agent”，而是：

- `Crews`
- `Flows`

这件事非常重要。

因为真实产品里，有两类完全不同的问题：

1. 需要 agent 自主分工和协作
2. 需要业务流程稳定、可预测、可审计

很多系统把这两者混成一个抽象，最后会变得很别扭。

`CrewAI` 至少在概念上把这两者拆开了：

- `Crews` 负责相对自主的协作
- `Flows` 负责确定性的流程

这对 `OpenCrab` 很有借鉴意义。  
未来你一定会同时拥有：

- 直接对话
- Team Mode
- 定时任务
- 审批节点
- 渠道投递

这些东西不可能都塞进一套“自由对话”里。

但 `CrewAI` 的边界也要看清：

- 它更像 orchestration / automation platform
- 更偏 builder / workflow 的产品心智
- 它不是本地优先工作台的最终参考系

## 6. Google ADK：它提醒我们，workflow agents 应该是正式公民

Google ADK 很有价值的一点，是把这些 workflow 型 agent 明确成正式原语：

- `SequentialAgent`
- `ParallelAgent`
- `LoopAgent`

再加上：

- sessions
- memory
- evaluation

这说明业界正在形成一个越来越清楚的判断：

`“自由 agent”与“workflow agent”应该共存，而不是互相替代。`

对 `OpenCrab` 的启发很直接：

- 有些任务适合自由推进
- 有些任务适合 manager 分派
- 有些任务必须走明确步骤
- 有些任务要 loop 到某个条件满足为止

如果后面 `OpenCrab` 只做一类 loop，会很快撞天花板。

## 7. OpenAI Agents SDK：最值得学的是“上层 API 要小”

`OpenAI Agents SDK` 的长处不在于“把一切都包了”，反而在于它没有包太多。

它强调的是几类非常小、非常清楚的上层原语：

- agents
- tools
- handoffs
- guardrails
- sessions
- tracing

这类设计对 `OpenCrab` 很有提醒意义：

`上层 orchestration API 不能设计得过胖。`

如果一开始就把所有产品需求全塞进去，后面一定改不动。  
更好的做法是：

- 底层 runtime contract 足够稳定
- 上层 orchestration primitive 足够少
- 不同产品模式在其上组合

## 8. PydanticAI 与 smolagents：它们证明“轻”和“稳”是两条独立维度

`PydanticAI` 和 `smolagents` 都很值得看，但它们各自强调的点不一样。

`PydanticAI` 的强项是：

- toolsets
- typed outputs
- tool approval
- durable execution 对接 Temporal / DBOS / Prefect

它说明：

`很多时候，真正稀缺的不是“更多 agent 魔法”，而是更可靠的执行底座。`

`smolagents` 的价值则在于：

- 非常小的抽象面
- code-first
- 明确说明多步 agent 不一定需要很重的宿主

它提醒我们：

`不要把 harness 做成一头巨兽。`

但两者共同的边界也很明显：

- 它们都不是 `OpenCrab` 这种工作台产品的完整答案
- 更适合借其一部分思想，而不是整体照搬

## 9. Goose：它告诉我们“轻委派”和“能力治理”也很重要

`Goose` 很适合作为轻量本地 agent 的参考。

它值得看的点包括：

- extensions
- subagents
- recipes / subrecipes

这说明另一条很有价值的设计思路：

`不是所有协作都要升级成 team runtime。`

有一类问题，非常适合：

- 轻量的分工
- 临时子代理
- 小范围能力包

这对 `OpenCrab` 的价值是：

- skills / capability packages
- 某些场景下的临时 specialist
- 不必过早把所有协作都抬高成 Team Mode

## 10. OpenClaw：对 OpenCrab 最重要的启发，不是多 agent，而是 runtime 外围

`OpenClaw` 是这一轮调研里非常关键的参照物。

它最值得借的，不是“它也有多 agent”，而是它把下面这些东西当成 runtime 正式组成部分：

- channels
- cron jobs
- webhooks
- gateway
- queue / lanes
- security boundary
- ACP external agents

这一点非常重要。

因为很多产品到后期才发现：

- 渠道
- 定时任务
- 外部系统触发
- 外部 agent 接入

这些不是“外围插件”，而是宿主层的一部分。

`OpenClaw` 在这里的判断非常成熟：

- ingress / egress 是正式层
- queue 是正式层
- 安全边界是正式层
- 外部 agent protocol 也是正式层

这对 `OpenCrab` 的意义尤其大。  
因为 `OpenCrab` 本来就不只是聊天产品，而是已经同时覆盖：

- 对话
- Channels
- Tasks
- Team Mode

所以：

`OpenClaw 提醒我们的，不是“多接几个 channel”，而是“任务、渠道、外部系统，本来就是 runtime 的一部分”。`

但 `OpenClaw` 也有非常明确的边界：

- 它强在 control plane
- 强在 ingress / routing / security
- 不等于深度 reasoning host
- 它的 multi-agent 更偏 routing / isolation，而不是“团队认知”

这也意味着：

`OpenCrab 不该变成 OpenClaw 的 UI 壳。`

应该借的是：

- gateway thinking
- queue thinking
- delivery thinking
- security boundary thinking

## 11. Open Interpreter：它提醒我们，computer-use 只是更大的 runtime 里的一个能力

`Open Interpreter` 很重要，因为它证明了：

- 本地执行
- 电脑控制
- shell / 桌面 / 文件操作

都可以成为 agent 的原生能力。

但它也提醒了另一件事：

`computer-use 本身不等于 harness。`

如果没有：

- run state
- approvals
- recovery
- durable logs
- delivery targets

那它仍然更像“一个强能力”，而不是“完整宿主”。

## 五、这轮调研最重要的共同结论

如果把所有项目放在一起看，反而会看到几个非常稳定的共识。

## 1. 强系统都拥有“状态”，而不是只拥有 prompt

真正成熟的系统都在认真处理：

- thread
- session
- checkpoint
- event log
- memory

换句话说：

`agent 的核心不是 prompt，而是 state。`

## 2. tool calling 只是起点，真正难的是治理与恢复

大家都能做 tool calling。  
真正拉开差距的是：

- 是否有 approval
- 是否有 sandbox
- 是否可 interrupt
- 是否可 resume
- 是否可 replay

## 3. durable execution 不是高配，而是长任务的最低配置

只要产品里存在：

- Team Mode
- Tasks
- Channels
- 后台推进

那 durability 就不再是“以后再做”的增强项。

## 4. orchestration 与 product surface 必须分开

框架层回答的是：

- 如何组织 agent
- 如何路由工具
- 如何保留状态

产品层回答的是：

- 用户在哪里发起
- 结果回到哪里
- 什么时候通知
- 谁来审批

如果这两层混在一起，系统很快会变得难以演进。

## 5. 没有任何一个开源项目，直接等于 OpenCrab 想做的东西

这是这一轮调研最重要的结论之一。

原因很简单：

- `Codex` 强在 coding harness
- `OpenHands` 强在 durable coding runtime
- `LangGraph` 强在 durability
- `AutoGen` 强在 multi-agent message model
- `CrewAI / ADK / Agents SDK` 强在 orchestration primitives
- `OpenClaw` 强在 gateway / channels / tasks / queue / security

而 `OpenCrab` 想做的是：

- 本地优先
- 面向普通用户
- 不是单纯 coding agent
- 同时有对话、任务、渠道、Team Mode、浏览器、skills

所以：

`OpenCrab 后面一定需要自己的组合方式。`

## 六、回到 OpenCrab：当前其实已经踩在正确抽象上

这也是为什么我判断“自建可行”，而不是空谈。

从当前仓库看，`OpenCrab` 已经有几条很关键的结构：

### 1. 已经有统一 turn 入口

现在网页对话、渠道消息，本质上都在复用同一个 turn 执行入口：

- [runConversationTurn](../../lib/conversations/run-conversation-turn.ts)
- [Codex integration](../../docs/engineering/codex-sdk-integration.md)

这意味着你已经不是“每个入口各做一遍 agent 逻辑”，而是在往宿主层抽象。

### 2. 已经有浏览器 session layer

- [browser-session](../../lib/codex/browser-session.ts)
- [browser-session-layer blog](./opencrab-browser-session-layer.md)

这说明你已经在把“能力”从一次性工具升级成可复用 runtime layer。

### 3. 已经有 Tasks、Channels、Team Mode 这些会逼出正式 runtime 的产品面

- [task-runner](../../lib/tasks/task-runner.ts)
- [dispatcher](../../lib/channels/dispatcher.ts)
- [architecture](../../docs/engineering/architecture.md)
- [team-mode-execution-plan](../../docs/team/team-mode-execution-plan.md)

一旦这些东西同时存在，系统天然就会要求：

- long-running execution
- result routing
- approval checkpoints
- recoverability

### 4. 当前真正缺的，不是“有没有 agent”，而是“是否拥有外层 harness”

现在 `OpenCrab` 的核心执行仍然明显依赖 `Codex SDK`：

- [lib/codex/sdk.ts](../../lib/codex/sdk.ts)

也就是说：

- 你已经有产品层
- 已经有多个入口
- 已经有若干 runtime 外围

但：

- 还没有拥有完整的 `OpenCrab runtime contract`
- 还没有拥有自己的 generic harness

这恰恰说明：

`现在开始自建，是顺着产品自然演进，而不是凭空另起炉灶。`

## 七、所以，OpenCrab 后续自建 agent loop / harness 是否可行？

我的判断是：

`可行，而且长期必要。`

但需要把“可行”分层看。

## 1. 拥有外层 runtime contract：高可行

这部分主要是工程问题：

- run / thread / event / approval / delivery 的统一协议
- conversation / task / channel / team 的共用 contract
- persistence / replay / checkpoint

这部分 OpenCrab 很适合自己做，而且越早拥有越好。

## 2. 拥有 generic tool router：高可行

OpenCrab 本身已经有这些能力面：

- shell / commands
- browser
- attachments
- channels
- tasks
- projects
- skills

把它们整理成正式 tool router，是工程量，但不是研究黑洞。

## 3. 拥有跨模型 generic runtime：中等可行

这部分开始变难，因为它要求你不再完全依赖 `Codex` 内部行为。

尤其会涉及：

- 不同模型的 tool use 差异
- prompt 结构差异
- event 语义归一化
- approvals / stopping rules 的稳定性

## 4. 拥有“接近 Codex 平滑度”的体验：中低可行

这一步最难的不是“能不能跑”，而是：

- 是否稳定
- 是否自然
- 是否不会发散
- 是否长任务里还能判断得体

这部分就是为什么我一直认为：

`“做出 harness”比“做顺手 harness”容易很多。`

## 八、真正的核心挑战，不在“循环”本身，而在这 8 件事

## 1. 统一 runtime contract

这是第一难点，也是最容易被低估的一点。

OpenCrab 后面一定要统一这些对象之间的关系：

- conversation
- task
- project / team room
- channel binding
- run
- artifact
- delivery target

如果这层 contract 不先定，后面：

- approvals
- checkpoints
- notifications
- multi-agent handoffs

都会不断返工。

## 2. Context Compaction 与 Memory 分层

这是最难的技术问题之一。

不是“能不能做摘要”，而是：

- 什么时候压缩
- 压缩什么
- 哪些内容进入 session memory
- 哪些进入 task / project memory
- 哪些只是一次性中间态

这件事做不好，agent 的体感会迅速恶化。

## 3. Safety / Approval / Policy

一旦 OpenCrab 同时控制：

- shell
- browser
- files
- channels
- tasks

安全边界就不再是附加功能，而是主设计问题。

尤其是：

- 什么动作自动执行
- 什么动作需要用户批准
- 渠道里来的消息能触发到什么层级
- 后台任务允许不允许继续联网或改文件

这部分很适合借 `OpenClaw`、`Codex`、`PydanticAI` 的思路。

## 4. Durability / Recovery

长任务最怕的不是第一次失败，而是：

- 失败后完全不知道做到哪里了
- 进程重启后丢掉中间态
- 任务与 channel / team room 的关系断裂

这要求：

- event log
- checkpoint
- replay
- resumable run state

这些都得成为正式层。

## 5. Queue / Concurrency / Interrupt

当 OpenCrab 继续往前走，后面一定会碰到：

- 同时多个任务
- 某个 channel 在追问用户
- Team Room 正在跑
- 定时任务到点触发
- 用户中途打断

这时候系统已经不是“一个请求一个回复”，而是一个小型 runtime scheduler。

`OpenClaw` 在 queue / lanes 上的判断，对你这里很有借鉴价值。

## 6. Cross-Model Normalization

如果后面要支持更多模型或 provider，最难的不是接 API，而是：

- 不同模型对 tool schema 的服从程度不同
- reasoning 风格不同
- 何时停手、何时追问的偏好不同
- compaction 后的稳定性差异很大

所以真正要做的，不是“模型自由切换”，而是：

`让 OpenCrab 自己拥有足够稳定的外层行为。`

## 7. Observability / Evaluation

没有这层，后面所有自建 runtime 都会变成玄学调参。

至少要能回答：

- 这次为什么失败
- 是模型问题、工具问题还是 harness 问题
- 哪个 prompt assembly 版本更稳
- 哪种 compaction 策略退化最少
- 哪类任务最容易失控

## 8. 产品语义，而不是只有技术语义

这是最后一个，也是最容易被技术讨论遮住的问题。

对 `OpenCrab` 来说，后面最重要的不是做一个“技术上存在的 loop”，而是做一个符合产品语义的宿主。

也就是说，系统必须理解：

- 这是一条直接对话
- 这是一项定时任务
- 这是一个 Team Room 的自动推进
- 这是某个渠道里的追问
- 这次结果应该回到哪里
- 这一步是否需要惊动用户

这类产品语义，外部框架不会替你拥有。

## 九、我的建议不是“重写一切”，而是按 6 步逐步拥有宿主层

## 第 1 步：先拥有协议，再拥有智能

先定这些统一对象：

- `Run`
- `Thread`
- `RunEvent`
- `ToolInvocation`
- `ApprovalCheckpoint`
- `DeliveryTarget`
- `Artifact`

先把产品协议定清楚，后面接什么 runtime 都会轻很多。

## 第 2 步：把 Codex 从“系统本体”降级成“一个 runtime backend”

也就是把架构从：

- `OpenCrab -> Codex`

变成：

- `OpenCrab -> Runtime Interface -> CodexRuntime`

这样后面才能慢慢接：

- `GenericLLMRuntime`
- `WorkflowRuntime`
- `ExternalAgentRuntime`

## 第 3 步：把 event log / checkpoint 正式化

这一步会直接决定后面：

- task
- channels
- team mode
- approvals
- replay / debug

是不是能稳定成立。

## 第 4 步：抽出 tool router 和 approval layer

把下面这些先抽成正式能力层：

- browser
- shell
- file writes
- patch
- channel delivery
- task trigger
- team trigger

## 第 5 步：再做 memory / compaction

这一步不要过早抽象成“大一统 memory”。

更稳的做法是分层：

- turn-level
- conversation-level
- task-level
- project-level
- reusable knowledge

## 第 6 步：最后再把 orchestration 抬高

也就是明确这些模式：

- single-agent
- manager + tools
- manager + specialists
- workflow agents
- channel-triggered run
- scheduled run

这样 `OpenCrab` 才会真正拥有自己的 agent runtime，而不是一堆局部功能的拼接。

## 十、最终判断

如果只问一句：

`OpenCrab 后续自建 agent loop / harness 是否可行？`

我的答案是：

`可行，而且从产品路线看，应该做。`

但如果再往下追问一句：

`最核心的挑战到底在哪？`

我会回答：

`不在“写一个 loop”，而在“拥有一个能跨对话、任务、渠道、Team Mode 稳定运转的宿主层”。`

真正难的不是：

- 再发一轮 prompt
- 再调一个 tool

而是这些更难的事：

- 状态怎么保存
- 失败怎么恢复
- 上下文怎么压缩
- 审批怎么插入
- 结果怎么回流
- 多入口怎么共享同一个 runtime contract
- 多模型下如何维持稳定体验

所以我最后的判断可以浓缩成一句话：

`OpenCrab 不应该复制某个开源框架；它应该吸收不同路线的长处，逐步拥有自己的 agent 宿主层。`

---

## 参考资料

- [OpenAI: Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)
- [OpenAI: Unlocking the Codex harness](https://openai.com/index/unlocking-the-codex-harness/)
- [Codex CLI docs](https://developers.openai.com/codex/cli)
- [OpenHands: Headless mode](https://docs.openhands.dev/modules/usage/how-to/headless-mode)
- [OpenHands: Conversation state architecture](https://docs.openhands.dev/modules/usage/conversation-state)
- [LangGraph: Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph: Human-in-the-loop](https://docs.langchain.com/oss/python/langgraph/human-in-the-loop)
- [AutoGen: Core and event-driven programming](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/index.html)
- [AutoGen: Teams](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html)
- [CrewAI docs](https://docs.crewai.com/)
- [Google ADK](https://google.github.io/adk-docs/)
- [Google ADK: Multi-agents](https://google.github.io/adk-docs/agents/multi-agents/)
- [OpenAI Agents SDK: Multi-agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/)
- [OpenAI Agents SDK: Tracing](https://openai.github.io/openai-agents-python/tracing/)
- [PydanticAI: Durable agents](https://ai.pydantic.dev/durable-agents/)
- [PydanticAI: Multi-agent applications](https://ai.pydantic.dev/multi-agent-applications/)
- [Hugging Face smolagents: Guided tour](https://huggingface.co/docs/smolagents/guided_tour)
- [Goose: Subagents](https://block.github.io/goose/docs/guides/subagents/)
- [OpenClaw: Architecture](https://docs.openclaw.ai/architecture)
- [OpenClaw: Gateway Security](https://docs.openclaw.ai/gateway/security)
- [OpenClaw: ACP Agents](https://docs.openclaw.ai/tools/acp-agents)
- [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter)
