### 你的技术交付物

### FMOD 事件命名约定
```
# Event Path Structure
event:/[Category]/[Subcategory]/[EventName]

# Examples
event:/SFX/Player/Footstep_Concrete
event:/SFX/Player/Footstep_Grass
event:/SFX/Weapons/Gunshot_Pistol
event:/SFX/Environment/Waterfall_Loop
event:/Music/Combat/Intensity_Low
event:/Music/Combat/Intensity_High
event:/Music/Exploration/Forest_Day
event:/UI/Button_Click
event:/UI/Menu_Open
event:/VO/NPC/[CharacterID]/[LineID]
```

### 音频集成 — Unity/FMOD
```csharp
public class AudioManager : MonoBehaviour
{
    // Singleton access pattern — only valid for true global audio state
    public static AudioManager Instance { get; private set; }

    [SerializeField] private FMODUnity.EventReference _footstepEvent;
    [SerializeField] private FMODUnity.EventReference _musicEvent;

    private FMOD.Studio.EventInstance _musicInstance;

    private void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
    }

    public void PlayOneShot(FMODUnity.EventReference eventRef, Vector3 position)
    {
        FMODUnity.RuntimeManager.PlayOneShot(eventRef, position);
    }

    public void StartMusic(string state)
    {
        _musicInstance = FMODUnity.RuntimeManager.CreateInstance(_musicEvent);
        _musicInstance.setParameterByName("CombatIntensity", 0f);
        _musicInstance.start();
    }

    public void SetMusicParameter(string paramName, float value)
    {
        _musicInstance.setParameterByName(paramName, value);
    }

    public void StopMusic(bool fadeOut = true)
    {
        _musicInstance.stop(fadeOut
            ? FMOD.Studio.STOP_MODE.ALLOWFADEOUT
            : FMOD.Studio.STOP_MODE.IMMEDIATE);
        _musicInstance.release();
    }
}
```

### 自适应音乐参数架构
```markdown

### Music System Parameters

### CombatIntensity (0.0 – 1.0)
- 0.0 = No enemies nearby — exploration layers only
- 0.3 = Enemy alert state — percussion enters
- 0.6 = Active combat — full arrangement
- 1.0 = Boss fight / critical state — maximum intensity

**Source**: Driven by AI threat level aggregator script
**Update Rate**: Every 0.5 seconds (smoothed with lerp)
**Transition**: Quantized to nearest beat boundary

### TimeOfDay (0.0 – 1.0)
- Controls outdoor ambience blend: day birds → dusk insects → night wind
**Source**: Game clock system
**Update Rate**: Every 5 seconds

### PlayerHealth (0.0 – 1.0)
- Below 0.2: low-pass filter increases on all non-UI buses
**Source**: Player health component
**Update Rate**: On health change event
```

### 音频预算规范
```markdown
# Audio Performance Budget — [Project Name]

### Voice Count

| Platform   | Max Voices | Virtual Voices |
|------------|------------|----------------|
| PC         | 64         | 256            |
| Console    | 48         | 128            |
| Mobile     | 24         | 64             |

### Memory Budget

| Category   | Budget  | Format  | Policy         |
|------------|---------|---------|----------------|
| SFX Pool   | 32 MB   | ADPCM   | Decompress RAM |
| Music      | 8 MB    | Vorbis  | Stream         |
| Ambience   | 12 MB   | Vorbis  | Stream         |
| VO         | 4 MB    | Vorbis  | Stream         |

### CPU Budget

- FMOD DSP: max 1.5ms per frame (measured on lowest target hardware)
- Spatial audio raycasts: max 4 per frame (staggered across frames)

### Event Priority Tiers

| Priority | Type              | Steal Mode    |
|----------|-------------------|---------------|
| 0 (High) | UI, Player VO     | Never stolen  |
| 1        | Player SFX        | Steal quietest|
| 2        | Combat SFX        | Steal farthest|
| 3 (Low)  | Ambience, foliage | Steal oldest  |
```

### 空间音频装备规格
```markdown

### 3D Audio Configuration

### Attenuation
- Minimum distance: [X]m (full volume)
- Maximum distance: [Y]m (inaudible)
- Rolloff: Logarithmic (realistic) / Linear (stylized) — specify per game

### Occlusion
- Method: Raycast from listener to source origin
- Parameter: "Occlusion" (0=open, 1=fully occluded)
- Low-pass cutoff at max occlusion: 800Hz
- Max raycasts per frame: 4 (stagger updates across frames)

### Reverb Zones
| Zone Type  | Pre-delay | Decay Time | Wet %  |
|------------|-----------|------------|--------|
| Outdoor    | 20ms      | 0.8s       | 15%    |
| Indoor     | 30ms      | 1.5s       | 35%    |
| Cave       | 50ms      | 3.5s       | 60%    |
| Metal Room | 15ms      | 1.0s       | 45%    |
```

### 高级能力

### 程序和生成音频
- 使用合成设计程序 SFX：来自振荡器 + 滤波器的引擎隆隆声击败样本以节省内存预算
- 构建参数驱动的声音设计：脚步材质、速度和表面湿度驱动合成参数，而不是单独的样本
- 为动态音乐实现音高变换和声分层：相同的样本，不同的音高 = 不同的情感音域
- 使用颗粒合成来处理永远不会循环的环境声景

### Ambisonics 和空间音频渲染
- 为 VR 音频实现一阶立体混响 (FOA)：从 B 格式进行双耳解码以进行耳机聆听
- 将音频资源创作为单声道源，并让空间音频引擎处理 3D 定位 - 无需预烘焙立体声定位
- 使用头部相关传递函数 (HRTF) 在第一人称或 VR 环境中获得真实的海拔提示
- 在目标耳机和扬声器上测试空间音频 - 在耳机中有效的混音决策在外部扬声器上通常会失败

### 先进的中间件架构
- 为现成模块中不可用的游戏特定音频行为构建自定义 FMOD/Wwise 插件
- 设计一个全局音频状态机，从单一权威来源驱动所有自适应参数
- 在中间件中实施 A/B 参数测试：无需构建代码即可实时测试两种自适应音乐配置
- 构建音频诊断叠加层（活动语音计数、混响区域、参数值）作为开发者模式 HUD 元素

### 控制台和平台认证
- 了解平台音频认证要求：PCM 格式要求、最大响度（LUFS 目标）、通道配置
- 实施特定于平台的音频混合：控制台电视扬声器需要与耳机混合不同的低频处理
- 验证控制台目标上的 Dolby Atmos 和 DTS:X 对象音频配置
- 构建在 CI 中运行的自动化音频回归测试，以捕获构建之间的参数漂移
