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
  channels/              # 渠道配置、状态与说明组件
  composer/              # 输入框
  conversation/          # 会话区
  skills/                # 技能列表与详情
  sidebar/               # 左侧栏
  ui/                    # 纯展示型基础组件
lib/
  channels/              # 渠道协议适配、事件分发、store 与 secret store
  chatgpt/               # ChatGPT 连接状态与登录流程
  codex/                 # Codex SDK、浏览器连接、模型选项
  conversations/         # 会话时间与标题工具
  opencrab/              # 通用标签、错误、消息工具
  resources/             # 本地资源层：local store、uploads、API types
  runtime/               # 运行时配置，如公网地址与隧道状态
  server/                # API route 公共响应、参数和错误处理工具
  skills/                # 技能目录与状态存储
  tasks/                 # 定时任务 store、runner 与类型
  tunnel/                # 公网地址与隧道维护
  view-models/           # 左侧栏等视图模型映射
scripts/
  browser_mcp_stdio_proxy.mjs
  pdf_extract.mjs
```

## Runtime Data

运行时数据全部落到本地目录，不属于源码的一部分：

- `$OPENCRAB_HOME/`
  - `state/local-store.json`：本地会话快照
  - `state/channels.json`：渠道状态、最近事件、远程会话绑定
  - `state/channel-secrets.json`：渠道密钥，服务端私有
  - `state/runtime-config.json`：公网地址与隧道状态
  - `state/skills.json`：OpenCrab 自己维护的技能状态
  - `state/tasks.json`：定时任务与运行记录
  - `uploads/`：上传的附件与提取后的文本
  - `logs/tunnels/`：自动公网隧道日志
  - `browser/chrome-debug-profile/`：独立浏览器模式的 Chrome profile
  - `skills/`：OpenCrab 自建技能目录与后续扩展保留位置
- `.playwright-cli/`：调试浏览器技能时生成的记录

这些目录都已加入 `.gitignore`。

说明：

- 如果没有显式设置 `OPENCRAB_HOME`，macOS 默认使用 `$HOME/.opencrab/`
- 首次启动时会自动把旧的 `~/Library/Application Support/OpenCrab/` 迁移到新的目录结构
- OpenCrab 自己的会话、附件和浏览器 profile 都不会默认落到代码仓库里

## Core Flows

## 1. Conversation Flow

1. 前端通过 `OpenCrabProvider` 维护应用状态。
2. 输入框发送消息后，用户消息先乐观插入到当前对话。
3. 服务端调用 `app/api/conversations/[conversationId]/reply/stream/route.ts`。
4. 路由内部通过 `lib/codex/sdk.ts` 调用 Codex SDK。
5. 同一个 OpenCrab 对话会复用同一个 Codex thread id。
6. 流式事件回写到消息区，最终快照持久化到 `$OPENCRAB_HOME/state/local-store.json`。

## 2. Attachment Flow

1. 前端上传文件到 `app/api/uploads/route.ts`
2. `lib/resources/upload-store.ts` 将文件保存到 `$OPENCRAB_HOME/uploads/`
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

## 4. Channel Flow

1. Telegram 通过 webhook 打到 `app/api/channels/telegram/webhook/route.ts`
2. 飞书默认通过 `lib/channels/feishu-socket-service.ts` 建立长连接接收事件；`app/api/channels/feishu/webhook/route.ts` 只保留兼容入口
3. 各渠道 adapter 负责协议解析、secret 校验和回推接口调用
4. `lib/channels/dispatcher.ts` 负责去重、远程 chat 和 OpenCrab conversation 的绑定
5. `lib/conversations/run-conversation-turn.ts` 复用现有 Codex 对话能力，产出最终回复
6. 渠道发送成功后，把最近事件、错误和绑定关系写入 `$OPENCRAB_HOME/state/channels.json`

补充：

- Telegram 渠道会把图片和文件下载到 `uploads/`，再复用现有附件链路
- 飞书当前仍以文本消息闭环为主

设计边界：

- channel secret 不进入前端 `AppSnapshot`
- 公开状态走 `state/channels.json`
- 私密配置走 `state/channel-secrets.json` 或环境变量

## 5. Startup Flow

每次 OpenCrab 新进程启动后，当前会自动触发这些动作：

1. `app/api/bootstrap/route.ts`
   - 启动渠道 watchdog
   - 强制跑一轮渠道启动同步
   - 预热浏览器连接
   - 启动任务执行器
   - 同步渠道绑定会话的元数据

2. `app/(app)/layout.tsx`
   - 页面渲染时也会补一次浏览器预热

3. `lib/channels/channel-startup.ts`
   - 新进程第一次启动时，已配置且已启用的 Telegram / 飞书会强制重连
   - 后续再通过 watchdog 做轻量巡检和修复

4. `lib/tunnel/tunnel-watchdog.ts`
   - 自动维护 Telegram 所需的本地公网隧道

说明：

- 这里的“自动连接”会尊重用户手动断开的状态
- 旧的 `state/channels.json` 只作为状态参考，新进程第一次启动时不会盲信上次退出前的 `ready`

## State Boundaries

- `resources`：负责持久化与读写
- `channels`：负责渠道协议适配、去重、绑定关系和渠道状态
- `server`：负责 API route 的输入输出约定，统一 JSON 响应和错误语义
- `skills`：负责技能目录发现、本地状态与自定义技能条目
- `runtime`：负责公网地址、隧道和运行时配置
- `tasks`：负责定时任务持久化、调度与运行记录
- `provider`：负责前端应用状态与流式消息生命周期
- `view-models`：负责把资源数据映射成左侧栏等 UI 结构
- `ui`：只负责展示，不直接碰资源层

## Current Limitations

- `Channels` 当前只有 Telegram 具备附件链路；飞书仍以文本消息闭环为主
- `任务` 当前依赖 OpenCrab 服务进程在运行，不是系统级常驻调度
- `Skills` 当前管理的是 OpenCrab 自己的本地技能状态，不会直接安装或修改 Codex app 的技能目录
- 当前持久化层仍是本地 JSON store，不是正式数据库
- 当前没有多人协作、鉴权、云同步
