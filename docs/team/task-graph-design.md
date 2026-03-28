# OpenCrab Task Graph 设计稿

日期：2026-03-23  
状态：Draft  
前置文档：

- [OpenCrab Team OS 设计稿](./team-os-design.md)
- [Learning Loop 设计稿](./learning-loop-design.md)

## 1. 目标

这份文档回答一个核心问题：

`OpenCrab 团队里的“工作”到底应该如何被表示、分配、依赖、交接、审核和完成？`

当前很多多 Agent 系统的问题，是把“消息”误当成“任务”。

Task Graph 的目标，就是让 OpenCrab 的团队协作从：

- 消息驱动

升级为：

- 任务驱动

## 2. 一句话定义

`Task Graph = 一组有 owner、有依赖、有交付物、有验收标准、有状态流转规则的结构化任务网络。`

## 3. 为什么必须做 Task Graph

如果没有 Task Graph，团队系统会长期停留在下面几种低级状态：

- PM 只能靠自然语言派工
- 群聊消息会变成事实来源
- 很难判断什么真的完成了
- 很难处理依赖、并行、返工、审核、阻塞
- 很难做长期复盘与模式学习

Task Graph 是 Team OS 的工作骨架。

## 4. 设计目标

- 任务是第一公民
- 依赖是显式结构，不靠文本猜
- 任务状态流是结构化的，不靠“看起来像完成”
- 每个任务都有 owner
- 每个任务都能绑定 artifact 和 review
- 任务可以成为长期复盘和模板化的基础

## 5. 核心对象

### 5.1 Task

一个任务最小需要包含：

- `id`
- `projectId`
- `title`
- `description`
- `status`
- `priority`
- `ownerAgentId`
- `stageLabel`
- `acceptanceCriteria`
- `outputArtifactIds`
- `dependsOnTaskIds`
- `blockedReason`
- `createdAt`
- `updatedAt`
- `startedAt`
- `completedAt`

### 5.2 Task Status

建议的基础状态流：

- `draft`
- `ready`
- `claimed`
- `in_progress`
- `in_review`
- `blocked`
- `waiting_input`
- `completed`
- `reopened`
- `cancelled`

### 5.3 Dependency Edge

依赖边用于表达：

- 先后顺序
- 审核前置
- 资源前置
- 信息前置

边类型建议至少支持：

- `finish_to_start`
- `review_to_start`
- `artifact_required`
- `input_required`

### 5.4 Claim

任务 claim 用于表达：

- 谁已经接了这个任务
- 是否拥有执行 lease
- lease 是否过期
- 是否允许被抢占

### 5.5 Artifact Link

任务完成不应只有文字总结，还需要绑定交付物：

- 文档
- 文件
- 页面
- 截图
- 链接
- 代码路径

### 5.6 Review

Review 是任务图的一部分，而不是后处理。

Review 最少需要表达：

- reviewer
- review target
- verdict
- blocking comments
- follow-up task

## 6. 任务状态流

### 6.1 创建

PM、用户或系统可以创建任务。

初始状态通常是：

- `draft`
或
- `ready`

### 6.2 就绪

当任务具备：

- 明确目标
- 明确 owner
- 明确依赖
- 基本验收标准

时，进入 `ready`。

### 6.3 认领

任务被某成员接手后进入：

- `claimed`

这里的 claim 可以来自：

- PM 指派
- 成员自领
- 系统自动恢复先前 lease

### 6.4 执行

真正开始运行时进入：

- `in_progress`

系统需要同时记录：

- runtimeConversationId
- startedAt
- heartbeat
- progressLabel
- currentSubstep

### 6.5 审核

成员提交结果后，任务进入：

- `in_review`

注意：

“成员回复了一段结果”不等于完成。  
只有 review 通过后，任务才能真正 close。

### 6.6 阻塞

如果发生：

- 依赖未满足
- 输入不足
- 文件锁冲突
- 上游结果不可信
- runtime stuck

任务进入：

- `blocked`
或
- `waiting_input`

### 6.7 完成

满足验收标准后进入：

- `completed`

### 6.8 返工

如果 review 不通过，任务进入：

- `reopened`

## 7. 依赖模型

### 7.1 线性接力只是最小形态

