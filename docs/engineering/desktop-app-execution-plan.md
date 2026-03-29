# OpenCrab Desktop App Execution Plan

更新时间：2026-03-29

## Goal

为 `OpenCrab` 增加正式可分发的桌面版 App，同时继续保留现有 Web 启动方式。

这次路线有两个硬约束：

- `桌面版产品能力必须与 Web 版一致，不做阉割`
- `桌面版不能演变成另一套产品内核`

换句话说，我们要做的是：

- 保留 `npm run dev` / `npm run build && npm run start` 这条 Web 路径
- 新增桌面分发形态
- 继续复用现有 `app/`、`app/api/*`、`lib/*`、本地 runtime 和产品模型

## Final Decision

桌面版采用：

- `Electron` 作为桌面壳
- `Next.js standalone server` 作为桌面版的本地服务进程
- `现有 OpenCrab app/api/lib 全量复用`

明确不采用：

- `Tauri + 重写 Node 运行时`
- `桌面版单独维护一套 API`
- `桌面版功能裁剪`

## Why Electron

当前 OpenCrab 已经深度依赖：

- `Node child_process`
- 本地文件系统
- `@openai/codex-sdk`
- 本地 JSON store
- 浏览器 MCP bridge
- 本地目录选择
- 任务执行器、渠道守护与本地 runtime home

这些能力已经写进现有实现，例如：

- `lib/codex/sdk.ts`
- `lib/chatgpt/connection.ts`
- `lib/codex/browser-session.ts`
- `app/api/bootstrap/route.ts`
- `lib/server/native-directory-picker.ts`

在这种前提下，`Electron + 复用现有 Node/Next 运行时` 是最稳、最不容易导致产品分叉的方案。

## Architecture

OpenCrab 后续支持三种运行方式：

### 1. Web Development

- `npm run dev`
- 面向开发、调试、快速迭代
- 保留当前热更新体验

### 2. Web Production

- `npm run build && npm run start`
- 面向本地生产态验证和服务端部署
- 继续保留现有可选入口

### 3. Desktop App

- `Electron main process`
- 启动本地 OpenCrab standalone server
- `BrowserWindow` 加载本地地址
- 业务 UI 和 API 仍然是同一套实现

## Core Principles

### 1. One Product Core

桌面版和 Web 版共享同一个产品内核：

- 同一个前端路由层
- 同一个 API 层
- 同一个本地 runtime 语义
- 同一个 Team / Channels / Tasks / Skills / Workspace / Sandbox 模型

### 2. Shell Separation

平台差异只允许出现在“壳层”：

- Electron main/preload
- 进程启动
- 原生目录选择器
- 文件管理器打开
- 打包、签名、公证

业务逻辑不下沉到桌面壳中。

### 3. No Capability Regression

桌面版验收标准不是“能打开 UI”，而是以下能力全部保持一致：

- 对话与流式回复
- 工作区与权限模式
- 浏览器工具
- 文件上传与文本抽取
- 技能
- 智能体
- Team Mode
- 渠道
- 定时任务

### 4. Single Runtime Safety

由于 Web 版和桌面版将来可能同时存在，必须避免同一份本地状态被多个进程并发写坏。

因此运行时锁和单实例策略属于必做项，而不是后续优化。

## Phase Plan

## Phase 1: Runtime Environment and Resource Paths

### Target

把当前代码里依赖 `process.cwd()`、固定端口、硬编码脚本路径的地方统一收口，形成“运行环境解析层”。

### Add

- `lib/runtime/app-mode.ts`
- `lib/runtime/resource-paths.ts`
- `lib/runtime/app-origin.ts`

### Update

- `lib/codex/sdk.ts`
- `lib/codex/browser-session.ts`
- `lib/agents/system-agent-catalog.ts`
- `lib/skills/skill-store.ts`
- `lib/resources/upload-store.ts`
- `lib/resources/attachment-access-policy.ts`

### Expected Result

- 开发态、Web 生产态、Electron 打包态都能正确找到：
  - `scripts/`
  - `skills/`
  - 系统智能体素材
  - `public/`
  - standalone 运行时资源
- 代码不再依赖“当前启动目录刚好是仓库根目录”

## Phase 2: Codex Runtime Resolution

### Target

统一 `codex` 可执行入口，桌面版最终不要求用户预装全局 `codex`。

### Add

- `lib/codex/codex-executable.ts`

### Update

- `lib/codex/sdk.ts`
- `lib/chatgpt/connection.ts`

### Expected Result

- 所有 `login`、`logout`、`status`、thread 启动都走同一个 resolver
- 桌面版优先使用包内 Codex runtime
- Web 开发态和源码模式仍支持当前依赖解析逻辑

### Notes

当前 `lib/chatgpt/connection.ts` 仍有直接调用裸 `codex` 的路径，这一步必须先清掉，否则桌面版无法真正做到“无需预装 CLI”。

## Phase 3: Next Standalone Packaging

### Target

把桌面版的服务端启动方式固定为 `Next standalone`，而不是临时拼接 `next start`。

### Update

- `next.config.ts`
- `package.json`

### Add

- `scripts/desktop/prepare-standalone.mjs`
- `scripts/desktop/run-standalone.mjs`

### Expected Result

新增一组桌面相关脚本，例如：

