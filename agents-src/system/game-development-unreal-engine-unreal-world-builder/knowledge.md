### 你的技术交付物

### 世界分区设置参考
```markdown

### World Partition Configuration — [Project Name]

**World Size**: [X km × Y km]
**Target Platform**: [ ] PC  [ ] Console  [ ] Both

### Grid Configuration
| Grid Name         | Cell Size | Loading Range | Content Type        |
|-------------------|-----------|---------------|---------------------|
| MainGrid          | 128m      | 512m          | Terrain, props      |
| ActorGrid         | 64m       | 256m          | NPCs, gameplay actors|
| VFXGrid           | 32m       | 128m          | Particle emitters   |

### Data Layers
| Layer Name        | Type           | Contents                           |
|-------------------|----------------|------------------------------------|
| AlwaysLoaded      | Always Loaded  | Sky, audio manager, game systems   |
| HighDetail        | Runtime        | Loaded when setting = High         |
| PlayerCampData    | Runtime        | Quest-specific environment changes |

### Streaming Source
- Player Pawn: primary streaming source, 512m activation range
- Cinematic Camera: secondary source for cutscene area pre-loading
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

### HLOD Layer: [Level Name] — HLOD0

**Method**: Mesh Merge (fastest build, acceptable quality for > 500m)
**LOD Screen Size Threshold**: 0.01
**Draw Distance**: 50,000 cm (500m)
**Material Baking**: Enabled — 1024×1024 baked texture

**Included Actor Types**:
- All StaticMeshActor in zone
- Exclusion: Nanite-enabled meshes (Nanite handles its own LOD)
- Exclusion: Skeletal meshes (HLOD does not support skeletal)

**Build Settings**:
- Merge distance: 50cm (welds nearby geometry)
- Hard angle threshold: 80° (preserves sharp edges)
- Target triangle count: 5000 per HLOD mesh

**Rebuild Trigger**: Any geometry addition or removal in HLOD coverage area
**Visual Validation**: Required at 600m, 1000m, and 2000m camera distances before milestone
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

### Open-World Performance Review — [Build Version]

**Platform**: ___  **Target Frame Rate**: ___fps

Streaming
- [ ] No hitches > 16ms during normal traversal at 8m/s run speed
- [ ] Streaming source range validated: player can't out-run loading at sprint speed
- [ ] Cell boundary crossing tested: no gameplay actor disappearance at transitions

Rendering
- [ ] GPU frame time at worst-case density area: ___ms (budget: ___ms)
- [ ] Nanite instance count at peak area: ___ (limit: 16M)
- [ ] Draw call count at peak area: ___ (budget varies by platform)
- [ ] HLOD visually validated from max draw distance

Landscape
- [ ] RVT cache warm-up implemented for cinematic cameras
- [ ] Landscape LOD transitions visible? [ ] Acceptable  [ ] Needs adjustment
- [ ] Layer count in any single region: ___ (limit: 4)

PCG
- [ ] Pre-baked for all areas > 1km²: Y/N
- [ ] Streaming load/unload cost: ___ms (budget: < 2ms)

Memory
- [ ] Streaming cell memory budget: ___MB per active cell
- [ ] Total texture memory at peak loaded area: ___MB
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
