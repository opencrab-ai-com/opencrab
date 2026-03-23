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

OpenCrab 是一个面向普通用户、以中文为主、本地优先的小螃蟹工作台。

它尽量把产品表面做简单：聊天是主入口，智能体、团队模式、渠道、定时任务和技能逐步收拢到同一套工作空间里，而不需要用户先学习一整套开发者工具链。

如果用一句更准确的话来描述：

`OpenCrab` 想做的是一个 `ChatGPT` 风格、中文优先、开源且本地优先的统一工作台，而不是另一个只服务工程师的终端代理。

- 官网：[opencrab-ai.com](https://opencrab-ai.com)
- 联系邮箱：[sky@opencrab-ai.com](mailto:sky@opencrab-ai.com)

## 产品截图

| 首页 | 对话线程 |
| --- | --- |
| <img src="./docs/screenshots/homepage.png" alt="OpenCrab 首页" width="480"> | <img src="./docs/screenshots/conversation-thread.png" alt="OpenCrab 对话线程" width="480"> |

| 渠道总览 | Telegram 渠道 |
| --- | --- |
| <img src="./docs/screenshots/channels-overview.png" alt="OpenCrab 渠道总览" width="480"> | <img src="./docs/screenshots/telegram-channel.png" alt="OpenCrab Telegram 渠道" width="480"> |

| 设置 | 定时任务 |
| --- | --- |
| <img src="./docs/screenshots/settings.png" alt="OpenCrab 设置" width="480"> | <img src="./docs/screenshots/tasks.png" alt="OpenCrab 定时任务" width="480"> |

| 技能 | 渠道页 |
| --- | --- |
| <img src="./docs/screenshots/skills.png" alt="OpenCrab 技能" width="480"> | <img src="./docs/screenshots/channels.png" alt="OpenCrab 渠道页" width="480"> |

## 产品定位

- `ChatGPT` 风格的聊天工作台，而不是终端优先工具
- 中文优先、本地优先、开源可改
- 把对话、执行、渠道、定时任务、团队协作和技能放进同一产品表面
- 目标不是只做“会写代码的智能体”，而是做“能真正持续完成工作的工作台”

## 为什么它有自己的位置

- 相比纯聊天产品，它更强调本地执行、渠道接入、定时调度和团队推进
- 相比纯 CLI / agent runtime，它更强调产品表面、低门槛和普通用户体验
- 相比纯知识工作助手，它同时兼顾编码执行、渠道、任务和团队模式

## 相对同类产品的关系

按 `2026-03-23` 的公开资料和当前仓库实现来判断：

- 相比 `OpenClaw`：`OpenCrab` 更像统一产品工作台；`OpenClaw` 在 Gateway、安全边界、审批和自动化控制平面上更硬
- 相比 `Codex`：`OpenCrab` 更适合做中文优先、chat-native 的统一工作台；`Codex` 在编码深度、worktree、多 agent 和官方生态上更强
- 相比 `Claude Cowork`：`OpenCrab` 更开源、更本地优先，也更强调渠道 / 任务 / Team Mode 组合；`Cowork` 在桌面知识工作、连接器和 polished output 上更成熟

更完整的定位、优势 / 劣势和对比说明见：

- [Product Positioning](./docs/product-positioning.md)

## 主要能力

- 以聊天为主入口，支持流式回复、历史对话和文件夹整理
- 支持图片、文件上传，以及常见文档格式的文本提取
- 支持浏览器工具接入，覆盖 `连接当前浏览器` 与 `使用独立浏览器` 两种模式
- 支持 Telegram 和飞书渠道接入：Telegram 走 webhook，飞书默认走长连接
- 支持定时任务创建、暂停、恢复、立即执行，以及从当前对话直接创建定时任务
- 支持技能目录浏览、详情查看、启用 / 禁用 / 卸载和自定义技能条目
- 支持智能体管理：可创建自定义角色，并直接发起专属对话
- 支持团队模式：可把多个智能体拉进同一个 Team Room 持续推进任务
- 内置“关于我们”页面，用于说明产品定位、原则、迭代历史与路线图
- 运行时数据和 secret 默认保存在仓库之外

## 当前页面结构

- `对话`：主工作流入口，支持上传文件、流式回复和浏览器能力
- `智能体`：管理系统智能体与自定义智能体，并可直接发起对话
- `团队模式`：创建 Team Room，让多个智能体围绕同一目标协作推进
- `渠道`：管理 Telegram、飞书的接入、状态与连接细节
- `定时任务`：集中管理计划任务和运行结果
- `技能`：浏览、启用、禁用、卸载与创建技能
- `关于我们`：查看产品介绍、原则、路线图与联系入口
- `设置`：管理模型、推理强度、语言、浏览器模式和连接状态

## 零基础安装与启用

下面这套流程按“完全新手第一次安装”来写。  
如果你只想尽快跑起来，按顺序照做即可。

### 0. 先确认你有 Codex 使用资格

OpenCrab 当前通过 `@openai/codex-sdk` 接入 Codex，核心回复能力依赖本机可用的 ChatGPT / Codex 登录态。

这意味着你需要先具备可用的 Codex 使用资格。  
由于 OpenAI 可能会调整可用计划、登录入口和权限边界，这里不再在 README 里硬编码套餐列表。

你至少需要满足两件事：

- 本机可以执行 `codex`
- 你的账号本身具备可用的 Codex 使用资格

最新要求请直接参考 OpenAI 官方文档：[Codex CLI](https://developers.openai.com/codex/cli)

如果账号本身没有 Codex 使用资格，那么即使项目能启动，OpenCrab 也无法正常完成核心回复流程。

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

### 6. 下载项目代码

如果你会用 Git：

```bash
git clone <你的仓库地址>
cd opencrab
```

如果你不会用 Git，也可以直接下载仓库 ZIP，解压后再进入项目目录。

### 7. 安装项目依赖

进入项目目录后执行：

```bash
npm install
```

### 8. 初始化本地配置

先复制一份本地环境文件：

```bash
cp .env.example .env.local
```

第一次安装时，通常不需要改动它，先保留默认值即可。

### 9. 启动 OpenCrab

执行：

```bash
npm run dev
```

当前默认开发模式使用的是 Next.js 16 的 Turbopack。  
如果你需要临时回退到旧的 Webpack 模式，也可以执行：

```bash
npm run dev:webpack
```

默认情况下，开发环境会启动在：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

如果 `3000` 端口已被占用，Next.js 会自动切换到别的端口，终端里会显示新的本地地址。  
这时直接打开终端里显示的那个地址即可。

### 10. 首次打开后怎么确认已经能用

启动后，先打开浏览器访问本地地址，然后建议做下面两步：

1. 打开首页，确认页面能正常加载
2. 打开 `/settings`，确认 ChatGPT 连接状态正常

如果你当前还没有登录，不需要先回终端手动执行登录命令。  
直接在设置页的 `ChatGPT 连接` 卡片里点击 `连接 ChatGPT`，按页面引导完成授权即可。

完成后，设置页通常会显示：

- 状态：`已连接`
- 提示文案类似：`ChatGPT 已连接，现在可以直接开始使用。`

这就说明 OpenCrab 已经具备基础可用条件。

如果你是开发者，也仍然可以直接在终端里手动执行：

```bash
codex login
codex login status
```

两种方式本质上复用的是同一套底层登录态。

### 11. 开始使用

完成上面的步骤后，你就可以直接在网页里：

- 新建对话
- 输入一句话开始聊天
- 上传图片或文件
- 在产品内继续配置其他能力

对于完全新手，建议先只跑通网页里的主对话链路，再继续探索其他页面。

### 12. 建议检查

如果你想确认当前仓库安装完整、构建正常，可以继续执行：

```bash
npm run lint
npm run test
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
OPENCRAB_UPLOAD_MAX_FILES=8
OPENCRAB_UPLOAD_MAX_FILE_BYTES=26214400
OPENCRAB_UPLOAD_MAX_TOTAL_BYTES=41943040
```

OpenCrab 自己的常用配置可以直接在这些页面里处理：

- `/settings`

说明：

- 如果你希望命令执行直接继承本机的 `OPENAI_API_KEY`，可以在 `/settings` 里手动打开对应开关；默认关闭
- 如果你直接复制 `.env.example`，当前默认 sandbox 也是 `workspace-write`，与设置页推荐值保持一致
- `/settings` 当前可直接配置默认模型、推理强度、默认语言、权限模式和浏览器连接方式
- 默认语言会写入 OpenCrab 的系统提示里，后续对话、总结、改写、定时任务和渠道回复都会优先按这个语言处理

如果你是高级用户，仍然可以按需通过环境变量扩展更多运行配置。

当前默认上传保护为：

- 单次最多 `8` 个附件
- 单文件默认最大 `25 MB`
- 单次总上传默认最大 `40 MB`

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

补充：

- 如果某个本地 JSON store 文件损坏，当前会先自动备份成 `*.corrupt.<timestamp>.json`，再恢复默认结构
- API 错误响应会附带 `requestId`，方便排障时回查服务端日志

首次启动时，OpenCrab 会自动把旧的 `~/Library/Application Support/OpenCrab` 迁移到这个新目录结构里。

这意味着对话、附件、浏览器状态和渠道 secret 默认都不会落进代码仓库。

## 文档

- [Product Positioning](./docs/product-positioning.md)
- [Product Scope](./docs/product-scope.md)
- [Architecture](./docs/architecture.md)
- [隐私与数据边界](./docs/privacy-and-data.md)
- [运维与排障](./docs/operations.md)
- [Startup Behavior](./docs/startup-behavior.md)
- [Development Guide](./docs/development.md)
- [Codex Integration](./docs/codex-sdk-integration.md)
- [SECURITY](./SECURITY.md)
- [CONTRIBUTING](./CONTRIBUTING.md)

## 当前状态

当前最稳定的部分依然是聊天主链路，但产品面已经比最初版本更完整。

- `对话`：已经支持持久化历史、文件夹、附件、浏览器能力和流式回复
- `智能体`：已经支持系统智能体、自定义智能体、详情查看和从智能体直接发起对话
- `团队模式`：已经支持 Team Room 创建、成员选择、运行推进和与定时任务联动
- `渠道`：Telegram 已支持文本、图片和文件消息；飞书当前以文本闭环为主
- `定时任务`：已经支持创建、暂停、恢复、立即执行、结果回流和对话内创建
- `技能`：已经支持目录浏览、详情查看、启用 / 禁用 / 卸载和自定义技能

整体策略仍然是：先把日常最常用的链路做稳，再继续向渠道、调度和协作能力扩展。

## 许可证

[MIT](./LICENSE)
