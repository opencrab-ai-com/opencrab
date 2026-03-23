# 隐私与数据边界

本文说明 OpenCrab 当前会把哪些数据写到本地、哪些数据会离开本机、以及哪些文件允许被自动注册为可下载附件。

## 1. 本地落盘的数据

OpenCrab 默认把运行时数据写到 `OPENCRAB_HOME`。

如果没有显式设置，macOS 默认路径是：

- `$HOME/.opencrab/`

当前主要包含：

- `state/local-store.json`：对话、文件夹、消息和默认设置
- `state/channels.json`：渠道状态、最近事件、远端会话绑定
- `state/channel-secrets.json`：Telegram / 飞书密钥与启用状态
- `state/runtime-config.json`：公网地址与隧道状态
- `state/skills.json`：技能本地状态
- `state/tasks.json`：定时任务与最近运行记录
- `state/projects.json`：Team Mode 房间、成员、运行与产出索引
- `uploads/`：上传的原始文件与提取后的文本
- `skills/`：OpenCrab 自己管理的技能目录
- `agents/`：自定义智能体 profile 与补充上下文

这些数据默认不进入仓库，也不应该提交到 Git。

## 2. 哪些数据会离开本机

OpenCrab 当前不会自建云端账号体系，但下面这些场景会把数据发到外部服务：

- 对话与智能体执行：发送到 OpenAI 侧的执行环境
- Telegram 渠道：把入站消息带入 OpenCrab，并把回复回推到 Telegram
- 飞书渠道：把入站消息带入 OpenCrab，并把回复回推到飞书

如果你在对话里上传了文件，文件本身或提取后的文本可能会参与后续执行链路。

## 3. 渠道 secret 的当前边界

渠道 secret 当前有两种来源：

- 环境变量
- 本地 `state/channel-secrets.json`

当前版本还不是系统钥匙串或加密存储；这意味着：

- 这些 secret 默认只在本机可见
- 但如果你的本机目录本身不安全，secret 也不算加密态保护

因此建议：

- 不要把 `OPENCRAB_HOME` 放进仓库
- 不要把 `.env.local`、`channel-secrets.json`、导出的运行时目录提交到 Git
- 在共享机器上不要长期保留真实渠道凭据

## 4. 自动附件注册的安全边界

OpenCrab 支持把模型输出里提到的本地文件注册成可下载附件，但当前只允许安全目录里的文件自动注册：

- `$OPENCRAB_HOME/uploads/`
- 仓库下的 `output/`
- 仓库下的 `tmp/`
- 仓库下的 `.playwright-cli/`
- 当前已创建的 Team Mode 工作空间目录

这条边界的目的，是避免把任意绝对路径文件错误暴露成可下载附件。

不会自动注册的典型例子：

- 用户家目录里随意提到的其他文件
- 与当前工作空间无关的系统路径
- 不在 allowlist 内的任意绝对路径

## 5. 清理与备份

清理前请先确认是否还需要保留历史对话、任务和 Team Mode 数据。

常见做法：

- 备份：直接备份整个 `$OPENCRAB_HOME/`
- 清理：执行 `npm run clean:runtime`

注意：

- `clean:runtime` 会删除 OpenCrab 运行目录、旧版运行目录，以及仓库下部分临时产物目录
- 清理后，本地对话、任务、渠道状态、上传附件和 Team Mode 数据都会一起消失

更详细的清理与排障建议，见：

- [运维与排障](./operations.md)
