# opencrab V1 前端视角的数据视图模型

## 1. 目标

这份文档描述前端页面真正需要消费和维护的数据视图模型。

它关注的是：
- 页面需要什么数据
- 数据如何组织成可渲染结构
- 哪些是服务端数据，哪些是前端本地 UI 状态

它不展开：
- React 组件拆分
- 状态管理库选型
- API 路由细节
- 数据库存储细节

## 2. 基本原则

- 前端优先消费“可直接渲染”的视图模型，而不是原始实体拼装结果
- 页面级视图模型尽量围绕左侧栏、主区、输入框三部分组织
- 列表视图和详情视图分开，避免一个对象承担过多页面语义
- 服务端数据和本地 UI 状态分开建模
- V1 优先简单，可接受一定程度的数据冗余以换取页面实现清晰

## 3. 全局壳层模型

整个应用建议先围绕一个 `AppShellViewModel` 组织。

建议包含：
- `current_user`
- `current_nav`
- `sidebar`
- `main_panel`
- `composer`
- `settings_entry`

其中：
- `current_nav` 表示当前一级入口，例如 `conversations`、`channels`、`tasks`、`skills`
- `sidebar` 表示左侧栏当前展示内容
- `main_panel` 表示主区当前展示内容
- `composer` 主要服务对话页

## 4. 左侧栏视图模型

### 4.1 SidebarViewModel

建议包含：
- `primary_actions`
- `primary_nav_items`
- `section_title`
- `section_items`
- `footer_profile`

说明：
- `primary_actions` 对应 `新对话`
- `primary_nav_items` 对应 `对话`、`Channels`、`任务`、`Skills`
- `section_items` 会随着当前一级入口变化

### 4.2 NavItemViewModel

建议包含：
- `key`
- `label`
- `icon`
- `is_active`
- `badge`

### 4.3 SidebarSectionItemViewModel

用于统一承载左侧栏列表项。

建议包含：
- `id`
- `type`
- `title`
- `subtitle`
- `meta`
- `is_active`
- `is_clickable`

建议类型：
- `folder`
- `conversation`
- `channel`
- `task`
- `skill`
- `section_link`

V1 说明：
- 左侧栏不必直接暴露原始实体，可以统一先映射成 `SidebarSectionItemViewModel`
- 这样不同页面共用一套左侧渲染结构会更简单

## 5. 对话页视图模型

### 5.1 ConversationsPageViewModel

建议包含：
- `sidebar`
- `active_folder`
- `conversation_list`
- `active_conversation`
- `empty_state`
- `composer`

说明：
- 当没有选中会话时，主区显示 `empty_state`
- 当选中会话时，主区显示 `active_conversation`

### 5.2 FolderListItemViewModel

建议包含：
- `id`
- `name`
- `conversation_count`
- `is_default`
- `is_active`

### 5.3 ConversationListItemViewModel

建议包含：
- `id`
- `title`
- `preview_text`
- `last_message_at_label`
- `folder_id`
- `is_active`
- `status`

V1 说明：
- 左侧最近对话只需要“标题 + 时间”即可
- `last_message_at_label` 可以直接是“刚刚”“今天”“昨天”这种前端已格式化文案

### 5.4 ActiveConversationViewModel

建议包含：
- `id`
- `title`
- `status`
- `source`
- `messages`
- `typing_state`
- `pending_actions`

其中：
- `typing_state` 表示是否正在生成、流式输出
- `pending_actions` 表示需要用户确认的动作或授权

### 5.5 MessageViewModel

建议包含：
- `id`
- `role`
- `blocks`
- `status`
- `created_at_label`
- `source_label`
- `attachments`

其中 `blocks` 建议作为前端渲染单元，而不是直接依赖一段原始字符串。

### 5.6 MessageBlockViewModel

建议类型：
- `text`
- `image`
- `file`
- `status_note`

建议包含：
- `type`
- `text`
- `url`
- `file_name`
- `file_size_label`

### 5.7 ComposerViewModel

建议包含：
- `draft_text`
- `uploaded_items`
- `reasoning_effort`
- `selected_model`
- `can_send`
- `is_submitting`
- `is_disabled`

V1 说明：
- 模型和推理强度控制项属于输入框视图模型
- 首页状态下也复用同一个 `ComposerViewModel`

## 6. Channels 页视图模型

### 6.1 ChannelsPageViewModel

