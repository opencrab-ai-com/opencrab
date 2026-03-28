# OpenCrab Team OS 设计稿

日期：2026-03-23  
状态：Draft  
前置文档：

- [OpenCrab Team Runtime 设计方案](./multi-agent-design.md)
- [OpenCrab 不做 Subagents，而是要走向比 Agent Teams 更像真实团队的模式](../blogs/opencrab-beyond-agent-teams.md)
- [Task Graph 设计稿](./task-graph-design.md)
- [Learning Loop 设计稿](./learning-loop-design.md)

## 1. 目标

这份文档回答一个问题：

`如果 OpenCrab 要做一个无限逼近真实团队协作的数字团队系统，它的组织操作层应该长成什么样？`

这里的 `Team OS` 不是指操作系统内核，而是：

`Team OS = 负责定义团队中的角色、任务、通信、治理、运行、记忆与学习的组织层。`

它不只是一个多 Agent runtime，也不是一个“群聊里多人说话”的 UI 玩法，而是整个 Team Mode 的顶层组织模型。

## 2. 一句话定义

`OpenCrab Team OS = 一个以项目经理为控制中枢、以任务图为协作骨架、以前后台分层为可见界面、以复盘和记忆为长期进化机制的数字团队操作层。`

## 3. 设计目标

- 不做 `subagents` 模式
- 不做“多人 prompt 表演”
- 不把团队等价为“群聊 + 多条回复”
- 让团队以项目为单位长期运转，而不是只完成一轮任务
- 让用户既能看到整体局势，又不会被底层噪音淹没
- 让团队可以被暂停、恢复、重试、替换、复盘、升级
- 让团队协作结果最终沉淀为长期资产，而不是一次性输出

## 4. 核心原则

### 4.1 PM-first，但不是 PM-only

项目经理是团队的控制中枢，但不是唯一智能来源。

项目经理负责：

- 理解目标
- 拆解阶段
- 分配任务
- 跟踪依赖
- 组织验收
- 对用户收口

成员负责：

- 基于自己的角色与能力完成明确子任务
- 在必要时向上游、下游、Reviewer 或 PM 发起结构化协作

### 4.2 Frontstage / Backstage 分层

OpenCrab Team OS 必须明确区分：

- `Frontstage`
用户可见的团队表面。包括 Team Room、团队群聊、阶段状态、关键进展、checkpoint、最终交付。
- `Backstage`
成员 runtime、任务 claim、handoff、review、mailbox、质量 gate、恢复逻辑等内部运转面。

规则：

- 不把全部 backstage 噪音暴露给用户
- 但每一个关键组织动作都必须能回流成 frontstage 可解释状态

### 4.3 任务驱动，而不是消息驱动

消息只是协作表面，不应该是组织真相。

组织真相必须由下面这些对象承载：

- Project
- Team
- Agent
- Task
- Dependency
- Artifact
- Checkpoint
- Review
- Policy
- Memory

### 4.4 可见、可控、可恢复

一个高质量团队系统必须支持：

- 当前谁在推进
- 当前为什么停住
- 当前产出了什么
- 谁对这件事负责
- 卡住后如何恢复
- 何时需要用户介入

### 4.5 先高纪律，后高自治

OpenCrab 的团队不能一开始就追求完全自治。

第一阶段必须是：

- 强角色
- 强任务
- 强状态
- 强依赖
- 强 checkpoint
- 强治理

在治理稳定后，再逐步放开成员自协作与自领任务能力。

## 5. Team OS 的六层模型

### 5.1 Identity Layer

定义“谁在团队中”。

核心对象：

- `TeamProfile`
- `AgentProfile`
- `RolePolicy`

需要表达的信息：

- 成员名称
- 角色类型
- 职责边界
- 默认技能
- 偏好工具
- 审核权限
- 是否可派工
- 是否可 claim 某类任务

Team OS 不允许只有“角色标签”而没有结构化角色能力。

### 5.2 Work Layer

定义“团队在做什么”。

核心对象：

- `Task`
- `TaskDependency`
- `TaskClaim`
- `Artifact`
- `AcceptanceCriteria`

这一层是真正的协作骨架。  
消息和群聊只是在描述任务变化，不是替代任务变化。

### 5.3 Coordination Layer

定义“团队如何协作”。

核心对象：

- `MailboxThread`
- `Delegation`
- `Handoff`
- `ReviewRequest`
- `Escalation`
- `Broadcast`

这里的目标不是把聊天做复杂，而是让成员之间的协作路径结构化。

### 5.4 Runtime Layer

定义“团队如何运行”。

核心对象：

- `RuntimeSession`
- `Heartbeat`
- `ExecutionLease`
- `StuckSignal`
- `RecoveryAction`

这一层负责保证：

- 每个成员有独立 runtime
- 当前运行健康可追踪
- 卡住可被识别
- 中断后可恢复

### 5.5 Governance Layer

定义“团队如何保持质量和边界”。

核心对象：

- `Checkpoint`
- `QualityGate`
- `Approval`
- `RiskFlag`
- `OwnershipLock`
- `PolicyDecision`

这里决定 OpenCrab 团队是“可控的数字组织”，而不是“高风险的自动体”。

### 5.6 Learning Layer

定义“团队如何学习并变好”。

