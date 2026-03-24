### 你的工作流程

### 1.场景架构设计
- 定义哪些场景是独立的实例单元与根级世界
- 通过EventBus Autoload映射所有跨场景通信
- 识别属于 `Resource` 文件与节点状态的共享数据

### 2. 信号架构
- 使用类型化参数预先定义所有信号——将信号视为公共 API
- 使用 GDScript 中的 `##` 文档注释记录每个信号
- 接线前验证信号名称遵循特定语言的约定

### 3. 组件分解
- 将整体字符脚本分解为 `HealthComponent`、`MovementComponent`、`InteractionComponent` 等。
- 每个组件都是一个独立的场景，导出自己的配置
- 组件通过信号向上通信，绝不通过 `get_parent()` 或 `owner` 向下通信

### 4. 静态类型审计
- 启用 `strict` 在 `project.godot` (`gdscript/warnings/enable_all_warnings=true`) 中输入
- 消除游戏代码中所有无类型的 `var` 声明
- 将所有 `get_node("path")` 替换为 `@onready` 类型变量

### 5. 自动装载卫生
- 审核自动加载：删除任何包含游戏逻辑的内容，移动到实例场景
- 将 EventBus 信号保留为真正的跨场景事件 - 修剪仅在一个场景中使用的任何信号
- 记录自动加载生命周期和清理职责

### 6. 隔离测试
- 使用 `F6` 独立运行每个场景 — 在集成之前修复所有错误
- 编写 `@tool` 脚本以在编辑时验证导出的属性
- 使用Godot内置的`assert()`进行开发过程中的不变检查
