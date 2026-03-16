# Codex Integration

`OpenCrab` 通过 `@openai/codex-sdk` 接入 Codex，当前只支持 `Sign in with ChatGPT` 登录，不使用 API key。

## Key Files

- `lib/codex/sdk.ts`
- `lib/codex/options.ts`
- `lib/codex/browser-session.ts`
- `app/api/codex/status/route.ts`
- `app/api/conversations/[conversationId]/reply/route.ts`
- `app/api/conversations/[conversationId]/reply/stream/route.ts`

## Design Decisions

- 一个 OpenCrab 对话对应一个 Codex thread
- 新对话通过 `startThread()` 创建
- 已有对话通过 `resumeThread(threadId)` 续接
- 登录状态由本机 `codex login status` 判断
- 前端永远只调用 OpenCrab 自己的 `/api/*`
- 模型列表来自本机 `~/.codex/models_cache.json`

## Browser Tool Integration

为了支持浏览器工具并尽量复用连接，OpenCrab 采用两层桥接：

1. OpenCrab 进程内维护浏览器 bridge
2. Codex CLI 通过 `scripts/browser_mcp_stdio_proxy.mjs` 以 `stdio` 方式接入

这样可以避免把不兼容的 HTTP MCP 配置直接塞给 Codex CLI。

## Default Behavior

- 默认模型：`gpt-5.4`
- 默认推理强度：`medium`
- 默认 sandbox：`workspace-write`
- 默认 approval policy：`never`
- 默认浏览器模式：`current-browser`

## Notes

- 登录成功不代表浏览器工具一定可用，这两类状态要分开看
- 如果页面提示 Codex 不可用，先检查 `codex login status`
