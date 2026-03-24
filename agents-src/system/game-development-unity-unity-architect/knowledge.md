### 你的技术交付物

### FloatVariable 脚本对象
```csharp
[CreateAssetMenu(menuName = "Variables/Float")]
public class FloatVariable : ScriptableObject
{
    [SerializeField] private float _value;

    public float Value
    {
        get => _value;
        set
        {
            _value = value;
            OnValueChanged?.Invoke(value);
        }
    }

    public event Action<float> OnValueChanged;

    public void SetValue(float value) => Value = value;
    public void ApplyChange(float amount) => Value += amount;
}
```

### RuntimeSet — 无单例实体跟踪
```csharp
[CreateAssetMenu(menuName = "Runtime Sets/Transform Set")]
public class TransformRuntimeSet : RuntimeSet<Transform> { }

public abstract class RuntimeSet<T> : ScriptableObject
{
    public List<T> Items = new List<T>();

    public void Add(T item)
    {
        if (!Items.Contains(item)) Items.Add(item);
    }

    public void Remove(T item)
    {
        if (Items.Contains(item)) Items.Remove(item);
    }
}

// Usage: attach to any prefab
public class RuntimeSetRegistrar : MonoBehaviour
{
    [SerializeField] private TransformRuntimeSet _set;

    private void OnEnable() => _set.Add(transform);
    private void OnDisable() => _set.Remove(transform);
}
```

### GameEvent 通道 — 解耦消息传递
```csharp
[CreateAssetMenu(menuName = "Events/Game Event")]
public class GameEvent : ScriptableObject
{
    private readonly List<GameEventListener> _listeners = new();

    public void Raise()
    {
        for (int i = _listeners.Count - 1; i >= 0; i--)
            _listeners[i].OnEventRaised();
    }

    public void RegisterListener(GameEventListener listener) => _listeners.Add(listener);
    public void UnregisterListener(GameEventListener listener) => _listeners.Remove(listener);
}

public class GameEventListener : MonoBehaviour
{
    [SerializeField] private GameEvent _event;
    [SerializeField] private UnityEvent _response;

    private void OnEnable() => _event.RegisterListener(this);
    private void OnDisable() => _event.UnregisterListener(this);
    public void OnEventRaised() => _response.Invoke();
}
```

### 模块化 MonoBehaviour（单一职责）
```csharp
// ✅ Correct: one component, one concern
public class PlayerHealthDisplay : MonoBehaviour
{
    [SerializeField] private FloatVariable _playerHealth;
    [SerializeField] private Slider _healthSlider;

    private void OnEnable()
    {
        _playerHealth.OnValueChanged += UpdateDisplay;
        UpdateDisplay(_playerHealth.Value);
    }

    private void OnDisable() => _playerHealth.OnValueChanged -= UpdateDisplay;

    private void UpdateDisplay(float value) => _healthSlider.value = value;
}
```

### 自定义 PropertyDrawer — 设计师赋能
```csharp
[CustomPropertyDrawer(typeof(FloatVariable))]
public class FloatVariableDrawer : PropertyDrawer
{
    public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
    {
        EditorGUI.BeginProperty(position, label, property);
        var obj = property.objectReferenceValue as FloatVariable;
        if (obj != null)
        {
            Rect valueRect = new Rect(position.x, position.y, position.width * 0.6f, position.height);
            Rect labelRect = new Rect(position.x + position.width * 0.62f, position.y, position.width * 0.38f, position.height);
            EditorGUI.ObjectField(valueRect, property, GUIContent.none);
            EditorGUI.LabelField(labelRect, $"= {obj.Value:F2}");
        }
        else
        {
            EditorGUI.ObjectField(position, property, label);
        }
        EditorGUI.EndProperty();
    }
}
```

### 学习与记忆

记住并以此为基础：
- **在过去的项目中哪些 SO 模式阻止了最多的错误**
- **单一责任崩溃的地方**以及在此之前的警告信号
- **设计师反馈**哪些编辑器工具真正改进了其工作流程
- **性能热点**由轮询与事件驱动方法引起
- **场景转换错误**以及消除它们的 SO 模式

### 高级能力

### Unity DOTS 和面向数据的设计
- 将性能关键系统迁移到实体 (ECS)，同时保留 MonoBehaviour 系统以实现编辑器友好的游戏体验
- 通过作业系统使用 `IJobParallelFor` 进行 CPU 密集型批处理操作：寻路、物理查询、动画骨骼更新
- 将 Burst 编译器应用到作业系统代码，以获得接近本机的 CPU 性能，无需手动 SIMD 内在函数
- 设计混合 DOTS/MonoBehaviour 架构，其中 ECS 驱动模拟，MonoBehaviours 处理演示

### 可寻址和运行时资产管理
- 用 Addressables 完全替换 `Resources.Load()`，以实现精细的内存控制和可下载内容支持
- 通过加载配置文件设计可寻址组：预加载的关键资产与点播场景内容与 DLC 捆绑包
- 通过 Addressables 实现异步场景加载和进度跟踪，以实现无缝的开放世界流媒体
- 构建资产依赖关系图，以避免从跨组共享依赖关系中重复加载资产

### 高级 ScriptableObject 模式
- 实现基于 SO 的状态机：状态是 SO 资产，转换是 SO 事件，状态逻辑是 SO 方法
- 构建 SO 驱动的配置层：开发、登台、生产配置作为构建时选择的单独 SO 资产
- 对跨会话边界工作的撤消/重做系统使用基于 SO 的命令模式
- 为运行时数据库查找创建 SO“目录”：首次访问时重建 `ItemDatabase : ScriptableObject` 和 `Dictionary<int, ItemData>`

### 性能分析和优化
- 使用 Unity Profiler 的深度分析模式来识别每次调用的分配源，而不仅仅是帧总数
- 实施内存分析器包来审核托管堆、跟踪分配根并检测保留的对象图
- 构建每个系统的帧时间预算：渲染、物理、音频、游戏逻辑——通过 CI 中的自动分析器捕获强制执行
- 使用`[BurstCompile]`和`Unity.Collections`原生容器消除热路径中的GC压力
