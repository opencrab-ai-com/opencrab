# OpenCrab Team Mode 详细执行计划

日期：2026-03-23  
状态：Active  
适用范围：后续 Team Mode 全量迭代、验收与文档同步  
前置文档：

- [OpenCrab Team Runtime 设计方案](./multi-agent-design.md)
- [OpenCrab Team Runtime 调研补充](./multi-agent-research.md)
- [OpenCrab Team OS 设计稿](./team-os-design.md)
- [OpenCrab Task Graph 设计稿](./task-graph-design.md)
- [OpenCrab Learning Loop 设计稿](./learning-loop-design.md)
- [OpenCrab 不做 Subagents，而是要走向比 Agent Teams 更像真实团队的模式](../blogs/opencrab-beyond-agent-teams.md)

## 1. 文档目标

这份文档不是新的概念设计稿，而是：

`把 Team OS / Task Graph / Learning Loop 三份设计稿落成一份可以持续推进、持续打勾、持续更新进展的执行清单。`

后续 Team Mode 的所有迭代，优先以这份计划作为：

- 当前总路线
- 阶段拆分
- 进展同步面
- 范围控制面

## 2. 使用方式

每完成一轮 Team Mode 相关开发，都应更新这份文档中的：

- 阶段状态
- 子项状态
- 最新进展
- 下一步建议

避免后续协作再次退化成：

- 只靠聊天记录追进展
- 只知道“做了很多”，不知道做到哪一层
- 不清楚哪些是已完成骨架，哪些仍是设计稿

## 3. 状态说明

- `已完成`
  已经有稳定实现，并且进入当前主链路
- `进行中`
  已经开始实现，但只完成了骨架或一部分关键流
- `未开始`
  设计明确，但尚未进入实现
- `暂不做`
  已经讨论过，但当前阶段明确不进入实现

## 4. 总体路线

OpenCrab Team Mode 不做 `subagents`，也不做“群聊里多人表演”。  
当前确定的路线是：

`Team Runtime -> Team OS 骨架 -> Task Graph -> Governance -> Coordination -> Memory -> Learning Loop -> 可控自治`

换句话说，先把团队做成：

- 会稳定干活的数字组织

再把团队做成：

- 会持续变好的数字组织

## 4.1 当前阶段判断

当前这份计划已经可以直接按 Phase 本身来理解，不需要再额外读“推荐顺序说明”。

截至现在，阶段判断可以直接压缩成：

- `Phase 0-4`
  基础骨架已成立，可以视为第一阶段完成。
- `Phase 5`
  已完成，Team 已经从“会跑任务”推进到“会管理交付物”。
- `Phase 6`
  已完成第一版，成员之间已经有 mailbox、handoff、review request、self-claim 和 escalation。
- `Phase 7`
  已完成第一版；后续仍会围绕运行恢复、run 视图和前台信息收口继续补强。
- `Phase 8`
  已完成第一版；当前重点转向记忆质量、压缩策略和展示收口。
- `Phase 9`
  已完成第一版；当前重点转向 suggestion 质量、人审入口与跨项目复用。
- `Phase 10`
  仍属后续阶段，不进入当前实现主线。

---

## 5. Phase 0：战略与文档基线

目标：先把方向、术语、组织模型和协作入口统一，避免实现层边做边漂。

### 5.1 路线选择

- [x] 明确 OpenCrab 不做 `subagents` 模式
  最新进展：已写入 Team 相关设计与博客结论，后续 Team Mode 路线明确以“比 Claude agent teams 更接近真实团队”为目标。

- [x] 明确 Team Mode 的目标不是“多人群聊”，而是“数字团队工作台”
  最新进展：已在 [OpenCrab Team OS 设计稿](./team-os-design.md) 和 [博客长文](../blogs/opencrab-beyond-agent-teams.md) 中定稿。

- [x] 明确 Team Mode 的组织中枢是 PM，而不是平均化多 Agent
  最新进展：当前运行实现已经是 `PM-first`，项目经理是唯一 Lead / canDelegate 成员。

### 5.2 文档基线

- [x] 产出 Team OS 设计稿
  最新进展：已完成，路径见 [team-os-design.md](./team-os-design.md)。

- [x] 产出 Task Graph 设计稿
  最新进展：已完成，路径见 [task-graph-design.md](./task-graph-design.md)。

- [x] 产出 Learning Loop 设计稿
  最新进展：已完成，路径见 [learning-loop-design.md](./learning-loop-design.md)。

