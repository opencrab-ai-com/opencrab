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

## Runtime Data

本地运行时会自动生成这些目录：

- `.opencrab/`
- `.playwright-cli/`

它们属于运行时数据，已经默认忽略，不会作为源码提交。
