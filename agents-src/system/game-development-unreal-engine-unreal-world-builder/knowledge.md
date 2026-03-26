### 你的技术交付物

### 世界分区设置参考
```markdown
### 世界分区配置 — [项目名称]

**世界大小**：[X 公里 × Y 公里]
**目标平台**： [ ] PC [ ] 主机 [ ] 两者

### 网格配置
|网格名称 |电池尺寸 |负载范围|内容类型 |
|-------------------|------------------------|------------------------|------------------------|
|主网格| 128m | 512m |地形、道具|
|演员网格 | 64m | 256m | NPC、游戏演员|
|视觉特效网格 | 32m | 128m |粒子发射器|

### 数据层
|图层名称 |类型 |内容 |
|--------------------------------|----------------|------------------------------------|
|始终加载 |始终加载| Sky、音频管理器、游戏系统|
|高细节 |运行时|当设置 = 高 | 时加载
|玩家营地数据 |运行时 |特定于任务的环境变化 |

### 流媒体源
- Player Pawn：主要流媒体源，512m激活范围
- 电影摄影机：过场动画区域预加载的辅助来源
```

### 景观材料建筑
```
Landscape Master Material: M_Landscape_Master

Layer Stack (max 4 per blended region):
  Layer 0: Grass (base — always present, fills empty regions)
  Layer 1: Dirt/Path (replaces grass along worn paths)
  Layer 2: Rock (driven by slope angle — auto-blend > 35°)
  Layer 3: Snow (driven by height — above 800m world units)

Blending Method: Runtime Virtual Texture (RVT)
  RVT Resolution: 2048×2048 per 4096m² grid cell
  RVT Format: YCoCg compressed (saves memory vs. RGBA)

Auto-Slope Rock Blend:
  WorldAlignedBlend node:
    Input: Slope threshold = 0.6 (dot product of world up vs. surface normal)
    Above threshold: Rock layer at full strength
    Below threshold: Grass/Dirt gradient

Auto-Height Snow Blend:
  Absolute World Position Z > [SnowLine parameter] → Snow layer fade in
  Blend range: 200 units above SnowLine for smooth transition

Runtime Virtual Texture Output Volumes:
  Placed every 4096m² grid cell aligned to landscape components
  Virtual Texture Producer on Landscape: enabled
```

### HLOD层配置
```markdown
### HLOD 层：[级别名称] — HLOD0

**方法**：网格合并（最快构建，> 500m 的质量可接受）
**LOD 屏幕尺寸阈值**：0.01
**绘制距离**：50,000 cm (500m)
**材质烘焙**：启用 — 1024×1024 烘焙纹理

**包含的演员类型**：
- 区域中的所有 StaticMeshActor
- 排除：启用 Nanite 的网格（Nanite 处理自己的 LOD）
- 排除：骨架网格物体（HLOD 不支持骨架）

**构建设置**：
- 合并距离：50cm（焊接附近的几何体）
- 硬角阈值：80°（保留锋利边缘）
- 目标三角形数量：每个 HLOD 网格 5000 个

**重建触发器**：HLOD 覆盖区域中的任何几何体添加或删除
**视觉验证**：在里程碑之前需要在 600m、1000m 和 2000m 相机距离处进行
```

### PCG 森林人口图
```
PCG Graph: G_ForestPopulation

Step 1: Surface Sampler
  Input: World Partition Surface
  Point density: 0.5 per 10m²
  Normal filter: angle from up < 25° (no steep slopes)

Step 2: Attribute Filter — Biome Mask
  Sample biome density texture at world XY
  Density remap: biome mask value 0.0–1.0 → point keep probability

Step 3: Exclusion
  Road spline buffer: 8m — remove points within road corridor
  Path spline buffer: 4m
  Water body: 2m from shoreline
  Hand-placed structure: 15m sphere exclusion

Step 4: Poisson Disk Distribution
  Min separation: 3.0m — prevents unnatural clustering

Step 5: Randomization
  Rotation: random Yaw 0–360°, Pitch ±2°, Roll ±2°
  Scale: Uniform(0.85, 1.25) per axis independently

Step 6: Weighted Mesh Assignment
  40%: Oak_LOD0 (Nanite enabled)
  30%: Pine_LOD0 (Nanite enabled)
  20%: Birch_LOD0 (Nanite enabled)
  10%: DeadTree_LOD0 (non-Nanite — manual LOD chain)

Step 7: Culling
  Cull distance: 80,000 cm (Nanite meshes — Nanite handles geometry detail)
  Cull distance: 30,000 cm (non-Nanite dead trees)

Exposed Graph Parameters:
  - GlobalDensityMultiplier: 0.0–2.0 (designer tuning knob)
  - MinForestSeparation: 1.0–8.0m
  - RoadExclusionEnabled: bool
```

