# Development Guide

## Requirements

- macOS
- Node.js 18+
- 已安装并可执行 `codex`
- 已完成 `codex login`

## Start

```bash
npm install
npm run dev
```

默认开发地址：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Recommended Checks

```bash
npm run lint
npm run build
```

## Local Runtime Directories

首次运行后，仓库下会自动生成：

- `.opencrab/`
- `.playwright-cli/`（仅在调试浏览器技能时）

这些目录是运行时数据，不需要提交。

## Debugging Codex

检查登录状态：

```bash
codex login status
```

如果 UI 提示 Codex 不可用，优先检查：

1. `codex login status`
2. `/api/codex/status`
3. 浏览器连接模式是否正确

## Browser Modes

设置页支持两种浏览器连接模式：

- `连接当前浏览器`
- `使用独立浏览器`

如果你需要复用自己平时的 Chrome 会话，使用 `连接当前浏览器`。

## Attachments

当前支持：

- 图片
- 文本文件
- Markdown / JSON / HTML / 代码文件
- PDF
- Word (`.doc`, `.docx`)

说明：

- PDF 目前支持可提取文字的 PDF，不支持纯扫描 OCR
- Word 提取依赖 macOS 自带 `textutil`
