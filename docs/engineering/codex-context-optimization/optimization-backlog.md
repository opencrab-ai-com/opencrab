# Prompt And Memory Optimization Backlog

更新时间：2026-04-02
状态：待排期

这份 backlog 只讨论一件事：

`OpenCrab` 后续如何把普通对话 / agent 对话的 prompt 注入、thread 续接、缓存命中率和恢复能力做得更稳。

## 优化目标

1. 降低重复注入长 agent md 带来的 token 占用
2. 尽量保持或提升 `prompt caching` 命中率
3. 降低长对话里 compaction 后角色约束漂移的风险
4. 在线程丢失、重建、agent 配置变更时，仍然能稳定恢复
5. 在不引入过度复杂度的前提下，给后续自研 memory layer 留接口

## 不建议直接采用的方案

### 方案：首轮完整注入，后续完全不注入

当前不建议直接这样做。

原因：

- 会把角色一致性过度交给底层 thread 黑盒维持
- 线程重建时很容易丢失长期角色约束
- 一旦 agent 文件改了，旧 thread 和新配置容易失配
- 出现问题时，OpenCrab 很难判断是 cache、compaction 还是 prompt seed 出了偏差

## 推荐的优化方向

### 1. 先做观测，不要先拍脑袋改 prompt lifecycle

优先级：`P0`

建议新增的观测项：

- 每轮 `input_tokens`
- 每轮 `cached_input_tokens`
- cache 命中率
- thread 创建次数 vs `resumeThread()` 次数
- agent prompt 体积
- 长对话中 thread 重建次数
- 失败恢复后首轮 token 体积

建议结果落点：

- conversation turn metadata
- 调试面板或开发日志
- 长期可进入后续 evaluation 文档

### 2. 把 agent prompt 拆成“核心层”和“扩展层”

优先级：`P0`

推荐拆法：

- 核心层：每轮都注入
  - agent 名称
  - 角色标签
  - 必须遵守的职责边界
  - 少量最关键的行为规则
- 扩展层：按需注入
  - 大段 `knowledge.md`
  - 很长的 `tools.md`
  - 只在特定场景才需要的补充说明

目标不是“后续完全不注入”，而是“后续只持续注入最必要的短约束”。

### 3. 给 conversation 增加 agent prompt 版本感知

优先级：`P0`

建议增加类似字段：

- `agentProfileVersion`
- `agentPromptHash`
- `lastFullAgentSeedAt`

作用：

- agent 文件一旦变化，可判断当前 thread 是否仍然可信
- 可以显式触发“完整重 seed”
- 避免新旧 prompt 配置与旧 thread 混跑

### 4. 定义“完整重 seed”的触发条件

优先级：`P1`

建议的触发条件：

- 新建 conversation
- `codexThreadId` 丢失或无效
- agent 文件 hash 变化
- 长时间 idle 后首次恢复
- 明确检测到 thread 恢复失败
- 手动点击“重置 agent 上下文”

### 5. 为 thread 丢失场景准备 OpenCrab 侧轻量恢复包

优先级：`P1`

当前普通对话还没有自己的本地摘要层。后续可以先做“轻量恢复包”，而不是立刻上完整 memory system。

建议恢复包内容：

- 最近几轮高价值消息
- 当前 agent 核心约束
- 关键用户偏好
- 最近一次阶段性目标
- 最近一次明确的产出格式要求

这个恢复包只用于：

- thread 丢失
- thread 重建
- 明确要求重新对齐上下文

### 6. 让 OpenCrab 自己感知 cache 是否真的在工作

优先级：`P1`

建议加入一些明确判断：

- 如果 `cached_input_tokens` 长期接近 `0`
- 而 prompt 前缀理论上高度稳定
- 说明当前 prompt 装配方式可能在破坏前缀稳定性

常见破坏因素可能包括：

- 注入顺序不稳定
- 动态时间戳混入 prompt
- skills 列表顺序变化
- agent 文件拼接格式频繁变化

### 7. 做一次 prompt 装配稳定性清理

优先级：`P1`

需要重点检查：

- 每轮 prompt 的前缀顺序是否稳定
- 是否混入无意义的动态文本
- skills、agent section、附件 section 的顺序是否固定
- 文本文件截断逻辑是否稳定

如果前缀不稳定，prompt caching 能力再强也很难吃到收益。

### 8. 把 Team Runtime 的 memory 设计经验回流到 solo / agent 对话

优先级：`P2`

不要直接把 Team 的整套 memory layer 平移过去，但可以借鉴两件事：

- 关键约束要结构化，而不是完全埋在原始消息里
- 恢复时要区分“长期有效约束”和“本轮临时上下文”

### 9. 做小范围 A/B 验证，不要一次性大改

优先级：`P2`

建议实验组：

- A：当前策略，每轮完整注入 agent md
- B：每轮核心层 + 扩展层按需注入
- C：每轮核心层，完整层仅在 thread seed / invalidation 时注入

重点观察：

- 回复稳定性
- `cached_input_tokens`
- 平均 token 成本
- 长对话表现
- thread 恢复后的行为一致性

## 建议的落地顺序

### Milestone 1

- 打点 `cached_input_tokens`
- 记录 thread create / resume 次数
- 统计 agent prompt 长度

### Milestone 2

- 拆分 agent prompt 为核心层 / 扩展层
- 增加 `agentPromptHash`
- 增加 thread invalidation 和 full reseed 规则

### Milestone 3

- 为 thread 重建补一个 OpenCrab 侧轻量恢复包
- 做 A/B 实验
- 再决定要不要上更正式的 local summary / memory layer

## 后续可能新增的文档

- `prompt-lifecycle-design.md`
- `agent-prompt-observability.md`
- `thread-recovery-design.md`
- `solo-conversation-memory-layer.md`
