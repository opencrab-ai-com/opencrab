# OpenCrab Learning Loop 设计稿

日期：2026-03-23  
状态：Draft  
前置文档：

- [OpenCrab Team OS 设计稿](./team-os-design.md)
- [Task Graph 设计稿](./task-graph-design.md)

## 1. 目标

这份文档回答的问题是：

`一个数字团队如何在多轮任务之后，不只是完成工作，而是真的变得更好？`

这就是 Learning Loop 的职责。

如果没有 Learning Loop，团队系统最多只是：

- 会协作
- 会派工
- 会交付

但不会：

- 复盘
- 纠错
- 调整规则
- 沉淀经验
- 改进组织

## 2. 一句话定义

`Learning Loop = 团队在每轮执行之后，把结果、问题、模式和改进建议结构化沉淀为长期资产，并在后续协作中真正生效的循环机制。`

## 3. 为什么 Learning Loop 是 OpenCrab 的关键差异

很多多 Agent 系统更像“多轮协作 runtime”。

OpenCrab 如果要领先于普通 agent teams，最重要的不是多几个成员，而是：

`让团队在每一次完成任务后，都比上一次更会协作。`

Learning Loop 正是这一层能力。

## 4. 设计目标

- 复盘不是长文总结，而是结构化记录
- 复盘结论必须能落到规则、记忆、模板、技能或角色配置里
- 团队不只是记住“做过什么”，还要记住“怎么做更好”
- 学习过程必须可控，不能让系统悄悄改变核心边界

## 5. Learning Loop 的四层

### 5.1 Reflection Layer

记录一轮工作的回顾：

- 目标是否达成
- 哪些地方顺畅
- 哪些地方卡住
- 哪些角色做得好
- 哪些交接成本高
- 哪些标准不清晰

### 5.2 Pattern Layer

把单次复盘抽象成模式：

- 常见卡点
- 常见返工原因
- 最佳接力顺序
- 常见质量风险
- 哪类任务需要提前 review

### 5.3 Memory Layer

把模式沉淀为长期记忆：

- project memory
- team memory
- agent memory
- task template
- artifact pattern

### 5.4 Policy / Upgrade Layer

让学习结果真正改变未来行为：

- 更新 role policy
- 更新 quality gate
- 更新 task template
- 更新 skill
- 更新 agent profile 的职责与知识

## 6. Reflection 的输入是什么

Learning Loop 不能只读群聊总结，它必须读取结构化信号。

至少包括：

- task graph
- task durations
- blocked events
- review results
- retries
- checkpoint records
- user feedback
- final artifacts
- PM summary
- member progress trail

## 7. Reflection 的输出应该是什么

每一轮最小反思记录建议包含：

- `runId`
- `projectId`
- `phase`
- `outcome`
- `whatWorked`
- `whatBlocked`
- `whatWasUnclear`
- `whichRoleShouldChange`
- `whichTaskPatternShouldUpdate`
- `whichSkillShouldBeCreatedOrImproved`
- `confidence`
- `approvedByHuman`

## 8. 三种记忆层级

### 8.1 Project Memory

只属于当前项目。

记录：

- 项目目标演化
- 特殊约束
- 关键决策
- 当前偏好
- 当前项目的历史坑点

### 8.2 Team Memory

属于这个团队的长期协作方式。

记录：

- 最佳接力顺序
- 高风险 handoff
- 常见 review 失败原因
- 更适合谁先上场
- 哪种 checkpoint 最有价值

### 8.3 Agent Memory

属于单个成员角色。

记录：

- 这个角色最常处理的任务类型
- 最容易犯的错误
- 最适合的输入格式
- 最有效的技能组合

## 9. Learning Loop 应该影响哪些对象

### 9.1 Task Template

复盘之后，可以更新：

- 某类任务的默认拆法
- 默认依赖关系
- 默认验收标准
- 默认 reviewer

### 9.2 Role Policy

复盘之后，可以更新：

- 谁更适合做 owner
- 谁更适合先起草
- 谁更适合做收口
- 哪个角色应提前介入

### 9.3 Quality Gate

复盘之后，可以更新：

- 哪类任务必须 review
- 哪类输出必须附带 artifact
- 哪些检查应前置

