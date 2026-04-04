<p align="center">
  <img src="./public/opencrab-logo.svg" alt="OpenCrab" width="320">
</p>

<p align="center">
  <a href="https://github.com/KetteyMan/opencrab"><img alt="OpenCrab Repo" src="https://img.shields.io/badge/GitHub-opencrab-black?logo=github"></a>
  <a href="https://github.com/opencrab-ai-com/opencrab/releases/tag/v0.1.1"><img alt="OpenCrab Desktop v0.1.1" src="https://img.shields.io/badge/macOS%20App-v0.1.1-111111?logo=apple"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-green.svg"></a>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white">
  <img alt="Local First" src="https://img.shields.io/badge/Local-First-111111">
</p>

<p align="center">
  <a href="./README.md">中文</a> ｜ English
</p>

OpenCrab is a Chinese-first, local-first, chat-native open-source AI workspace.  
`OpenCrab for Mac` is already available as a desktop app: [`OpenCrab Desktop v0.1.1`](https://github.com/opencrab-ai-com/opencrab/releases/tag/v0.1.1).

- Website: [opencrab-ai.com](https://opencrab-ai.com)
- Email: [sky@opencrab-ai.com](mailto:sky@opencrab-ai.com)

## What OpenCrab Is

### What it is

- An AI product for everyday users
- A technical product that still lets builders DIY their own setup
- A workspace that brings `conversations`, `agents`, `Team Mode`, `Channels`, `scheduled tasks`, and `Skills` into one product surface
- A desktop AI workspace currently centered on macOS and a local-first runtime

### What it is not

- It is not a terminal-only agent shell for engineers
- It is not a control panel that dumps `cron`, `router`, `YAML`, `MCP`, or `subagent graphs` directly onto non-technical users
- It is not just a chat wrapper around a model
- It is not a product that chases feature breadth at the expense of clarity

### Why I am building OpenCrab

- For non-technical users:
  I want AI software to feel like a real user product. Open a Mac app, connect an account, say one sentence, and get moving, without first learning terminals, env vars, schedulers, or agent orchestration.
- For technical users:
  I also do not want OpenCrab to become a sealed black box. You should be able to DIY your own agents, skills, team workflows, runtime boundaries, and product capabilities. OpenCrab is meant to be both a user product and a technical product.

## How To Use OpenCrab

### 0. Prerequisites

- `Mac`
- `Google Chrome 146+`
- A working `codex` account
  The account system is the same one you already use with ChatGPT.
- Network access that can reach ChatGPT

### 1. Non-technical users

- The recommended path is to install the macOS desktop app.
- Current release: [`OpenCrab Desktop v0.1.1`](https://github.com/opencrab-ai-com/opencrab/releases/tag/v0.1.1)
- After installation, follow the in-app flow to connect ChatGPT / Codex and start using it.

### 2. Beginner technical users

- If you can use a terminal a little, but do not want to debug everything alone, let Codex help you install OpenCrab.
- You can send Codex a prompt like this:

```text
Help me install OpenCrab on my Mac. First check my Chrome version, codex login status, and network conditions. If anything is missing, fix it, then get OpenCrab running and tell me exactly where I should click to start using it.
```

- This path is for people who want to learn a bit of the technical side without getting stuck on setup.

### 3. Advanced technical users

- You can install, run, and modify OpenCrab directly from Git.
- Full instructions: [Install OpenCrab From Git](./docs/engineering/install-from-git-en.md)
- If you just want the shortest path:

```bash
git clone https://github.com/KetteyMan/opencrab.git
cd opencrab
npm install
cp .env.example .env.local
npm run desktop:dev
```

## OpenCrab Product Philosophy

### 1. If non-technical users cannot understand it, it should never appear in the product interaction

If using a feature requires learning `cron`, `MCP`, `sandbox`, `router`, or `worktree` first, that concept should not be pushed directly onto ordinary users.  
Technical complexity can exist, but the product should absorb it instead of offloading it to the user.

### 2. Prefer depth over breadth

OpenCrab is not trying to do a shallow version of everything.  
The priority is to go deep on the things that matter, especially `Team Mode`.

The goal is not to help one person manage ten toy demos.  
The goal is to help one person start `10` companies and make all of them profitable.

### 3. My blog

- [Why tasks should keep work moving](https://opencrab-ai.com/blog/tasks-keep-work-moving)
- [Why channels are participation, not just messaging](https://opencrab-ai.com/blog/channels-are-participation)
- [Why Team Mode should go beyond subagents](https://opencrab-ai.com/blog/team-mode-beyond-subagents)
- [How system agents build strategy](https://opencrab-ai.com/blog/system-agents-build-strategy)
- [Why team memory and autonomy gate matter](https://opencrab-ai.com/blog/team-memory-and-autonomy-gate)

### 4. Screenshots

| Conversation | Agents |
| --- | --- |
| <img src="./docs/screenshots/conversation.png" alt="OpenCrab conversation page" width="480"> | <img src="./docs/screenshots/agents.png" alt="OpenCrab agents page" width="480"> |

| Team Mode | Channels |
| --- | --- |
| <img src="./docs/screenshots/team-mode.png" alt="OpenCrab team mode page" width="480"> | <img src="./docs/screenshots/channels.png" alt="OpenCrab channels page" width="480"> |

| Scheduled Tasks | Skills |
| --- | --- |
| <img src="./docs/screenshots/tasks.png" alt="OpenCrab scheduled tasks page" width="480"> | <img src="./docs/screenshots/skills.png" alt="OpenCrab skills page" width="480"> |

## Codebase Structure

```text
opencrab/
  app/          Next.js pages and API routes
  components/   UI and interaction layer
  lib/          shared runtime core, stores, services, and integrations
  desktop/      Electron desktop shell
  scripts/      build, packaging, import, and runtime helper scripts
  agents-src/   system agent source materials
  public/       icons and static assets
  docs/         product, engineering, and blog documentation
  tests/        automated tests
```

- Start with `app/` and `components/` if you want to change the product surface
- Start with `lib/` if you want to change shared runtime behavior
- Start with `desktop/` if you want to change the macOS shell
- For detailed setup and development docs, see [Install OpenCrab From Git](./docs/engineering/install-from-git-en.md), [Development Guide](./docs/engineering/development.md), and [Docs Index](./docs/README.md)

## License

[MIT](./LICENSE)
