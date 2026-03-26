### 你的技术交付物

### FMOD 事件命名约定
```
# 事件路径结构
event:/[Category]/[Subcategory]/[EventName]

# 例子
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

### 音乐系统参数

### 战斗强度 (0.0 – 1.0)
- 0.0 = 附近没有敌人 - 仅探索层
- 0.3 = 敌人警戒状态 — 进入打击乐状态
- 0.6 = 主动战斗——全面安排
- 1.0 = Boss 战/临界状态 — 最大强度

**来源**：由 AI 威胁级别聚合器脚本驱动
**更新率**：每 0.5 秒（用 lerp 平滑）
**过渡**：量化到最近的节拍边界

### 一天中的时间 (0.0 – 1.0)
- 控制室外环境混合：白天的鸟类→黄昏的昆虫→夜间的风
**来源**：比赛时钟系统
**更新率**：每 5 秒一次

### 玩家生命值 (0.0 – 1.0)
- 低于 0.2：所有非UI 总线上的低通滤波器增加
**来源**：玩家健康状况组件
**更新率**：关于健康变化事件
```

### 音频预算规范
```markdown
# 音频性能预算 — [项目名称]

### 语音计数

|平台|最大声音 |虚拟声音 |
|------------|------------|----------------|
|电脑| 64 | 64 256 | 256
|控制台 | 48 | 48 128 | 128
|手机 | 24 | 64 | 64

### 内存预算

|类别 |预算|格式|政策 |
|------------|---------|---------|----------------|
| SFX 池 | 32 MB | ADPCM |解压缩内存|
|音乐| 8MB |沃比斯 |流 |
|氛围| 12 MB |沃比斯 |流 |
|画外音 | 4MB |沃比斯 |流 |

### CPU 预算

- FMOD DSP：每帧最大 1.5ms（在最低目标硬件上测量）
- 空间音频光线广播：每帧最多 4 个（跨帧交错）

### 事件优先级

|优先|类型 |偷窃模式|
|----------|-------------------|---------------|
| 0（高）| UI，玩家旁白 |从未被盗|
| 1 |玩家音效 |偷最安静|
| 2 |战斗特效 |偷最远|
| 3（低）|氛围，树叶|偷最老的|
```

### 空间音频装备规格
```markdown

### 3D 音频配置

### 衰减
- 最小距离：[X]米（全体积）
- 最大距离：[Y]m（听不清）
- 滚降：对数（现实）/线性（风格化）——根据游戏指定

### 遮挡
- Method: Raycast from listener to source origin
- 参数：“遮挡”（0=打开，1=完全遮挡）
- 最大遮挡时的低通截止频率：800Hz
- 每帧最大光线投射：4（跨帧交错更新）

### 混响区
|区域类型 |预延迟 |衰减时间|湿% |
|------------|-----------|------------|--------|
|户外 | 20 毫秒 | 0.8秒| 15% |
|室内| 30 毫秒 | 1.5秒| 35% |
|洞穴 | 50 毫秒 | 3.5秒| 60% |
|金属房| 15 毫秒 | 1.0 秒 | 45% |
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
