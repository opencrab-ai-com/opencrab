# OpenCrab Web / Desktop 双端升级唯一操作指南

更新时间：2026-03-29  
指南版本：`v1`  
状态：唯一操作指南  
适用范围：后续所有需要同时支持 web / desktop 演进的开发任务  
说明：

- 本文档已吸收原来的 `Runtime Contract 执行计划` 与 `Desktop 薄壳执行协议`
- 后续开发只维护这一份正文

## 1. 这份文档的定位

这份文档是后续日常开发中：

`唯一需要优先打开和执行的操作指南。`

如果你准备开发：

- 对话
- Tasks
- Channels
- Team Mode
- Agents
- runtime
- desktop 能力
- web / desktop 同步升级

默认先看这份文档。

它现在不是摘要文档，而是唯一正文。

## 2. 一句话总原则

`OpenCrab 只有一个 runtime core；web 和 desktop 只是两个产品入口；desktop 只能做薄壳和平台适配，不能拥有第二套底层运行语义。`

## 3. 先记住这 8 条铁律

1. 所有真正影响产品结果的逻辑，优先进入 shared runtime core。
2. desktop 只能提供平台能力，不能决定业务状态。
3. 任何新功能都先定义 `Work Object`、`Trigger`、`Run`、`Delivery`、`Attention`，再写代码。
4. Tasks、Channels、Team Mode 不是独立子系统，而是同一 runtime contract 的不同产品表面。
5. Codex 当前是第一 runtime backend，不是系统本体。
6. 任何会影响 web / desktop 最终结果一致性的逻辑，都不能只写在 desktop。
7. 任何 duplicated runtime logic 都视为架构倒退。
8. 如果一段代码删掉 Electron 之后仍然应该成立，那它大概率不该写在 `desktop/`。

## 4. 后续开发的唯一判断顺序

每做一个功能，都按这个顺序判断，不要跳步。

### 第一步：这是哪个工作对象的能力

先回答它服务于什么 `Work Object`：

- `Conversation`
- `Task`
- `Project / Team Room`
- `Channel Binding`
- `Approval Item`
- 后续的 `Inbox Item` / `Artifact Board`

如果这个问题答不清楚，先别写实现。

### 第二步：它通过什么触发源进入 runtime

触发源必须能归到统一 trigger 里：

- `direct_message`
- `scheduled_run`
- `channel_ingress`
- `team_dispatch`
- `resume_after_approval`
- `manual_retry`
- `webhook_event`
- `system_recovery`

如果你发现自己在写一个“特殊入口”，先停下来，看看能不能归到已有 trigger。

### 第三步：它会产生什么 Run

每次正式执行都应该能回答：

- 为谁而跑
- 为什么被触发
- 用哪个 runtime thread
- 当前状态是什么
- 最终结果去哪

如果你写的是“某个页面直接调一下模型”，但说不清这次 run 的身份，那说明还没落到正确层级。

### 第四步：结果去哪

先分清楚：

- `Delivery Target`
  结果落在哪
- `Attention Policy`
  什么时候打扰用户

绝不能再把“回流”和“通知”混成一件事。

### 第五步：是否需要 approval

只要涉及：

- shell
- 文件改写
- patch
- browser
- 外部 channel 发送
- 高风险 team / task 自动推进

都要先想清楚 approval checkpoint 放在哪。

### 第六步：这是 runtime core 还是平台 adapter

这是整个指南里最关键的一步。

判断规则只有一句：

`改变产品运行结果的，进 runtime core；只是把平台能力接进来的，进 adapter。`

## 5. 代码归属速查表

## 5.1 应该放进 shared runtime core 的内容

默认落点：

- `lib/runtime/*`
- `lib/resources/*`
- `lib/tasks/*`
- `lib/channels/*`
- `lib/projects/*`
- `lib/agents/*`
- `lib/skills/*`
- `lib/codex/*`
- `lib/modules/*`
- `lib/server/*`
- `app/api/*`

这些内容必须共享：

- runtime lock
- startup / bootstrap / health
- task runner
- channel dispatcher
- project / team runtime
- browser session
- Codex executable / backend 接入
- store schema / normalize / migration
- result target / delivery / attention / approval 语义

