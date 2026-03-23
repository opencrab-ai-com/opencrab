# 运维与排障

本文面向当前单机部署 / 本地运行形态，说明 OpenCrab 的启动入口、检查顺序、日志位置与常见问题定位方法。

## 1. 启动入口

当前常用启动方式：

```bash
npm run dev
```

如果你需要临时回退旧的开发打包链路：

```bash
npm run dev:webpack
```

默认地址：

- `http://127.0.0.1:3000`

## 2. 首次检查顺序

如果你刚启动项目，建议按这个顺序确认：

1. 首页是否可打开
2. `/settings` 是否能看到连接状态
3. `/api/health` 是否返回 `{ ok: true }`
4. `/api/bootstrap` 是否能返回应用快照

说明：

- `/api/health` 只代表服务端基本可响应
- `/api/bootstrap` 还会触发启动时的后台准备动作

## 3. 启动后后台会做什么

当前启动后会自动做这些事：

- 渠道 watchdog
- 渠道状态同步与重连修复
- 浏览器连接预热
- 定时任务执行器启动
- 渠道绑定会话元数据修正
- 内置技能目录准备

更完整说明见：

- [Startup Behavior](./startup-behavior.md)

## 4. 常见排查入口

### 4.1 ChatGPT / 执行环境

先看：

- `/settings`
- `/api/codex/status`

再看本机终端：

```bash
codex login status
```

### 4.2 浏览器工具

如果浏览器工具不可用，优先检查：

- 设置页当前浏览器模式
- Chrome 首次远程调试授权是否已放行
- `/api/codex/browser-session`

### 4.3 Telegram / 飞书渠道

优先检查：

- `/channels/telegram`
- `/channels/feishu`
- `$OPENCRAB_HOME/state/channel-secrets.json`
- `$OPENCRAB_HOME/state/channels.json`

如果是 Telegram，还要确认：

- 是否有可用公网地址
- 是否配置了 `OPENCRAB_PUBLIC_BASE_URL`
- 隧道日志是否正常刷新

### 4.4 定时任务

如果任务没有按时触发，优先确认：

- OpenCrab 服务进程是否仍在运行
- `/tasks` 页面状态是否正常
- `$OPENCRAB_HOME/state/tasks.json` 是否有新的运行记录

## 5. 日志与运行时目录

当前最重要的本地目录：

- `$OPENCRAB_HOME/state/`
- `$OPENCRAB_HOME/uploads/`
- `$OPENCRAB_HOME/logs/tunnels/`
- `$OPENCRAB_HOME/browser/chrome-debug-profile/`
- 仓库下 `.playwright-cli/`

这几个目录都属于运行产物，不应该提交到 Git。

补充：

- 如果某个 `state/*.json` 或 `uploads/index.json` 被异常写坏，当前共享 store 会先把旧文件备份为 `*.corrupt.<timestamp>.json`，然后再自动恢复默认结构
- API 错误响应会附带 `requestId`，排障时建议连同请求编号一起记录

## 6. 清理命令

如果你需要清理本地运行数据：

```bash
npm run clean:runtime
```

清理范围当前包含：

- `OPENCRAB_HOME`
- 旧版 `~/Library/Application Support/OpenCrab`
- 仓库下 `.playwright-cli`
- 仓库下 `output`
- 仓库下 `tmp`

执行前建议先备份：

- `$OPENCRAB_HOME/`

## 7. 当前运维边界

当前版本仍有这些边界：

- 没有正式数据库，持久化仍以本地 JSON store 为主
- 没有多人鉴权与云同步
- 定时任务依赖 OpenCrab 服务进程存活
- 飞书当前仍以文本消息闭环为主
