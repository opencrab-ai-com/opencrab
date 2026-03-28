# OpenCrab 不做 Subagents，而是要走向比 Agent Teams 更像真实团队的模式

更新时间：2026-03-23

这篇文章不是一份纯功能说明，而是一篇技术路线博客。

它想回答 6 个问题：

1. `直接对话`、`subagents`、`agent teams`、`人类团队协作`，本质上分别是什么
2. `OpenClaw` 的 multi-agents 到底属于哪一层，它为什么值得研究
3. 为什么 `subagents -> agent teams` 的演化，看起来越来越像真实的人类团队
4. 当前 `agent teams` 和真实人类团队相比，还缺什么
5. 在现阶段模型能力和工程技术瓶颈下，`OpenCrab` 能做到的团队模式上限大概是什么
6. 基于这些判断，`OpenCrab` 为什么决定不做 `subagents`，而是直接面向更强的团队协作模式

## 一句话结论

`OpenCrab` 不做 `subagents` 模式。

`OpenCrab` 要做的，是一个无限逼近真实人类团队协作方式的数字团队系统。

但这里的“逼近”，不是指机械复制人类团队的一切，而是：

- 学习人类团队最有价值的能力
- 避免人类团队最常见的低效
- 在产品、runtime、任务系统、记忆系统、质量治理和复盘机制上做成一个更强的数字团队工作台

## 一、从直接对话到多 Agent，本质上在演化什么

如果把今天常见的智能体协作方式放在一条线上看，大概会是这样：

`直接对话 -> subagents -> agent teams -> 更接近真实团队的数字组织`

这条演化线的核心，不是“模型越来越多”，而是：

`协作抽象越来越像组织，而不是越来越像单个助手。`

### 1. 直接对话

最简单的模式是：一个用户，对一个主智能体。

优点：

- 轻
- 稳
- 成本低
- 控制感强

缺点：

- 本质上还是单线程
- 很难天然并行
- 多轮复杂任务容易把主线程拖得很重

### 2. Subagents

`subagents` 更像：

`一个主管临时叫几个专家去干活，再把结果拿回来汇总。`

这是“委派系统”，不是“团队系统”。

它比直接对话更强的地方在于：

- 可以并行探索
- 可以把分支任务外包
- 可以减少主线程上下文污染

但它的核心仍然是：

- 主线程定义问题
- 子 agent 执行
- 结果回主线程

也就是说，`subagents` 的提升主要是执行结构和探索效率，不是组织形态的根本变化。

### 3. Agent Teams

`agent teams` 开始进入另一个层次。

它不再只是“主线程叫几个工人”，而更像：

`一个 lead 带着几个独立成员，通过任务和通信机制持续协作。`

这里的变化不只是并行，而是引入了“团队协作”的基本要素：

- lead
- teammates
- shared task list
- direct messaging
- dependencies
- coordination lifecycle

这时系统开始从“委派工具”走向“组织系统”。

### 4. OpenClaw Multi-Agents：不是 Subagents，也还不是 Agent Teams

这里必须把 `OpenClaw` 单独拿出来讲，因为它很容易被误归类。

很多人看到 `multi-agents` 这个词，会自然把它理解成：

- `subagents`
- 或 `agent teams`

但我认为，`OpenClaw` 当前都不完全属于这两类。

它更准确的归类应该是：

`multiple isolated agents + deterministic routing`

也就是：

- 多个独立 agent 并存
- 每个 agent 都有独立 workspace、session、auth、skills
- 外部消息按照 account / peer / channel 规则，被稳定地路由到对应 agent

它不像 `subagents` 的地方在于：

- 没有一个天然居中的主线程在临时调用若干子 agent
- 各 agent 不是“主助手的临时工”，而是长期存在的独立 brain

它也不像典型 `agent teams` 的地方在于：

- 它强调的是隔离、入口绑定和 routing
- 而不是 lead、teammates、shared task list、持续协作和团队接力

换句话说，`OpenClaw` 回答得更好的是：