- [x] 整理 docs 目录结构与总索引
  最新进展：`docs/` 已按 `product / engineering / tasks / team / blogs` 收拢，并补了 [docs/README.md](../README.md)。

### 5.3 当前判断

状态：`已完成`

说明：

- 文档基线已经够用，后续不需要再新增新的顶层概念文档
- 后面重点应进入“按这份计划推进实现并持续回填进展”

---

## 6. Phase 1：Team Runtime 基础骨架

目标：把 Team Mode 从“拼台词群聊”升级成“前台群聊 + 后台独立 runtime”。

### 6.1 独立成员 runtime

- [x] 每个成员有独立 hidden runtime conversation
  最新进展：已进入主链路，成员拥有独立 `runtimeConversationId` 与独立上下文。

- [x] 项目经理拥有独立 runtime，并作为默认编排入口
  最新进展：已接入，用户默认与项目经理对话，PM 决定后续派工。

- [x] Team 群聊只作为 frontstage，不再承担真实执行
  最新进展：已接入，群聊主要展示前台过程，真实执行发生在 backstage runtime。

### 6.2 运行控制

- [x] 支持启动团队运行
  最新进展：已有独立入口，且会自动创建团队群聊。

- [x] 支持暂停团队
  最新进展：已支持暂停与恢复，且暂停后会阻止后台继续推进。

- [x] 支持删除团队并清理相关会话
  最新进展：已支持清理 Team Room 群聊、成员 hidden runtime conversation，以及相关 `projectId` 会话。

- [x] 支持卡住检测与重推当前棒次
  最新进展：项目经理已具备检测成员异常、重启卡住成员并继续推进的能力。

### 6.3 当前判断

状态：`已完成`

说明：

- Team Runtime 基础骨架已经存在
- 但当前骨架仍偏“PM 编排驱动”，尚未进入真正任务图和 mailbox 协作阶段

---

## 7. Phase 2：Team OS 基础组织层

目标：把团队里的“人”和“状态”结构化，而不是靠聊天文案推断。

### 7.1 角色模型

- [x] 团队默认绑定项目经理
  最新进展：已完成，系统智能体已内置项目经理，创建团队时自动装配。

- [x] 成员角色与 Team 结构角色分离
  最新进展：当前已存在 `角色标签` 与 `teamRole` 的分层概念；`teamRole` 已用于 Team 内部行为。

- [x] 默认系统成员支持扩展
  最新进展：已新增 `审美设计师` 作为默认系统智能体，并扩充了设计相关 skills。

### 7.2 Team Room 组织视图

- [x] Team Room 显示当前阶段、当前 baton、下一棒、PM 判断
  最新进展：已完成，Team Room 已有 `Mission Control` 与成员推进看板。

- [x] 团队群聊支持 `@成员`
  最新进展：已完成，且补了候选层、快捷成员 pill 等交互。

- [x] 团队详情页支持删除、暂停、恢复、打开群聊
  最新进展：已完成。

### 7.3 当前判断

状态：`已完成`

说明：

- Team OS 的“角色与前台可见组织感”已经具备第一版
- 后续要继续补的是任务对象、治理对象、学习对象，而不是继续堆角色 UI

---

## 8. Phase 3：Task Graph 骨架

目标：把 Team Mode 从“消息驱动”切到“任务驱动”。

### 8.1 Task 一等公民

- [x] 引入 `ProjectTaskRecord`
  最新进展：已进入 [types.ts](../../lib/projects/types.ts)，Team Store / Project Detail 已正式包含 `tasks`。

- [x] 任务具备基础字段
  最新进展：已具备：
  - `title`
  - `description`
  - `status`
  - `ownerAgentId`
  - `stageLabel`
  - `acceptanceCriteria`
  - `dependsOnTaskIds`
  - `blockedByTaskId`
  - `resultSummary`
  - 时间字段

- [x] 成员支持关联 `currentTaskId`
  最新进展：已接入，成员与当前任务已有结构化映射。

- [x] 任务记录显式包含 `claimedAt / blockedReason`
  最新进展：已完成。任务现在不只知道“卡住了”，还能表达“何时被接手、当前为什么被阻塞”。

### 8.2 任务状态流

- [x] 引入基础任务状态流
  最新进展：当前已支持：
  - `draft`
  - `ready`
  - `claimed`
  - `in_progress`
  - `in_review`
  - `waiting_input`
  - `blocked`
  - `completed`
  - `reopened`
  - `cancelled`

