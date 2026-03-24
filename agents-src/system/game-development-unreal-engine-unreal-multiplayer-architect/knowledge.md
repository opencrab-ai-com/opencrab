### 你的技术交付物

### 复制 Actor 设置
```cpp
// AMyNetworkedActor.h
UCLASS()
class MYGAME_API AMyNetworkedActor : public AActor
{
    GENERATED_BODY()

public:
    AMyNetworkedActor();
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    // Replicated to all — with RepNotify for client reaction
    UPROPERTY(ReplicatedUsing=OnRep_Health)
    float Health = 100.f;

    // Replicated to owner only — private state
    UPROPERTY(Replicated)
    int32 PrivateInventoryCount = 0;

    UFUNCTION()
    void OnRep_Health();

    // Server RPC with validation
    UFUNCTION(Server, Reliable, WithValidation)
    void ServerRequestInteract(AActor* Target);
    bool ServerRequestInteract_Validate(AActor* Target);
    void ServerRequestInteract_Implementation(AActor* Target);

    // Multicast for cosmetic effects
    UFUNCTION(NetMulticast, Unreliable)
    void MulticastPlayHitEffect(FVector HitLocation);
    void MulticastPlayHitEffect_Implementation(FVector HitLocation);
};

// AMyNetworkedActor.cpp
void AMyNetworkedActor::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AMyNetworkedActor, Health);
    DOREPLIFETIME_CONDITION(AMyNetworkedActor, PrivateInventoryCount, COND_OwnerOnly);
}

bool AMyNetworkedActor::ServerRequestInteract_Validate(AActor* Target)
{
    // Server-side validation — reject impossible requests
    if (!IsValid(Target)) return false;
    float Distance = FVector::Dist(GetActorLocation(), Target->GetActorLocation());
    return Distance < 200.f; // Max interaction distance
}

void AMyNetworkedActor::ServerRequestInteract_Implementation(AActor* Target)
{
    // Safe to proceed — validation passed
    PerformInteraction(Target);
}
```

### 游戏模式/游戏状态架构
```cpp
// AMyGameMode.h — Server only, never replicated
UCLASS()
class MYGAME_API AMyGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    virtual void PostLogin(APlayerController* NewPlayer) override;
    virtual void Logout(AController* Exiting) override;
    void OnPlayerDied(APlayerController* DeadPlayer);
    bool CheckWinCondition();
};

// AMyGameState.h — Replicated to all clients
UCLASS()
class MYGAME_API AMyGameState : public AGameStateBase
{
    GENERATED_BODY()
public:
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    UPROPERTY(Replicated)
    int32 TeamAScore = 0;

    UPROPERTY(Replicated)
    float RoundTimeRemaining = 300.f;

    UPROPERTY(ReplicatedUsing=OnRep_GamePhase)
    EGamePhase CurrentPhase = EGamePhase::Warmup;

    UFUNCTION()
    void OnRep_GamePhase();
};

// AMyPlayerState.h — Replicated to all clients
UCLASS()
class MYGAME_API AMyPlayerState : public APlayerState
{
    GENERATED_BODY()
public:
    UPROPERTY(Replicated) int32 Kills = 0;
    UPROPERTY(Replicated) int32 Deaths = 0;
    UPROPERTY(Replicated) FString SelectedCharacter;
};
```

### GAS 复制设置
```cpp
// In Character header — AbilitySystemComponent must be set up correctly for replication
UCLASS()
class MYGAME_API AMyCharacter : public ACharacter, public IAbilitySystemInterface
{
    GENERATED_BODY()

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GAS")
    UAbilitySystemComponent* AbilitySystemComponent;

    UPROPERTY()
    UMyAttributeSet* AttributeSet;

public:
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override
    { return AbilitySystemComponent; }

    virtual void PossessedBy(AController* NewController) override;  // Server: init GAS
    virtual void OnRep_PlayerState() override;                       // Client: init GAS
};

// In .cpp — dual init path required for client/server
void AMyCharacter::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);
    // Server path
    AbilitySystemComponent->InitAbilityActorInfo(GetPlayerState(), this);
    AttributeSet = Cast<UMyAttributeSet>(AbilitySystemComponent->GetOrSpawnAttributes(UMyAttributeSet::StaticClass(), 1)[0]);
}

void AMyCharacter::OnRep_PlayerState()
{
    Super::OnRep_PlayerState();
    // Client path — PlayerState arrives via replication
    AbilitySystemComponent->InitAbilityActorInfo(GetPlayerState(), this);
}
```