- 哪个入口触发了系统
- 该路由给哪个 agent
- 该 agent 用哪个 workspace / identity 工作

而不是：

- 多个 agent 如何围绕一个共同目标长期协作

所以如果把它放在这条演化线上，我更愿意把它理解成：

`一条位于 subagents 与 agent teams 之间、但方向侧重于 routing / isolation 的分支。`

它不是“更强的团队系统”，而是：

`更成熟的多入口、多身份、多工作区 agent 路由系统。`

### 5. 更像真实团队的数字组织

再往上走，就不是简单意义上的 `agent teams` 了。

它开始要回答更难的问题：

- 团队如何形成共享理解
- 成员如何建立责任连续性
- 组织如何复盘并改进自己的协作方式
- 任务如何长期沉淀成记忆、模板、技能和流程

这也是 `OpenCrab` 真正想去的方向。

## 二、五种模式的上限对比

下面这张表，不是在比“当前谁功能更多”，而是在比它们各自更接近什么组织形态。


| 维度      | 直接对话    | Subagents  | OpenClaw Multi-Agents | Claude Agent Teams           | OpenCrab 目标极限模式                           | 人类团队协作                 |
| ------- | ------- | ---------- | --------------------- | ---------------------------- | ----------------------------------------- | ---------------------- |
| 本质      | 单助手工作流  | 主线程委派系统    | 多独立 agent 路由系统        | 多 session 协作系统               | 产品化数字团队工作台                                | 真实组织系统                 |
| 组织形态    | 单中心     | 单中心 + 临时工人 | 多入口 + 多 brain + 路由   | lead + teammates + task list | PM + runtime + task graph + 可见 frontstage | leader + 成员 + 正式/非正式协作 |
| 成员独立性   | 无       | 有，但从属于主线程  | 很高                    | 高                            | 高                                         | 很高                     |
| 用户可见性   | 中       | 低          | 中低                    | 中                            | 高                                         | 取决于组织工具                |
| 共享任务系统  | 无       | 弱          | 弱                      | 强                            | 强                                         | 强，但未必规范                |
| 成员间直接通信 | 无       | 几乎无        | 有限或可选                | 有                            | 应该有                                       | 天然有                    |
| 自主领任务   | 无       | 无          | 弱                      | 有                            | 应该有，但受治理约束                                | 有                      |
| 依赖管理    | 弱       | 弱          | 弱                      | 中到强                          | 强                                         | 强                      |
| 质量治理    | 靠主线程    | 靠主线程       | 靠隔离与路由边界             | lead + hooks                 | PM + reviewer + gate + checkpoint         | 流程 + 文化 + 经验           |
| 异常恢复    | 中       | 中          | 中到强                   | 中                            | 应该做到强                                     | 强                      |
| 复盘能力    | 弱       | 弱          | 弱                      | 中                            | 强                                         | 很强                     |
| 自我进化能力  | 弱       | 弱          | 弱                      | 弱到中                          | 中到强                                       | 很强                     |
| 最适合     | 简单/顺序任务 | 可拆分小并行任务   | 多入口 agent 分流、渠道绑定、长期个人 brain | 并行研究、评审、讨论                   | 数字项目团队协作                                  | 复杂长期真实协作               |


## 三、为什么 `subagents -> agent teams` 越来越像真实团队

这个判断很重要，因为它解释了为什么很多产品最后都会从“多工具调用”走向“多成员协作”。

### 1. 从结果回收走向过程协作

`subagents` 更像一次性结果回收。

`agent teams` 开始有：

- 中间状态
- 协作过程
- 任务依赖
- 多角色接力

这和人类团队已经很像了。

### 2. 从主管全控走向局部自治

真实团队里，leader 不是亲自决定每一步。

很多推进来自于：

- 成员认领工作
- 成员之间同步
- 发现问题后局部调整

这正是 `agent teams` 试图学习的东西。

### 3. 从单次执行走向组织运转

一旦出现：

- lead
- member
- task list
- dependency
- handoff
- quality gate

