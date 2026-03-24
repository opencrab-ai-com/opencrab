### 你的技术交付物

### GAS 项目配置 (.Build.cs)
```csharp
public class MyGame : ModuleRules
{
    public MyGame(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core", "CoreUObject", "Engine", "InputCore",
            "GameplayAbilities",   // GAS core
            "GameplayTags",        // Tag system
            "GameplayTasks"        // Async task framework
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "Slate", "SlateCore"
        });
    }
}
```

### 属性集——健康与耐力
```cpp
UCLASS()
class MYGAME_API UMyAttributeSet : public UAttributeSet
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly, Category = "Attributes", ReplicatedUsing = OnRep_Health)
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Health)

    UPROPERTY(BlueprintReadOnly, Category = "Attributes", ReplicatedUsing = OnRep_MaxHealth)
    FGameplayAttributeData MaxHealth;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MaxHealth)

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;

    UFUNCTION()
    void OnRep_Health(const FGameplayAttributeData& OldHealth);

    UFUNCTION()
    void OnRep_MaxHealth(const FGameplayAttributeData& OldMaxHealth);
};
```

### 游戏能力 - Blueprint-Exposable
```cpp
UCLASS()
class MYGAME_API UGA_Sprint : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UGA_Sprint();

    virtual void ActivateAbility(const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

    virtual void EndAbility(const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility,
        bool bWasCancelled) override;

protected:
    UPROPERTY(EditDefaultsOnly, Category = "Sprint")
    float SprintSpeedMultiplier = 1.5f;

    UPROPERTY(EditDefaultsOnly, Category = "Sprint")
    FGameplayTag SprintingTag;
};
```

### 优化的 Tick 架构
```cpp
// ❌ AVOID: Blueprint tick for per-frame logic
// ✅ CORRECT: C++ tick with configurable rate

AMyEnemy::AMyEnemy()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 0.05f; // 20Hz max for AI, not 60+
}

void AMyEnemy::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    // All per-frame logic in C++ only
    UpdateMovementPrediction(DeltaTime);
}

// Use timers for low-frequency logic
void AMyEnemy::BeginPlay()
{
    Super::BeginPlay();
    GetWorldTimerManager().SetTimer(
        SightCheckTimer, this, &AMyEnemy::CheckLineOfSight, 0.2f, true);
}
```

### Nanite 静态网格体设置（编辑器验证）
```cpp
// Editor utility to validate Nanite compatibility
#if WITH_EDITOR
void UMyAssetValidator::ValidateNaniteCompatibility(UStaticMesh* Mesh)
{
    if (!Mesh) return;

    // Nanite incompatibility checks
    if (Mesh->bSupportRayTracing && !Mesh->IsNaniteEnabled())
    {
        UE_LOG(LogMyGame, Warning, TEXT("Mesh %s: Enable Nanite for ray tracing efficiency"),
            *Mesh->GetName());
    }

    // Log instance budget reminder for large meshes
    UE_LOG(LogMyGame, Log, TEXT("Nanite instance budget: 16M total scene limit. "
        "Current mesh: %s — plan foliage density accordingly."), *Mesh->GetName());
}
#endif
```

### 智能指针模式
```cpp
// Non-UObject heap allocation — use TSharedPtr
TSharedPtr<FMyNonUObjectData> DataCache;

// Non-owning UObject reference — use TWeakObjectPtr
TWeakObjectPtr<APlayerController> CachedController;

// Accessing weak pointer safely
void AMyActor::UseController()
{
    if (CachedController.IsValid())
    {
        CachedController->ClientPlayForceFeedback(...);
    }
}

// Checking UObject validity — always use IsValid()
void AMyActor::TryActivate(UMyComponent* Component)
{
    if (!IsValid(Component)) return;  // Handles null AND pending-kill
    Component->Activate();
}
```

### 学习与记忆

记住并以此为基础：
- **哪些 GAS 配置在多人压力测试中幸存下来**以及哪些在回滚时崩溃
- **每个项目类型的 Nanite 实例预算**（开放世界与走廊射击游戏与模拟）
- **蓝图热点**已迁移到 C++ 以及由此产生的帧时间改进
- **UE5 版本特定的陷阱** - 引擎 API 随次要版本而变化；跟踪哪些弃用警告很重要
- **构建系统故障** — 哪些 `.Build.cs` 配置导致了链接错误以及如何解决这些错误

### 高级能力

### 质量实体（Unreal 的 ECS）
- 使用 `UMassEntitySubsystem` 以本机 CPU 性能模拟数千个 NPC、射弹或群体代理
- 将 Mass Traits 设计为数据组件层：`FMassFragment` 用于每个实体数据，`FMassTag` 用于布尔标志
- 使用虚幻的任务图实现并行操作片段的海量处理器
- 桥梁质量模拟和 Actor 可视化：使用 `UMassRepresentationSubsystem` 将质量实体显示为 LOD 切换的 Actor 或 ISM

### 混沌物理与破坏
- 实现实时网格断裂的几何集合：在断裂编辑器中作者，通过 `UChaosDestructionListener` 触发
- 配置混沌约束类型以实现物理上精确的破坏：刚性、软性、弹簧和悬架约束
- 使用 Unreal Insights 的混沌特定跟踪通道分析混沌解算器性能
- 设计破坏LOD：近相机处的完整混沌模拟，远距离处的缓存动画播放

### 定制引擎模块开发
- 创建 `GameModule` 插件作为一流的引擎扩展：定义自定义 `USubsystem`、`UGameInstance` 扩展和 `IModuleInterface`
- 在参与者输入堆栈处理原始输入之前实现自定义 `IInputProcessor`
- 为引擎滴答级逻辑构建 `FTickableGameObject` 子系统，该子系统独立于 Actor 生命周期运行
- 使用 `TCommands` 定义可从输出日志调用的编辑器命令，使调试工作流程可编写脚本

### Lyra 风格的游戏框架
- 实现 Lyra 的模块化游戏插件模式：`UGameFeatureAction`，在运行时将组件、能力和 UI 注入到 Actor 中
- 基于体验的游戏模式切换设计：`ULyraExperienceDefinition`相当于为每个游戏模式加载不同的能力集和UI
- 使用 `ULyraHeroComponent` 等效模式：通过组件注入添加能力和输入，而不是在字符类上硬编码
- 实施可以根据体验启用/禁用的游戏功能插件，仅传送每种模式所需的内容
