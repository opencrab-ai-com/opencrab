<p align="center">
  <img src="./public/opencrab-logo.svg" alt="OpenCrab" width="320">
</p>

<p align="center">
  <a href="https://github.com/KetteyMan/opencrab"><img alt="OpenCrab Repo" src="https://img.shields.io/badge/GitHub-opencrab-black?logo=github"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-green.svg"></a>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white">
  <img alt="Local First" src="https://img.shields.io/badge/Local-First-111111">
</p>

<p align="center">
  中文 README ｜ <a href="./README-en.md">English</a>
</p>

OpenCrab 是一个面向普通用户的、本地优先的小螃蟹工作台。

它尽量把产品表面做简单：聊天是主入口，Telegram 和飞书等渠道可以直接接入同一套工作空间，而不需要用户先学习一整套开发者工具链。

## 产品截图

| 首页 | 对话 |
| --- | --- |
| ![OpenCrab home](./docs/screenshots/homepage.png) | ![Conversation thread](./docs/screenshots/conversation-thread.png) |

| Channels | Telegram |
| --- | --- |
| ![Channels overview](./docs/screenshots/channels-overview.png) | ![Telegram channel page](./docs/screenshots/telegram-channel.png) |

| 设置 |
| --- |
| ![Settings page](./docs/screenshots/settings.png) |

## 主要能力

- 以聊天为主入口，支持流式回复和持久化历史对话
- 支持文件夹管理对话，整体交互接近大家熟悉的 ChatGPT 形态
- 支持图片、文件上传，以及常见文档格式的文本提取
- 支持浏览器工具接入，覆盖 current-browser 和 managed-browser 两种模式
- 已支持 Telegram 和飞书渠道接入：Telegram 走 webhook，飞书默认走长连接
- 支持 Skills 目录浏览、详情查看、状态管理和自定义技能条目
- 运行时数据和 secret 默认保存在仓库之外

## 快速开始

### 环境要求

- macOS
- Node.js `20.9+`
- 已安装 `codex`，并完成 `codex login`

### 启动

```bash
npm install
cp .env.example .env.local
codex login
npm run dev
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000) 即可。

### 建议检查

```bash
npm run lint
npm run typecheck
npm run build
```

## 配置

大多数情况下，你可以先直接从 UI 开始用；只有在需要接渠道时，再补 secret。

```bash
OPENCRAB_CODEX_MODEL=gpt-5.4
OPENCRAB_CODEX_REASONING_EFFORT=medium
OPENCRAB_CODEX_SANDBOX_MODE=read-only
OPENCRAB_CODEX_NETWORK_ACCESS=false
OPENCRAB_PUBLIC_BASE_URL=http://127.0.0.1:3000

OPENCRAB_TELEGRAM_BOT_TOKEN=
OPENCRAB_TELEGRAM_WEBHOOK_SECRET=
OPENCRAB_FEISHU_APP_ID=
OPENCRAB_FEISHU_APP_SECRET=
OPENCRAB_FEISHU_VERIFICATION_TOKEN=
OPENCRAB_FEISHU_ENCRYPT_KEY=
```

也可以直接在这些页面里配置：

- `/channels/telegram`
- `/channels/feishu`

说明：

- Telegram 需要公网地址来接 webhook，OpenCrab 会尽量自动处理这一步
- 飞书默认使用长连接，不需要公网地址；兼容 Webhook 模式时需要同时提供 `OPENCRAB_FEISHU_VERIFICATION_TOKEN` 和 `OPENCRAB_FEISHU_ENCRYPT_KEY`

## 运行时数据

OpenCrab 的运行时数据存放在 `OPENCRAB_HOME`。

如果没有显式设置，macOS 默认路径是：

```bash
$HOME/Library/Application Support/OpenCrab
```

当前运行时目录结构：

```text
$OPENCRAB_HOME/
  local-store.json
  channels.json
  channel-secrets.json
  runtime-config.json
  skills.json
  uploads/
  uploads/index.json
  tunnels/
  chrome-debug-profile/
```

这意味着对话、附件、浏览器状态和渠道 secret 默认都不会落进代码仓库。

## 文档

- [Product Scope](./docs/product-scope.md)
- [Architecture](./docs/architecture.md)
- [Development Guide](./docs/development.md)
- [Codex Integration](./docs/codex-sdk-integration.md)

## 当前状态

目前最完整的部分还是对话主链路。

`Channels` 已经支持 Telegram 和飞书的一版可用接入流程，其中 Telegram 已支持文本、图片和文件消息的入站与回推，飞书当前以文本消息闭环为主。`Skills` 已经具备目录浏览、详情查看、启用/禁用/卸载状态和自定义条目管理；`任务` 仍然主要是产品骨架。

## 许可证

[MIT](./LICENSE)