### 开放世界性能分析清单
```markdown
### 开放世界性能回顾 — [构建版本]

**平台**： ___ **目标帧速率**： ___fps

流媒体
- [ ] 以 8m/s 运行速度正常运行时，无卡顿 > 16ms
- [ ] 流媒体源范围已验证：玩家无法以冲刺速度超越加载
- [ ] 单元格边界交叉测试：过渡时游戏演员不会消失

渲染
- [ ] 最坏情况密度区域的 GPU 帧时间：___ms（预算：___ms）
- [ ] 峰值区域的纳米实例数：___（限制：16M）
- [ ] 峰值区域的绘制调用计数：___（预算因平台而异）
- [ ] HLOD 从最大绘制距离进行视觉验证

风景
- [ ] 为电影摄影机实现 RVT 缓存预热
- [ ] 景观 LOD 过渡可见？ [ ] 可以接受 [ ] 需要调整
- [ ] 任何单个区域的层数：___（限制：4）

计算机图形学
- [ ] 预烘焙所有面积 > 1km² 的区域：是/否
- [ ] 流加载/卸载成本：___ms（预算：< 2ms）

内存
- [ ] 流单元内存预算：每个活动单元 ___MB
- [ ] 峰值加载区域的总纹理内存： ___MB
```

### 高级能力

### 大世界坐标 (LWC)
- 为任何轴上 > 2 公里的世界启用大世界坐标 — 浮点精度误差在没有 LWC 的情况下在约 20 公里处变得可见
- 审核所有着色器和材质的 LWC 兼容性：`LWCToFloat()` 函数取代直接世界位置采样
- 在最大预期世界范围内测试 LWC：在距离原点 100 公里处生成玩家并验证没有视觉或物理伪影
- 当启用 LWC 时，在游戏代码中使用 `FVector3d`（双精度）来表示世界位置 - 默认情况下 `FVector` 仍然是单精度

### 每个演员一个文件 (OFPA)
- 为所有世界分区级别启用每个 Actor 一个文件，以实现多用户编辑而不会发生文件冲突
- 对团队进行 OFPA 工作流程教育：从源代码控制中检查各个参与者，而不是整个关卡文件
- 构建一个关卡审核工具，标记遗留关卡中尚未转换为 OFPA 的参与者
- 监控 OFPA 文件数量增长：包含数千名演员的大型关卡生成数千个文件 — 建立文件数量预算

### 先进的景观工具
- 使用景观编辑图层进行非破坏性多用户地形编辑：每个艺术家都在自己的图层上工作
- 实施用于道路和河流雕刻的景观样条线：样条线变形网格自动符合地形拓扑
- 构建运行时虚拟纹理权重混合，对游戏标签或贴花演员进行采样以驱动动态地形状态变化
- 设计具有程序湿度的景观材质：雨水积累参数驱动 RVT 混合权重朝向潮湿表面层

### 流媒体性能优化
- 使用 `UWorldPartitionReplay` 记录玩家遍历路径以进行流式压力测试，无需真人玩家参与
- 在非玩家流媒体源上实施 `AWorldPartitionStreamingSourceComponent`：过场动画、AI 导演、过场动画摄像机
- 在编辑器中构建流预算仪表板：显示活动单元数、每个单元的内存以及最大流半径下的预计内存
- 配置目标存储硬件上的 I/O 流延迟：SSD 与 HDD 具有 10-100 倍不同的流特性 - 相应地设计单元大小
