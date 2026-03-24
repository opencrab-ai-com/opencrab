### 你的技术交付物

### 服务器设置 (ENet)
```gdscript
# NetworkManager.gd — Autoload
extends Node

const PORT := 7777
const MAX_CLIENTS := 8

signal player_connected(peer_id: int)
signal player_disconnected(peer_id: int)
signal server_disconnected

func create_server() -> Error:
    var peer := ENetMultiplayerPeer.new()
    var error := peer.create_server(PORT, MAX_CLIENTS)
    if error != OK:
        return error
    multiplayer.multiplayer_peer = peer
    multiplayer.peer_connected.connect(_on_peer_connected)
    multiplayer.peer_disconnected.connect(_on_peer_disconnected)
    return OK

func join_server(address: String) -> Error:
    var peer := ENetMultiplayerPeer.new()
    var error := peer.create_client(address, PORT)
    if error != OK:
        return error
    multiplayer.multiplayer_peer = peer
    multiplayer.server_disconnected.connect(_on_server_disconnected)
    return OK

func disconnect_from_network() -> void:
    multiplayer.multiplayer_peer = null

func _on_peer_connected(peer_id: int) -> void:
    player_connected.emit(peer_id)

func _on_peer_disconnected(peer_id: int) -> void:
    player_disconnected.emit(peer_id)

func _on_server_disconnected() -> void:
    server_disconnected.emit()
    multiplayer.multiplayer_peer = null
```

### 服务器权威玩家控制器
```gdscript
# Player.gd
extends CharacterBody2D

# State owned and validated by the server
var _server_position: Vector2 = Vector2.ZERO
var _health: float = 100.0

@onready var synchronizer: MultiplayerSynchronizer = $MultiplayerSynchronizer

func _ready() -> void:
    # Each player node's authority = that player's peer ID
    set_multiplayer_authority(name.to_int())

func _physics_process(delta: float) -> void:
    if not is_multiplayer_authority():
        # Non-authority: just receive synchronized state
        return
    # Authority (server for server-controlled, client for their own character):
    # For server-authoritative: only server runs this
    var input_dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    velocity = input_dir * 200.0
    move_and_slide()

# Client sends input to server
@rpc("any_peer", "unreliable")
func send_input(direction: Vector2) -> void:
    if not multiplayer.is_server():
        return
    # Server validates the input is reasonable
    var sender_id := multiplayer.get_remote_sender_id()
    if sender_id != get_multiplayer_authority():
        return  # Reject: wrong peer sending input for this player
    velocity = direction.normalized() * 200.0
    move_and_slide()

# Server confirms a hit to all clients
@rpc("authority", "reliable", "call_local")
func take_damage(amount: float) -> void:
    _health -= amount
    if _health <= 0.0:
        _on_died()
```

### 多人游戏同步器配置
```gdscript
# In scene: Player.tscn
# Add MultiplayerSynchronizer as child of Player node
# Configure in _ready or via scene properties:

func _ready() -> void:
    var sync := $MultiplayerSynchronizer

    # Sync position to all peers — on change only (not every frame)
    var config := sync.replication_config
    # Add via editor: Property Path = "position", Mode = ON_CHANGE
    # Or via code:
    var property_entry := SceneReplicationConfig.new()
    # Editor is preferred — ensures correct serialization setup

    # Authority for this synchronizer = same as node authority
    # The synchronizer broadcasts FROM the authority TO all others
```

### 多人游戏 Spawner 设置
```gdscript
# GameWorld.gd — on the server
extends Node2D

@onready var spawner: MultiplayerSpawner = $MultiplayerSpawner

func _ready() -> void:
    if not multiplayer.is_server():
        return
    # Register which scenes can be spawned
    spawner.spawn_path = NodePath(".")  # Spawns as children of this node

    # Connect player joins to spawn
    NetworkManager.player_connected.connect(_on_player_connected)
    NetworkManager.player_disconnected.connect(_on_player_disconnected)

func _on_player_connected(peer_id: int) -> void:
    # Server spawns a player for each connected peer
    var player := preload("res://scenes/Player.tscn").instantiate()
    player.name = str(peer_id)  # Name = peer ID for authority lookup
    add_child(player)           # MultiplayerSpawner auto-replicates to all peers
    player.set_multiplayer_authority(peer_id)

func _on_player_disconnected(peer_id: int) -> void:
    var player := get_node_or_null(str(peer_id))
    if player:
        player.queue_free()  # MultiplayerSpawner auto-removes on peers
```

### RPC 安全模式
```gdscript
# SECURE: validate the sender before processing
@rpc("any_peer", "reliable")
func request_pick_up_item(item_id: int) -> void:
    if not multiplayer.is_server():
        return  # Only server processes this

    var sender_id := multiplayer.get_remote_sender_id()
    var player := get_player_by_peer_id(sender_id)

    if not is_instance_valid(player):
        return

    var item := get_item_by_id(item_id)
    if not is_instance_valid(item):
        return

    # Validate: is the player close enough to pick it up?
    if player.global_position.distance_to(item.global_position) > 100.0:
        return  # Reject: out of range

    # Safe to process
    _give_item_to_player(player, item)
    confirm_item_pickup.rpc(sender_id, item_id)  # Confirm back to client

@rpc("authority", "reliable")
func confirm_item_pickup(peer_id: int, item_id: int) -> void:
    # Only runs on clients (called from server authority)
    if multiplayer.get_unique_id() == peer_id:
        UIManager.show_pickup_notification(item_id)
```

### 高级能力

### 用于基于浏览器的多人游戏的 WebRTC
- 在 Godot Web 导出中使用 `WebRTCPeerConnection` 和 `WebRTCMultiplayerPeer` 进行 P2P 多人游戏
- 在 WebRTC 连接中实现 NAT 穿越的 STUN/TURN 服务器配置
- 构建一个信令服务器（最小的 WebSocket 服务器）以在对等方之间交换 SDP Offer
- 跨不同网络配置测试 WebRTC 连接：对称 NAT、防火墙企业网络、移动热点

### 对接会和大厅整合
- 将 Nakama（开源游戏服务器）与 Godot 集成，用于匹配、大厅、排行榜和数据存储
- 构建 REST 客户端 `HTTPRequest` 包装器，用于通过重试和超时处理来匹配 API 调用
- 实施基于票证的匹配：玩家提交票证，轮询比赛分配，连接到指定的服务器
- 通过 WebSocket 订阅设计大厅状态同步 — 大厅更改无需轮询即可推送至所有成员

### 中继服务器架构
- 构建一个最小的Godot中继服务器，无需权威模拟即可在客户端之间转发数据包
- 实施基于房间的路由：每个房间都有一个服务器分配的 ID，客户端通过房间 ID 而不是直接对等 ID 路由数据包
- 设计连接握手协议：加入请求→房间分配→对等列表广播→连接建立
- 配置中继服务器吞吐量：测量目标服务器硬件上每个 CPU 核心的最大并发房间和玩家数量

### 自定义多人游戏协议设计
- 使用 `PackedByteArray` 设计二进制数据包协议，以实现 `MultiplayerSynchronizer` 上的最大带宽效率
- 对频繁更新的状态实施增量压缩：仅发送更改的字段，而不发送完整的状态结构
- 在开发版本中构建数据包丢失模拟层以测试可靠性，而不会出现真正的网络性能下降
- 为语音和音频数据流实施网络抖动缓冲区，以平滑可变数据包到达时间
