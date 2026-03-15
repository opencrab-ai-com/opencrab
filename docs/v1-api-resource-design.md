# opencrab V1 API 资源设计草案

## 1. 目标

这份文档用于定义 `opencrab` V1 的 API 资源边界和接口分层。

当前重点回答：
- 前端需要从哪些资源取数
- 每类资源承担什么职责
- 列表接口和详情接口如何拆分
- 哪些动作应该建成独立操作接口

当前不展开：
- 鉴权机制
- HTTP 细节
- WebSocket 或 SSE 具体协议
- 错误码规范

## 2. 设计原则

- API 资源边界优先贴合产品对象，而不是页面临时需求
- 列表接口和详情接口分开，避免一次返回过重数据
- 写操作优先围绕明确动作设计，而不是过度依赖大而全的更新接口
- 流式生成、远程回流、任务执行记录等异步场景要单独考虑
- 前端可以消费 view model，但服务端资源层仍应以稳定对象为主

## 3. 资源总览

V1 建议先收敛为这些一级资源：
- `me`
- `folders`
- `conversations`
- `messages`
- `channels`
- `tasks`
- `task-runs`
- `skills`
- `settings`
- `uploads`

其中：
- `messages` 可以作为 `conversations` 的子资源为主
- `task-runs` 可以作为 `tasks` 的子资源为主
- `uploads` 用于承接图片和文件上传

## 4. 全局壳层资源

### 4.1 `GET /me`

用于获取当前用户基础信息。

建议返回：
- `id`
- `display_name`
- `locale`
- `timezone`

### 4.2 `GET /app-shell`

可选的聚合资源，用于首屏快速加载应用壳层。

建议返回：
- `current_user`
- `current_nav`
- `settings_entry_summary`
- `sidebar_primary_actions`
- `sidebar_primary_nav_items`

V1 说明：
- 如果前端想减少首屏拼装，可以提供这个聚合接口
- 但它不应替代各业务资源的详情接口

## 5. 文件夹资源

### 5.1 `GET /folders`

获取当前用户的文件夹列表。

建议返回轻量字段：
- `id`
- `name`
- `conversation_count`
- `is_default`
- `sort_order`

### 5.2 `POST /folders`

创建文件夹。

建议输入：
- `name`

### 5.3 `PATCH /folders/:folderId`

更新文件夹。

V1 建议支持：
- 重命名
- 排序调整

### 5.4 `DELETE /folders/:folderId`

删除文件夹。

V1 说明：
- 需要同时定义该文件夹下对话如何处理
- 建议通过额外参数或约定移动到默认视图，而不是直接删除对话

## 6. 对话资源

### 6.1 `GET /conversations`

获取对话列表。

建议支持过滤：
- `folder_id`
- `source`
- `status`
- `cursor`
- `limit`

建议返回轻量列表项：
- `id`
- `title`
- `preview_text`
- `last_message_at`
- `status`
- `folder_id`

### 6.2 `POST /conversations`

创建新对话。

建议输入：
- `folder_id`
- `title`

V1 说明：
- 如果用户直接在首页发送第一条消息，也可以由发送消息动作隐式创建对话

### 6.3 `GET /conversations/:conversationId`

获取单个对话详情。

建议返回：
- `id`
- `title`
- `status`
- `source`
- `folder_id`
- `last_message_at`
- `message_page`

其中 `message_page` 可以包含第一页消息列表。

### 6.4 `PATCH /conversations/:conversationId`

更新对话元信息。

V1 建议支持：
- 修改标题
- 移动文件夹
- 更新状态

### 6.5 `DELETE /conversations/:conversationId`

删除对话。

V1 可以先定义为软删除。

### 6.6 `GET /conversations/:conversationId/messages`

获取会话消息列表。

建议支持：
- `cursor`
- `limit`

### 6.7 `POST /conversations/:conversationId/messages`

发送一条消息到已有对话。

建议输入：
- `content`
- `attachments`
- `model`
- `reasoning_effort`

建议返回：
- 新建的用户消息
- 当前生成任务的基础状态
- 是否进入流式响应

### 6.8 `POST /conversations/send`

发送一条消息并在必要时隐式创建新对话。

建议输入：
- `conversation_id`
- `folder_id`
- `content`
- `attachments`
- `model`
- `reasoning_effort`

V1 说明：
- 这个接口更贴近首页输入框体验
- 当前端没有 `conversation_id` 时，可由服务端直接创建新对话并返回

## 7. 消息流与生成状态

对于聊天生成，V1 建议至少定义一类异步更新通道。

建议方向：
- `GET /conversations/:conversationId/stream`
- 或统一的事件流资源

建议覆盖事件：
- `message_created`
- `message_delta`
- `message_completed`
- `message_failed`
- `conversation_updated`

V1 说明：
- 这里不先写死 SSE 还是 WebSocket
- 但需要在接口设计上明确“流式返回”和“普通读写接口”是两层

## 8. 上传资源

### 8.1 `POST /uploads`

用于上传图片或文件。

建议返回：
- `upload_id`
- `file_name`
- `content_type`
- `file_size`
- `preview_url`

V1 说明：
- 前端输入框上传建议先走独立 `uploads` 资源
- 后续发送消息时通过 `attachments` 关联这些上传结果