- [x] 引入显式 `claimed`
  最新进展：已完成第一版。PM 派工创建任务后，第一棒会先进入 `claimed`，再在成员真正开跑时进入 `in_progress`。

### 8.3 PM 派工任务化

- [x] PM 派工时创建结构化任务
  最新进展：已实现，PM 规划完成后会创建 delegation tasks，而不是只发自然语言。

- [x] PM planning task 独立存在
  最新进展：已实现，运行开始时会激活或创建 PM planning task。

- [x] checkpoint 会创建结构化 checkpoint task
  最新进展：已实现，`waiting_approval` / `waiting_user` 会生成对应 checkpoint task。

### 8.4 Team Room 任务板

- [x] Team Room 展示 Task Graph 摘要
  最新进展：已上线 `任务图摘要` 面板，支持：
  - 当前执行
  - 待复核
  - 等补充 / 阻塞
  - 最近完成

- [x] 任务卡展示 owner、依赖、验收、结果摘要、更新时间
  最新进展：已完成第一版。

- [x] 提供真正的依赖关系视图
  最新进展：已完成骨架版。当前 Task Graph 已同时展示：
  - `接力依赖` rail
  - `依赖边` 列表
  - 任务级 `blockedReason`
  对于当前阶段的 Team Mode，这已经足以把依赖关系从隐含状态升级为显式结构。

- [x] 依赖完成后自动解锁下游任务
  最新进展：已完成第一版。当前任务完成后，会自动把下游阻塞任务从 `blocked` 切到 `ready`，不再只是静态展示依赖。

- [x] 支持返工任务进入 `reopened`
  最新进展：已完成第一版。在 `waiting_approval` 下要求修改时，会基于 pending reviews 自动生成 `reopened / blocked` 的 follow-up task 链，恢复运行后会优先从这条返工链继续。

### 8.5 当前判断

状态：`已完成`

说明：

- Task Graph 的“有任务”已经成立
- 当前已经具备：
  - 显式任务对象
  - 显式状态流
  - 显式 claim 起点
  - 显式依赖链
  - 自动解锁
  - 返工 reopened
  - task -> review / artifact 挂接
- 后续更复杂的 lock / lease / mailbox 协作不再算 Phase 3 骨架问题，而进入后续治理与协作阶段

---

## 9. Phase 4：Governance 与质量治理

目标：让团队不是“能跑”，而是“可控、可审、可收口”。

### 9.1 Checkpoint

- [x] 支持 `waiting_user`
  最新进展：已完成，PM 可进入待补充状态。

- [x] 支持 `waiting_approval`
  最新进展：已完成，PM 可进入待确认状态。

- [x] Team Room 顶部显示待确认 / 待补充入口
  最新进展：已完成，状态为 `waiting_approval` 时顶部已有明确确认入口。

### 9.2 Review 机制

- [x] 用任务状态表达 review 阶段
  最新进展：当前已通过 `in_review` 和 checkpoint task 表达“待复核”，并继续保留这层状态表达。

- [x] 引入独立 Review 对象
  最新进展：已引入 `ProjectReviewRecord` 与 `reviews` 状态层。成员任务交回后会创建待 PM 复核记录；进入 `waiting_approval` 时会创建面向用户的阶段复核记录。

- [x] 支持 reviewer verdict、blocking comments、follow-up task
  最新进展：当前已支持：
  - `pending / approved / changes_requested / cancelled`
  - `blockingComments`
  - `followUpTaskId`
  同时已经完成主链路：
  - 用户在 `waiting_approval` 下要求修改时，会生成对应 follow-up task
  - review 会挂上 `followUpTaskId`
  - Team Room 任务卡会提示“已生成后续 follow-up task”
  - review verdict 已进入任务卡与返工链展示，不再只是底层状态

### 9.3 Ownership / Lock / 风险治理

- [x] 文件 ownership / lock
  最新进展：已完成第一版。当前任务已支持：
  - `lockScopePaths`
  - `lockStatus`
  - `lockBlockedByTaskId`
  - 基于锁范围的自动阻塞与自动解锁
  - Team Room 直接展示“锁定范围 / 锁占用”

- [x] 任务 lease / 抢占 / 过期恢复
  最新进展：已完成治理主链。当前任务已支持：
  - `leaseAcquiredAt`
  - `leaseHeartbeatAt`
  - `leaseExpiresAt`
  - 任务卡直接显示“租约有效至 / 已过期”
  - PM 在判断卡住时，已经会把 lease 过期作为显式治理信号之一
  - 重试次数记录
  - 连续异常后的 owner replacement
  - PM 接管异常任务并回收到重新编排链