- `desktop:dev`
- `desktop:prodlike`
- `desktop:build`
- `desktop:dist:mac`

并确保 standalone 输出包含桌面运行必需资源。

## Phase 4: Electron Shell

### Target

新增桌面壳，但不复制业务逻辑。

### Add

- `desktop/main.ts`
- `desktop/preload.ts`
- `desktop/runtime-manager.ts`

### Expected Result

- Electron main process 负责选择端口、启动 OpenCrab 本地服务、打开窗口
- BrowserWindow 加载的是同一套 OpenCrab 页面
- Web 版和桌面版共享业务功能

## Phase 5: Runtime Lock and Single Instance

### Target

防止桌面版和 Web 版同时运行时写坏本地状态，或重复启动任务执行器、渠道守护、浏览器 bridge。

### Add

- `lib/runtime/runtime-lock.ts`
- 必要时新增 `scripts/desktop/server-entry.mjs`

### Update

- `lib/server/json-file-store.ts`
- `lib/resources/runtime-paths.ts`

### Expected Result

- Electron 进程有单实例锁
- OpenCrab runtime 目录也有锁
- 第二个实例启动时能识别已有运行中的 runtime，而不是默默并发写入

### Notes

当前 JSON store 已具备原子写入，但仍不是多进程安全实现，因此这一阶段属于必做项。

## Phase 6: Native Bridge Replacement

### Target

让桌面版优先使用原生桌面能力，同时保持 Web 版功能不退化。

### Add

- `desktop/ipc/local-files.ts`

### Update

- `lib/server/native-directory-picker.ts`
- `app/api/local-files/pick-directory/route.ts`
- `app/api/local-files/open/route.ts`

### Expected Result

- 桌面版使用 Electron 原生目录选择器
- 桌面版使用 Electron 打开文件夹 / reveal in finder
- Web 版继续使用现有 `osascript` / `open` / `zenity` / `explorer.exe` 路径

## Phase 7: Desktop Build Pipeline

### Target

补齐桌面打包链路，确保桌面版不是“能打开 UI 但跑不动能力”的空壳。

### Add

- `electron-builder.yml` 或等价配置
- `scripts/desktop/copy-runtime-assets.mjs`

### Must Bundle

- Codex runtime
- `scripts/browser_mcp_stdio_proxy.mjs`
- `scripts/pdf_extract.mjs`
- `skills/`
- `agents-src/system/`
- `agents-src/system-groups.json`
- `public/`
- `.next/static/`
- standalone server 输出

### Expected Result

- 桌面产物具备独立可运行能力
- 浏览器工具、技能、系统智能体、PDF 抽取都能在桌面版工作

## Phase 8: Desktop Diagnostics

### Target

先补最小可运维能力，再考虑自动更新、托盘、通知等增强项。

### Update

- `app/(app)/settings/page.tsx`
- 相关 provider / store

### Expected Result

设置页最少能展示：

- 当前运行模式
- runtime home
- 当前本地服务端口
- Codex 状态
- 浏览器连接状态
- 默认工作区与权限

## Milestones

### M1

桌面开发态可启动，并完成：

- 普通对话
- 工作区
- 权限模式

### M2

桌面生产态可启动，并完成：

- 浏览器工具
- 文件上传
- PDF 抽取

### M3

桌面版无需用户预装 `codex`，能够完成：

- ChatGPT 连接
- 模型状态读取
- 正常对话回复

### M4

桌面版与 Web 版在以下能力上行为一致：

- Team Mode
- 定时任务
- Telegram
- 飞书

### M5

再进入分发阶段：

- DMG 打包
- 签名
- notarization

## Acceptance Criteria

只有当以下条件全部满足，桌面版才算达标：

- 桌面版和 Web 版使用同一套业务实现
- 桌面版不要求用户接触仓库代码
- 桌面版不要求用户手动运行 `npm`
- 桌面版关键能力不缺失
- Web 启动方式仍然保留
- 本地 runtime 不会因多实例并发而损坏

## Risks

### 1. Path Assumptions

当前若继续保留 `process.cwd()` 依赖，打包后最容易出现“页面能开、能力失效”。

### 2. Codex Binary Packaging

若 Codex runtime 没有正确进包或解包，桌面版会卡在登录与执行入口。

### 3. Multi-Process State Corruption

如果没有 runtime lock，Web 版和桌面版并发运行时会损坏本地 JSON store，或重复拉起后台守护。

### 4. False Success During Packaging

桌面 UI 能打开，不代表浏览器工具、PDF、技能、系统智能体、渠道与任务已经真正可用。

## Not Included in First Desktop Milestone

以下能力不作为桌面版第一阶段必做项：

- 自动更新
- 菜单栏 / 托盘增强
- 系统通知优化
- Mac App Store 上架
- Windows / Linux 正式发行

这些都可以放到桌面主能力闭环之后。

## External References

- Next.js `standalone` 输出文档
- Next.js custom server 限制说明
- Electron 单实例锁文档
- Electron 原生目录选择器文档

## Recommended Next Step

实现顺序固定为：

1. 资源路径统一层
2. Codex 可执行入口统一
3. Electron 启动壳
4. 桌面打包链路

在这四步完成之前，不建议先做 DMG、自动更新或签名公证工作。