## 5.2 应该放进产品表面的内容

默认落点：

- `app/(app)/*`
- `components/*`
- `lib/view-models/*`

这层负责：

- 页面
- 表单
- 状态展示
- 操作入口
- 用户语言

这层不能偷偷定义新的 runtime 语义。

## 5.3 应该放进 desktop adapter / shell 的内容

默认落点：

- `desktop/*`
- `scripts/desktop/*`

允许存在的内容：

- Electron 主进程
- preload
- IPC bridge
- 文件选择器
- reveal path
- 系统通知
- 菜单 / 托盘 / Dock
- 自动更新
- 打包 / 签名 / 分发
- 桌面级错误弹窗

这层不能做的事：

- 自己维护 runtime lock
- 自己维护 bootstrap / task runner / team runtime
- 直接改写 `state/*.json`
- 复制 shared core 的路径 / origin / protocol / runtime 规则

## 5.4 当前 backend 的归属

当前第一阶段 backend 仍然是：

- `CodexRuntime`

对应现状主要落点：

- `lib/codex/*`
- `lib/conversations/run-conversation-turn.ts`

后续所有扩展都要记住：

- backend 不是宿主层
- backend 只负责执行
- OpenCrab 自己必须拥有外层 contract

## 6. 四类高频开发场景怎么做

## 6.1 新增或重构 Tasks 能力

正确顺序：

1. 先定义它属于哪种任务语义
   - 提醒型
   - 监控型
   - 周期产出型
   - 持续推进型
2. 再定义它的 trigger 是什么
3. 再定义它的 result target、delivery policy、attention policy
4. 再落到：
   - `lib/tasks/types.ts`
   - `lib/tasks/task-store.ts`
   - `lib/tasks/task-runner.ts`
   - `app/api/tasks/*`
   - `components/tasks/*`

禁止做法：

- 先在 tasks 页面里加按钮，再倒推 runtime 语义
- 让任务只变成“到点发一句 prompt”
- 把任务结果默认混回聊天而不区分 target

## 6.2 新增或重构 Channels 能力

正确顺序：

1. 先定义这个能力属于：
   - ingress
   - ambient collaboration
   - attention layer
   - delivery layer
2. 再定义它绑定哪个工作对象
3. 再定义它是 trigger、delivery，还是 approval participation
4. 再落到：
   - `lib/channels/*`
   - 必要的 `lib/runtime/*` / `lib/modules/*`
   - `app/api/channels/*`
   - `components/channels/*`

禁止做法：

- 把 channel 当成独立宇宙
- 在 channel 页面里偷偷定义独立状态机
- 只做“收发消息”，不绑定工作对象

## 6.3 新增或重构 Team Mode 能力

正确顺序：

1. 先判断这是：
   - PM runtime 能力
   - 成员 runtime 能力
   - shared task graph 能力
   - governance / checkpoint 能力
   - memory / learning loop 能力
2. 再定义它会产出什么 run / event / checkpoint
3. 再落到：
   - `lib/projects/*`
   - `lib/modules/projects/*`
   - 必要的 `lib/runtime/*`
   - `app/api/projects/*`
   - `components/projects/*`

禁止做法：

- 把 Team Mode 当成“项目页特例”
- 把关键协作状态只存在 UI 组件里
- 为 Team Mode 单独发明与任务、渠道不兼容的运行语义

## 6.4 新增或重构 agent harness / runtime 能力

正确顺序：

1. 先问它属于：
   - runtime contract
   - runtime service
   - tool router
   - approval layer
   - scheduler / queue
   - memory / compaction
   - runtime backend
2. 明确它是否会改变：
   - run contract
   - event model
   - delivery
   - attention
   - recovery
3. 再决定落点：
   - `lib/runtime/*`
   - `lib/codex/*`
   - `lib/modules/*`
   - `lib/server/*`

禁止做法：

- 直接把 Codex 行为当成 OpenCrab 正式语义
- 因为当前先能跑，就跳过 contract 设计
- 为 web / desktop 分别接不同 runtime 行为

## 7. 标准开发流程

以后所有支持 web / desktop 双端升级的功能，统一按这个流程推进。

### Step 1：写清产品语义

至少写清：

