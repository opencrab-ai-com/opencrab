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

OpenCrab 是一个中文优先、本地优先、chat-native 的开源 AI 工作台。

它不把终端、路由配置、调度表达式或多 Agent 编排图当成主入口，而是把 `对话`、`智能体`、`团队模式`、`渠道`、`定时任务`、`技能` 收进同一个产品表面，让普通用户也能自然地开始使用。

如果只用一句话来描述：

`OpenCrab` 想做的不是另一个只服务工程师的 agent shell，而是一个更像 `ChatGPT`、但把执行、协作、渠道和持续工作一起收进来的中文优先工作台。

- 官网：[opencrab-ai.com](https://opencrab-ai.com)
- 联系邮箱：[sky@opencrab-ai.com](mailto:sky@opencrab-ai.com)

## OpenCrab 的特色

- `ChatGPT 风格的产品表面`
  从“发一句话”开始，而不是要求用户先学习终端、YAML、graph 或 gateway 配置。
- `比多 Agent demo 更像真实团队`
  Team Mode 不把多智能体理解成 subagents 拼接，而是朝“更像数字团队”的方向推进。
- `Channels 不是移动端聊天补充`
  渠道在 OpenCrab 里更像工作流的外部参与层，让用户、客户、同事和外部系统能继续参与正在运行的工作。
- `定时任务不是提醒器升级版`
  它更像按时间唤醒上下文继续运行的后台执行单元，而不是一条定时 prompt。
- `本地优先，不把运行时塞进仓库`
  对话、附件、浏览器状态、技能状态和渠道 secret 默认留在本机运行时目录。

## 产品截图

| 对话页 | 智能体页 |
| --- | --- |
| <img src="./docs/screenshots/conversation.png" alt="OpenCrab 对话页" width="480"> | <img src="./docs/screenshots/agents.png" alt="OpenCrab 智能体页" width="480"> |

| 团队模式页 | 渠道页 |
| --- | --- |
| <img src="./docs/screenshots/team-mode.png" alt="OpenCrab 团队模式页" width="480"> | <img src="./docs/screenshots/channels.png" alt="OpenCrab 渠道页" width="480"> |

| 定时任务页 | 技能页 |
| --- | --- |
| <img src="./docs/screenshots/tasks.png" alt="OpenCrab 定时任务页" width="480"> | <img src="./docs/screenshots/skills.png" alt="OpenCrab 技能页" width="480"> |

## OpenCrab 到底是什么

- 一个以聊天为主入口的 AI 工作台
- 一个本地优先的 runtime 外壳，而不是纯云端黑盒
- 一个把对话、执行、团队协作、渠道、定时任务和技能统一起来的产品面
- 一个试图按“开源项目 + 商业产品”双标准持续演进的项目

它不是什么：

- 不是只面向工程师的终端代理
- 不是只会调模型的聊天壳子
- 不是把多 Agent 机械拼起来的研究 demo
- 不是一个把基础设施术语直接暴露给普通用户的控制台

## 为什么它和一般 agent 产品不一样

很多产品只解决其中一小块：

- 要么强在终端和编码执行
- 要么强在 SaaS 聊天表面
- 要么强在 gateway、routing 和 automation runtime
- 要么强在知识工作和 polished output

OpenCrab 想做的是另一条路线：

- `产品表面` 向 ChatGPT 靠近，降低日常使用门槛
- `执行能力` 向强 agent 产品靠近，不停留在纯问答
- `协作方式` 不只做单助手，而是让 Team Mode 朝真实数字团队演进
- `持续工作` 不只靠即时对话，而是通过渠道和定时任务让工作继续发生
- `可控性` 保留开源、本地优先和可改造的空间

## 4 个关键产品判断

### 1. 对话仍然是主入口，但不是唯一能力

OpenCrab 仍然坚持 `chat-native`。

原因不是“聊天最流行”，而是：

- 用户最容易从一句自然语言开始
- 页面和心智最容易统一
- 对话最适合承接后续的执行、渠道消息、任务结果和团队协作

但 OpenCrab 也不把自己限制成“一个对话页”，它要让对话成为统一工作台的入口层。

### 2. Team Mode 不做 subagents，而是朝数字团队走

OpenCrab 的判断不是“多几个 agent 就更强”，而是：

`协作抽象要越来越像组织，而不是越来越像单个助手。`

这意味着 Team Mode 更关注：

- lead / member 关系
- shared task list
- handoff 与依赖
- 阶段推进、质量门、恢复与复盘

而不是只做“主线程临时叫几个分身干活”。

深入阅读：

- [OpenCrab 不做 Subagents，而是要走向比 Agent Teams 更像真实团队的模式](./docs/blogs/opencrab-beyond-agent-teams.md)

### 3. Channels 是工作流的外部参与层

OpenCrab 不把 Channels 定义成“在手机上也能聊天”。

它更像：

- 让外部用户继续参与工作
- 让远程消息进入正确的对话 / 团队上下文
- 让系统结果能主动送达到 Telegram / 飞书这类原生环境

所以它更接近 `ingress / egress layer`，而不是“消息平台配置页”。

深入阅读：

- [OpenCrab 对 Channels 的重新思考：它不是移动端聊天入口，而是 Agents 的外部参与层](./docs/blogs/opencrab-what-channels-should-be.md)

### 4. 定时任务是后台执行单元，不是提醒器

OpenCrab 不想把定时任务做成：

- 到点提醒一下
- 到点发一句 prompt
- 到点暴露一堆 cron 表达式

它更想做的是：

- 有上下文来源
- 有执行节奏
- 有运行记录
- 有结果出口
- 能继续把工作往前推

也就是“按时间唤醒某个工作上下文继续运行”。

深入阅读：

- [OpenCrab 对定时任务的重新思考：它不应该只是提醒，也不应该只是调度系统](./docs/blogs/opencrab-what-scheduled-tasks-should-be.md)

## 主要能力

### 对话与执行

- 流式回复、历史对话、文件夹整理
- 图片 / 文件上传与常见文档文本抽取
- 浏览器能力接入，支持连接当前浏览器和独立浏览器模式
- 模型、推理强度、默认语言、权限模式等设置

### 智能体与团队模式

- 系统智能体与自定义智能体
- 智能体详情、角色设定与直接发起对话
- Team Room 创建、成员选择、阶段推进与恢复
- 项目经理式组织协作，而不是只有多 agent 并行

### 渠道与定时任务

- Telegram webhook 接入
- 飞书长连接接入
- 远程消息与本地对话绑定
- 定时任务创建、暂停、恢复、立即执行和结果回流

### 技能与运行治理

- 技能目录浏览、启用 / 禁用 / 卸载、自定义条目
- 运行时目录隔离
- 附件 allowlist
- JSON store 原子写入、CI、测试、隐私与运维文档

## 相对同类产品的关系

按 `2026-03-23` 的公开资料和当前仓库实现来判断：

- 相比 `OpenClaw`
  `OpenCrab` 更强调产品表面、中文优先和统一工作台叙事；`OpenClaw` 在 gateway、安全边界、自动化与控制平面上更硬。
- 相比 `Codex`
  `OpenCrab` 更适合做 chat-native、中文优先的统一工作台；`Codex` 在编码深度、worktree、多 agent 协调和官方生态上更强。
- 相比 `Claude Cowork`
  `OpenCrab` 更开源、更本地优先，也更强调渠道 / 任务 / Team Mode 组合；`Cowork` 在桌面知识工作、连接器和 polished output 上更成熟。

更完整的定位、优劣势和边界判断见：

- [Product Positioning](./docs/product/product-positioning.md)

## 深入阅读

- [Product Positioning](./docs/product/product-positioning.md)
- [Product Scope](./docs/product/product-scope.md)
- [OpenCrab 不做 Subagents，而是要走向比 Agent Teams 更像真实团队的模式](./docs/blogs/opencrab-beyond-agent-teams.md)
- [OpenCrab 对 Channels 的重新思考：它不是移动端聊天入口，而是 Agents 的外部参与层](./docs/blogs/opencrab-what-channels-should-be.md)
- [OpenCrab 对定时任务的重新思考：它不应该只是提醒，也不应该只是调度系统](./docs/blogs/opencrab-what-scheduled-tasks-should-be.md)

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

- [Docs Index](./docs/README.md)
- [Product Positioning](./docs/product/product-positioning.md)
- [Product Scope](./docs/product/product-scope.md)
- [Architecture](./docs/engineering/architecture.md)
- [隐私与数据边界](./docs/engineering/privacy-and-data.md)
- [运维与排障](./docs/engineering/operations.md)
- [Startup Behavior](./docs/engineering/startup-behavior.md)
- [Development Guide](./docs/engineering/development.md)
- [Codex Integration](./docs/engineering/codex-sdk-integration.md)
- [SECURITY](./SECURITY.md)
- [CONTRIBUTING](./CONTRIBUTING.md)

## 当前状态

当前最成熟的仍然是聊天主链路，但 OpenCrab 的产品面已经不是“一个对话页”了。

- `对话`
  已支持持久化历史、文件夹、附件、浏览器能力和流式回复。
- `智能体`
  已支持系统智能体、自定义智能体、详情查看和从智能体直接发起对话。
- `团队模式`
  已支持 Team Room 创建、成员选择、运行推进和与定时任务联动。
- `渠道`
  Telegram 已支持文本、图片和文件消息；飞书当前以文本闭环为主。
- `定时任务`
  已支持创建、暂停、恢复、立即执行、结果回流和对话内创建。
- `技能`
  已支持目录浏览、详情查看、启用 / 禁用 / 卸载和自定义技能。

整体策略仍然是：先把最常用链路做稳，再继续向协作、渠道、调度和长期运行能力扩展。

## 许可证

[MIT](./LICENSE)
