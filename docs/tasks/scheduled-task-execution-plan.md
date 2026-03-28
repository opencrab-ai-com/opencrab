# OpenCrab 定时任务优化执行路径

更新时间：2026-03-23
状态：执行基线文档

这份文档不是背景介绍，而是后续开发的执行路径。

目标很明确：

- 把 `OpenCrab` 的定时任务，从“已可用功能”推进到“清晰、可信、可扩展的工作台能力”
- 后续产品和开发尽量按这条路径推进，避免来回摇摆

## 一、目标定义

`OpenCrab` 的定时任务，目标不是做成：

- 一个高级提醒器
- 一个暴露给用户的 cron 面板

而是做成：

`能按节奏唤醒某个工作上下文继续运行的后台执行能力。`

对应到产品上，它必须同时满足这四个条件：

1. `任务独立`
任务必须是一等对象，有自己的状态、运行记录和生命周期。

2. `上下文归属清楚`
任务必须知道自己是在继续哪个工作对象。

3. `结果出口明确`
任务必须知道每次运行的结果落到哪里，怎么提醒用户。

4. `能长期融入工作流`
任务不能只是“到点发一句话”，而要能支持提醒、监控、周期产出和持续推进。

## 二、状态标记

- `已完成`：当前产品已经具备，后续只需小修
- `部分完成`：方向正确，但语义、交互或实现还不完整
- `未开始`：当前没有正式设计或实现
- `暂缓`：知道要做，但不进入当前主路径

## 三、当前基线

先对当前状态做一个简短判断。

### 已经做对的部分

- 任务已经是独立对象，不是消息上的附属动作
- 任务已支持绑定 `conversationId` 或 `projectId`
- 任务无绑定目标时，会自动创建专属任务对话
- 任务详情页已经把“结果回流”作为正式概念展示
- 任务有独立的 run history、状态、下一次执行时间和最近执行结果

对应现状代码：

- [lib/tasks/task-store.ts](../../lib/tasks/task-store.ts)
- [lib/tasks/task-runner.ts](../../lib/tasks/task-runner.ts)
- [components/tasks/task-form.tsx](../../components/tasks/task-form.tsx)
- [components/tasks/task-detail-screen.tsx](../../components/tasks/task-detail-screen.tsx)

### 还没有真正完成的部分

- 任务类型还没有正式分层
- “结果目标”还不是创建时的核心产品概念
- “结果回流”和“通知方式”还没有分开
- run history 还更像记录，不是任务叙事主干
- Team Mode 绑定虽然存在，但还没长成“团队节奏器”
- runtime 和 delivery 语义还不够完整

## 四、执行路径总览

| 步骤 | 主题 | 当前状态 | 结论 |
| --- | --- | --- | --- |
| 01 | 产品语义收敛 | 部分完成 | 先把任务类型、目标、通知三层概念正式化 |
| 02 | 领域模型升级 | 部分完成 | 当前 schema 能跑，但还不够表达 V2 能力 |
| 03 | 创建流程 V2 | 部分完成 | 现有表单可用，但不够上下文化 |
| 04 | 结果目标与通知模型 | 未开始 | 必须正式拆开 |
| 05 | run history 叙事化 | 部分完成 | 当前有记录，但缺“可理解的变化感” |
| 06 | 对话与 Team Mode 深化整合 | 部分完成 | 已有基础，但还不是工作流主线 |
| 07 | runtime / delivery 强化 | 部分完成 | 需要补更成熟的后台执行语义 |
| 08 | 渠道 / inbox / webhook 扩展 | 未开始 | 作为第二阶段扩展能力 |
| 09 | 评估与稳定性治理 | 未开始 | 必须在功能成型后补上 |

下面按顺序展开。

## 五、步骤 01：产品语义收敛

状态：`部分完成`

### 目标

把定时任务的产品语言彻底定下来，避免后续页面、接口、runtime 各说各话。

### 当前已有

- 已经明确“任务是独立对象”
- 已经有 conversation / project 两种回流目标
- 已经有定时执行与 run record 的基础能力

### 当前缺口

下面三个概念还没有正式进入产品定义：

1. `任务类型`
至少要区分：
- 提醒型
- 监控型
- 周期产出型
- 持续推进型

2. `结果目标`
至少要区分：
- 回流到当前 conversation
- 回流到 Team Room
- 独立 task-only space

