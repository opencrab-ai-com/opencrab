# Startup Behavior

本文说明 OpenCrab 在每次服务进程重启后，会自动做哪些事情，以及哪些行为会尊重用户之前的手动操作。

## 自动执行的启动动作

当前启动入口主要是：

- `app/api/bootstrap/route.ts`
- `app/(app)/layout.tsx`

当 OpenCrab 新进程起来、且首次页面访问触发启动流程后，系统会自动做这些事：

1. 同步渠道配置到运行时状态
   - 从 `state/channel-secrets.json` 和环境变量读取 Telegram / 飞书配置
   - 把配置摘要同步到 `state/channels.json`

2. 自动恢复已启用的渠道连接
   - Telegram：
     - 如果已经保存 `Bot Token`
     - 且没有被用户手动断开
     - 启动后会自动重新绑定 webhook
   - 飞书：
     - 如果已经保存 `App ID / App Secret`
     - 且没有被用户手动断开
     - 启动后会自动重新拉起长连接 socket

3. 启动渠道 watchdog
   - OpenCrab 会定时巡检渠道状态
   - 如果连接中途掉了，会自动尝试修复

4. 启动公网隧道 watchdog
   - 当 Telegram 需要临时公网地址、且没有显式配置 `OPENCRAB_PUBLIC_BASE_URL` 时
   - OpenCrab 会自动维护本地隧道
   - 隧道失效后会自动重建，并重新绑定 Telegram webhook

5. 预热浏览器连接
   - OpenCrab 会自动预热 Chrome DevTools MCP
   - 如果当前浏览器模式需要首次授权，Chrome 可能会在启动阶段弹出远程调试授权
   - 预热时还会做一次轻量探测，尽量把授权提前到真正对话前

6. 检查定时任务
   - OpenCrab 会启动任务执行器
   - 并检查当前是否有已经到期的任务需要运行

7. 修正渠道会话元数据
   - 已绑定的 Telegram / 飞书对话会自动回写来源、渠道名、远端会话标识
   - 保证左侧对话列表和详情页展示一致

8. 准备内置技能目录
   - OpenCrab 会确保内置技能目录已就绪
   - 技能页首次打开时不需要再临时准备一整套基础技能

## 触发方式补充

当前启动相关动作主要由这两处触发：

- `app/api/bootstrap/route.ts`
- `app/(app)/layout.tsx`

说明：

- `/api/bootstrap` 返回快照时，会把渠道同步、浏览器预热、任务执行器和会话元数据修正放到后台处理
- `app/(app)/layout.tsx` 会补一次浏览器连接预热
- 这些动作现在都带有冷却控制，不会在每次前端轮询时都强制完整执行一遍

## 会尊重用户手动决定的行为

下面这些状态不会在重启后被偷偷改回去：

- Telegram 手动点了“断开连接”
  - 会持久化为 `enabled: false`
  - 重启后不会自动恢复连接

- 飞书手动点了“断开连接”
  - 也会持久化为 `enabled: false`
  - 重启后不会自动恢复长连接

如果你希望重新自动连接，只需要回到对应渠道页面点一次重新连接，或者重新保存配置。

## 需要用户仍然参与的一步

有一类行为仍然可能需要用户点一下：

- `current-browser` 模式下的 Chrome DevTools 首次远程调试授权

这一步是 Chrome 自己的安全确认，不是 OpenCrab 可以绕过的。  
OpenCrab 能做的是尽量在启动阶段提前触发，而不是等到你真正发起浏览器操作时才弹出来。

## 当前边界

以下几件事仍然有边界，需要了解：

- 定时任务依赖 OpenCrab 服务进程在运行
  - 现在不是系统级常驻后台任务

- Telegram 自动连接依赖可用公网地址
  - 如果没有显式配置 `OPENCRAB_PUBLIC_BASE_URL`
  - OpenCrab 会尝试自动维护本地隧道

- 渠道的“已连接”是运行时状态
  - 不是只看上次退出前写下来的旧状态
  - 新进程第一次启动时会做真实重连

## 排查顺序

如果你怀疑“重启后没有自动恢复”，建议按这个顺序看：

1. 打开 `/api/bootstrap`
2. 打开 `/api/channels/telegram` 或 `/api/channels/feishu`
3. 查看 `$OPENCRAB_HOME/state/channel-secrets.json`
   - 确认对应渠道不是 `enabled: false`
4. 查看 `$OPENCRAB_HOME/state/channels.json`
   - 确认 `updatedAt`、`lastVerifiedAt`、`lastSocketConnectedAt` 是否在本次启动后刷新
