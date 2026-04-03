# Codex Context Optimization

更新时间：2026-04-02
状态：调研结论

这个目录专门沉淀 `OpenCrab` 在 `Codex thread`、上下文续接、prompt caching、compaction、agent prompt 注入策略上的现状判断，以及后续优化方向。

## 这次调研的核心结论

### 1. 普通对话 / Agent 对话的底层记忆，主要不是 OpenCrab 自己维护

当前普通对话和单个 agent 对话的主链路是：

- `OpenCrab` 本地保存消息历史、`codexThreadId`、`agentProfileId`、workspace、sandbox 等元数据
- 每轮调用时，把当前轮输入和 `codexThreadId` 交给 `@openai/codex-sdk`
- 底层通过 `startThread()` / `resumeThread()` 继续同一条 `Codex thread`

这意味着：

- `OpenCrab` 知道“这是哪条 thread”
- 但普通对话的长期上下文续接、上下文压缩和内部 session state 主要由 `Codex thread runtime` 负责
- `OpenCrab` 当前没有为普通对话单独实现一层“历史摘要压缩器”

### 2. Agent 对话当前每一轮都会重新拼 agent 配置

只要一条对话绑定了 `agentProfileId`，当前每轮都会重新：

- `getAgentProfile(...)`
- 读取或拿到 `soul / responsibility / tools / user / knowledge`
- 重新拼进 prompt

所以当前实现不是“首轮注入一次，后面完全依赖 thread 记住”。

### 3. Codex thread 确实具备会话续接、prompt caching 和 compaction 能力

基于本地 SDK 类型、README 和 OpenAI 官方文档，可以确认：

- `Codex thread` 可持久化，并可通过 `resumeThread()` 恢复
- `usage` 中明确暴露了 `cached_input_tokens`
- OpenAI 官方对 prompt caching 有正式文档，且 `gpt-5-codex` 属于支持范围
- OpenAI 官方对 Codex agent loop 的说明里，明确提到 Codex 在上下文过长时会做 compaction

但要注意：

- “具备 prompt caching 能力”不等于“每一轮都一定命中缓存”
- 缓存命中依赖精确前缀匹配、token 长度、保留时间和配置稳定性

### 4. Team Runtime 是例外

`Team Runtime` 不是简单把消息交给 `Codex thread` 续上就完了。

在 Team 路径里，`OpenCrab` 已经显式维护并注入了：

- `projectMemory`
- `teamMemory`
- `roleMemory`
- 最近群聊摘要
- 当前可复用交付物
- learning loop / reuse candidate

也就是说：

- 普通对话 / agent 对话：更依赖底层 thread runtime
- Team Runtime：`OpenCrab` 自己已经在做更正式的 memory orchestration

## 这组结论对后续优化意味着什么

当前不建议直接做成：

- 首轮完整注入 agent md
- 后续完全不再注入

这个方案的风险是：

- 角色约束会过度依赖底层 thread / compaction 的黑盒保持
- 一旦 thread 丢失、重建、或 compaction 后约束漂移，行为会不稳

更稳的方向是分层：

- 每轮保留一份很短的核心角色约束
- 长的 agent 文件改成“按需重注入”
- 用显式版本号 / hash 决定什么时候必须重新 seed 一次完整 prompt

## 当前最值得先做的事

1. 先把 `cached_input_tokens`、总 `input_tokens`、thread 重建次数做成可观测指标
2. 再把 agent prompt 拆成“核心层”和“扩展层”
3. 最后再决定是否要引入 OpenCrab 自己的轻量 session summary

## 关键代码位置

- `lib/resources/local-store.ts`
- `lib/conversations/run-conversation-turn.ts`
- `lib/codex/sdk.ts`
- `lib/agents/agent-store.ts`
- `lib/projects/project-store.ts`

## 相关文档

- [Codex Integration](../codex-sdk-integration.md)
- [OpenCrab 复现 Codex Agent Harness 可行性评估](../codex-harness-feasibility.md)
- [Prompt And Memory Optimization Backlog](./optimization-backlog.md)

## 外部参考

- [OpenAI Prompt Caching Guide](https://developers.openai.com/api/docs/guides/prompt-caching)
- [OpenAI: Unrolling the Codex Agent Loop](https://openai.com/index/unrolling-the-codex-agent-loop/)
