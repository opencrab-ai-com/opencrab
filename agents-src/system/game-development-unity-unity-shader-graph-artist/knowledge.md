### 你的技术交付物

### 溶解着色器图形布局
```
黑板参数：
[Texture2D] 底图 — 反照率纹理
[Texture2D] 溶解贴图 — 噪声纹理驱动溶解
[Float] 溶解量 — 范围(0,1)，由艺术家驱动
[Float] 边缘宽度 — 范围(0,0.2)
[颜色] 边缘颜色 - 为发射边缘启用 HDR

节点图结构：
[示例纹理 2D：DissolveMap] → [R 通道] → [减去：DissolveAmount]
→ [Step: 0] → [Clip]（驱动 Alpha 剪辑阈值）

[减去：溶解量 + 边缘宽度] → [步长] → [乘：边缘颜色]
→ [添加到发射输出]

子图：“DissolveCore”封装了上面的内容，以便在角色材料中重复使用
```

### 自定义 URP 渲染器功能 — Outline Pass
```csharp
// OutlineRendererFeature.cs
public class OutlineRendererFeature : ScriptableRendererFeature
{
    [System.Serializable]
    public class OutlineSettings
    {
        public Material outlineMaterial;
        public RenderPassEvent renderPassEvent = RenderPassEvent.AfterRenderingOpaques;
    }

    public OutlineSettings settings = new OutlineSettings();
    private OutlineRenderPass _outlinePass;

    public override void Create()
    {
        _outlinePass = new OutlineRenderPass(settings);
    }

    public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
    {
        renderer.EnqueuePass(_outlinePass);
    }
}

public class OutlineRenderPass : ScriptableRenderPass
{
    private OutlineRendererFeature.OutlineSettings _settings;
    private RTHandle _outlineTexture;

    public OutlineRenderPass(OutlineRendererFeature.OutlineSettings settings)
    {
        _settings = settings;
        renderPassEvent = settings.renderPassEvent;
    }

    public override void Execute(ScriptableRenderContext context, ref RenderingData renderingData)
    {
        var cmd = CommandBufferPool.Get("Outline Pass");
        // Blit with outline material — samples depth and normals for edge detection
        Blitter.BlitCameraTexture(cmd, renderingData.cameraData.renderer.cameraColorTargetHandle,
            _outlineTexture, _settings.outlineMaterial, 0);
        context.ExecuteCommandBuffer(cmd);
        CommandBufferPool.Release(cmd);
    }
}
```

### 优化的 HLSL — URP Lit Custom
```hlsl
// CustomLit.hlsl — URP-compatible physically based shader
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

TEXTURE2D(_BaseMap);    SAMPLER(sampler_BaseMap);
TEXTURE2D(_NormalMap);  SAMPLER(sampler_NormalMap);
TEXTURE2D(_ORM);        SAMPLER(sampler_ORM);

CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST;
    float4 _BaseColor;
    float _Smoothness;
CBUFFER_END

struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; float3 normalOS : NORMAL; float4 tangentOS : TANGENT; };
struct Varyings  { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; float3 normalWS : TEXCOORD1; float3 positionWS : TEXCOORD2; };

Varyings Vert(Attributes IN)
{
    Varyings OUT;
    OUT.positionHCS = TransformObjectToHClip(IN.positionOS.xyz);
    OUT.positionWS  = TransformObjectToWorld(IN.positionOS.xyz);
    OUT.normalWS    = TransformObjectToWorldNormal(IN.normalOS);
    OUT.uv          = TRANSFORM_TEX(IN.uv, _BaseMap);
    return OUT;
}

half4 Frag(Varyings IN) : SV_Target
{
    half4 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, IN.uv) * _BaseColor;
    half3 orm    = SAMPLE_TEXTURE2D(_ORM, sampler_ORM, IN.uv).rgb;

    InputData inputData;
    inputData.normalWS    = normalize(IN.normalWS);
    inputData.positionWS  = IN.positionWS;
    inputData.viewDirectionWS = GetWorldSpaceNormalizeViewDir(IN.positionWS);
    inputData.shadowCoord = TransformWorldToShadowCoord(IN.positionWS);

    SurfaceData surfaceData;
    surfaceData.albedo      = albedo.rgb;
    surfaceData.metallic    = orm.b;
    surfaceData.smoothness  = (1.0 - orm.g) * _Smoothness;
    surfaceData.occlusion   = orm.r;
    surfaceData.alpha       = albedo.a;
    surfaceData.emission    = 0;
    surfaceData.normalTS    = half3(0,0,1);
    surfaceData.specular    = 0;
    surfaceData.clearCoatMask = 0;
    surfaceData.clearCoatSmoothness = 0;

    return UniversalFragmentPBR(inputData, surfaceData);
}
```

### 着色器复杂性审核
```markdown

### 着色器评论：[着色器名称]

**管道**： [ ] URP [ ] HDRP [ ] 内置
**目标平台**： [ ] PC [ ] 主机 [ ] 移动设备

纹理样本
- 片段纹理样本：___（移动限制：不透明 8 个，透明 4 个）

算术运算器指令
- Estimated ALU (from Shader Graph stats or compiled inspection): ___
- 移动预算：≤ 60 不透明/≤ 40 透明

渲染状态
- 混合模式：[ ] 不透明 [ ] Alpha 剪辑 [ ] Alpha 混合
- 深度写入： [ ] 开 [ ] 关
- 双面：[ ] 是（增加透支风险）

使用的子图：___
已记录的公开参数： [ ] 是 [ ] 否 — 被阻止，直到是
存在移动后备变体： [ ] 是 [ ] 否 [ ] 不需要（仅限 PC/主机）
```

### 高级能力

### Unity URP 中的计算着色器
- 编写用于 GPU 端数据处理的计算着色器：粒子模拟、纹理生成、网格变形
- 使用 `CommandBuffer` 调度计算通道并将结果注入渲染管道
- 使用计算写入的 `IndirectArguments` 缓冲区针对大量对象实现 GPU 驱动的实例渲染
- 使用 GPU 分析器分析计算着色器占用率：识别导致低扭曲占用率的寄存器压力

### 着色器调试和自省
- 使用与 Unity 集成的 RenderDoc 来捕获和检查任何绘制调用的着色器输入、输出和寄存器值
- 实现 `DEBUG_DISPLAY` 预处理器变体，将中间着色器值可视化为热图
- 构建一个着色器属性验证系统，在运行时根据预期范围检查 `MaterialPropertyBlock` 值
- 策略性地使用 Unity 的 Shader Graph 的 `Preview` 节点：在烘焙最终结果之前将中间计算公开为调试输出

### 自定义渲染管道通道 (URP)
- 通过 `ScriptableRendererFeature` 实现多通道效果（深度预通道、G 缓冲区自定义通道、屏幕空间覆盖）
- 使用与 URP 的后处理堆栈集成的自定义 `RTHandle` 分配构建自定义景深通道
- 设计材质排序覆盖来控制透明对象的渲染顺序，而无需单独依赖队列标签
- 实现写入自定义渲染目标的对象 ID，以实现需要区分每个对象的屏幕空间效果

### 程序纹理生成
- 使用计算着色器在运行时生成可平铺的噪声纹理：Worley、Simplex、FBM — 存储到 `RenderTexture`
- 构建一个地形 splat 地图生成器，根据高度和坡度数据在 GPU 上写入材质混合权重
- 实现在运行时从动态数据源生成的纹理图集（小地图合成、自定义 UI 背景）
- 使用 `AsyncGPUReadback` 在 CPU 上检索 GPU 生成的纹理数据，而不阻塞渲染线程
