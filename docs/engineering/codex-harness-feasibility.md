# OpenCrab 复现 Codex Agent Harness 可行性评估

日期：2026-03-22
状态：草案

## 1. 结论

如果 OpenCrab 想支持 OpenAI 之外的模型，同时尽量保留 `Codex` 这条产品体验，最佳方向不是继续把 `Codex` 当成唯一底层，而是逐步自研一层类似 `Codex agent harness` 的运行时。

结论可以直接分三档看：

- 复现一个“像 Codex 的 agent harness”：可行性高
- 复现到“多数核心体验接近 Codex”：可行性中等
- 复现到“几乎无折损替代官方 Codex”：可行性中低

换句话说：

- `60% - 75%` 的效果，较现实
- `80% - 90%` 的效果，可以追，但需要持续调优
- “几乎无折损”不现实，至少短中期不现实

## 2. 为什么这件事是可行的

OpenAI 近阶段已经公开了不少 `Codex` 的关键机制，因此这件事不是“完全黑盒逆向”。

目前能确认公开的内容包括：

- `Codex CLI` / `Codex SDK` 的 thread / run / streamed events 机制
- agent loop 的大体结构
- prompt 输入会由 `instructions + tools + input` 等部分共同组成
- 会话线程、上下文压缩、工具调用等是可描述的 runtime 行为
- `AGENTS.md`、developer instructions、工具定义都会影响最终行为

所以，从架构视角看，`Codex` 不是“一个神秘模型”，而是：

- 一个较强的模型
- 一层针对 agent 的 runtime / harness
- 一套长期打磨过的 prompt/context engineering
- 一些产品级行为约束和默认策略

这意味着 OpenCrab 理论上可以自己实现其中的大部分结构。

## 3. 为什么“完全不折损”很难

真正难的不是把框架搭出来，而是把体验调到接近官方。

难点主要不在模型能力本身，而在 runtime 层：

- 长任务里什么时候继续、什么时候停手
- 工具调用失败后怎么恢复
- 什么时候该追问用户，什么时候该继续做
- 什么时候该压缩上下文
- 压缩成什么形式既便宜又不丢关键约束
- 多轮之后如何保持行为稳定
- 如何避免 agent 死循环、过度执行、无意义展开

这些东西，官方即使公开了原理，也不等于把全部经验参数、边界条件和调优结果都开源出来。

所以：

- “做出来”相对容易
- “做顺手”难很多
- “做得像官方一样稳”更难

## 4. 对 OpenCrab 来说，Codex Harness 到底是什么

如果从 OpenCrab 的产品需求拆开看，`Codex harness` 其实可以被理解成 8 个模块：

### 4.1 Prompt Assembly

负责把这些内容组合成当前回合输入：

- system / base instructions
- developer instructions
- `AGENTS.md`
- 当前用户消息
- 最近对话上下文
- 附件摘要
- 项目状态
- 工具定义
- sandbox / approval / budget 约束

### 4.2 Thread Runtime

负责：

- 创建 thread
- 恢复 thread
- 维护 thread state
- 让多轮对话和多步执行有延续性

### 4.3 Tool Execution Loop

负责：

- 解析模型的工具调用
- 执行命令 / 文件编辑 / 浏览器 / MCP / 自定义技能
- 把结果以结构化形式回填给模型
- 决定下一轮继续还是结束

### 4.4 Context Management

负责：

- 上下文窗口接近极限时的压缩
- 历史消息摘要
- 保留哪些关键约束
- 丢弃哪些低价值中间态

### 4.5 Safety / Control Layer

负责：

- sandbox
- approval policy
- network access
- tool allowlist / denylist
- 停止条件
- 最大轮数 / 最大时长 / 最大成本

### 4.6 Streaming and Event Layer

负责把 agent 过程变成产品可消费的事件流：

- thinking
- assistant text
- tool call started
- tool call completed
- file changed
- turn completed
- turn failed

### 4.7 Recovery Layer

负责：

- 中断恢复
- 失败重试
- 崩溃重启后的状态一致性

### 4.8 Evaluation Layer

负责：

- 跑基准任务
- 对比不同模型 / prompt / compaction 策略
- 识别回归

## 5. 哪些部分最容易复现

下面这些模块，OpenCrab 相对容易自己做：

### 5.1 Thread / Session 抽象

这部分本质是工程问题，不是研究问题。

可以自己实现：

- conversation id -> runtime thread id
- thread metadata
- resume / retry / cancel
- run records

### 5.2 Tool Loop

如果你把工具协议定清楚，这部分是很能工程化的。

尤其 OpenCrab 本来就已经有：

- 对话
- 附件
- browser bridge
- skills
- task
- channels

所以工具回路是能逐步抽出来的。

### 5.3 Event Streaming

这部分也偏工程实现。

你现在已经有流式回复链路，后面把事件做得更细就行。

### 5.4 Permission / Approval / Budget

这部分反而是自研的优势。因为一旦脱离官方 `Codex`，你可以按自己的产品理念定义：

