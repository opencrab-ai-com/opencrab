# OpenCrab

`OpenCrab` 是一个面向普通用户的开源 Web 助手，主入口是聊天，底层执行能力直接复用 Codex。

当前仓库已经完成：

- 对话主链路
- 历史对话与文件夹管理
- 图片 / 文件上传
- Codex 模型与推理强度选择
- 流式回复与思考过程展示
- 浏览器工具接入
- Telegram / 飞书 channel webhook 接入
- 设置页中的默认模型、推理强度、权限模式、浏览器模式

## Quick Start

```bash
npm install
codex login
npm run dev
```

开发地址：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Documentation

- [Product Scope](./docs/product-scope.md)
- [Architecture](./docs/architecture.md)
- [Development Guide](./docs/development.md)
- [Codex Integration](./docs/codex-sdk-integration.md)

## Current Status

当前最完整的是对话能力；`Channels` 已支持 Telegram / 飞书的第一版 webhook 对接，`任务` 和 `Skills` 仍以页面骨架为主。

## Useful Scripts

```bash
npm run lint
npm run typecheck
npm run build
npm run clean:runtime
```

## Runtime Data

OpenCrab 的运行时数据根目录由 `OPENCRAB_HOME` 决定。

如果没有显式设置 `OPENCRAB_HOME`，macOS 默认会使用：

```bash
$HOME/Library/Application Support/OpenCrab
```

目录结构如下：

```text
$OPENCRAB_HOME/
  local-store.json          # 对话、消息、文件夹、设置等本地快照
  channels.json             # 渠道状态、绑定关系、最近事件
  channel-secrets.json      # 渠道密钥（服务端私有）
  uploads/                  # 上传的原始附件与提取后的文本
    index.json              # 附件索引
  chrome-debug-profile/     # 独立浏览器模式使用的 Chrome profile
```

补充说明：

- OpenCrab 自己的对话内容、上传文件、浏览器 profile 都会写到 `$OPENCRAB_HOME`，不会默认写进代码仓库。
- 渠道 secret 不会进入前端 snapshot，只会保存在 `$OPENCRAB_HOME/channel-secrets.json` 或环境变量里。
- 仓库里的 `.playwright-cli/` 只在用浏览器调试技能时才会生成，不属于 OpenCrab 对话运行时数据。
- 如果你想把运行时数据放到别的目录，可以在启动前设置 `OPENCRAB_HOME`。

## Channels

当前 `Channels` 第一版支持：

- `Telegram`：Bot webhook 入站、去重、自动创建会话绑定、文本消息回推
- `飞书`：事件订阅 challenge 校验、文本消息入站、自动创建会话绑定、文本消息回推

配置方式：

- 在 UI 的 `/channels/telegram` 或 `/channels/feishu` 页面中填写
- 或通过 `.env` / 环境变量注入

如果你希望页面里直接显示完整 webhook 地址，请设置：

```bash
OPENCRAB_PUBLIC_BASE_URL=https://your-public-host
```