建议包含：
- `sidebar`
- `channel_list`
- `active_channel`
- `empty_state`

### 6.2 ChannelListItemViewModel

建议包含：
- `id`
- `name`
- `type`
- `status`
- `last_active_at_label`
- `is_active`

### 6.3 ActiveChannelViewModel

建议包含：
- `id`
- `name`
- `type`
- `status`
- `connection_hint`
- `recent_messages`
- `related_conversations`
- `available_actions`

V1 说明：
- `recent_messages` 用于展示远程对话痕迹
- `related_conversations` 用于帮助用户跳回网页中的对应会话

## 7. 任务页视图模型

### 7.1 TasksPageViewModel

建议包含：
- `sidebar`
- `filters`
- `task_list`
- `active_task`
- `empty_state`

### 7.2 TaskListItemViewModel

建议包含：
- `id`
- `name`
- `mode`
- `status`
- `next_run_at_label`
- `is_active`

### 7.3 ActiveTaskViewModel

建议包含：
- `id`
- `name`
- `description`
- `mode`
- `status`
- `schedule_text`
- `next_run_at_label`
- `last_run_at_label`
- `run_history`
- `available_actions`
- `target_summary`

其中：
- `run_history` 用于展示执行记录
- `target_summary` 用于说明结果会回流到哪里，例如某个会话或某个 Channel

### 7.4 TaskRunListItemViewModel

建议包含：
- `id`
- `status`
- `started_at_label`
- `finished_at_label`
- `result_summary`
- `linked_conversation_id`

## 8. Skills 页视图模型

### 8.1 SkillsPageViewModel

建议包含：
- `sidebar`
- `filters`
- `skill_list`
- `active_skill`
- `empty_state`

### 8.2 SkillListItemViewModel

建议包含：
- `id`
- `name`
- `status`
- `source`
- `is_active`

### 8.3 ActiveSkillViewModel

建议包含：
- `id`
- `name`
- `description`
- `status`
- `source`
- `scope`
- `usage_notes`
- `available_actions`

## 9. 设置页视图模型

### 9.1 SettingsPageViewModel

建议包含：
- `permission_mode`
- `default_model`
- `default_reasoning_effort`
- `language`
- `connection_settings`
- `about_info`

V1 说明：
- 设置页数据可以按聚合模型消费，不需要拆成很多独立页面模型
- 它本质上是低频系统配置页

## 10. 首页空态视图模型

首页空态建议单独建模，而不是混在会话详情里。

### 10.1 HomeEmptyStateViewModel

建议包含：
- `brand_title`
- `headline`
- `placeholder_text`
- `composer`

V1 说明：
- 首页应保持极简
- 不放 dashboard 卡片
- 不放额外快捷入口

## 11. 本地 UI 状态模型

除了服务端返回的数据，前端还需要一组本地 UI 状态。

建议单独维护：
- `is_sidebar_collapsed`
- `active_modal`
- `active_dropdown`
- `selected_upload_items`
- `is_dragging_file`
- `toast_queue`
- `optimistic_updates`

V1 说明：
- 这些状态不应该混进服务端实体模型
- 特别是输入框草稿、上传过程、弹层状态，都更适合作为本地状态

## 12. 列表与详情的取数边界

为了让前端更稳，建议一开始就区分“列表数据”和“详情数据”：

- 左侧栏优先使用轻量列表项模型
- 主区详情页再请求更完整的详情模型
- 不要求列表接口一次返回完整消息历史
- `conversation_list` 和 `active_conversation` 可以分开取
- `task_list` 和 `active_task` 可以分开取
- `skill_list` 和 `active_skill` 可以分开取

这样做的好处：
- 页面首屏更轻
- 结构更清晰
- 更适合未来分页和缓存

## 13. 推荐的前端组装方式

建议前端按两层组装数据：

第一层：实体层
- 对应后端返回的基础对象，例如 `conversation`、`message`、`task`

第二层：视图层
- 对应页面消费的 `ConversationListItemViewModel`、`ActiveTaskViewModel` 等

V1 说明：
- 不建议直接在组件里临时拼所有字段
- 更适合在页面容器或 view model mapper 中统一转换

## 14. 后续可以继续细化的部分

在这份草案基础上，下一步最适合继续补的是：
- API 资源设计草案
- 前端状态管理边界
- 页面级加载与缓存策略
- 初版路由结构
