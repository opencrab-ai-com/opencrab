# Install OpenCrab From Git

This guide is for:

- people who want to run the latest OpenCrab source code
- developers who want to modify OpenCrab locally
- contributors who want to debug, inspect, or experiment

If you only want to start using OpenCrab, the simpler path is the released Mac app:

- [OpenCrab Desktop v0.1.1](https://github.com/opencrab-ai-com/opencrab/releases/tag/v0.1.1)

## 0. Prerequisites

- macOS
- `Google Chrome 146+`
- Node.js `20.9+`
- Git
- `codex` installed and executable
- a working `codex` account
- network access that can reach ChatGPT

## 1. Clone the repository

```bash
git clone https://github.com/KetteyMan/opencrab.git
cd opencrab
```

## 2. Install dependencies

```bash
npm install
```

## 3. Initialize local config

```bash
cp .env.example .env.local
```

For a first local run, you usually do not need to change `.env.local` immediately.

## 4. Check Codex login status

```bash
codex login status
```

If you are not logged in yet:

```bash
codex login
```

You can also connect ChatGPT / Codex later from the OpenCrab settings page after startup.

## 5. Start the web app

```bash
npm run dev
```

Default local address:

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

## 6. Start the Mac desktop app in development mode

```bash
npm run desktop:dev
```

This starts the Electron shell and automatically boots the shared runtime in development mode.

## 7. Recommended checks

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

## 8. Optional: build a local macOS package

If you want to generate a local macOS build artifact:

```bash
npm run desktop:dist:mac
```

For the fuller packaging checklist, see:

- [Desktop Smoke And Release Checklist](./desktop-smoke-and-release-checklist.md)

## 9. Related docs

- [Development Guide](./development.md)
- [Startup Behavior](./startup-behavior.md)
- [Docs Index](../README.md)