- 哪类动作必须批准
- 哪类 agent 可以联网
- 哪类项目默认只读

## 6. 哪些部分最难复现

### 6.1 Context Engineering

这是最难的部分之一。

原因：

- 不同模型对同一 prompt 结构的敏感度不同
- 同样的 tool schema，不同模型的调用稳定性差异很大
- 长任务里上下文组织方式直接决定“会不会跑偏”

这部分很难一次做对，只能通过不断测试和迭代逼近。

### 6.2 Context Compaction / Memory

这是另一个最难点。

不是简单做“历史摘要”就够了，难在：

- 摘要什么
- 丢掉什么
- 什么要进入长期 memory
- 什么只该留在当前 run
- 压缩后如何保持后续回合行为一致

如果这里做不好，产品会表现为：

- 过几轮之后忘记关键约束
- 或者保留太多，成本和延迟失控

### 6.3 Agent Policy Tuning

比如：

- 什么时候主动问用户
- 什么时候自己继续做
- 什么时候应该先看代码再计划
- 什么时候应该停止而不是继续试

这些表面像 prompt 问题，实质是产品行为策略。

### 6.4 模型适配差异

即使不算模型本身智力差异，不同 provider 也会有这些非智力差异：

- tool call 格式稳定性
- JSON/schema 遵从度
- 长上下文保真度
- 多轮 self-correction 稳定性
- streamed output 颗粒度

这会让同一套 harness 在不同模型上表现差很多。

## 7. 对 OpenCrab 的现实判断

OpenCrab 现在的执行层是直接绑定 `Codex` 的：

- `new Codex(...)` 是核心 runtime 入口
- 模型选择本质上还是在 `Codex` 支持范围内选
- thread / streaming / reasoning effort 都沿着 `Codex` 语义在走

也就是说：

- 现在 OpenCrab 还没有自己的 agent runtime
- 现在的“模型可选”不是“runtime 可替换”

因此，如果要支持 `Claude / 国内模型 / 其他 provider`，真正要做的不是多加几个模型名，而是：

- 先把 OpenCrab 的 runtime 抽象出来
- 再让 `Codex` 变成其中一个 provider

## 8. 推荐路线

## Phase 1：抽象 Runtime 接口

先定义统一接口，例如：

- `startRun`
- `resumeRun`
- `streamRun`
- `cancelRun`
- `listCapabilities`

以及统一事件模型，例如：

- `message.delta`
- `tool.call.started`
- `tool.call.finished`
- `artifact.updated`
- `run.completed`
- `run.failed`

这一阶段不要急着接新模型，先把 OpenCrab 自己的上层逻辑从 `Codex` 解绑。

## Phase 2：保留 Codex，新增 Generic Runtime

做两套 runtime：

- `CodexRuntime`
- `GenericAgentRuntime`

其中：

- `CodexRuntime` 继续吃官方 Codex 的 thread / tool / harness
- `GenericAgentRuntime` 用普通模型 API + OpenCrab 自己的 harness

这样你可以一边保留现有体验，一边开始验证自研路线。

## Phase 3：先支持一类非 Codex 模型

不要一上来支持 10 家。

先选一类：

- 一个 OpenAI 非 Codex 路线
- 或一个 Claude 路线
- 或一个国内 provider 路线

目的不是“覆盖市场”，而是验证你自研 harness 的可迁移性。

## Phase 4：补 Evaluation 和 Regression

建立固定任务集，比较：

- CodexRuntime
- GenericRuntime + OpenAI
- GenericRuntime + 非 OpenAI provider

评估项不只看最终答案，还要看：

- 工具调用稳定性
- 长任务完成率
- 重试率
- 是否会跑偏
- 是否会忘记约束
- stop / resume 表现

## 9. 预期效果应该怎么设

比较现实的目标不是“无损替代 Codex”，而是：

- 在一部分场景里接近 Codex
- 在另一部分场景里接受有限折损
- 用更多模型覆盖和更灵活的 provider 支持换取产品边界扩展

比较合理的目标设定是：

- coding 深任务：优先仍走 `CodexRuntime`
- 通用对话 / 内容生成 / 国内模型接入：可走 `GenericRuntime`
- 多 Agent orchestration：尽量做成 runtime 无关，底层可以替换

## 10. 最终建议

如果你的目标是：

- 支持 OpenAI 之外的模型
- 尽量保留 Codex 产品体验
- 后面还能做多 Agent

那这件事值得做，而且方向正确。

但要接受一个现实：

你不是在“换模型”，你是在“做自己的 agent runtime”。

只要心智放对，这条路就很清楚：

- 先抽 runtime
- 再做自研 harness
- 再逐步让更多模型接入

这条路的可行性高，但它更像一个阶段性产品工程项目，而不是一个小型接入改造。

## 11. 关键参考

- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)
- [Codex CLI Getting Started](https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started)
- [Codex SDK README in current repo](../../node_modules/@openai/codex-sdk/README.md)
- [Current Codex integration](../../lib/codex/sdk.ts)
