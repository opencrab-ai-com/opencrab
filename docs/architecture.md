# OpenCrab Architecture

`OpenCrab` 是一个面向普通用户的 Web 助手，当前以“聊天主入口 + Codex 执行引擎”为核心。

## Current Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS`
- `@openai/codex-sdk`
- `@modelcontextprotocol/sdk`

## Repository Layout

```text
app/
  (app)/                 # 主应用路由
  api/                   # 服务端 API 路由
components/
  app-shell/             # 全局壳层与应用状态
  composer/              # 输入框
  conversation/          # 会话区
  sidebar/               # 左侧栏
  ui/                    # 纯展示型基础组件
lib/
  codex/                 # Codex SDK、浏览器连接、模型选项
  conversations/         # 会话时间与标题工具
  opencrab/              # 通用标签、错误、消息工具
  resources/             # 本地资源层：mock store、uploads、API types
  view-models/           # 左侧栏等视图模型映射
scripts/
  browser_mcp_stdio_proxy.mjs
  pdf_extract.mjs
```

## Runtime Data

运行时数据全部落到本地目录，不属于源码的一部分：

- `.opencrab/`
  - `mock-store.json`：本地会话快照
  - `uploads/`：上传的附件与提取后的文本
  - `chrome-debug-profile/`：独立浏览器模式的 Chrome profile
- `.playwright-cli/`：调试浏览器技能时生成的记录

这些目录都已加入 `.gitignore`。

## Core Flows

## 1. Conversation Flow

1. 前端通过 `OpenCrabProvider` 维护应用状态。
2. 输入框发送消息后，用户消息先乐观插入到当前对话。
3. 服务端调用 `app/api/conversations/[conversationId]/reply/stream/route.ts`。
4. 路由内部通过 `lib/codex/sdk.ts` 调用 Codex SDK。
5. 同一个 OpenCrab 对话会复用同一个 Codex thread id。
6. 流式事件回写到消息区，最终快照持久化到 `.opencrab/mock-store.json`。

## 2. Attachment Flow

1. 前端上传文件到 `app/api/uploads/route.ts`
2. `lib/resources/upload-store.ts` 将文件保存到 `.opencrab/uploads/`
3. 文本类附件直接复用原文件
4. PDF 通过 `scripts/pdf_extract.mjs` 提取文本
5. Word 文档通过 macOS `textutil` 转成纯文本
6. Codex 回复时会读取可供 prompt 使用的文本路径

## 3. Browser Tool Flow

1. OpenCrab 自己维护浏览器 bridge 状态：`lib/codex/browser-session.ts`
2. 对 Codex CLI 暴露的是一个本地 `stdio` 代理脚本：`scripts/browser_mcp_stdio_proxy.mjs`
3. 代理脚本再连接到 OpenCrab 自己的 `/api/codex/browser-mcp`
4. 当前支持两种模式：
   - `current-browser`
   - `managed-browser`

这样做的目的是让浏览器连接尽可能常驻复用，而不是每轮消息都重新建 MCP 配置。

## State Boundaries

- `resources`：负责持久化与读写
- `provider`：负责前端应用状态与流式消息生命周期
- `view-models`：负责把资源数据映射成左侧栏等 UI 结构
- `ui`：只负责展示，不直接碰资源层

## Current Limitations

- `Channels / 任务 / Skills` 目前还是稳定骨架页，核心实现仍以对话为主
- 当前持久化层仍是本地 JSON store，不是正式数据库
- 当前没有多人协作、鉴权、云同步
