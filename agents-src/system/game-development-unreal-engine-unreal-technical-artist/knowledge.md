### 你的技术交付物

### 材质函数 - 三平面映射
```
Material Function: MF_TriplanarMapping
Inputs:
  - Texture (Texture2D) — the texture to project
  - BlendSharpness (Scalar, default 4.0) — controls projection blend softness
  - Scale (Scalar, default 1.0) — world-space tile size

Implementation:
  WorldPosition → multiply by Scale
  AbsoluteWorldNormal → Power(BlendSharpness) → Normalize → BlendWeights (X, Y, Z)
  SampleTexture(XY plane) * BlendWeights.Z +
  SampleTexture(XZ plane) * BlendWeights.Y +
  SampleTexture(YZ plane) * BlendWeights.X
  → Output: Blended Color, Blended Normal

Usage: Drag into any world material. Set on rocks, cliffs, terrain blends.
Note: Costs 3x texture samples vs. UV mapping — use only where UV seams are visible.
```

### 尼亚加拉系统 — 地面冲击爆发
```
System Type: CPU Simulation (< 50 particles)
Emitter: Burst — 15–25 particles on spawn, 0 looping

Modules:
  Initialize Particle:
    Lifetime: Uniform(0.3, 0.6)
    Scale: Uniform(0.5, 1.5)
    Color: From Surface Material parameter (dirt/stone/grass driven by Material ID)

  Initial Velocity:
    Cone direction upward, 45° spread
    Speed: Uniform(150, 350) cm/s

  Gravity Force: -980 cm/s²

  Drag: 0.8 (friction to slow horizontal spread)

  Scale Color/Opacity:
    Fade out curve: linear 1.0 → 0.0 over lifetime

Renderer:
  Sprite Renderer
  Texture: T_Particle_Dirt_Atlas (4×4 frame animation)
  Blend Mode: Translucent — budget: max 3 overdraw layers at peak burst

Scalability:
  High: 25 particles, full texture animation
  Medium: 15 particles, static sprite
  Low: 5 particles, no texture animation
```

### PCG 图 — 森林人口
```
PCG Graph: PCG_ForestPopulation

Input: Landscape Surface Sampler
  → Density: 0.8 per 10m²
  → Normal filter: slope < 25° (exclude steep terrain)

Transform Points:
  → Jitter position: ±1.5m XY, 0 Z
  → Random rotation: 0–360° Yaw only
  → Scale variation: Uniform(0.8, 1.3)

Density Filter:
  → Poisson Disk minimum separation: 2.0m (prevents overlap)
  → Biome density remap: multiply by Biome density texture sample

Exclusion Zones:
  → Road spline buffer: 5m exclusion
  → Player path buffer: 3m exclusion
  → Hand-placed actor exclusion radius: 10m

Static Mesh Spawner:
  → Weights: Oak (40%), Pine (35%), Birch (20%), Dead tree (5%)
  → All meshes: Nanite enabled
  → Cull distance: 60,000 cm

Parameters exposed to level:
  - GlobalDensityMultiplier (0.0–2.0)
  - MinSeparationDistance (1.0–5.0m)
  - EnableRoadExclusion (bool)
```

### 着色器复杂性审核（虚幻）
```markdown

### Material Review: [Material Name]

**Shader Model**: [ ] DefaultLit  [ ] Unlit  [ ] Subsurface  [ ] Custom
**Domain**: [ ] Surface  [ ] Post Process  [ ] Decal

Instruction Count (from Stats window in Material Editor)
  Base Pass Instructions: ___
  Budget: < 200 (mobile), < 400 (console), < 800 (PC)

Texture Samples
  Total samples: ___
  Budget: < 8 (mobile), < 16 (console)

Static Switches
  Count: ___ (each doubles permutation count — approve every addition)

Material Functions Used: ___
Material Instances: [ ] All variation via MI  [ ] Master modified directly — BLOCKED

Quality Switch Tiers Defined: [ ] High  [ ] Medium  [ ] Low
```

### Niagara 可扩展性配置
```
Niagara Scalability Asset: NS_ImpactDust_Scalability

Effect Type → Impact (triggers cull distance evaluation)

High Quality (PC/Console high-end):
  Max Active Systems: 10
  Max Particles per System: 50

Medium Quality (Console base / mid-range PC):
  Max Active Systems: 6
  Max Particles per System: 25
  → Cull: systems > 30m from camera

Low Quality (Mobile / console performance mode):
  Max Active Systems: 3
  Max Particles per System: 10
  → Cull: systems > 15m from camera
  → Disable texture animation

Significance Handler: NiagaraSignificanceHandlerDistance
  (closer = higher significance = maintained at higher quality)
```

### 高级能力

### 基材材质系统（UE5.3+）
- 从旧的着色模型系统迁移到 Substrate 以进行多层材质创作
- 作者具有显式层堆叠的基材板：岩石上污垢上的湿涂层，物理正确且性能良好
- 使用 Substrate 的体积雾板来参与材质中的介质 — 取代自定义的次表面散射解决方法
- 在运送到控制台之前，使用 Substrate Complexity 视口模式分析 Substrate 材料的复杂性

### 先进的尼亚加拉系统
- 在 Niagara 中构建用于类流体粒子动力学的 GPU 模拟阶段：邻居查询、压力、速度场
- 使用 Niagara 的数据接口系统查询模拟中的物理场景数据、网格表面和音频频谱
- 实施 Niagara 模拟阶段进行多通道模拟：平流→碰撞→在每帧的单独通道中解析
- 创建通过参数集合接收游戏状态的 Niagara 系统，以实现对游戏玩法的实时视觉响应

### 路径追踪和虚拟生产
- 配置路径追踪器以进行离线渲染和电影质量验证：验证流明近似值是否可接受
- 构建影片渲染队列预设，以在整个团队中实现一致的离线渲染输出
- 实施 OCIO (OpenColorIO) 颜色管理，以在编辑器和渲染输出中实现正确的颜色科学
- 设计适用于实时流明和路径跟踪离线渲染的照明装置，无需双重维护

### PCG 高级模式
- 构建 PCG 图表来查询参与者的游戏标签以驱动环境人口：不同的标签 = 不同的生物群系规则
- 实现递归 PCG：使用一个图的输出作为另一个图的输入样条线/曲面
- 为可破坏环境设计运行时 PCG 图：几何形状更改后重新运行填充
- 构建 PCG 调试实用程序：在编辑器视口中可视化点密度、属性值和禁区边界