系统设计的问题就不再只是 prompt engineering，而开始变成：

- 角色设计
- 权限设计
- 任务流设计
- 组织设计

这也是为什么 `agent teams` 更像“组织系统”，而不只是“更复杂的 prompt”。

## 四、为什么 OpenClaw 很值得研究，但它不等于 Agent Teams

我认为 `OpenClaw` 对 `OpenCrab` 的价值很大，但必须用正确方式理解。

如果理解错了，就会出现一个典型误判：

`以为只要做了 multi-agents routing，就等于做了 agent teams。`

这是不对的。

### 1. OpenClaw 强在“边界”和“路由”

它真正成熟的地方，不是“团队协作外形”，而是：

- 多入口统一 ingress
- 多 agent 隔离
- per-agent workspace / session / auth
- deterministic routing
- gateway 级安全边界

这些能力对于一切长期运行的 agent 系统都很关键。

### 2. OpenClaw 解决的是“谁接这条消息”，不是“团队如何围绕一个目标协作”

这是我认为最关键的分界点。

`OpenClaw` 问的是：

- 哪个入口触发
- 路由到哪个 agent
- 这个 agent 用哪个 workspace / identity

而 `agent teams` 问的是：

- 谁是 lead
- 谁负责哪个子任务
- 任务如何接力
- 依赖如何推进
- 团队如何汇总、复盘和调整分工

这两者都重要，但不是一回事。

### 3. 对 OpenCrab 来说，OpenClaw 更像底层启发，而不是最终产品目标

我会把它的启发总结成四点：

- `隔离`
- `路由`
- `边界`
- `多入口长期运行`

但 `OpenCrab` 要做的，不是停在这里。

`OpenCrab` 不是只想知道“哪条消息给哪个 agent”，而是想进一步回答：

- 这些 agent 如何围绕同一个项目共同工作
- 用户如何看见和干预这个团队
- 团队如何在多轮协作后变得更稳定、更可恢复、更可复盘

换句话说：

