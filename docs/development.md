# Development Guide

## Requirements

- macOS
- Node.js `20.9+`
- 已安装并可执行 `codex`
- 账号具备可用的 Codex 使用资格

## Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

首次启动后，如果还没有登录，可以直接在 `/settings` 页点击 `连接 ChatGPT` 完成授权。

如果你更习惯终端方式，也可以手动执行：

```bash
codex login
codex login status
```

当前默认 `npm run dev` 使用 Next.js 16 的 Turbopack。
如果你需要临时回退到旧的 Webpack 模式，可以执行：

```bash
npm run dev:webpack
```

默认开发地址：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Recommended Checks

```bash
npm run lint
npm run typecheck
npm run build
```

当前 `.env.example` 默认配置与设置页保持一致：

- `OPENCRAB_CODEX_MODEL=gpt-5.4`
- `OPENCRAB_CODEX_REASONING_EFFORT=medium`
- `OPENCRAB_CODEX_SANDBOX_MODE=workspace-write`
- `OPENCRAB_PUBLIC_BASE_URL=http://127.0.0.1:3000`

设置页当前还能直接管理：

- 默认语言
- 浏览器连接方式
- 是否允许命令继承 `OPENAI_API_KEY`

## Local Runtime Directories

首次运行后，仓库下会自动生成：

- `.playwright-cli/`（仅在调试浏览器技能时）

OpenCrab 自己的运行时数据会写到：

- `$OPENCRAB_HOME/`

这些目录是运行时数据，不需要提交。

如果没有显式设置 `OPENCRAB_HOME`，macOS 默认使用：

- `$HOME/.opencrab/`

`$OPENCRAB_HOME/` 当前会包含：

- `state/`
- `state/local-store.json`
- `state/channels.json`
- `state/channel-secrets.json`
- `state/runtime-config.json`
- `state/skills.json`
- `state/tasks.json`
- `state/projects.json`
- `uploads/`
- `uploads/index.json`
- `logs/tunnels/`
- `browser/chrome-debug-profile/`
- `skills/`
- `agents/`

首次启动时会自动把旧的 `~/Library/Application Support/OpenCrab/` 迁移到新目录。

如果你想一键清理这些本地运行产物：

```bash
npm run clean:runtime
```

## 渠道

当前支持 Telegram 和飞书。

当前行为：

- Telegram：通过 webhook 接入，自动尝试配置公网地址；支持文本、图片和文件消息
- 飞书：默认通过长连接接入；Webhook 只保留兼容模式，当前主要支持文本消息

常用环境变量：

- `OPENCRAB_PUBLIC_BASE_URL`
- `OPENCRAB_TELEGRAM_BOT_TOKEN`
- `OPENCRAB_TELEGRAM_WEBHOOK_SECRET`
- `OPENCRAB_FEISHU_APP_ID`
- `OPENCRAB_FEISHU_APP_SECRET`
- `OPENCRAB_FEISHU_VERIFICATION_TOKEN`
- `OPENCRAB_FEISHU_ENCRYPT_KEY`

也可以直接在 UI 的 `/channels/telegram` 和 `/channels/feishu` 页面里保存配置。

如果你主要在本机调试：

- Telegram 仍然需要一个可被 Telegram 访问到的公网地址
- 飞书长连接模式不需要公网地址

## Startup And Restart

OpenCrab 当前在重启后会自动做这些事：

- 同步渠道配置到运行时状态
- 自动恢复已启用的 Telegram / 飞书连接
- 启动渠道 watchdog
- 自动维护 Telegram 隧道
- 预热浏览器 MCP 连接
- 启动任务执行器
- 修正渠道会话元数据
- 准备内置技能目录

补充说明：

- Telegram / 飞书如果是用户手动断开的，重启后会保持断开
- 浏览器远程调试的首次授权仍然可能需要用户点一次允许
- 定时任务依赖 OpenCrab 服务进程处于运行状态
- 这些启动动作当前是“后台触发 + 冷却式同步”，不会在每次前端轮询时都强制完整执行一遍

更完整说明见：

- [Startup Behavior](./startup-behavior.md)

## API Conventions

`app/api/*` 路由当前统一复用：

- `lib/server/api-route.ts`

这里集中处理 JSON 响应、动态路由参数读取、请求体解析和常见错误响应，避免每个 route 重复拼装同一套模板逻辑。

## Debugging Codex

检查底层登录状态：

```bash
codex login status
```

如果 UI 提示 ChatGPT / Codex 不可用，优先检查：

1. `codex login status`
2. `/api/codex/status`
3. `/api/chatgpt/connect/status`
4. 浏览器连接模式是否正确

## Browser Modes

设置页支持两种浏览器连接模式：

- `连接当前浏览器`
- `使用独立浏览器`

如果你需要复用自己平时的 Chrome 会话，使用 `连接当前浏览器`。

## Attachments

当前支持：

- 图片
- 文本文件
- Markdown / JSON / HTML / 代码文件
- PDF
- Word (`.doc`, `.docx`)

说明：

- PDF 目前支持可提取文字的 PDF，不支持纯扫描 OCR
- Word 提取依赖 macOS 自带 `textutil`
- Telegram 渠道会把图片和文件下载进 OpenCrab 的上传存储，再参与后续回复

## Current Product Areas

当前主导航已经包含这些产品区块：

- `对话`
- `智能体`
- `团队模式`
- `渠道`
- `定时任务`
- `技能`
- `关于我们`
- `设置`
