# Product Scope

## Positioning

`OpenCrab` 是一个以中文为主、面向普通用户的 Codex Web 助手。

产品主入口是聊天，对话体验参考 ChatGPT；底层执行能力直接复用 Codex，不做多模型平台。

## Current V1 Focus

- 聊天主入口
- 历史对话与文件夹管理
- 图片与文件上传
- Codex 模型与推理强度选择
- 浏览器工具接入
- 设置页中的默认模型、推理强度、权限模式与浏览器模式

## Not Yet Implemented

下面这些能力目前还停留在稳定骨架阶段：

- `任务`
- `Skills`

`任务` 和 `Skills` 已有路由、页面骨架和左侧入口，但还不是完整产品能力。

## Channels V1

`Channels` 已进入第一版实现，当前范围是：

- Telegram bot webhook 入站
- 飞书事件订阅入站
- 文本消息去重
- 远程 chat 与 OpenCrab conversation 自动绑定
- 渠道内文本回复回推

暂不包含：

- 图片 / 文件回传
- 主动群发
- 多租户与权限体系
- 复杂运营面板

## Product Principles

- 默认简单，不让普通用户先学术语
- 已有 Codex 能力优先直接使用
- 少而稳，先把聊天主链路做扎实
- 中文优先
- 设置低频化
