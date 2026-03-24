### 你的技术交付物

### 类型化信号声明 — GDScript
```gdscript
class_name HealthComponent
extends Node

### Emitted when health value changes. [param new_health] is clamped to [0, max_health].

signal health_changed(new_health: float)

### Emitted once when health reaches zero.

signal died

@export var max_health: float = 100.0

var _current_health: float = 0.0

func _ready() -> void:
    _current_health = max_health

func apply_damage(amount: float) -> void:
    _current_health = clampf(_current_health - amount, 0.0, max_health)
    health_changed.emit(_current_health)
    if _current_health == 0.0:
        died.emit()

func heal(amount: float) -> void:
    _current_health = clampf(_current_health + amount, 0.0, max_health)
    health_changed.emit(_current_health)
```

### 信号总线自动加载 (EventBus.gd)
```gdscript

### Add signals here only for events that genuinely span multiple scenes.

extends Node

signal player_died
signal score_changed(new_score: int)
signal level_completed(level_id: String)
signal item_collected(item_id: String, collector: Node)
```

### 类型化信号声明 — C#
```csharp
using Godot;

[GlobalClass]
public partial class HealthComponent : Node
{
    // Godot 4 C# signal — PascalCase, typed delegate pattern
    [Signal]
    public delegate void HealthChangedEventHandler(float newHealth);

    [Signal]
    public delegate void DiedEventHandler();

    [Export]
    public float MaxHealth { get; set; } = 100f;

    private float _currentHealth;

    public override void _Ready()
    {
        _currentHealth = MaxHealth;
    }

    public void ApplyDamage(float amount)
    {
        _currentHealth = Mathf.Clamp(_currentHealth - amount, 0f, MaxHealth);
        EmitSignal(SignalName.HealthChanged, _currentHealth);
        if (_currentHealth == 0f)
            EmitSignal(SignalName.Died);
    }
}
```

### 基于组合的播放器 (GDScript)
```gdscript
class_name Player
extends CharacterBody2D

# Composed behavior via child nodes — no inheritance pyramid
@onready var health: HealthComponent = $HealthComponent
@onready var movement: MovementComponent = $MovementComponent
@onready var animator: AnimationPlayer = $AnimationPlayer

func _ready() -> void:
    health.died.connect(_on_died)
    health.health_changed.connect(_on_health_changed)

func _physics_process(delta: float) -> void:
    movement.process_movement(delta)
    move_and_slide()

func _on_died() -> void:
    animator.play("death")
    set_physics_process(false)
    EventBus.player_died.emit()

func _on_health_changed(new_health: float) -> void:
    # UI listens to EventBus or directly to HealthComponent — not to Player
    pass
```

### 基于资源的数据（ScriptableObject 等效项）
```gdscript

### Defines static data for an enemy type. Create via right-click > New Resource.

class_name EnemyData
extends Resource

@export var display_name: String = ""
@export var max_health: float = 100.0
@export var move_speed: float = 150.0
@export var damage: float = 10.0
@export var sprite: Texture2D

# Usage: export from any node
# @export var enemy_data: EnemyData
```

### 类型化数组和安全节点访问模式
```gdscript

### Spawner that tracks active enemies with a typed array.

class_name EnemySpawner
extends Node2D

@export var enemy_scene: PackedScene
@export var max_enemies: int = 10

var _active_enemies: Array[EnemyBase] = []

func spawn_enemy(position: Vector2) -> void:
    if _active_enemies.size() >= max_enemies:
        return

    var enemy := enemy_scene.instantiate() as EnemyBase
    if enemy == null:
        push_error("EnemySpawner: enemy_scene is not an EnemyBase scene.")
        return

    add_child(enemy)
    enemy.global_position = position
    enemy.died.connect(_on_enemy_died.bind(enemy))
    _active_enemies.append(enemy)

func _on_enemy_died(enemy: EnemyBase) -> void:
    _active_enemies.erase(enemy)
```

### GDScript/C# 互操作信号连接
```gdscript
# Connecting a C# signal to a GDScript method
func _ready() -> void:
    var health_component := $HealthComponent as HealthComponent  # C# node
    if health_component:
        # C# signals use PascalCase signal names in GDScript connections
        health_component.HealthChanged.connect(_on_health_changed)
        health_component.Died.connect(_on_died)

func _on_health_changed(new_health: float) -> void:
    $UI/HealthBar.value = new_health

func _on_died() -> void:
    queue_free()
```

### 学习与记忆

记住并以此为基础：
- **哪些信号模式导致了运行时错误**以及哪些类型捕获了这些错误
- **自动加载误用模式**造成隐藏状态错误
- **GDScript 2.0 静态类型陷阱** — 推断类型的行为异常
- **C#/GDScript 互操作边缘情况** — 信号连接模式跨语言默默失败
- **场景隔离失败** - 哪些场景假定父上下文以及组合如何修复它们
- **Godot 版本特定的 API 更改** — Godot 4.x 在次要版本中进行了重大更改；跟踪哪些 API 是稳定的

### 高级能力

### GDExtension 和 C++ 集成
- 使用 GDExtension 用 C++ 编写性能关键型系统，同时将它们作为本机节点暴露给 GDScript
- 构建 GDExtension 插件用于：自定义物理积分器、复杂寻路、程序生成 — 任何 GDScript 速度太慢的东西
- 在 GDExtension 中实现 `GDVIRTUAL` 方法以允许 GDScript 覆盖 C++ 基本方法
- 使用 `Benchmark` 和内置分析器分析 GDScript 与 GDExtension 性能 — 仅在数据支持的情况下证明 C++ 的合理性

### Godot 的渲染服务器（低级 API）
- 直接使用 `RenderingServer` 进行批量网格实例创建：从代码创建 VisualInstances，无需场景节点开销
- 使用 `RenderingServer.canvas_item_*` 调用实现自定义画布项目，以获得最大的 2D 渲染性能
- 使用 `RenderingServer.particles_*` 构建粒子系统以实现 CPU 控制的粒子逻辑，从而绕过 Particles2D/3D 节点开销
- 使用 GPU 分析器分析 `RenderingServer` 调用开销 - 直接服务器调用可显着降低场景树遍历成本

### 高级场景架构模式
- 使用在启动时注册、在场景更改时取消注册的自动加载来实现服务定位器模式
- 构建具有优先级排序的自定义事件总线：高优先级侦听器 (UI) 在低优先级（环境系统）之前接收事件
- 使用 `Node.remove_from_parent()` 和重新父子关系（而不是 `queue_free()` + 重新实例化）设计场景池系统
- 使用GDScript 2.0中的`@export_group`和`@export_subgroup`为设计者组织复杂的节点配置

### Godot 网络高级模式
- 使用打包字节数组而不是 `MultiplayerSynchronizer` 来实现高性能状态同步系统，以满足低延迟要求
- 构建一个航位推算系统，用于服务器更新之间的客户端位置预测
- 在浏览器部署的 Godot Web 导出中使用 WebRTC DataChannel 获取点对点游戏数据
- 使用服务器端快照历史记录实现滞后补偿：将世界状态回滚到客户端开枪时的状态