`OpenClaw` 更像 team runtime 的前置基础设施思想，但它本身还不是我们要去的“数字团队产品形态”。`

## 五、当前 Agent Teams 与真实人类团队相比，还缺什么

这是最关键的一部分。

我认为，今天的 `agent teams` 已经学到了人类团队的“外形”，但还远没有学到人类团队的“组织智能”。

### 1. 共享世界模型还不稳定

真实团队强大的地方，不是人人都看到同一份任务列表，而是大家逐渐形成相对一致的共同理解：

- 当前事实是什么
- 什么已经确认
- 什么还存在争议
- 目标到底是什么

当前 `agent teams` 更多是共享：

- 任务
- 消息
- 文件

但这不等于共享理解。

### 2. 成员没有真正稳定的 ownership

人类团队里的成员，不只是“完成一次任务”，而是对某块工作形成责任连续性。

当前多 agent 系统里的成员，更像：

`会运行的一段角色化执行实例`

而不是：

`持续对结果负责的角色`

### 3. 协商能力仍然很浅

真实团队不是只有“被派工”和“回结果”，还有大量协商：

- 这个目标是否合理
- 任务该谁做
- 标准是否该改
- 上游结果是否值得继续信任

当前 `agent teams` 已经有协作，但距离成熟协商还很远。

### 4. 隐性知识迁移能力很弱

人类团队真正强的一部分，是大量没写进文档的 tacit knowledge：

- 谁擅长什么
- 哪个模块以前踩过坑
- 哪种方案表面正确但实际上会翻车

当前 `agent teams` 仍然严重依赖显式上下文。

### 5. 异常恢复还不够强

人类团队即使有人卡住、误解、离线、做砸，通常也能恢复。

当前 `agent teams` 在：

- session 恢复
- 任务状态滞后
- shutdown
- stuck detection

这些方面仍然比较脆弱。

### 6. 复盘与自我进化能力还远不够

真实团队最强的一点，是会在多轮协作后改变自己：

- 调整分工
- 更新流程
- 优化标准
- 形成文化

这是现在绝大多数 `agent teams` 还不具备的。

## 六、如果把“反思总结与自我进化”单独拉出来看

这件事值得单列，因为它几乎决定了“它到底像不像一个真正团队”。


| 维度       | 直接对话 | Subagents | OpenClaw Multi-Agents | Claude Agent Teams | OpenCrab 目标极限模式 | 人类团队协作 |
| -------- | ---- | --------- | --------------------- | ------------------ | --------------- | ------ |
| 单轮任务复盘   | 弱    | 弱         | 弱                     | 中                  | 强               | 很强     |
| 多轮连续复盘   | 弱    | 很弱        | 很弱                    | 弱到中                | 中到强             | 很强     |
| 从失败中调整流程 | 弱    | 弱         | 弱                     | 中                  | 强               | 很强     |
| 调整角色分工   | 无    | 无         | 无                     | 有限                 | 中到强             | 很强     |
| 沉淀长期经验   | 弱    | 弱         | 弱到中                   | 中                  | 中到强             | 很强     |
| 自发改进组织自身 | 无    | 无         | 很弱                    | 很弱                 | 中               | 很强     |


如果单看“反思总结与自我进化”这件事，我的判断是：

`人类团队 > OpenCrab 目标极限模式 > Claude Agent Teams > OpenClaw Multi-Agents > Subagents > 直接对话`

原因很简单：

- `Claude agent teams` 的重点仍然是“把这轮任务协作完成”
- `OpenClaw` 的重点仍然更偏 routing、隔离和长期工作区边界，而不是围绕共同目标的协作复盘
- `OpenCrab` 如果做成产品化系统，就有机会把复盘真正沉淀成长期资产：
  - 团队记忆
  - 协作规则
  - 角色更新
  - 技能升级
  - 质量 gate
  - 项目模板

这就是产品系统相对纯 runtime 的巨大优势。

## 七、为什么 OpenCrab 明确不做 Subagents 模式

这是一个非常明确的产品决策。

### 决策 1

`OpenCrab 不做 Subagents 模式。`

原因不是因为 `subagents` 没价值，而是因为它解决的问题，不是 `OpenCrab` 最想解决的问题。

`subagents` 更适合：

- 快速并行小任务
- 结果导向的分支探索
- 为主线程减压

但 `OpenCrab` 想做的不是“主线程多几个临时助手”，而是：

`一个用户可以感知、观察、驱动、暂停、恢复、复盘、持续使用的数字团队。`

这两者的心智完全不同。

如果 `OpenCrab` 做 `subagents`，会带来几个问题：

- 产品表面会变得模糊：到底是聊天助手，还是任务外包器
- 团队协作能力会被拉回“主线程结果汇总”思路
- 很多真正有价值的团队能力就很难成立：
  - frontstage / backstage
  - Team Room
  - checkpoint
  - 阶段交付
  - 组织复盘

所以在 `OpenCrab` 里，`subagents` 不是核心产品方向。

## 八、OpenCrab 要做什么：不是复制 Claude Agent Teams，也不是复制 OpenClaw

### 决策 2

`OpenCrab` 要做的是领先于 Claude Agent Teams、也不同于 OpenClaw 的模式，是一个无限逼近人类真实团队协作的模式。

这个判断很重要，因为它说明 `OpenCrab` 既不是要做 Claude 那一套的中文皮肤版，也不是要做 OpenClaw 的 gateway / routing 产品翻版。

它要解决的是另一个问题：

`如果把 AI 团队协作真的做成产品，而不只是做成 runtime 机制，应该长成什么样？`

### OpenCrab 想去的极限形态

我认为 `OpenCrab` 的上限，不是“自治公司”，而是：

`一个可观测、可干预、可恢复、可复盘、可进化的数字项目团队。`

它应该具备这些能力：

- 有明确 PM runtime
- 有独立成员 runtime
- 有 frontstage 群聊和 Team Room
- 有共享任务图，而不只是聊天记录
- 有依赖、claim、ownership 和质量 gate
- 有 checkpoint、暂停、恢复、重试、替补机制
- 有阶段总结和可见进展
- 有多轮复盘后沉淀下来的团队记忆和协作规则

这时它就不只是“会协作”，而开始“会组织自己”。

## 九、OpenCrab 相比 Claude Agent Teams 与 OpenClaw 的独特机会

这里不能只看当前能力，还要看产品潜力。

`Claude agent teams` 更像“多智能体协作 runtime”。

`OpenClaw` 更像“多 agent ingress / routing runtime”。

`OpenCrab` 的机会在于，它可以把协作做成完整产品层：

- 对话
- Team Room
- 任务
- 运行态
- 技能
- 渠道
- 定时任务
- 复盘与记忆

一旦这些层真正打通，`OpenCrab` 的上限就不再只是“更强的多 agent 调度器”，而会变成：

`一个真正可持续运转的数字工作组织。`

这也是它理论上可以同时超过：

- 今天 `Claude agent teams` 的团队协作可见性上限
- 以及 `OpenClaw` 的 routing-first 产品形态上限

的地方。

## 十、但 OpenCrab 也不应该简单复制人类团队

这一点非常重要。

“无限逼近人类团队”并不意味着“机械复制人类团队的一切”。

因为人类团队除了优点，也有很多低效：

- 沟通成本高
- 信息失真
- 等待
- 扯皮
- 情绪干扰
- 责任边界模糊

所以 `OpenCrab` 真正应该做的是：

### 学人类团队的优点

- 分工
- ownership
- handoff
- 复盘
- 组织记忆
- 质量共识

### 避免人类团队的低效

- 减少无意义同步
- 降低上下游等待成本
- 让 checkpoint 更清晰
- 让任务依赖更结构化
- 让恢复与替补更自动化

一句话说：

`OpenCrab 不是要做“像人类一样低效的团队”，而是要做“比人类团队更高纪律、更低噪音、更可恢复的数字团队”。`

## 十一、当前 OpenCrab Team Runtime 处在哪个位置

基于当前仓库实现，`OpenCrab` 已经明显超出了“单会话模拟多人台词”的阶段。

当前它已经具备：

- 前台团队群聊
- 项目经理编排器
- 成员独立 hidden runtime conversation
- 阶段接力
- `waiting_user / waiting_approval`
- Team Room 的可见状态面板
- 暂停 / 恢复 / 删除清理 / 卡住重试等治理能力

这意味着：

`OpenCrab 当前已经不是 subagents，也不是简单的群聊式多角色 prompt，而是一个 PM 驱动的 team runtime 雏形。`

但它离目标极限模式还有距离。

这些距离主要体现在：

- 共享任务板仍不够强
- agent-to-agent mailbox 不够完整
- 组织学习和长期记忆还不够强
- 自我进化能力仍处在早期

## 十二、最终结论

如果把整个判断压缩成三句话：

### 第一句

`Subagents` 是委派系统，不是团队系统。

### 第二句

`Claude agent teams` 已经开始接近真实团队协作，但更多还是“会协作的多 agent runtime”，还不是“会持续进化的数字组织”。

### 第三句

`OpenCrab` 的机会，不在于复制 subagents，也不在于做 Claude agent teams 的中文翻版，而在于把多 Agent 协作做成一个可见、可控、可恢复、可复盘、可进化的数字团队产品。

这条路更难，但也更值得做。

## 参考资料

- [Claude Code: Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [OpenClaw System Architecture](https://openclawlab.com/zh-cn/docs/concepts/system-architecture/)
- [OpenClaw Multi-Agent Routing](https://openclawlab.com/en/docs/concepts/multi-agent/)
- [OpenCrab Team Runtime 设计方案](../team/multi-agent-design.md)
- [OpenCrab 多智能体研究记录](../team/multi-agent-research.md)
- [OpenCrab 产品定位](../product/product-positioning.md)