3. `通知方式`
至少要区分：
- 仅沉淀结果
- 结果沉淀 + 轻提醒
- 结果沉淀 + 强提醒 / 渠道投递

### 本步骤需要补什么

- 一页产品术语定义
- 一页任务类型定义
- 一页结果目标与通知模型定义

### 完成标准

- 后续前端、接口、store、runtime 都统一使用同一套概念
- 不再把“结果放哪”和“怎么提醒”混成一件事

## 六、步骤 02：领域模型升级

状态：`部分完成`

### 目标

让数据结构能够表达 V2 任务能力，而不只是表达“一个 prompt 定时跑一下”。

### 当前已有

- `TaskRecord`
- `TaskRunRecord`
- `conversationId`
- `projectId`
- `schedule`
- `status`

对应：

- [lib/tasks/types.ts](../../lib/tasks/types.ts)

### 当前缺口

当前 schema 还缺这些正式字段：

- `taskType`
- `resultTargetType`
- `resultTargetId`
- `notificationMode`
- `lastRunNeedsAttention`
- `lastRunDeltaSummary`
- `createdFrom`

### 本步骤需要补什么

- 更新 `lib/tasks/types.ts`
- 更新 `lib/resources/opencrab-api-types.ts`
- 更新 `lib/tasks/task-store.ts` 的 normalize / persistence
- 补兼容旧数据的 migration 逻辑

### 完成标准

- 新旧任务都能被正常读取
- 新模型能表达“任务类型 + 结果目标 + 通知方式”

## 七、步骤 03：创建流程 V2

状态：`部分完成`

### 目标

让创建任务从“通用表单填写”升级成“有上下文意识的创建体验”。

### 当前已有

- 任务表单简洁可用
- 支持 schedule preset
- 支持模板卡片入口

对应：

- [components/tasks/task-form.tsx](../../components/tasks/task-form.tsx)
- [components/tasks/tasks-screen.tsx](../../components/tasks/tasks-screen.tsx)

### 当前缺口

- 还没有显式选择任务类型
- 还没有显式确认结果目标
- 还没有显式确认通知方式
- 从 conversation / Team Room 创建时，还缺更自然的上下文默认值

### 本步骤需要补什么

1. 创建入口分层
- 从任务页创建
- 从 conversation 创建
- 从 Team Room 创建

2. 表单结构升级
- 第一步：这是什么类型的任务
- 第二步：何时执行
- 第三步：结果回到哪里
- 第四步：如何提醒我

3. 默认策略
- 从普通聊天创建且明显是延续任务：默认回到当前 conversation
- 从 Team Room 创建：默认回到当前 Team Room
- 从模板创建的监控/产出型任务：默认 task-only space

### 完成标准

- 用户在创建时就能理解“这条任务以后怎么工作”
- 创建后不需要再猜结果会跑到哪里

## 八、步骤 04：结果目标与通知模型

状态：`未开始`

### 目标

把“回流结果”和“通知用户”彻底拆开。

### 为什么这是关键步骤

如果不拆开，后面会一直陷在这类问题里：

- 结果是不是一定要刷一条消息
- 回流到 Team Room 是不是等于通知用户
- 纯提醒任务要不要产生完整 run 对话

### 推荐模型

#### 结果目标

- `conversation`
- `project`
- `task_space`

#### 通知方式

- `none`
- `passive`
- `notify`
- `channel_delivery`（未来）

### 本步骤需要补什么

- schema 字段
- task detail UI
- create / update API
- runner 完成后的分发逻辑

### 完成标准

- 结果沉淀与用户提醒可以独立配置

## 九、步骤 05：run history 叙事化

状态：`部分完成`

### 目标

把 run history 从“日志”变成“任务主叙事”。

### 当前已有

- 有执行时间
- 有成功/失败状态
- 有 summary
- 有错误消息

### 当前缺口

用户现在还不容易直接看出：

- 这次相比上次有什么变化
- 这次是否需要我接手
- 这次是提醒、监控、产出还是推进
- 这次产出了什么正式结果

### 本步骤需要补什么

- `delta summary`
- `needs attention`
- `artifact summary`
- 更强的 run card 结构

### 完成标准

- 用户打开任务详情时，不需要读完整对话就能理解最近发生了什么

