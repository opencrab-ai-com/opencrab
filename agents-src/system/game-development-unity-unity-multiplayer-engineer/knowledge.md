### 你的技术交付物

### 网络代码项目设置
```csharp
// NetworkManager configuration via code (supplement to Inspector setup)
public class NetworkSetup : MonoBehaviour
{
    [SerializeField] private NetworkManager _networkManager;

    public async void StartHost()
    {
        // Configure Unity Transport
        var transport = _networkManager.GetComponent<UnityTransport>();
        transport.SetConnectionData("0.0.0.0", 7777);

        _networkManager.StartHost();
    }

    public async void StartWithRelay(string joinCode = null)
    {
        await UnityServices.InitializeAsync();
        await AuthenticationService.Instance.SignInAnonymouslyAsync();

        if (joinCode == null)
        {
            // Host: create relay allocation
            var allocation = await RelayService.Instance.CreateAllocationAsync(maxConnections: 4);
            var hostJoinCode = await RelayService.Instance.GetJoinCodeAsync(allocation.AllocationId);

            var transport = _networkManager.GetComponent<UnityTransport>();
            transport.SetRelayServerData(AllocationUtils.ToRelayServerData(allocation, "dtls"));
            _networkManager.StartHost();

            Debug.Log($"Join Code: {hostJoinCode}");
        }
        else
        {
            // Client: join via relay join code
            var joinAllocation = await RelayService.Instance.JoinAllocationAsync(joinCode);
            var transport = _networkManager.GetComponent<UnityTransport>();
            transport.SetRelayServerData(AllocationUtils.ToRelayServerData(joinAllocation, "dtls"));
            _networkManager.StartClient();
        }
    }
}
```

### 服务器权威玩家控制器
```csharp
public class PlayerController : NetworkBehaviour
{
    [SerializeField] private float _moveSpeed = 5f;
    [SerializeField] private float _reconciliationThreshold = 0.5f;

    // Server-owned authoritative position
    private NetworkVariable<Vector3> _serverPosition = new NetworkVariable<Vector3>(
        readPerm: NetworkVariableReadPermission.Everyone,
        writePerm: NetworkVariableWritePermission.Server);

    private Queue<InputPayload> _inputQueue = new();
    private Vector3 _clientPredictedPosition;

    public override void OnNetworkSpawn()
    {
        if (!IsOwner) return;
        _clientPredictedPosition = transform.position;
    }

    private void Update()
    {
        if (!IsOwner) return;

        // Read input locally
        var input = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")).normalized;

        // Client prediction: move immediately
        _clientPredictedPosition += new Vector3(input.x, 0, input.y) * _moveSpeed * Time.deltaTime;
        transform.position = _clientPredictedPosition;

        // Send input to server
        SendInputServerRpc(input, NetworkManager.LocalTime.Tick);
    }

    [ServerRpc]
    private void SendInputServerRpc(Vector2 input, int tick)
    {
        // Server simulates movement from this input
        Vector3 newPosition = _serverPosition.Value + new Vector3(input.x, 0, input.y) * _moveSpeed * Time.fixedDeltaTime;

        // Server validates: is this physically possible? (anti-cheat)
        float maxDistancePossible = _moveSpeed * Time.fixedDeltaTime * 2f; // 2x tolerance for lag
        if (Vector3.Distance(_serverPosition.Value, newPosition) > maxDistancePossible)
        {
            // Reject: teleport attempt or severe desync
            _serverPosition.Value = _serverPosition.Value; // Force reconciliation
            return;
        }

        _serverPosition.Value = newPosition;
    }

    private void LateUpdate()
    {
        if (!IsOwner) return;

        // Reconciliation: if client is far from server, snap back
        if (Vector3.Distance(transform.position, _serverPosition.Value) > _reconciliationThreshold)
        {
            _clientPredictedPosition = _serverPosition.Value;
            transform.position = _clientPredictedPosition;
        }
    }
}
```

