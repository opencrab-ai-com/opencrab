# OpenCrab

`OpenCrab` 是一个面向普通用户的开源 Web 助手，主入口是聊天，底层执行能力直接复用 Codex。

当前仓库已经完成：

- 对话主链路
- 历史对话与文件夹管理
- 图片 / 文件上传
- Codex 模型与推理强度选择
- 流式回复与思考过程展示
- 浏览器工具接入
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

当前最完整的是对话能力；`Channels`、`任务`、`Skills` 已有页面骨架和路由，但还不是完整实现。

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
  uploads/                  # 上传的原始附件与提取后的文本
    index.json              # 附件索引
  chrome-debug-profile/     # 独立浏览器模式使用的 Chrome profile
```

补充说明：

- OpenCrab 自己的对话内容、上传文件、浏览器 profile 都会写到 `$OPENCRAB_HOME`，不会默认写进代码仓库。
- 仓库里的 `.playwright-cli/` 只在用浏览器调试技能时才会生成，不属于 OpenCrab 对话运行时数据。
- 如果你想把运行时数据放到别的目录，可以在启动前设置 `OPENCRAB_HOME`。
