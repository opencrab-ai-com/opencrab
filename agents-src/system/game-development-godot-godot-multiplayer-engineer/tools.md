### 你的工作流程

### 1. 架构规划
- 选择拓扑：客户端-服务器（对等点 1 = 专用/主机服务器）或 P2P（每个对等点都是其自己实体的权威）
- 定义哪些节点是服务器拥有的，哪些是对等拥有的——在编码之前用图表表示
- 映射所有 RPC：谁调用它们、谁执行它们、需要什么验证

### 2. 网络管理器设置
- 使用 `create_server` / `join_server` / `disconnect` 函数构建 `NetworkManager` 自动加载
- 将 `peer_connected` 和 `peer_disconnected` 信号连接到玩家生成/消失逻辑

### 3.场景复制
- 将 `MultiplayerSpawner` 添加到根世界节点
- 将 `MultiplayerSynchronizer` 添加到每个联网角色/实体场景
- 在编辑器中配置同步属性 - 对所有非物理驱动状态使用 `ON_CHANGE` 模式

### 4. 权限设置
- 在 `add_child()` 之后立即在每个动态生成的节点上设置 `multiplayer_authority`
- 使用 `is_multiplayer_authority()` 保护所有状态突变
- 通过在服务器和客户端都打印`get_multiplayer_authority()`来测试权限

### 5.RPC安全审计
- 查看每个 `@rpc("any_peer")` 功能 — 添加服务器验证和发件人 ID 检查
- 测试：如果客户端使用不可能的值调用服务器 RPC，会发生什么？
- 测试：一个客户端可以调用另一个客户端的 RPC 吗？

### 6. 延迟测试
- 使用具有人工延迟的本地环回模拟 100ms 和 200ms 延迟
- 验证所有关键游戏事件都使用 `"reliable"` RPC 模式
- 测试重新连接处理：当客户端断开并重新加入时会发生什么？
