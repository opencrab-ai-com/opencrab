# 从 Git 安装 OpenCrab

这份文档适合：

- 想运行 OpenCrab 最新源码的人
- 想自己修改 OpenCrab 的开发者
- 想参与贡献、排查问题或做本地实验的人

如果你只是想直接开始使用 OpenCrab，优先下载已经发布的 Mac App：

- [OpenCrab Desktop v0.1.1](https://github.com/opencrab-ai-com/opencrab/releases/tag/v0.1.1)

## 0. 前提

- macOS
- `Google Chrome 146+`
- Node.js `20.9+`
- Git
- 已安装并可执行 `codex`
- 可用的 `codex` 账户
- 能访问 ChatGPT 的网络条件

## 1. 克隆仓库

```bash
git clone https://github.com/KetteyMan/opencrab.git
cd opencrab
```

## 2. 安装依赖

```bash
npm install
```

## 3. 初始化本地配置

```bash
cp .env.example .env.local
```

如果你只是第一次本地运行，通常不需要立刻修改 `.env.local`。

## 4. 检查 Codex 登录状态

```bash
codex login status
```

如果当前还没有登录，可以执行：

```bash
codex login
```

你也可以在 OpenCrab 启动后，通过产品内的设置页连接 ChatGPT / Codex。

## 5. 启动 Web 版本

```bash
npm run dev
```

默认开发地址：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

## 6. 启动 Mac 桌面开发版

```bash
npm run desktop:dev
```

这条命令会启动 Electron 桌面壳，并在开发模式下自动拉起共享 runtime。

## 7. 建议检查

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

## 8. 可选：本地打包 mac 版本

如果你需要在本地生成 mac 安装包，可以执行：

```bash
npm run desktop:dist:mac
```

更完整的打包前检查见：

- [Desktop Smoke And Release Checklist](./desktop-smoke-and-release-checklist.md)

## 9. 相关文档

- [Development Guide](./development.md)
- [Startup Behavior](./startup-behavior.md)
- [Docs Index](../README.md)