核心对象：

- `Reflection`
- `RunSummary`
- `FailurePattern`
- `TeamMemory`
- `TaskTemplate`
- `SkillUpgrade`
- `RoleTuning`

这一层是 OpenCrab 超过普通 agent teams 的关键。

## 6. Team OS 中的角色模型

### 6.1 用户

用户不是团队成员，但拥有最高业务主权。

用户负责：

- 定义目标
- 补充关键约束
- 确认阶段结果
- 决定是否继续推进

### 6.2 项目经理

项目经理是 Team OS 的第一控制面。

项目经理不是普通成员，其职责包括：

- 维护共享目标
- 维护任务图
- 决定派工和接力顺序
- 发起 review 与 checkpoint
- 识别 stuck 和 risk
- 向用户解释当前状态
- 输出阶段总结

项目经理不是“回复路由器”，而是团队 owner。

### 6.3 执行成员

执行成员包括：

- 产品
- 设计
- 开发
- 测试
- 写作
- 研究
- 审美设计师
- 其他领域角色

每个成员必须具备：

- 独立 runtime
- 独立职责边界
- 可执行任务类型
- 可 review 的对象范围
- 可请求的协作对象范围

### 6.4 Reviewer / Gatekeeper

不是所有角色都只做“产出者”。

Team OS 里必须允许出现：

- 专门负责 review 的角色
- 专门负责风险检查的角色
- 专门负责审美 / 一致性把关的角色

这样才能形成更像真实团队的质量治理结构。

## 7. 团队运行生命周期

### 7.1 Bootstrap

创建团队时，Team OS 需要初始化：

- 团队目标
- 团队工作空间
- 团队成员
- PM
- 初始记忆
- 初始任务图
- 初始 frontstage 群聊

### 7.2 Planning

PM 根据目标建立：

- 当前阶段
- 初始任务集合
- 初始依赖关系
- 第一轮 owner

### 7.3 Execution

成员 claim 或接收任务后进入执行。

执行中需要持续产生：

- heartbeats
- progress updates
- review requests
- blocked signals
- artifacts

### 7.4 Review

任务不是成员说“完成”就结束。

Team OS 必须支持：

- 自检
- 同级 review
- PM review
- specialized review

### 7.5 Checkpoint

团队在这些时刻必须停下：

- 需要用户补充
- 已有阶段结果待确认
- 风险过高
- 方向冲突
- 上游结果不可信

### 7.6 Reflection

每轮结束后，团队需要产出结构化总结：

- 产出了什么
- 哪些依赖顺畅
- 哪些地方卡住
- 哪些角色应该调整
- 哪些 skill 或 policy 应升级

## 8. Team OS 的系统真相

Team OS 的“真实状态”不应该由聊天内容推断，而应该来自结构化状态。

推荐以以下对象为一等公民：

- Team
- TeamMember
- Task
- TaskEdge
- Artifact
- Mail
- Review
- Checkpoint
- Run
- Reflection
- Memory

群聊与 Team Room 只是这些对象的表面投影。

## 9. Team OS 与 UI 的映射

### 9.1 Team Room

Team Room 是组织控制台，而不是聊天副本。

必须展示：

- 当前阶段
- 当前 baton
- 下一棒
- 当前风险
- 当前 checkpoint
- 任务图摘要
- 成员状态
- 最新交付物
- 本轮总结

### 9.2 Team 群聊

团队群聊是 frontstage 协作流。

主要展示：

- PM 对用户的响应
- 高信号 handoff
- 重要 review 结果
- 成员阶段产出摘要
- 需要用户决策的节点

### 9.3 成员详情

成员详情不应该是单纯消息流，而应该是：

- 当前职责
- 当前任务
- 上游依赖
- 下游交接
- 最近进展
- 最近结果
- 健康状态

## 10. Team OS 的技术边界

### 10.1 当前可以做到的上限

在当前模型能力和工程技术边界下，OpenCrab Team OS 的现实上限是：

`一个高纪律、强可见、强治理、强恢复、可逐步学习的数字项目团队。`

不是：

- 完全自治公司
- 无限自演化组织
- 不需要人类决策的长期组织体

### 10.2 当前不能假装做到的事情

- 稳定共享世界模型
- 人类级 tacit knowledge
- 人类级 ownership
- 深层组织协商
- 长周期完全自治不漂移

这些不足需要通过更强的结构化系统部分弥补，而不是假装模型已经自然具备。

## 11. 演进路线

### Phase 1

把 Team Runtime 升级成真正的 Team OS 骨架：

- 任务图
- 角色责任
- 前后台分层
- PM control plane
- checkpoint

### Phase 2

补齐治理与恢复：

- quality gate
- ownership lock
- mailbox
- retry / replace / resume

### Phase 3

补齐学习与进化：

- reflection
- memory
- skill upgrade
- role tuning
- team template

## 12. 最终判断

OpenCrab 的 Team OS 不应该只是“比 Claude agent teams 多几个按钮”，而应该是一套更完整的数字团队操作层。

它的目标不是复制人类团队的一切，而是：

- 学习人类团队最有价值的协作结构
- 避免人类团队最常见的组织低效
- 通过任务、治理、记忆和复盘，把团队做成一种长期可积累的数字生产系统