- [x] runtime stuck detection / retry
  最新进展：已完成。当前已经支持：
  - runtime 卡住检测
  - 与 task lease 联动的治理判断
  - 第一轮自动重试
  - 连续异常后不再盲目重试，而是把任务 ownership 回收给 PM

### 9.4 当前判断

状态：`已完成`

说明：

- checkpoint 已经有了
- review 已经开始真正带动返工任务与恢复链
- lease、lock、owner replacement 已经进入治理主链
- 当前治理层已经具备“可控、可审、可恢复”的第一版骨架
- 后续不再把治理层当作缺失模块，而是进入 Coordination 与 Artifact 继续深化

---

## 10. Phase 5：交付物闭环

目标：让 Team Mode 从“围绕任务推进”升级成“围绕交付物推进”。

### 10.1 任务绑定交付物

- [x] 任务支持 `artifactIds`
  最新进展：字段和主链路都已接通。初始 bootstrap task 会挂接团队初始化 artifact；成员任务完成后也会生成并挂接对应 task result artifact。

- [x] 任务完成时自动挂接相关 artifact
  最新进展：已完成第一版：
  - 成员完成任务后会生成 `Task Result` 类型 artifact，并自动挂到对应 task
  - checkpoint task 会自动挂接 `阶段总结 / 待补充事项` artifact
  - Team Room 任务卡已可看到“这条任务已挂接几项交付物”

- [x] Team Room 可从任务直接跳到交付物
  最新进展：已完成第一版。任务卡现在会显式展示 `输入交付物 / 产出交付物`，并可直接定位到 Team Room 里的对应 artifact 卡片。

### 10.2 交付物图谱

- [x] artifact 显示来源任务、owner、review 状态
  最新进展：已完成第一版。artifact 卡片与详情弹窗现在都可直接看到：
  - 来源任务
  - owner
  - review 状态
  - reviewer

- [x] artifact 支持成为后续任务依赖
  最新进展：已完成第一版主链路：
  - PM 在派工时已可显式引用已有 artifact
  - delegation task 创建时会挂接对应 `inputArtifactIds`
  - 如果引用的 artifact 尚未 ready，任务会进入显式阻塞
  - artifact ready 后，相关任务会自动解除阻塞继续进入 task flow
  - 成员执行 prompt 已可直接读取挂接的输入交付物，而不是只靠群聊上下文

- [x] 建立 artifact graph，而不是 artifact 列表
  最新进展：已完成第一版 Team Room `Artifact Graph` 视图。当前已经能展示：
  - 来源任务 -> artifact
  - artifact -> artifact
  - artifact -> 下游任务
  - artifact 来源任务 / owner / reviewer / review 状态
  这已经足以把 Team Room 从“结果列表”推进到“交付物流向图”。

### 10.3 当前判断

状态：`已完成`

说明：

- Team 已经可以围绕“可交付成果”而不是只围绕聊天和状态运转
- 下一阶段主线应正式切换到成员协作层

---

## 11. Phase 6：成员协作层

目标：让成员之间不是只能靠 PM 转述，而是开始拥有结构化协作机制。

### 11.1 Agent-to-Agent 协作

- [x] 引入 mailbox thread
  最新进展：已完成第一版，项目内已经有结构化 mailbox thread 数据对象，并在 Team Room 里作为“协作信号”独立展示。

- [x] 支持 direct message / broadcast
  最新进展：已完成第一版，PM 派工时会同步生成 direct message；存在多成员接力时会额外生成 broadcast。

- [x] 支持成员向上游追问 / 请求补充 / 请求 review
  最新进展：已完成第一版，下游因上游任务或输入 artifact 阻塞时会生成 request_input；任务交回后会自动生成 review_request。

### 11.2 自协作能力

- [x] 支持有限 self-claim
  最新进展：已完成第一版，在没有其他 worker 正在执行时，已解锁的 ready task 会由对应 owner 有边界地自动 claim。

- [x] 支持成员发起结构化 escalation
  最新进展：已完成第一版，成员执行失败会通过 escalation thread 升级给 PM，并把项目切到 waiting_user checkpoint。

- [x] 支持成员基于任务图自发建议下一棒
  最新进展：已完成第一版，成员交回任务后会给 PM 生成 next_step_suggestion，后续 checkpoint 或重新派工会自动收束旧建议。

### 11.3 当前判断

状态：`已完成`

说明：

