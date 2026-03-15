# Codex SDK 接入说明

`opencrab` 当前通过 `@openai/codex-sdk` 接入 Codex。

当前实现只支持 `Sign in with ChatGPT`，不走 API key。

## 当前接法

- 服务端封装：`/Users/sky/SkyProjects/opencrab/lib/codex/sdk.ts`
- 模型与推理选项：`/Users/sky/SkyProjects/opencrab/lib/codex/options.ts`
- 对话回复接口：`/Users/sky/SkyProjects/opencrab/app/api/conversations/[conversationId]/reply/route.ts`
- 状态探活接口：`/Users/sky/SkyProjects/opencrab/app/api/codex/status/route.ts`
- 附件上传接口：`/Users/sky/SkyProjects/opencrab/app/api/uploads/route.ts`

## 关键设计

- 使用 `Codex.startThread()` 创建新线程
- 使用 `Codex.resumeThread(threadId)` 续接已有对话
- 每个 `conversation` 持久化自己的 `codexThreadId`
- Web 前端只调用应用自己的 `/api/*`，不直接暴露 Codex SDK
- 默认使用中文回复
- 显式屏蔽 `OPENAI_API_KEY` 和 `CODEX_API_KEY`，强制复用本机 Codex 登录态
- 模型列表读取本机 `~/.codex/models_cache.json`
- 推理强度按每个模型自己的 `supported_reasoning_levels` 提供
- `+` 入口支持图片上传和文本文件上传

## 本地准备

1. 安装依赖：`npm install`
2. 先在本机完成 Codex 登录：`codex login`
3. 检查登录状态：`codex login status`
4. 准备环境变量：参考 `/Users/sky/SkyProjects/opencrab/.env.example`
5. 启动开发环境：`npm run dev`
6. 检查 Codex 连通性：访问 `GET /api/codex/status`

## 默认配置

- 模型：`gpt-5.4`
- 推理强度：`medium`
- sandbox：`read-only`
- approval policy：`never`
- network access：`false`

这些默认值都可以通过环境变量覆盖。
