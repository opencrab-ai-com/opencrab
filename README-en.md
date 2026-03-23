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

OpenCrab is a Chinese-first, local-first, chat-native open-source AI workspace.

It does not treat terminals, routing dashboards, cron syntax, or agent graphs as the main entry. Instead, it brings `conversations`, `agents`, `team mode`, `channels`, `scheduled tasks`, and `skills` into one product surface that feels closer to ChatGPT than to a terminal-first agent shell.

If one sentence has to do the job:

`OpenCrab` is trying to become a unified AI workspace for real ongoing work, not just another agent runtime for engineers.

## What Makes OpenCrab Different

- `Chat-native product surface`
  Start from one sentence, not from terminal workflows or orchestration setup.
- `Team Mode that aims beyond subagents`
  The product direction is closer to a digital team than to temporary delegated workers.
- `Channels as an external participation layer`
  Telegram and Feishu are not only extra chat surfaces; they are ingress and egress points for ongoing work.
- `Scheduled tasks as background execution units`
  Tasks are meant to wake up context and continue work, not only fire reminders.
- `Local-first runtime`
  Conversations, attachments, browser state, and secrets stay in runtime storage outside the repo by default.

## Screenshots

| Conversation | Agents |
| --- | --- |
| <img src="./docs/screenshots/conversation.png" alt="OpenCrab conversation page" width="480"> | <img src="./docs/screenshots/agents.png" alt="OpenCrab agents page" width="480"> |

| Team Mode | Channels |
| --- | --- |
| <img src="./docs/screenshots/team-mode.png" alt="OpenCrab team mode page" width="480"> | <img src="./docs/screenshots/channels.png" alt="OpenCrab channels page" width="480"> |

| Scheduled Tasks | Skills |
| --- | --- |
| <img src="./docs/screenshots/tasks.png" alt="OpenCrab scheduled tasks page" width="480"> | <img src="./docs/screenshots/skills.png" alt="OpenCrab skills page" width="480"> |

## What OpenCrab Is

- A chat-first AI workspace
- A local-first runtime shell with a real product surface
- A unified place for conversations, execution, teams, channels, recurring work, and skills
- An open-source project trying to grow toward commercial-grade product quality

It is not:

- a terminal-only agent shell
- a thin model wrapper with a nicer chat UI
- a multi-agent demo stitched together for research optics
- a gateway dashboard exposed directly to end users

## Four Product Theses

### 1. Chat stays the main entry, but not the whole product

OpenCrab keeps the conversation surface as the main entry because it is still the lowest-friction way to start work, carry context forward, and connect later capabilities back into one place.

### 2. Team Mode should feel more like a digital team than a subagent tree

The direction is not “spin up more helper agents.”  
It is closer to:

- lead + members
- shared task lists
- handoff and dependencies
- checkpoints, recovery, and review

Read more:

- [OpenCrab 不做 Subagents，而是要走向比 Agent Teams 更像真实团队的模式](./docs/blogs/opencrab-beyond-agent-teams.md)

### 3. Channels should be the external participation layer of the workspace

Channels are not only there so users can “chat from mobile.”  
They are meant to let users, clients, teammates, and outside systems participate in ongoing work from their native environments.

Read more:

- [OpenCrab 对 Channels 的重新思考：它不是移动端聊天入口，而是 Agents 的外部参与层](./docs/blogs/opencrab-what-channels-should-be.md)

### 4. Scheduled tasks should act like background execution units

OpenCrab does not want tasks to stop at reminders or raw schedulers.  
They should have context, cadence, logs, and result destinations, so work can continue even when the user is away.

Read more:

- [OpenCrab 对定时任务的重新思考：它不应该只是提醒，也不应该只是调度系统](./docs/blogs/opencrab-what-scheduled-tasks-should-be.md)

## Current Highlights

- Streaming conversations, persistent history, folders, uploads, and browser tools
- Built-in and custom agents with direct agent-started conversations
- Team rooms for staged multi-agent collaboration and follow-through
- Telegram and Feishu channel loops connected back into local conversations
- Scheduled tasks that can be created, paused, resumed, run now, and routed back into conversations
- A skills surface for enable / disable / uninstall management and custom entries
- Local runtime storage, attachment allowlists, atomic JSON writes, CI, tests, and ops/privacy docs

## Relative To Reference Products

As of `2026-03-23`, based on public official materials and the current repo:

- Compared with `OpenClaw`
  OpenCrab is more product-surface-oriented, Chinese-first, and workspace-driven; OpenClaw is stronger on gateway boundaries, automation, and control-plane rigor.
- Compared with `Codex`
  OpenCrab is more suitable as a unified chat-native workspace; Codex is stronger in coding depth, worktrees, multi-agent coordination, and official ecosystem strength.
- Compared with `Claude Cowork`
  OpenCrab is more open-source, more local-first, and more explicit about channels / tasks / team mode in one UI; Cowork is more mature for polished desktop knowledge work.

See:

- [Product Positioning](./docs/product/product-positioning.md)

## Quick Start

### Requirements

- macOS
- Node.js `20.9+`
- `codex` installed and executable
- An account with working Codex access

### Setup

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
```

The app surface already covers the most common setup flows through:

- `/settings`
- `/channels/telegram`
- `/channels/feishu`

Notes:

- If you want command execution to inherit the local `OPENAI_API_KEY`, you can explicitly enable it in `/settings`; it stays off by default
- `.env.example` uses the same default sandbox as the app: `workspace-write`
- Default language is part of the system prompt path and affects downstream conversations, rewrites, scheduled tasks, and channel replies

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

Additional notes:

- If a local JSON store becomes corrupt, OpenCrab backs it up as `*.corrupt.<timestamp>.json` before reseeding
- API error responses include a `requestId`, which helps correlate user-facing failures with server logs

## Documentation

- [Docs Index](./docs/README.md)
- [Product Positioning](./docs/product/product-positioning.md)
- [Product Scope](./docs/product/product-scope.md)
- [Architecture](./docs/engineering/architecture.md)
- [Privacy And Data Boundaries](./docs/engineering/privacy-and-data.md)
- [Operations Runbook](./docs/engineering/operations.md)
- [Startup Behavior](./docs/engineering/startup-behavior.md)
- [Development Guide](./docs/engineering/development.md)
- [Codex Integration](./docs/engineering/codex-sdk-integration.md)
- [SECURITY](./SECURITY.md)
- [CONTRIBUTING](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