- 第一版目标已经达成，协作信号不再只能靠 PM 在群聊里转述
- 下一阶段重点不是继续补 mailbox 底层，而是把运行恢复和前台可见性继续做扎实

---

## 12. Phase 7：运行与前台支撑层

目标：让团队运行更可靠、前台更清楚，但这层始终服务主线，不单独抢主战场。

### 12.1 Runtime 健康与恢复

- [x] 成员进展 trail / progress label
  最新进展：已完成第一版，当前执行过程可以在 Team Room 可视化看到。

- [x] 成员心跳与卡住判断
  最新进展：已完成第一版，PM 能检查成员是否卡住。

- [x] 统一 Heartbeat / StuckSignal / RecoveryAction 数据对象
  最新进展：已完成第一版，store 内已经有结构化 heartbeat、stuck signal、recovery action 对象，Team Room 也有对应的 Runtime Health 视图。

- [x] 支持暂停 / 恢复
  最新进展：已完成。

- [x] 支持卡住成员重试
  最新进展：已完成第一版。

- [x] 支持替换成员继续
  最新进展：已完成第一版，卡住任务在达到恢复阈值后会优先改派给空闲成员继续；没有可用替补时才回收到 PM。

- [x] 支持回滚到最近 checkpoint 后重跑
  最新进展：已完成第一版，当前可从最近 checkpoint 直接重跑，并把这次恢复动作沉淀到 run log 与 recovery action。

### 12.2 Frontstage 产品体验

- [x] Team Room 已收成指挥台风格，而不是长文堆叠
  最新进展：已完成第一版，有 Mission Control、成员推进看板、活动流、任务图摘要。

- [x] 顶部状态、确认入口、暂停恢复入口
  最新进展：已完成。

- [~] 任务板、活动流、成员看板的视觉统一
  最新进展：已有第一版，但后续仍需持续打磨。

- [x] 任务卡可见复核状态
  最新进展：已完成。

- [x] 团队群聊具备模式标记、`@成员`、回放能力
  最新进展：已完成，且回放已扩展为全对话通用能力。

- [~] 团队群聊顶部信息、状态信息与输入区紧凑化
  最新进展：已完成一轮收缩，但仍有细节体验可继续优化。

- [x] 团队列表页标题与 slogan 已中文化，卡片高度已限制
  最新进展：已完成第一版。

- [x] 列表页与任务层信息的进一步联动
  最新进展：已完成第一版，团队列表卡片现在可以直接看到当前任务、待复核数、卡住信号、最近恢复动作与当前 run 停点。

### 12.3 当前判断

状态：`已完成`

说明：

- 这一层已经把 runtime health、run log、checkpoint rollback 与列表页联动都补齐到了第一版闭环
- 后续如果继续打磨，重点会转向体验细节，而不是再补新的 Phase 7 主能力

---

## 13. Phase 8：Memory Layer

目标：让团队不是每轮都从零开始。

### 13.1 项目记忆

- [x] 引入 Project Memory 结构化对象
  最新进展：已完成第一版，store 内已经有结构化 project memory 对象，并能在 Team Room 里直接查看。

- [x] 将关键决策、偏好、风险、历史坑点结构化沉淀
  最新进展：已完成第一版，当前会从 checkpoint、用户补充、复核意见、stuck signal 与 recovery action 自动沉淀这些记忆。

### 13.2 团队记忆

- [x] 记录最佳接力顺序、常见卡点、常见 review 问题
  最新进展：已完成第一版，当前会从 task dependency、阻塞记录与 review 结果派生 team memory pattern。

- [x] 让 Team Memory 真正影响后续派工
  最新进展：已完成第一版，manager planning prompt 已注入 team memory，不再只看当前群聊与交付物。

### 13.3 角色记忆

- [x] 记录每个成员最擅长的任务类型、常见错误、最优输入格式
  最新进展：已完成第一版，角色记忆会根据完成任务、卡点与复核结果自动整理。

- [x] 让角色记忆影响任务模板、派工和 review
  最新进展：已完成第一版，manager / worker prompt 都已注入 role memory，用来影响后续派工与执行方式。

### 13.4 当前判断

状态：`已完成`

说明：

- 第一版已经形成“可沉淀、可展示、可反哺 runtime”的闭环
- 后续再继续做时，重点会转向记忆质量、压缩策略和显式 human review，而不是从零起 memory 结构

---

## 14. Phase 9：Learning Loop

目标：让团队不只是完成任务，而是会从任务中学习如何更好地协作。

### 14.1 Reflection

