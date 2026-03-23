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

Chat is still the primary entry, but the current product surface already includes agents, team rooms, channels, scheduled tasks, skills, and settings inside one workspace.

More precisely, OpenCrab is trying to become a Chinese-first, open-source, local-first workspace with a ChatGPT-style product surface, rather than another terminal-first agent shell.

## Screenshots

| Home | Conversation |
| --- | --- |
| <img src="./docs/screenshots/homepage.png" alt="OpenCrab home" width="480"> | <img src="./docs/screenshots/conversation-thread.png" alt="OpenCrab conversation" width="480"> |

| Channels Overview | Telegram Channel |
| --- | --- |
| <img src="./docs/screenshots/channels-overview.png" alt="OpenCrab channels overview" width="480"> | <img src="./docs/screenshots/telegram-channel.png" alt="OpenCrab Telegram channel" width="480"> |

| Settings | Scheduled Tasks |
| --- | --- |
| <img src="./docs/screenshots/settings.png" alt="OpenCrab settings" width="480"> | <img src="./docs/screenshots/tasks.png" alt="OpenCrab scheduled tasks" width="480"> |

| Skills | Channels |
| --- | --- |
| <img src="./docs/screenshots/skills.png" alt="OpenCrab skills" width="480"> | <img src="./docs/screenshots/channels.png" alt="OpenCrab channels" width="480"> |

## Positioning

- A chat-native workspace instead of a terminal-first shell
- Chinese-first and local-first by default
- One surface for conversations, execution, agents, team rooms, channels, scheduled tasks, and skills
- Open-source and product-oriented, rather than only being an agent runtime

## Why It Exists

- Compared with pure chat products, OpenCrab goes deeper on local execution, channels, recurring tasks, and team coordination
- Compared with CLI-native agent tools, it puts more weight on product surface, lower onboarding friction, and non-terminal users
- Compared with knowledge-work assistants, it also keeps coding execution, channel ingress, and team-room orchestration in scope

For a fuller positioning write-up and comparison against OpenClaw, Codex, and Claude Cowork, see:

- [Product Positioning](./docs/product-positioning.md) (Chinese-first)

## Highlights

- Chat-first product flow with streaming replies and persistent conversation history
- Folder-based conversation organization with a familiar ChatGPT-style layout
- File and image uploads, plus text extraction for common document formats
- Browser tool integration for current-browser and managed-browser workflows
- Channel support for Telegram and Feishu: Telegram uses webhooks, while Feishu uses persistent socket connections by default
- Simple scheduled task management, with the ability to create a recurring task directly from a conversation
- Skills catalog browsing, detail pages, local status management, and custom skill entries
- Agent profiles with direct agent-started conversations
- Team rooms for multi-agent collaboration and task follow-through
- A dedicated About page and a settings surface for language, browser mode, model, reasoning, and sandbox defaults
- Local runtime data and secrets stored outside the repository by default

## Getting Started

### Requirements

- macOS
- Node.js `20.9+`
- `codex` installed and executable
- An account with working Codex access

### Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the app at [http://127.0.0.1:3000](http://127.0.0.1:3000).

If you are not signed in yet, open `/settings` and complete the ChatGPT connection flow there. Terminal `codex login` is still supported for developer-oriented setups.

### Recommended Checks

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

## Configuration

Most users can start from the UI, then add secrets only when they need channels.

```bash
OPENCRAB_CODEX_MODEL=gpt-5.4
OPENCRAB_CODEX_REASONING_EFFORT=medium
OPENCRAB_CODEX_SANDBOX_MODE=workspace-write
OPENCRAB_CODEX_NETWORK_ACCESS=false
OPENCRAB_PUBLIC_BASE_URL=http://127.0.0.1:3000
OPENCRAB_UPLOAD_MAX_FILES=8
OPENCRAB_UPLOAD_MAX_FILE_BYTES=26214400
OPENCRAB_UPLOAD_MAX_TOTAL_BYTES=41943040

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
- `/settings`

Notes:

- Telegram needs a public URL for webhooks, and OpenCrab will try to automate that step
- Feishu uses persistent socket connections by default and does not need a public callback URL; webhook compatibility mode needs both `OPENCRAB_FEISHU_VERIFICATION_TOKEN` and `OPENCRAB_FEISHU_ENCRYPT_KEY`
- If you want command execution to inherit the local `OPENAI_API_KEY`, you can explicitly enable it in `/settings`; it stays off by default
- `.env.example` uses the same default sandbox as the app: `workspace-write`

Default upload protections:

- Up to `8` files per request
- `25 MB` max per file by default
- `40 MB` max total per request by default

## Runtime Data

OpenCrab stores runtime data in `OPENCRAB_HOME`.

If `OPENCRAB_HOME` is not set, macOS defaults to:

```bash
$HOME/.opencrab
```

Current runtime files:

```text
$OPENCRAB_HOME/
  state/
    local-store.json
    channels.json
    channel-secrets.json
    runtime-config.json
    skills.json
    tasks.json
    projects.json
  uploads/
  uploads/index.json
  logs/
    tunnels/
  browser/
    chrome-debug-profile/
  skills/
  agents/
```

On first launch, OpenCrab automatically migrates the legacy
`~/Library/Application Support/OpenCrab` layout into this new structure.

This keeps conversations, attachments, browser state, and channel secrets out of the repository by default.

Additional notes:

- If a local JSON store becomes corrupt, OpenCrab backs it up as `*.corrupt.<timestamp>.json` before reseeding
- API error responses now include a `requestId`, which helps correlate user-facing failures with server logs

## Documentation

- [Product Positioning](./docs/product-positioning.md)
- [Product Scope](./docs/product-scope.md)
- [Architecture](./docs/architecture.md)
- [Privacy And Data Boundaries](./docs/privacy-and-data.md)
- [Operations Runbook](./docs/operations.md)
- [Startup Behavior](./docs/startup-behavior.md)
- [Development Guide](./docs/development.md)
- [Codex Integration](./docs/codex-sdk-integration.md)
- [SECURITY](./SECURITY.md)
- [CONTRIBUTING](./CONTRIBUTING.md)

## Current Status

The conversation workflow is still the most mature part of the product, but the app surface is now broader.

- `Conversations`: persistent history, folders, uploads, browser tools, and streaming replies
- `Agents`: built-in agents, custom agents, detail pages, and direct agent-started conversations
- `Team Mode`: team room creation, member selection, staged collaboration flow, and task linkage
- `Channels`: Telegram already supports text, image, and file loops; Feishu is still focused on text-message loops
- `Tasks`: create, pause, resume, run-now, result conversations, and conversation-to-task flow
- `Skills`: catalog browsing, detail pages, local enable / disable / uninstall state, and custom entries

## License

[MIT](./LICENSE)
