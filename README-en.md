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
  <a href="./README.md">中文</a> ｜ English
</p>

OpenCrab is a local-first workspace for everyday users.

It keeps the product surface simple: chat is the main entry, and channels let Telegram or Feishu users talk to the same workspace without learning a developer toolchain first.

## Screenshots

| Home | Conversations |
| --- | --- |
| ![OpenCrab home](./docs/screenshots/homepage.png) | ![Conversation thread](./docs/screenshots/conversation-thread.png) |

| Channels | Telegram channel |
| --- | --- |
| ![Channels overview](./docs/screenshots/channels-overview.png) | ![Telegram channel page](./docs/screenshots/telegram-channel.png) |

| Settings |
| --- |
| ![Settings page](./docs/screenshots/settings.png) |

## Highlights

- Chat-first product flow with streaming replies and persistent conversation history
- Folder-based conversation organization with a familiar ChatGPT-style layout
- File and image uploads, plus text extraction for common document formats
- Browser tool integration for current-browser and managed-browser workflows
- Channel support for Telegram and Feishu: Telegram uses webhooks, while Feishu uses persistent socket connections by default
- Skills catalog browsing, detail pages, local status management, and custom skill entries
- Local runtime data and secrets stored outside the repository by default

## Getting Started

### Requirements

- macOS
- Node.js `20.9+`
- `codex` installed and authenticated with `codex login`

### Quick Start

```bash
npm install
cp .env.example .env.local
codex login
npm run dev
```

Open the app at [http://127.0.0.1:3000](http://127.0.0.1:3000).

### Recommended Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Configuration

Most users can start from the UI, then add secrets only when they need channels.

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

Channel configuration also works directly from:

- `/channels/telegram`
- `/channels/feishu`

Notes:

- Telegram needs a public URL for webhooks, and OpenCrab will try to automate that step
- Feishu uses persistent socket connections by default and does not need a public callback URL; webhook compatibility mode needs both `OPENCRAB_FEISHU_VERIFICATION_TOKEN` and `OPENCRAB_FEISHU_ENCRYPT_KEY`

## Runtime Data

OpenCrab stores runtime data in `OPENCRAB_HOME`.

If `OPENCRAB_HOME` is not set, macOS defaults to:

```bash
$HOME/Library/Application Support/OpenCrab
```

Current runtime files:

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

This keeps conversations, attachments, browser state, and channel secrets out of the repository by default.

## Documentation

- [Product Scope](./docs/product-scope.md)
- [Architecture](./docs/architecture.md)
- [Development Guide](./docs/development.md)
- [Codex Integration](./docs/codex-sdk-integration.md)

## Current Status

The conversation workflow is the most complete part of the product today.

`Channels` already supports Telegram and Feishu in a usable V1 flow. Telegram currently supports inbound and outbound text, image, and file handling; Feishu is still focused on text-message loops. `Skills` already supports catalog browsing, detail pages, local enable/disable state, and custom entries, while `任务` is still mostly a product skeleton.

## License

[MIT](./LICENSE)