- [x] 任务级微复盘
  最新进展：已完成第一版，会根据任务的完成结果、review、阻塞与恢复动作自动生成结构化 task reflection。

- [x] 阶段级复盘
  最新进展：已完成第一版，会按 stage 汇总 wins / risks / recommendations，形成结构化 stage reflection。

- [x] 项目级 run summary
  最新进展：已完成第一版，会围绕每一轮 run 的 trigger、结果、风险和建议生成 run summary。

### 14.2 Pattern / Policy

- [x] 常见失败模式沉淀
  最新进展：已完成第一版，会从 team memory / project memory 中提炼 failure pattern suggestion。

- [x] task template suggestion
  最新进展：已完成第一版，会根据 task reflection 自动产出输入交付物 / 验收标准相关的任务模板建议。

- [x] role tuning suggestion
  最新进展：已完成第一版，会把成员长板与常见问题整理成角色调优建议。

- [x] quality gate suggestion
  最新进展：已完成第一版，会根据 review / 风险模式生成轻量 quality gate 建议。

### 14.3 落地升级

- [x] skill suggestion / skill upgrade
  最新进展：已完成第一版，会从 reflection / review / recovery 信号中自动生成 skill upgrade suggestion，并在 Team Room 中进入显式落地候选。

- [x] agent profile update suggestion
  最新进展：已完成第一版，会根据 role memory 自动生成 agent profile update suggestion，明确指出 profile 应补哪些职责 / 知识 / 输入偏好。

- [x] 允许部分建议进入 human review 流
  最新进展：已完成第一版，需要人审的 skill / profile suggestion 会自动生成 human review mailbox thread，并支持在 Team Room 里直接采纳或忽略。

### 14.4 当前判断

状态：`已完成`

说明：

- 第一版已经形成“可复盘、可展示、可反哺 prompt、可进入人审”的 learning loop 闭环
- 后续继续做时，重点会转向 suggestion 质量、默认采纳边界和跨项目复用，而不是继续补基础对象

---

## 15. Phase 10：可控自治

目标：不是完全放飞团队，而是在高纪律边界内提升自推进能力。

### 15.1 团队自推进

- [ ] 用户离线时，PM 可在安全边界内推进多轮
  最新进展：未开始。

- [ ] 成员可在任务图约束下自领下一步
  最新进展：未开始。

- [ ] 团队能主动识别风险并提前升级
  最新进展：未开始。

### 15.2 高风险边界

- [ ] 高风险动作必须走 gate
  最新进展：未开始。

- [ ] 关键政策修改必须 human in the loop
  最新进展：未开始。

### 15.3 当前判断

状态：`未开始`

说明：

- 这是远期目标
- 当前阶段不应该为了“更像自主团队”而提前牺牲系统稳定性

---

## 16. 当前里程碑判断

截至 2026-03-23，OpenCrab Team Mode 所处位置可以更准确地概括为：

`已经完成 Team Runtime、Team OS、Task Graph 骨架、Governance 第一版、Phase 5 交付物闭环、Phase 6 协作层、Phase 7 运行健康层、Phase 8 Memory Layer，以及 Phase 9 Learning Loop 第一版。`

也就是说，系统已经跨过了最早期的：

- 只有群聊，没有真正团队结构
- 只有成员，没有任务对象
- 只有任务，没有治理能力

当前更准确的结构判断如下：

### 16.1 已经可以视为完成的层

- Team Runtime 基础骨架
- PM-first 团队结构
- frontstage / backstage 分层
- 暂停 / 恢复 / 删除 / 卡住检测 / 首轮自动重试
- 团队群聊与 Team Room 基础产品形态
- 当前执行过程公开进展
- Task Graph 第一版骨架
- Governance 第一版骨架
- 成员协作层第一版
- Runtime Health 第一版
- Memory Layer 第一版
- Learning Loop 第一版

### 16.2 当前仍在进行中的层

- Team Room / 团队群聊围绕 runtime、memory、learning 和回放体验的信息收口
- suggestion 质量、压缩策略、人审入口、采纳回写与跨项目复用

### 16.3 当前绝对不该抢跑的层

- controlled autonomy

`memory layer` 和 `learning loop` 已经完成第一版主链，但都还应该优先做“可验证的渐进增强”，而不是过早扩成复杂自治系统。

原因不是这些不重要，而是当前如果先跳到更强自治和策略自动改写，会过早拉散当前更关键的稳定性与可控性主链。

## 17. 当前建议的下一步

如果现在要决定“下一步做什么”，这份文档本身已经足够给出答案：