当前很多系统只有“上一棒 -> 下一棒”。

这只是最简单的接力链，不足以表达真实项目。

Task Graph 需要至少支持：

- 串行依赖
- 并行分支
- 汇合节点
- 审核前置
- 外部输入依赖

### 7.2 自动解锁

一旦上游任务完成或 review 通过，下游任务应自动从：

- `blocked`

转为：

- `ready`

### 7.3 阻塞信息必须显式可见

每一个阻塞都要能被解释：

- 等谁
- 等什么 artifact
- 等什么用户输入
- 等什么 review

## 8. Ownership 与 Lock

### 8.1 Owner 必须唯一

任何时刻，一个任务只能有一个主 owner。

可以有：

- reviewer
- watcher
- collaborator

但只能有一个主 owner。

### 8.2 文件或目录锁

某些任务执行时，必须持有资源锁：

- 文件锁
- 路径锁
- 模块锁
- artifact 锁

防止出现：

- 多人同时改同一文件
- 多人同时写同一交付物
- review 和修改并发冲突

### 8.3 Lease 过期

如果成员卡住太久，lease 可过期并触发：

- PM 重试
- 替换 owner
- 重新 claim

## 9. PM 与 Task Graph 的关系

PM 不应该再只做“语言派工”，而应该成为任务图控制者。

PM 的职责包括：

- 创建任务
- 分配 owner
- 维护依赖
- 判断是否并行
- 发起 review
- 判断是否进入 checkpoint
- 在任务图中完成阶段收束

PM 的核心产物不只是群聊消息，而应该是：

- 任务创建
- 任务状态迁移
- review 决策
- checkpoint 决策

## 10. 成员与 Task Graph 的关系

成员不是“自由说话的人”，而是：

- claim 任务的人
- 执行任务的人
- review 任务的人
- handoff 任务的人

成员在任务图中必须能表达：

- 我当前拥有哪项任务
- 我被什么阻塞
- 我交付了什么 artifact
- 我需要谁 review
- 我要把任务交给谁

## 11. 用户与 Task Graph 的关系

用户不应该直接被复杂任务图淹没，但任务图必须支撑用户体验。

用户可见层应该只展示：

- 当前阶段
- 当前在做的任务
- 当前卡点
- 当前结果
- 待确认节点

当用户需要更深控制时，再暴露：

- 任务列表
- 依赖关系
- 当前 owner
- review 状态

## 12. Team Room 如何展示 Task Graph

### 12.1 默认态

展示压缩任务视图：

- 当前 active task
- 下一批 ready tasks
- 当前 blocked tasks
- 当前 review tasks

### 12.2 扩展态

展示更完整的任务板：

- Kanban 视图
- 依赖图视图
- 责任人视图
- 交付物视图

### 12.3 群聊映射

群聊里展示的消息应是任务状态变化的投影，例如：

- PM 已创建任务
- 开发工程师已认领任务
- 设计任务已完成并等待审美 review
- 团队在等待用户补充目标

## 13. 与复盘系统的关系

Task Graph 是 Learning Loop 的原材料。

每轮复盘都应该基于任务图回答：

- 哪些任务流转顺畅
- 哪些状态频繁返工
- 哪种依赖最容易卡住
- 哪类任务经常缺验收标准
- 哪个角色经常被过早或过晚介入

如果没有 Task Graph，复盘很难真正结构化。

## 14. MVP 落地建议

### Phase 1

最小可用任务实体：

- Task
- owner
- status
- dependsOn
- acceptanceCriteria
- artifactRefs

### Phase 2

任务图治理：

- claim / lease
- blocked
- review
- reopen
- checkpoint

### Phase 3

高级能力：

- file lock
- self-claim
- auto-unblock
- task templates
- risk scoring

## 15. 最终结论

OpenCrab 要想从“多 Agent 协作”进化到“数字团队操作层”，必须让任务成为团队协作的真实骨架。

没有 Task Graph，Team Mode 最终仍然会退化成：

- 群聊驱动
- 消息驱动
- PM 单点驱动

有了 Task Graph，团队才有机会进入：

- 结构化分工
- 可恢复依赖管理
- 可解释的协作状态
- 可学习的组织行为