### 网络频率优化
```cpp
// Set replication frequency per actor class in constructor
AMyProjectile::AMyProjectile()
{
    bReplicates = true;
    NetUpdateFrequency = 100.f; // High — fast-moving, accuracy critical
    MinNetUpdateFrequency = 33.f;
}

AMyNPCEnemy::AMyNPCEnemy()
{
    bReplicates = true;
    NetUpdateFrequency = 20.f;  // Lower — non-player, position interpolated
    MinNetUpdateFrequency = 5.f;
}

AMyEnvironmentActor::AMyEnvironmentActor()
{
    bReplicates = true;
    NetUpdateFrequency = 2.f;   // Very low — state rarely changes
    bOnlyRelevantToOwner = false;
}
```

### 专用服务器构建配置
```ini
# DefaultGame.ini — Server configuration
[/Script/EngineSettings.GameMapsSettings]
GameDefaultMap=/Game/Maps/MainMenu
ServerDefaultMap=/Game/Maps/GameLevel

[/Script/Engine.GameNetworkManager]
TotalNetBandwidth=32000
MaxDynamicBandwidth=7000
MinDynamicBandwidth=4000

# Package.bat — Dedicated server build
RunUAT.bat BuildCookRun
  -project="MyGame.uproject"
  -platform=Linux
  -server
  -serverconfig=Shipping
  -cook -build -stage -archive
  -archivedirectory="Build/Server"
```

### 高级能力

### 自定义网络预测框架
- 为物理驱动或需要回滚的复杂运动实施虚幻的网络预测插件
- 为每个预测系统设计预测代理（`FNetworkPredictionStateBase`）：运动、能力、交互
- 使用预测框架的权限校正路径构建服务器协调 - 避免自定义协调逻辑
- 配置文件预测开销：测量高延迟测试条件下的回滚频率和模拟成本

### 复制图优化
- 启用复制图插件以用空间分区替换默认的平面相关性模型
- 为开放世界游戏实施 `UReplicationGraphNode_GridSpatialization2D`：仅将空间单元内的参与者复制到附近的客户端
- 为休眠参与者构建自定义 `UReplicationGraphNode` 实现：不靠近任何玩家的 NPC 以最低频率复制
- 使用 `net.RepGraph.PrintAllNodes` 和 Unreal Insights 配置复制图性能 — 比较之前/之后的带宽

### 专用服务器基础设施
- 实施 `AOnlineBeaconHost` 进行轻量级会话前查询：服务器信息、玩家数量、ping - 无需完整的游戏会话连接
- 使用自定义 `UGameInstance` 子系统构建服务器集群管理器，该子系统在启动时向匹配后端注册
- 实现优雅的会话迁移：当侦听服务器主机断开连接时传输玩家保存的内容和游戏状态
- 设计服务器端作弊检测日志记录：每个可疑的服务器 RPC 输入都被写入带有玩家 ID 和时间戳的审核日志中

### GAS 多人游戏深度探索
- 在 `UGameplayAbility` 中正确实现预测密钥：`FPredictionKey` 范围所有预测更改以进行服务器端确认
- 设计 `FGameplayEffectContext` 子类，通过 GAS 管道携带命中结果、能力源和自定义数据
- 构建服务器验证的`UGameplayAbility`激活：客户端本地预测，服务器确认或回滚
- 分析 GAS 复制开销：使用 `net.stats` 和属性集大小分析来识别复制频率过高
