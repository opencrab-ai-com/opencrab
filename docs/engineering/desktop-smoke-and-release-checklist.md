# OpenCrab Desktop Smoke And Release Checklist

更新时间：2026-03-30

这份文档只回答两个问题：

1. `每次 desktop 改动后，应该怎么做固定回归？`
2. `准备发一个可测试版本时，最小需要做哪些事情？`

目标不是覆盖所有未来发布流程，而是把当前已经验证过的 desktop 基础链，收敛成一份稳定、可重复执行的操作清单。

## 当前发布基线

当前 desktop 版本的基线假设如下：

- Desktop 是 `Electron shell + shared OpenCrab runtime`
- Desktop 默认走 production runtime bundle，不再依赖用户手动运行 `next dev`
- 浏览器模式使用 `current-browser`
- OpenCrab 强依赖用户本机安装 `Google Chrome`
- ChatGPT 登录体验以 OpenCrab 引导为准，用户感知到的是“在 Chrome 中登录 ChatGPT”
- 测试隔离优先使用 `OPENCRAB_HOME`，不再改整个系统 `HOME`

## 固定命令

所有命令都在仓库根目录执行：

```bash
cd /path/to/opencrab
```

开发前的基础检查：

```bash
npm run typecheck
npm test
```

准备 desktop production runtime bundle：

```bash
npm run desktop:bundle-runtime
```

启动一个“只隔离 OpenCrab 数据，不碰系统 HOME”的 desktop 测试实例：

```bash
npm run desktop:prod:isolated
```

生成一个本地可验证的 packaged app 目录：

```bash
npm run desktop:pack
```

生成 macOS dmg 分发产物：

```bash
npm run desktop:dist:mac
```

## Desktop Smoke Checklist

下面这套清单是每次 desktop 相关改动后都应该重复执行的最小回归。

### 1. 基础构建

- 运行 `npm run typecheck`
- 运行 `npm test`
- 运行 `npm run desktop:bundle-runtime`
- 确认 runtime bundle 目录存在：`.opencrab-desktop/runtime`

通过标准：

- TypeScript 无报错
- 测试全部通过
- runtime bundle 成功生成

### 2. Isolated Desktop 启动

- 运行 `npm run desktop:prod:isolated`
- 观察终端输出，确认出现：
  - `OpenCrab data dir`
  - `System HOME preserved at`
  - `Local: http://127.0.0.1:<port>`
  - `Ready`

通过标准：

- Desktop 窗口正常打开
- 不出现 Chrome 钥匙串异常弹窗
- 终端能看到 runtime 已 ready

### 3. Runtime Readiness

在 desktop 保持运行时，检查：

```bash
curl -s http://127.0.0.1:3400/api/health
curl -s http://127.0.0.1:3400/api/runtime/readiness
```

如果实例不是 `3400` 端口，替换成实际端口。

通过标准：

- `/api/health` 返回 `{"ok":true}`
- `/api/runtime/readiness` 至少能给出清晰状态
- 如果系统已登录 ChatGPT，允许直接是 `ready: true`
- 如果系统未登录 ChatGPT，允许进入 `recommendedAction: connect_chatgpt`

### 4. ChatGPT 首次连接

仅在“系统当前未登录 ChatGPT”时执行：

- 在 OpenCrab 首次引导里点击“连接 ChatGPT”
- 确认 OpenCrab 会拉起 `Google Chrome`
- 在 Chrome 中完成 ChatGPT 登录
- 切回 OpenCrab，确认状态自动更新

通过标准：

- 用户不需要理解 `codex cli`
- OpenCrab 的连接文案是网页登录体验，而不是 CLI 术语
- 回到 OpenCrab 后，不需要手动点“刷新状态”

### 5. Current-Browser MCP

- 确认设置页里的浏览器状态是 `已就绪`
- 在对话里让 OpenCrab 打开一个网页，例如 `https://x.com`
- 观察 Chrome 是否在当前浏览器会话里正常打开页面

通过标准：

- `current-browser` 状态能进入 `ready`
- OpenCrab 能在当前 Chrome 会话中创建新页面
- 不再出现“检测到 Chrome，但控制不可用”的误判

### 6. 浏览器关闭与恢复

- 完全退出 Chrome
- 切回 OpenCrab，确认状态变成不可用或等待恢复
- 重新打开 Chrome
- 在设置页点击“重新检查浏览器连接”或等待自动恢复

通过标准：

- 状态变化对用户是清晰可理解的
- 恢复后可以重新进入 `ready`
- 不需要重启整个 OpenCrab

### 7. 应用关闭与重开

- 关闭 OpenCrab desktop
- 再重新启动一次 `npm run desktop:prod:isolated`
- 再次检查：
  - ChatGPT 状态
  - 浏览器状态
  - 主界面是否可用

通过标准：

- 重启后 shared runtime 能再次正常起来
- 之前修好的 readiness / browser / login 链不会回退

## 最小发布清单

下面这部分是“准备发一个可测试 desktop 版本”时的最小动作，不等于正式商业发布流程。

### 1. 发布前代码基线

- 当前分支已经合并或明确基于最新可发布代码
- `npm run typecheck` 通过
- `npm test` 通过
- Desktop Smoke Checklist 全部走完

### 2. 打包产物

- 运行 `npm run desktop:pack`
- 本地打开 `dist/desktop/.../OpenCrab.app`
- 确认 packaged app 能正常拉起 shared runtime

通过标准：

- 不是只在开发态可用
- packaged app 启动后，`/api/health` 正常
- packaged app 内的 Codex 执行链可用

### 3. 分发产物

- 运行 `npm run desktop:dist:mac`
- 检查 `dist/desktop` 下的 dmg 产物
- 确认产物命名清晰、可区分版本

通过标准：

- 至少有一个可发送给测试用户的 macOS dmg
- 产物名称能直接看出版本

### 4. 发布说明

每次对外发测试包，至少记录：

- 版本号
- 对应分支 / commit
- 本次重点验证项
- 已知限制

当前已知限制应明确写出来：

- 当前只支持 `Google Chrome`
- 当前浏览器模式是 `current-browser`
- 正式对外广泛分发前，仍需要补签名 / 公证

## 暂不在本轮处理的发布项

这些事情很重要，但不属于当前这轮“先把 desktop 做成稳定可测试版本”的最小范围：

- macOS 代码签名
- notarization / stapling
- 自动更新
- 正式应用图标与品牌资源链
- 安装器体验优化
- Windows / Linux 分发

这些项要等当前 smoke 回归稳定后，再单独进入下一轮。

## 失败时先查什么

### Desktop 能启动，但页面打不开

先查：

- `npm run desktop:bundle-runtime` 是否最新
- 终端里 shared runtime 是否已经 `Ready`
- `curl http://127.0.0.1:<port>/api/health` 是否返回 `ok`

### ChatGPT 登录后没有自动更新

先查：

- 是否切回了 OpenCrab 窗口
- focus / visibility 恢复后状态是否刷新
- `/api/chatgpt/connect/status` 是否已经变成 `connected`

### 浏览器检测通过，但当前浏览器控制不可用

先查：

- Chrome 是否真的在运行
- `/api/codex/browser-session` 的 `status` 是什么
- 是否错误地改了系统 `HOME`

### 又出现 Chrome 钥匙串弹窗

先查：

- 是否误用了 `HOME=/tmp/...` 这种测试方式
- 当前是否使用 `desktop:prod:isolated`

正确做法是：

- 保留系统真实 `HOME`
- 只隔离 `OPENCRAB_HOME`