## 十、步骤 06：对话与 Team Mode 深化整合

状态：`部分完成`

### 目标

让定时任务真正成为 conversation 和 Team Mode 的“节奏器”。

### 当前已有

- conversation 回流
- project 回流
- 无目标时自动创建任务对话

对应：

- [lib/tasks/task-runner.ts](../../lib/tasks/task-runner.ts#L101)

### 当前缺口

- Team Room 里的任务还缺更强的产品心智
- “继续当前工作”与“独立后台运行”的区分还没正式命名
- 任务回流到 conversation 后，缺少“这是一次后台续跑”的更清楚表达

### 本步骤需要补什么

- 在 conversation / Team Room 里显示任务来源和 run metadata
- 为 Team Room 任务补“节奏性推进”状态文案
- 为 conversation 回流补“后台续跑结果”标识

### 完成标准

- 用户能明显感觉到：任务是在“继续推进工作”，而不是“系统突然插进来发一条消息”

## 十一、步骤 07：runtime / delivery 强化

状态：`部分完成`

### 目标

让定时任务在 runtime 层更接近成熟系统能力，而不是单轮执行器。

### 当前已有

- due task 执行器
- 运行中去重
- 任务 run 记录
- project / conversation 双路径

### 当前缺口

- 还没有正式的 main-context vs isolated-run 语义
- delivery 语义还不够完整
- 缺少 retry/backoff / richer failure policy
- 缺少更清楚的 wake / trigger 语义

### 推荐优化

向 OpenClaw 借鉴底层思路，但不要照搬前台术语：

- `continue current workspace`
底层相当于 main-context 续跑

- `run in background`
底层相当于 isolated session

### 本步骤需要补什么

- `executionMode` 抽象
- richer failure policy
- retry / backoff
- timeout / budget
- stronger delivery handler

### 完成标准

- 任务系统不仅能跑，而且在失败、重试、噪音控制上更成熟

## 十二、步骤 08：渠道 / inbox / webhook 扩展

状态：`未开始`

### 目标

把任务结果从“只回到本地工作空间”扩展到多出口体系。

### 为什么这一层现在暂缓

如果前面的任务类型、目标、通知、run 叙事没定清楚，过早扩 webhook/channel 只会让系统更乱。

### 未来方向

- channel delivery
- webhook delivery
- inbox aggregation
- daily digest / attention queue

### 完成标准

- 任务结果既能留在 OpenCrab，也能选择性投递到外部

## 十三、步骤 09：评估与稳定性治理

状态：`未开始`

### 目标

让定时任务从“功能可用”进入“持续稳定可迭代”阶段。

### 需要补什么

- 固定任务样例集
- 手工评估 checklist
- 失败场景回归集
- 运行指标面板

### 推荐重点指标

- 准时触发率
- 运行成功率
- 失败后恢复率
- 需要用户介入比例
- 回流目标准确率
- 用户是否继续跟进该任务结果

### 完成标准

- 每次任务系统升级后，都能知道是否真的更好，而不是只凭感觉

## 十四、推荐开发顺序

后续开发建议严格按下面顺序进行：

1. `步骤 01`
先定语义，不先上功能

2. `步骤 02`
把 schema 扩出来

3. `步骤 03`
升级创建流程

4. `步骤 04`
拆结果目标与通知模型

5. `步骤 05`
让 run history 成为主叙事

6. `步骤 06`
深化 conversation / Team Mode 融合

7. `步骤 07`
补 runtime 能力

8. `步骤 08`
再做渠道和 webhook 扩展

9. `步骤 09`
补治理和评估

## 十五、当前建议：下一步先做什么

如果只选一个下一步，我建议优先做：

`步骤 01 + 步骤 02`

也就是：

- 正式定义任务类型
- 正式定义结果目标
- 正式定义通知方式
- 更新 schema

原因很简单：

如果这四件事不先定，后面的表单、详情页、Team Mode、delivery、run history 都会反复返工。

## 十六、版本纪律

后续关于定时任务的产品与开发讨论，默认以这份文档作为基线。

如果要改路径，建议遵循这条规则：

- 小修：直接更新对应步骤状态与缺口
- 大改：先更新本路线图，再进入实现

这样可以保证：

- 产品判断不漂移
- 实现顺序不乱掉
- 每次讨论都能回到同一条主线上
