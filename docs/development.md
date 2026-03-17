# Development Guide

## Requirements

- macOS
- Node.js `20.9+`
- 已安装并可执行 `codex`
- 已完成 `codex login`

## Start

```bash
npm install
npm run dev
```

默认开发地址：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Recommended Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Local Runtime Directories

首次运行后，仓库下会自动生成：

- `.playwright-cli/`（仅在调试浏览器技能时）

OpenCrab 自己的运行时数据会写到：

- `$OPENCRAB_HOME/`

这些目录是运行时数据，不需要提交。

如果没有显式设置 `OPENCRAB_HOME`，macOS 默认使用：

- `$HOME/Library/Application Support/OpenCrab/`

`$OPENCRAB_HOME/` 当前会包含：

- `local-store.json`
- `channels.json`
- `channel-secrets.json`
- `runtime-config.json`
- `skills.json`
- `uploads/`
- `uploads/index.json`
- `tunnels/`
- `chrome-debug-profile/`

如果你想一键清理这些本地运行产物：

```bash
npm run clean:runtime
```

## Channels

`Channels` 第一版支持 Telegram 和飞书。

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

## Debugging Codex

检查登录状态：

```bash
codex login status
```

如果 UI 提示 Codex 不可用，优先检查：

1. `codex login status`
2. `/api/codex/status`
3. 浏览器连接模式是否正确

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