- 现在不应该直接推进 `Phase 10：可控自治`
- `Phase 7-9` 都已经完成第一版主链，但还处在“收口与质量增强”阶段
- `Phase 10` 仍然暂时不进入实现主线

所以，当前最合理的选择不是直接进入可控自治，而是先完成 `Phase 7-9` 的可验证收口：

- 先做 Team Room / 团队群聊里 `runtime + memory + learning + replay` 的信息收口
- 再做 suggestion 的可验证增强：去重、压缩、证据展示、人审与采纳回写
- 最后再做跨项目复用的最小闭环，但仍保持在“建议 / 采纳”层，不提前升级成自治执行

只有当上述链路已经稳定、可读、可审，并且高风险 gate 边界足够清楚时，才适合进入 `Phase 10` 的最小自治闭环。

### 17.1 接下来一轮的实现主线

这一轮不再按“新 Phase”推进，而是按“收口主线”推进：

- `主线 A：信息收口`
  目标：把 Team Room / 团队群聊里已经存在的 runtime、memory、learning、replay 信号真正收成一个可读工作台，而不是分散在多个面板里。
- `主线 B：suggestion 质量增强`
  目标：把 learning suggestion 从“已经能生成和处理”推进到“能解释为什么出现、是否值得采纳、采纳后到底影响了什么”。
- `主线 C：跨项目复用最小闭环`
  目标：让已经被验证过的建议开始具备复用出口，但仍停留在“候选 / 采纳”层，不自动扩成自治执行。

### 17.2 推荐实施顺序

建议按下面顺序推进，而不是并行发散：

1. 先做 `主线 A：信息收口`
2. 再做 `主线 B：suggestion 质量增强`
3. 最后做 `主线 C：跨项目复用最小闭环`

原因：

- 如果前台信息仍然分散，就算生成了更多 memory / learning 结果，用户也很难判断这些结果是否可靠
- 如果 suggestion 还不能解释证据和回写影响，过早做跨项目复用只会放大噪音
- 只有当单项目内已经“可读、可审、可回写”，跨项目复用才不会退化成另一层黑箱

### 17.3 建议拆成的执行包

#### A. 信息收口包（Phase 7 收口）

- [x] Team Room 建立 `runtime -> recovery -> memory -> learning -> replay` 的更清楚跳转关系
  最新进展：已完成第一轮。Team Room 顶部已新增 `收口导航`，能直接跳到 `Checkpoint / Runtime Health / Team Memory / Learning Loop / 协作线程 / 最近活动 / 团队群聊`，并先把当前停点、最近恢复、记忆焦点与学习焦点收成统一入口。
- [x] 团队群聊顶部或关键信息区补足当前 run 停点、待确认事项、待人审建议等摘要
  最新进展：已完成第一轮。团队群聊 header 现在已直接显示运行状态、当前停点、待人审建议数、待确认复用候选数与待处理线程数，不再要求用户必须先返回 Team Room 才能判断当前停在哪。
- [x] 活动流、协作线程、Learning Loop 之间建立更明确的互相定位能力，而不是只能靠人工来回翻
  最新进展：已完成。Learning suggestion 已可直接打开关联 human review thread；协作线程详情也可反向定位关联 suggestion；Activity Dialog 现在也能把单条活动直接送到对应 `checkpoint / runtime recovery / learning suggestion` 的落点，不再需要人工先猜该翻哪块。
- [x] 把“为什么停在这里 / 为什么生成这条建议 / 最近哪次恢复影响了后续判断”收成更直接的前台文案
  最新进展：已完成第一轮。Team Room 与团队群聊都已新增 stop summary、recovery summary、memory / learning focus 文案，用户现在可以先看收口结论，再决定要不要继续翻活动流。

完成标志：

- 用户进入 Team Room 后，不需要通读长活动流，也能回答“现在停在哪”“为什么停在这”“接下来该看哪里”

当前判断：

- 状态：`已完成`
- 这一包已经从“能看到主要入口”推进到“能从活动、线程、suggestion 之间直接来回定位”
- 后续如果继续打磨，也只属于定位精度和文案 polish，不再阻塞当前主线判断

#### B. Suggestion 质量增强包（Phase 8-9 收口）

- [x] suggestion 去重与压缩，避免同类 failure pattern / quality gate / task template 建议反复堆叠
  最新进展：已完成。store 侧已按 `kind + target` 做 suggestion 压缩，并在证据标签、证据源、动作项和回写目标层做去重，避免同类建议反复堆叠。