### 大厅+对接会一体化
```csharp
public class LobbyManager : MonoBehaviour
{
    private Lobby _currentLobby;
    private const string KEY_MAP = "SelectedMap";
    private const string KEY_GAME_MODE = "GameMode";

    public async Task<Lobby> CreateLobby(string lobbyName, int maxPlayers, string mapName)
    {
        var options = new CreateLobbyOptions
        {
            IsPrivate = false,
            Data = new Dictionary<string, DataObject>
            {
                { KEY_MAP, new DataObject(DataObject.VisibilityOptions.Public, mapName) },
                { KEY_GAME_MODE, new DataObject(DataObject.VisibilityOptions.Public, "Deathmatch") }
            }
        };

        _currentLobby = await LobbyService.Instance.CreateLobbyAsync(lobbyName, maxPlayers, options);
        StartHeartbeat(); // Keep lobby alive
        return _currentLobby;
    }

    public async Task<List<Lobby>> QuickMatchLobbies()
    {
        var queryOptions = new QueryLobbiesOptions
        {
            Filters = new List<QueryFilter>
            {
                new QueryFilter(QueryFilter.FieldOptions.AvailableSlots, "1", QueryFilter.OpOptions.GE)
            },
            Order = new List<QueryOrder>
            {
                new QueryOrder(false, QueryOrder.FieldOptions.Created)
            }
        };
        var response = await LobbyService.Instance.QueryLobbiesAsync(queryOptions);
        return response.Results;
    }

    private async void StartHeartbeat()
    {
        while (_currentLobby != null)
        {
            await LobbyService.Instance.SendHeartbeatPingAsync(_currentLobby.Id);
            await Task.Delay(15000); // Every 15 seconds — Lobby times out at 30s
        }
    }
}
```

### 网络变量设计参考
```csharp
// State that persists and syncs to all clients on join → NetworkVariable
public NetworkVariable<int> PlayerHealth = new(100,
    NetworkVariableReadPermission.Everyone,
    NetworkVariableWritePermission.Server);

// One-time events → ClientRpc
[ClientRpc]
public void OnHitClientRpc(Vector3 hitPoint, ClientRpcParams rpcParams = default)
{
    VFXManager.SpawnHitEffect(hitPoint);
}

// Client sends action request → ServerRpc
[ServerRpc(RequireOwnership = true)]
public void RequestFireServerRpc(Vector3 aimDirection)
{
    if (!CanFire()) return; // Server validates
    PerformFire(aimDirection);
    OnFireClientRpc(aimDirection);
}

// Avoid: setting NetworkVariable every frame
private void Update()
{
    // BAD: generates network traffic every frame
    // Position.Value = transform.position;

    // GOOD: use NetworkTransform component or custom prediction instead
}
```

### 高级能力

### 客户端预测和回滚
- 通过服务器协调实现完整的输入历史缓冲：存储输入的最后 N 帧和预测状态
- 为远程玩家位置设计快照插值：在接收到的服务器快照之间进行插值以实现平滑的视觉表示
- 为格斗游戏风格的游戏构建回滚网络代码基础：确定性模拟+输入延迟+异步回滚
- 使用 Unity 的物理模拟 API (`Physics.Simulate()`) 进行回滚后服务器权威的物理重新模拟

### 专用服务器部署
- 使用 Docker 容器化 Unity 专用服务器构建，以便部署在 AWS GameLift、Multiplay 或自托管虚拟机上
- 实现无头服务器模式：在服务器构建中禁用渲染、音频和输入系统以减少 CPU 开销
- 构建一个服务器编排客户端，将服务器运行状况、玩家数量和容量传达给匹配服务
- 实现服务器正常关闭：将活动会话迁移到新实例，通知客户端重新连接

### 反作弊架构
- 使用速度上限和隐形传输检测设计服务器端运动验证
- 实施服务器权威的命中检测：客户端报告命中意图，服务器验证目标位置并施加伤害
- 为所有影响游戏的服务器 RPC 构建审核日志：记录时间戳、玩家 ID、操作类型和用于回放分析的输入值
- 对每个玩家每个 RPC 应用速率限制：检测并断开以高于人类可能速率触发 RPC 的客户端

### 非政府组织绩效优化
- 通过航位推算实现自定义 `NetworkTransform`：预测更新之间的移动以降低网络频率
- 将 `NetworkVariableDeltaCompression` 用于高频数值（位置增量小于绝对位置）
- 设计一个网络对象池系统：非政府组织网络对象的产生/消失成本高昂——改为池化并重新配置
- 使用 NGO 的内置网络统计 API 分析每个客户端的带宽，并设置每个 NetworkObject 的更新频率预算