### 9.4 Skill

复盘之后，可以决定：

- 是否需要新增 skill
- 是否需要升级某个 skill
- 某个 skill 是否该成为默认工作流的一部分

### 9.5 Agent Profile

复盘之后，可以提出对以下文件的更新建议：

- `soul.md`
- `responsibility.md`
- `tools.md`
- `knowledge.md`

## 10. Human in the Loop 原则

Learning Loop 不能完全自动改写组织。

必须区分：

- 可自动沉淀
- 可自动建议
- 必须人审后生效

### 10.1 可自动沉淀

- reflection record
- run summary
- failure pattern
- team memory item

### 10.2 可自动建议

- role tuning suggestion
- task template suggestion
- skill suggestion
- quality gate suggestion

### 10.3 必须人审

- 修改 agent 核心职责
- 修改团队默认工作流
- 修改高风险 policy
- 修改自动批准规则

## 11. 反思频率设计

### 11.1 微复盘

在每个任务完成或失败后记录。

适合记录：

- 小卡点
- 小优化
- review 问题

### 11.2 阶段复盘

在一个 checkpoint 或阶段结束时记录。

适合记录：

- 阶段顺畅度
- 依赖设计问题
- 成员接力是否合理

### 11.3 项目复盘

在整个项目结束或重大暂停时记录。

适合记录：

- 团队配置是否合理
- 哪些 skill/模板应沉淀
- 下次应如何更快达成目标

## 12. Failure Pattern 系统

Learning Loop 不能只沉淀成功经验，也必须沉淀失败模式。

建议记录这些失败模式：

- PM 过早或过晚派工
- 依赖未显式表达
- 任务验收标准不清
- 成员 claim 后长时间卡住
- 上游结果质量不够却继续下游
- review 缺席导致返工
- 用户 checkpoint 出现过晚

这些模式比“成功经验”更值钱，因为它们更能帮助组织避免重复犯错。

## 13. Learning Loop 与 UI 的关系

### 13.1 用户默认不看底层学习原始数据

大多数用户不应该被一堆 reflection record 淹没。

默认只需要看到：

- 本轮阶段总结
- 本轮问题摘要
- 本轮团队学到了什么

### 13.2 Team Room 可展示学习结果摘要

例如：

- 这轮团队发现“产品 -> 设计 -> 开发”的顺序更稳
- 这类任务建议默认加审美 review
- 这类 landing page 任务建议复用某个 task template

### 13.3 高级视图再展示“组织学习”明细

适合高级用户或团队操作者查看：

- 失败模式分布
- 常见卡点
- 最佳角色顺序
- 高频 review 问题

## 14. 与 Task Graph 的关系

Learning Loop 不是独立系统，它必须建立在 Task Graph 之上。

没有 Task Graph，Learning Loop 会退化成：

- 群聊总结
- 主观判断
- 无法复用的长文复盘

有了 Task Graph，Learning Loop 才能真正回答：

- 哪类任务经常卡住
- 哪个状态最常返工
- 哪个角色最常在错误时机介入
- 哪类 artifact 最需要前置 review

## 15. Learning Loop 的产物应该去哪里

建议新增或长期沉淀这些资产：

- `team-memory.json`
- `reflection-records.json`
- `failure-patterns.json`
- `task-templates.json`
- `role-tuning-suggestions.json`
- `quality-policy-suggestions.json`

同时允许把高价值结论回流到：

- 智能体 md 文件
- skill 文档
- Team Room 默认模板

## 16. MVP 落地建议

### Phase 1

最小可用复盘系统：

- run summary
- what worked / what blocked
- waiting_user / waiting_approval 结构化记录

### Phase 2

团队学习资产：

- failure pattern
- team memory
- task template suggestion

### Phase 3

真正的自我进化：

- role tuning suggestion
- quality gate suggestion
- skill upgrade suggestion
- human-approved policy update

## 17. 最终结论

没有 Learning Loop 的 Team Mode，最多只是“会协作的 runtime”。

有了 Learning Loop，OpenCrab 才有可能从：

- 会执行
- 会协作

走向：

- 会总结
- 会学习
- 会逐轮变好

这也是 OpenCrab 最有机会领先普通 agent teams 的地方。
