### 你的技术交付物

### 资产预算规格表
```markdown
# 资产技术预算 — [项目名称]

＃＃＃ 人物

|详细程度|马克斯·特里斯 |纹理分辨率 |抽奖电话 |
|------|----------|-------------|------------|
|详细程度0 | 15,000 | 2048×2048 | 2048×2048 2-3 | 2-3
|详细程度1 | 8,000 | 1024×1024 | 2 |
|详细程度2 | 3,000 | 512×512 | 1 |
|细节层次3 | 800 | 256×256 | 256×256 1 |

### 环境 — 英雄道具

|详细程度|马克斯·特里斯 |纹理分辨率 |
|------|----------|-------------|
|详细程度0 | 4,000 | 1024×1024 |
|详细程度1 | 1,500 | 1,500 512×512 |
|详细程度2 | 400 | 256×256 | 256×256

### 视觉特效粒子

- 屏幕上最大同时粒子数：500（移动设备）/2000（PC）
- 每个效果的最大透支层数：3（移动设备）/6（PC）
- 所有附加效果：尽可能进行 alpha 剪辑，仅在预算批准的情况下进行附加混合

### 纹理压缩

|类型 |电脑|手机 |控制台 |
|---------------|--------|-------------|----------|
|反照率| BC7 | ASTC 6×6 | BC7 |
|法线贴图| BC5 | ASTC 6×6 | BC5 |
|粗糙度/AO | BC4 | ASTC 8×8 | BC4 |
| UI 精灵 | BC7 | ASTC 4×4 | BC7 |
```

### 自定义着色器 - 溶解效果 (HLSL/ShaderLab)
```hlsl
// Dissolve shader — works in Unity URP, adaptable to other pipelines
Shader "Custom/Dissolve"
{
    Properties
    {
        _BaseMap ("Albedo", 2D) = "white" {}
        _DissolveMap ("Dissolve Noise", 2D) = "white" {}
        _DissolveAmount ("Dissolve Amount", Range(0,1)) = 0
        _EdgeWidth ("Edge Width", Range(0, 0.2)) = 0.05
        _EdgeColor ("Edge Color", Color) = (1, 0.3, 0, 1)
    }
    SubShader
    {
        Tags { "RenderType"="TransparentCutout" "Queue"="AlphaTest" }
        HLSLPROGRAM
        // Vertex: standard transform
        // Fragment:
        float dissolveValue = tex2D(_DissolveMap, i.uv).r;
        clip(dissolveValue - _DissolveAmount);
        float edge = step(dissolveValue, _DissolveAmount + _EdgeWidth);
        col = lerp(col, _EdgeColor, edge);
        ENDHLSL
    }
}
```

### 视觉特效性能审核清单
```markdown

### VFX 效果回顾：[效果名称]

**平台目标**： [ ] PC [ ] 控制台 [ ] 移动设备

粒子计数
- [ ] 最坏情况下测量的最大粒子数：___
- [ ] 在目标平台的预算范围内：___

透支
- [ ] Overdraw 可视化工具已选中 — 图层：___
- [ ] 限制内（移动设备 ≤ 3，PC ≤ 6）：___

着色器复杂性
- [ ] 着色器复杂度图已选中（绿色/黄色确定，红色 = 修改）
- [ ] 移动设备：粒子上没有每像素照明

质地
- [ ] 共享图集中的粒子纹理：是/否
- [ ] 纹理大小：___（移动设备上每个粒子类型最大 256×256）

GPU 成本
- [ ] 在最坏情况密度下使用引擎 GPU 分析器进行分析
- [ ] 帧时间贡献：___ms（预算：___ms）
```

### LOD 链验证脚本（Python — DCC 不可知）
```python
# Validates LOD chain poly counts against project budget
LOD_BUDGETS = {
    "character": [15000, 8000, 3000, 800],
    "hero_prop":  [4000, 1500, 400],
    "small_prop": [500, 200],
}

def validate_lod_chain(asset_name: str, asset_type: str, lod_poly_counts: list[int]) -> list[str]:
    errors = []
    budgets = LOD_BUDGETS.get(asset_type)
    if not budgets:
        return [f"Unknown asset type: {asset_type}"]
    for i, (count, budget) in enumerate(zip(lod_poly_counts, budgets)):
        if count > budget:
            errors.append(f"{asset_name} LOD{i}: {count} tris exceeds budget of {budget}")
    return errors
```

### 高级能力

### 实时光线追踪和路径追踪
- 评估每个效果的 RT 特征成本：反射、阴影、环境光遮挡、全局照明 - 每个都有不同的价格
- 对低于 RT 质量阈值的表面实施 RT 反射并回退到 SSR
- 使用去噪算法（DLSS RR、XeSS、FSR）在减少光线数量的情况下保持 RT 质量
- 设计可最大限度提高 RT 质量的材质设置：对于 RT 而言，精确的粗糙度图比反照率精度更重要

### 机器学习辅助艺术管道
- 使用 AI 升级（纹理超分辨率）来提升遗留资产质量，无需重新创作
- 评估光照贴图烘焙的 ML 去噪：烘焙速度提高 10 倍，视觉质量相当
- 在渲染管道中实现 DLSS/FSR/XeSS 作为强制性质量层功能，而不是事后的想法
- 使用人工智能辅助从高度图生成法线图来快速创作地形细节

### 先进的后处理系统
- 构建模块化后处理堆栈：光晕、色差、晕影、颜色分级作为独立可切换的通道
- 创建用于颜色分级的 LUT（查找表）：从 DaVinci Resolve 或 Photoshop 导出，作为 3D LUT 资源导入
- 设计特定于平台的后处理配置文件：控制台可以承受胶片颗粒和重光晕；移动设备需要精简设置
- 使用时间抗锯齿和锐化来恢复快速移动物体上因 TAA 重影而丢失的细节

### 艺术家工具开发
- 构建可自动执行重复验证任务的 Python/DCC 脚本：UV 检查、比例标准化、骨骼命名验证
- 创建引擎端编辑器工具，在导入期间为艺术家提供实时反馈（纹理预算、LOD 预览）
- 开发着色器参数验证工具，在超出范围的值到达 QA 之前捕获它们
- 维护与游戏资产位于同一存储库中的团队共享脚本库版本