## 9. Channels 资源

### 9.1 `GET /channels`

获取 Channel 列表。

建议返回：
- `id`
- `name`
- `type`
- `status`
- `last_active_at`

### 9.2 `POST /channels`

创建或发起一个 Channel 连接流程。

建议输入：
- `type`
- `name`

### 9.3 `GET /channels/:channelId`

获取单个 Channel 详情。

建议返回：
- 基础信息
- 连接状态
- 连接提示信息
- 最近消息摘要
- 相关对话摘要

### 9.4 `PATCH /channels/:channelId`

更新 Channel 基础信息或状态。

V1 建议支持：
- 重命名
- 断开
- 重新连接

### 9.5 `GET /channels/:channelId/messages`

获取某个 Channel 的最近消息或远程记录。

### 9.6 `POST /channels/:channelId/send`

从网页侧向某个 Channel 主动发送内容。

V1 说明：
- 如果第一版先不开放网页主动发往 Channel，这个接口可以后置
- 但建议先在资源层预留

## 10. 任务资源

### 10.1 `GET /tasks`

获取任务列表。

建议支持过滤：
- `status`
- `mode`
- `cursor`
- `limit`

建议返回轻量列表项：
- `id`
- `name`
- `mode`
- `status`
- `next_run_at`

### 10.2 `POST /tasks`

创建任务。

建议输入：
- `name`
- `description`
- `mode`
- `schedule_text`
- `target_conversation_id`
- `target_channel_id`

### 10.3 `GET /tasks/:taskId`

获取单个任务详情。

建议返回：
- 基础信息
- 调度信息
- 最近执行记录摘要
- 目标回流信息

### 10.4 `PATCH /tasks/:taskId`

更新任务。

V1 建议支持：
- 修改名称或描述
- 修改状态
- 修改调度文本
- 修改目标位置

### 10.5 `POST /tasks/:taskId/pause`

暂停任务。

### 10.6 `POST /tasks/:taskId/resume`

恢复任务。

### 10.7 `POST /tasks/:taskId/run-now`

立即执行一次任务。

V1 说明：
- 这类动作接口比通用 `PATCH` 更清晰，也更符合产品语义

## 11. 任务执行记录资源

### 11.1 `GET /tasks/:taskId/runs`

获取某个任务的执行记录列表。

### 11.2 `GET /task-runs/:taskRunId`

获取某次任务执行的详情。

建议返回：
- 执行状态
- 开始和结束时间
- 结果摘要
- 错误信息
- 关联的对话或消息

## 12. Skills 资源

### 12.1 `GET /skills`

获取 Skills 列表。

建议支持过滤：
- `status`
- `source`

### 12.2 `GET /skills/:skillId`

获取 Skill 详情。

建议返回：
- 基础信息
- 描述
- 状态
- 作用范围
- 使用说明

### 12.3 `POST /skills/:skillId/enable`

启用某个 Skill。

### 12.4 `POST /skills/:skillId/disable`

停用某个 Skill。

V1 说明：
- 启停动作建议独立，而不是全部塞进通用更新接口

## 13. 设置资源

### 13.1 `GET /settings`

获取当前用户设置。

建议返回：
- `permission_mode`
- `default_model`
- `default_reasoning_effort`
- `language`
- `connection_settings`
- `about_info`

### 13.2 `PATCH /settings`

更新设置。

V1 说明：
- 由于设置项较少，可先聚合成单一资源

## 14. 聚合接口建议

为了减少前端首屏拼装成本，V1 可以考虑少量聚合接口，但数量要克制。

建议仅在以下场景使用：
- 首页壳层加载
- 对话页首次进入
- 任务页首次进入

可选示例：
- `GET /pages/conversations/:conversationId?include=sidebar,composer`
- `GET /pages/tasks/:taskId?include=list,detail`

V1 原则：
- 聚合接口服务于页面首屏
- 基础资源仍然要完整存在
- 不把所有页面都设计成高度耦合的大接口

## 15. 前端最常见的接口组合

### 15.1 首页空态

建议组合：
- `GET /me`
- `GET /settings`
- `GET /folders`

### 15.2 打开某个对话

建议组合：
- `GET /folders`
- `GET /conversations?folder_id=...`
- `GET /conversations/:conversationId`
- `GET /conversations/:conversationId/messages`

### 15.3 首页发消息

建议组合：
- `POST /uploads`
- `POST /conversations/send`
- 流式事件通道

### 15.4 打开任务页

建议组合：
- `GET /tasks`
- `GET /tasks/:taskId`
- `GET /tasks/:taskId/runs`

### 15.5 打开 Channels 页

建议组合：
- `GET /channels`
- `GET /channels/:channelId`

## 16. V1 需要守住的接口约束

- 列表接口不返回完整消息历史
- `task` 和 `task_run` 分开建资源
- 上传走独立资源，不直接把二进制耦合进消息接口
- 首页发送消息允许隐式创建对话
- 流式生成和普通 CRUD 接口分层
- 资源命名尽量稳定，不跟页面文案强绑定

## 17. 后续可以继续细化的部分

在这份草案基础上，下一步最适合继续补的是：
- 请求与响应示例
- 错误处理和状态码约定
- 流式事件格式
- 鉴权与会话机制