- 这是哪个工作对象的能力
- 它由什么触发
- 结果去哪
- 什么时候通知
- 是否需要审批

### Step 2：先改 shared runtime core

优先改：

- `lib/*`
- `app/api/*`

而不是先改页面或 desktop 壳层。

### Step 3：补产品表面

再改：

- `components/*`
- `app/(app)/*`

让用户能理解和操作这项能力。

### Step 4：如果需要，再补 desktop adapter

只有当功能真的需要 OS 能力时，才进入：

- `desktop/*`
- `scripts/desktop/*`

### Step 5：补测试

最少分三层检查：

1. shared core 测试
2. adapter contract 测试
3. desktop shell smoke test

### Step 6：更新文档

如果这次改动改变了：

- runtime contract
- desktop 边界
- 新功能接入规则

就必须同步更新文档，而不是只改代码。

## 8. 明确禁止的开发行为

下面这些行为，一律视为不符合本指南：

1. 为 desktop 单独补一份 runtime 逻辑。
2. 在 `desktop/` 里写业务状态机。
3. 在 UI 层偷偷维护正式运行状态。
4. 因为“先修 bug 更快”，就在 desktop 层做产品补丁。
5. 因为“当前模块最方便”，就在 Tasks / Channels / Team Mode 里各自维护平行 contract。
6. 继续把 Codex 当成 OpenCrab 的系统本体。
7. 把 generated bundle 当源码维护。

## 9. 提交前检查清单

每个 PR 提交前，至少自查这 10 个问题：

1. 这个功能服务于哪个 `Work Object`？
2. 它通过什么 `Trigger` 进入 runtime？
3. 它会产生什么 `Run` 和 `RunEvent`？
4. 它的 `Delivery Target` 是什么？
5. 它的 `Attention Policy` 是什么？
6. 它是否需要 `Approval Checkpoint`？
7. 这段逻辑是否真的属于 shared runtime core？
8. 如果删掉 Electron，这段逻辑还应不应该成立？
9. web 和 desktop 在同一输入下，最终结果是否仍然一致？
10. 我这次有没有在某处复制已有 runtime 规则？

只要有一条回答不清楚，就不应直接合并。

## 10. 什么时候应该先停下来改文档，而不是继续写代码

遇到下面几种情况，先更新文档，再继续开发：

- 你发现现有 `Trigger` 类型不够表达新的入口
- 你发现现有 `Delivery Target` 不够表达新的结果落点
- 你发现 approval 规则开始跨模块冲突
- 你发现 Tasks、Channels、Team Mode 在用不同语言描述同一种运行语义
- 你发现 desktop 不得不开始承载 runtime 逻辑

这说明你不是在写普通功能，而是在改变 contract。

## 11. 开发优先级建议

后续如果要支持持续演进，建议按这个优先级推进：

1. `Run / Event / Checkpoint` 正式化
2. `Trigger / Delivery / Attention` 正式化
3. `Tool Router / Approval Layer`
4. `Scheduler / Queue / Interrupt`
5. `Memory / Compaction`
6. `Codex -> Runtime Backend` 降级
7. `Workflow / Team / Task / Channel` 统一模式化
8. `Desktop first-run` 体验增强

也就是说：

- 先统一 runtime core
- 再增强 product surface
- 最后再做更深的 desktop 体验优化

## 12. Done Definition

一个功能只有同时满足下面这些条件，才算真正完成了双端可升级支持：

1. 它的 runtime 语义进入了 shared core。
2. web 和 desktop 使用同一套底层结果逻辑。
3. desktop 只承担必要的壳层 / adapter 职责。
4. 它已经明确 trigger、delivery、attention、approval 边界。
5. 它不会逼出新的平行 runtime。

## 13. 最终结论

后续 OpenCrab 的开发，不应该再按“web 功能”和“desktop 功能”来拆。

更准确的拆法应该是：

- `共享 runtime core 能力`
- `产品表面能力`
- `desktop 平台适配能力`
- `runtime backend 能力`

只要一直按这个指南推进，你后面继续优化：

- 定时任务
- Channels
- Team Mode
- agent harness
- web / desktop 宿主

都还能继续收敛到同一个内核，而不会演变成两套越来越难维护的系统。
