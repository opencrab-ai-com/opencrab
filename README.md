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

- 官网：[opencrab-ai.com](https://opencrab-ai.com)
- 联系邮箱：[sky@opencrab-ai.com](mailto:sky@opencrab-ai.com)

## 产品截图

| 首页                                                                        | 渠道                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| <img src="./docs/screenshots/homepage.png" alt="OpenCrab 首页" width="480"> | <img src="./docs/screenshots/channels.png" alt="OpenCrab 渠道" width="480"> |

| 定时任务                                                                     | 技能                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| <img src="./docs/screenshots/tasks.png" alt="OpenCrab 定时任务" width="480"> | <img src="./docs/screenshots/skills.png" alt="OpenCrab 技能" width="480"> |

## 主要能力

- 以聊天为主入口，支持流式回复和持久化历史对话
- 支持文件夹管理对话，整体交互接近大家熟悉的 ChatGPT 形态
- 支持图片、文件上传，以及常见文档格式的文本提取
- 支持浏览器工具接入，覆盖 current-browser 和 managed-browser 两种模式
- 已支持 Telegram 和飞书渠道接入：Telegram 走 webhook，飞书默认走长连接
- 支持简单的定时任务管理，也可以直接从当前对话创建定时任务
- 支持 Skills 目录浏览、详情查看、状态管理和自定义技能条目
- 运行时数据和 secret 默认保存在仓库之外

## 零基础安装与启用

下面这套流程按“完全新手第一次安装”来写。  
如果你只想尽快跑起来，按顺序照做即可。

### 0. 先确认你有 Codex 使用资格

OpenCrab 当前通过 `@openai/codex-sdk` 接入 Codex，核心对话能力依赖本机 `codex login` 的登录状态。

这意味着你需要先具备可用的 Codex 使用资格。
由于 OpenAI 可能会调整可用计划、登录入口和权限边界，这里不再在 README 里硬编码套餐列表。

你只需要确认两件事：

- 本机可以执行 `codex login`
- `codex login status` 能返回已登录状态

最新要求请直接参考 OpenAI 官方文档：[Codex CLI](https://developers.openai.com/codex/cli)

如果你的账号本身没有 Codex 使用资格，那么即使项目能启动，OpenCrab 也无法正常完成核心回复流程。

### 1. 准备 macOS

当前推荐环境：

- macOS
- 稳定网络环境
- 可正常打开终端 App

### 2. 安装 Homebrew

如果你还没有安装 Homebrew，可以先在终端执行：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装完成后，检查是否成功：

```bash
brew -v
```

### 3. 安装 Node.js

推荐直接安装当前 LTS 线路可用的 Node：

```bash
brew install node
```

安装完成后，检查版本：

```bash
node -v
```

只要输出版本 `>= 20.9` 就符合 OpenCrab 当前要求。

### 4. 安装 npm

通常不需要单独安装。`npm` 会随 Node.js 一起安装。

你只需要执行下面的命令确认它已经可用：

```bash
npm -v
```

如果能看到版本号，就说明 `npm` 已经安装成功。

### 5. 安装 Codex CLI

在终端执行：

```bash
npm i -g @openai/codex
```

安装完成后，检查版本：

```bash
codex --version
```

### 6. 登录 Codex

执行：

```bash
codex login
```

第一次登录时，终端会引导你完成账号登录。  
登录完成后，再检查一次：

```bash
codex login status
```

看到类似下面的结果，就说明这一步已经完成：

```text
Logged in using ChatGPT
```

### 7. 下载项目代码

如果你会用 Git：

```bash
git clone <你的仓库地址>
cd opencrab
```

如果你不会用 Git，也可以直接下载仓库 ZIP，解压后再进入项目目录。

### 8. 安装项目依赖

进入项目目录后执行：

```bash
npm install
```

### 9. 初始化本地配置

先复制一份本地环境文件：

```bash
cp .env.example .env.local
```

第一次安装时，通常不需要改动它，先保留默认值即可。

### 10. 启动 OpenCrab

执行：

```bash
npm run dev
```

默认情况下，开发环境会启动在：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

如果 `3000` 端口已被占用，Next.js 会自动切换到别的端口，终端里会显示新的本地地址。  
这时直接打开终端里显示的那个地址即可。

### 11. 首次打开后怎么确认已经能用

启动后，先打开浏览器访问本地地址，然后建议做下面两步：

1. 打开首页，确认页面能正常加载
2. 打开 `/settings`，确认账户连接状态正常

如果设置页显示：

- 账户连接状态：`已登录`
- 当前状态：`OpenCrab 可用`

就说明 OpenCrab 已经具备基础可用条件。

### 12. 开始使用

完成上面的步骤后，你就可以直接在网页里：

- 新建对话
- 输入一句话开始聊天
- 上传图片或文件
- 在产品内继续配置其他能力

对于完全新手，建议先只跑通网页里的主对话链路，再继续探索其他页面。

### 13. 建议检查

如果你想确认当前仓库安装完整、构建正常，可以继续执行：

```bash
npm run lint
npm run typecheck
npm run build
```

## 配置

大多数情况下，你可以先直接从 UI 开始用。  
对于普通用户，推荐优先通过产品内页面完成后续配置，而不是手动修改本地文件。

```bash
OPENCRAB_CODEX_MODEL=gpt-5.4
OPENCRAB_CODEX_REASONING_EFFORT=medium
OPENCRAB_CODEX_SANDBOX_MODE=workspace-write
OPENCRAB_CODEX_NETWORK_ACCESS=false
OPENCRAB_PUBLIC_BASE_URL=http://127.0.0.1:3000
```

OpenCrab 自己的常用配置可以直接在这些页面里处理：

- `/settings`

说明：

- 如果你希望命令执行直接继承本机的 `OPENAI_API_KEY`，可以在 `/settings` 里手动打开对应开关；默认关闭
- 如果你直接复制 `.env.example`，当前默认 sandbox 也是 `workspace-write`，与设置页推荐值保持一致

如果你是高级用户，仍然可以按需通过环境变量扩展更多运行配置。

## 运行时数据

OpenCrab 的运行时数据存放在 `OPENCRAB_HOME`。

如果没有显式设置，macOS 默认路径是：

```bash
$HOME/.opencrab
```

当前运行时目录结构：

```text
$OPENCRAB_HOME/
  state/
    local-store.json
    channels.json
    channel-secrets.json
    runtime-config.json
    skills.json
    tasks.json
  uploads/
  uploads/index.json
  logs/
    tunnels/
  browser/
    chrome-debug-profile/
  skills/
```

首次启动时，OpenCrab 会自动把旧的 `~/Library/Application Support/OpenCrab` 迁移到这个新目录结构里。

这意味着对话、附件、浏览器状态和渠道 secret 默认都不会落进代码仓库。

## 文档

- [Product Scope](./docs/product-scope.md)
- [Architecture](./docs/architecture.md)
- [Startup Behavior](./docs/startup-behavior.md)
- [Development Guide](./docs/development.md)
- [Codex Integration](./docs/codex-sdk-integration.md)

## 当前状态

目前最完整的部分还是对话主链路。

`Channels` 已经支持 Telegram 和飞书的一版可用接入流程，其中 Telegram 已支持文本、图片和文件消息的入站与回推，飞书当前以文本消息闭环为主。`任务` 已支持创建、暂停、恢复、立即执行、结果回流，以及从当前对话直接创建定时任务。`Skills` 已经具备目录浏览、详情查看、启用/禁用/卸载状态和自定义条目管理。

## 许可证

[MIT](./LICENSE)