- [x] suggestion 显式展示证据来源，不只显示标签，还能说明来自哪些 task / review / recovery / run summary
  最新进展：已完成。前台 suggestion 卡片已新增 `证据来源` 区块，能够直接显示 `任务复盘 / 阶段复盘 / run summary / review / recovery / 项目记忆 / 团队记忆 / 角色记忆` 的来源摘要。
- [x] suggestion 显式区分 `开放中 / 待人审 / 已采纳 / 已忽略`
  最新进展：已完成。前台状态已把 `待人审` 单独抬成一档，不再混在泛化的 `开放中` 里。
- [x] 把 human review thread、review note、reviewedAt 和前台建议卡片打通
  最新进展：已完成。suggestion 卡片已可直接打开关联人审线程，并显式展示 review note 与 reviewedAt。
- [x] 把“采纳后已进入默认策略”的回写结果展示得更清楚，而不是只体现在底层 prompt 注入
  最新进展：已完成。前台 suggestion 卡片现在会直接展示 `已回写到 / 采纳后会回写到` 的目标列表和回写说明，不再只藏在 prompt 注入里。

完成标志：

- 用户看到一条 suggestion 时，能够直接判断：
  - 它为什么出现
  - 证据来自哪里
  - 现在是否还待人审
  - 如果已经采纳，它已经影响了哪类默认判断

当前判断：

- 状态：`已完成`
- Suggestion 已经从“抽象结论卡片”升级成“可解释、可回写、可追证”的前台对象
- 后续如果继续提升，也会偏向建议质量和排序策略，而不是当前这层可读性闭环

#### C. 跨项目复用最小闭环包（Phase 9 收口）

- [x] 只从 `已采纳` 且证据足够稳定的 suggestion 中生成跨项目复用候选
  最新进展：已完成。只有 `accepted` 且证据数量达到稳定阈值的 suggestion 才会长成复用候选。
- [x] 复用对象优先限定为：
  - task template candidate
  - quality gate candidate
  - handoff / review checklist candidate
  最新进展：已完成。当前复用候选只会落在这三类对象里，不会扩散到更激进的自动策略。
- [x] 复用入口必须显式人工确认，不做默认自动扩散
  最新进展：已完成。source project 的 Learning Loop 里已新增 `确认进入候选库 / 暂不复用` 人工动作；不确认就不会进入跨项目候选库。
- [x] 复用记录需要能回看“来自哪个项目、依据哪些证据、何时被采纳”
  最新进展：已完成。复用候选记录现在会保留 source project、source suggestion、evidence labels / evidence sources、acceptedAt、reviewedAt 与 reviewNote，并在前台直接展示。

完成标志：

- 已采纳建议不只停留在当前项目，而是能以“候选模板 / 候选策略”的方式被下一个项目安全复用

当前判断：

- 状态：`已完成`
- 当前项目内已经能看到待确认候选与已确认候选库，且确认后的候选会进入后续项目的 runtime prompt，作为可选复用经验继续生效
- 这条闭环目前仍停留在“候选 / 采纳”层，没有越界成自动扩散或自动执行

#### 17.3 当前判断

- 状态：`已完成`
- `A 信息收口 / B suggestion 质量增强 / C 跨项目复用最小闭环` 三包都已经落地到 `store + prompt + Team Room / 群聊前台 + 人工确认动作`
- 当前可以把 `Phase 7-9 第一版主链已完成，并已完成这一轮收口与质量增强闭环` 视为成立判断

### 17.4 这一轮明确不做的事

- [ ] 不做 `Phase 10` 式多轮自治推进
- [ ] 不做 policy 自动改写
- [ ] 不做 learning suggestion 默认自动采纳
- [ ] 不做跨项目自动广播或自动迁移

这些都应等到 Phase 7-9 的收口结果稳定之后，再决定是否开启。

### 17.5 这一轮完成后的验收问题

当下面这些问题都能稳定回答时，才说明这一轮收口基本完成：

- 用户能不能在 10-20 秒内看懂当前 run 停点与最近恢复动作？
- 用户能不能快速分辨哪些是“开放建议”，哪些是“待人审建议”，哪些已经进入默认策略？
- 用户能不能从 suggestion 直接追到证据，而不是只看到抽象结论？
- 用户能不能知道哪些经验已经只属于当前项目，哪些已经成为跨项目复用候选？

如果这些问题还答不上来，就说明当前仍然属于 `收口与质量增强阶段`，不应该提前切去 `Phase 10`。
