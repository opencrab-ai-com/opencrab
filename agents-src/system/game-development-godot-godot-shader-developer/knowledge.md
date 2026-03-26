### 你的技术交付物

### 2D CanvasItem 着色器 - 精灵轮廓
```glsl
shader_type canvas_item;

uniform vec4 outline_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float outline_width : hint_range(0.0, 10.0) = 2.0;

void fragment() {
    vec4 base_color = texture(TEXTURE, UV);

    // Sample 8 neighbors at outline_width distance
    vec2 texel = TEXTURE_PIXEL_SIZE * outline_width;
    float alpha = 0.0;
    alpha = max(alpha, texture(TEXTURE, UV + vec2(texel.x, 0.0)).a);
    alpha = max(alpha, texture(TEXTURE, UV + vec2(-texel.x, 0.0)).a);
    alpha = max(alpha, texture(TEXTURE, UV + vec2(0.0, texel.y)).a);
    alpha = max(alpha, texture(TEXTURE, UV + vec2(0.0, -texel.y)).a);
    alpha = max(alpha, texture(TEXTURE, UV + vec2(texel.x, texel.y)).a);
    alpha = max(alpha, texture(TEXTURE, UV + vec2(-texel.x, texel.y)).a);
    alpha = max(alpha, texture(TEXTURE, UV + vec2(texel.x, -texel.y)).a);
    alpha = max(alpha, texture(TEXTURE, UV + vec2(-texel.x, -texel.y)).a);

    // Draw outline where neighbor has alpha but current pixel does not
    vec4 outline = outline_color * vec4(1.0, 1.0, 1.0, alpha * (1.0 - base_color.a));
    COLOR = base_color + outline;
}
```

### 3D 空间着色器 — 溶解
```glsl
shader_type spatial;

uniform sampler2D albedo_texture : source_color;
uniform sampler2D dissolve_noise : hint_default_white;
uniform float dissolve_amount : hint_range(0.0, 1.0) = 0.0;
uniform float edge_width : hint_range(0.0, 0.2) = 0.05;
uniform vec4 edge_color : source_color = vec4(1.0, 0.4, 0.0, 1.0);

void fragment() {
    vec4 albedo = texture(albedo_texture, UV);
    float noise = texture(dissolve_noise, UV).r;

    // Clip pixel below dissolve threshold
    if (noise < dissolve_amount) {
        discard;
    }

    ALBEDO = albedo.rgb;

    // Add emissive edge where dissolve front passes
    float edge = step(noise, dissolve_amount + edge_width);
    EMISSION = edge_color.rgb * edge * 3.0;  // * 3.0 for HDR punch
    METALLIC = 0.0;
    ROUGHNESS = 0.8;
}
```

### 3D 空间着色器 - 水面
```glsl
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform sampler2D normal_map_a : hint_normal;
uniform sampler2D normal_map_b : hint_normal;
uniform float wave_speed : hint_range(0.0, 2.0) = 0.3;
uniform float wave_scale : hint_range(0.1, 10.0) = 2.0;
uniform vec4 shallow_color : source_color = vec4(0.1, 0.5, 0.6, 0.8);
uniform vec4 deep_color : source_color = vec4(0.02, 0.1, 0.3, 1.0);
uniform float depth_fade_distance : hint_range(0.1, 10.0) = 3.0;

void fragment() {
    vec2 time_offset_a = vec2(TIME * wave_speed * 0.7, TIME * wave_speed * 0.4);
    vec2 time_offset_b = vec2(-TIME * wave_speed * 0.5, TIME * wave_speed * 0.6);

    vec3 normal_a = texture(normal_map_a, UV * wave_scale + time_offset_a).rgb;
    vec3 normal_b = texture(normal_map_b, UV * wave_scale + time_offset_b).rgb;
    NORMAL_MAP = normalize(normal_a + normal_b);

    // Depth-based color blend (Forward+ / Mobile renderer required for DEPTH_TEXTURE)
    // In Compatibility renderer: remove depth blend, use flat shallow_color
    float depth_blend = clamp(FRAGCOORD.z / depth_fade_distance, 0.0, 1.0);
    vec4 water_color = mix(shallow_color, deep_color, depth_blend);

    ALBEDO = water_color.rgb;
    ALPHA = water_color.a;
    METALLIC = 0.0;
    ROUGHNESS = 0.05;
    SPECULAR = 0.9;
}
```

### 全屏后处理（CompositorEffect — Forward+）
```gdscript
# post_process_effect.gd — must extend CompositorEffect
@tool
extends CompositorEffect

func _init() -> void:
    effect_callback_type = CompositorEffect.EFFECT_CALLBACK_TYPE_POST_TRANSPARENT

func _render_callback(effect_callback_type: int, render_data: RenderData) -> void:
    var render_scene_buffers := render_data.get_render_scene_buffers()
    if not render_scene_buffers:
        return

    var size := render_scene_buffers.get_internal_size()
    if size.x == 0 or size.y == 0:
        return

    # Use RenderingDevice for compute shader dispatch
    var rd := RenderingServer.get_rendering_device()
    # ... dispatch compute shader with screen texture as input/output
    # See Godot docs: CompositorEffect + RenderingDevice for full implementation
```

### 着色器性能审核
```markdown

### Godot 着色器评论：[效果名称]

**着色器类型**： [ ] canvas_item [ ] 空间 [ ] 粒子
**渲染器目标**： [ ] 向前+ [ ] 移动 [ ] 兼容性

纹理样本（片段阶段）
数量：___（移动预算：对于不透明材料，每个片段 ≤ 6）

制服暴露给检查员
[ ] 所有制服都有提示（hint_range、source_color、hint_normal 等）
[ ] 着色器主体中没有魔法数字

丢弃/Alpha 剪辑
[ ] 放弃在不透明空间着色器中使用的内容？  — FLAG：在移动设备上转换为 Alpha Scissor
[ ] canvas_item alpha 仅通过 COLOR.a 处理？

SCREEN_TEXTURE 使用过吗？
[ ] 是 — 触发帧缓冲区复制。这种效果合理吗？
[ ] 不

动态循环？
[ ] 是 - 验证循环计数在移动设备上是恒定的或有界的
[ ] 不

兼容性渲染器安全吗？
[ ] 是 [ ] 否 — 在着色器注释标题中记录需要哪个渲染器
```

### 高级能力

### RenderingDevice API（计算着色器）
- 使用 `RenderingDevice` 调度计算着色器以进行 GPU 端纹理生成和数据处理
- 从 GLSL 计算源创建 `RDShaderFile` 资产并通过 `RenderingDevice.shader_create_from_spirv()` 编译它们
- 使用计算实现 GPU 粒子模拟：将粒子位置写入纹理，在粒子着色器中对该纹理进行采样
- 使用 GPU 分析器分析计算着色器调度开销 — 批量调度以分摊每次调度的 CPU 成本

### 高级视觉着色器技术
- 在 GDScript 中使用 `VisualShaderNodeCustom` 构建自定义 VisualShader 节点 — 将复杂的数学公开为艺术家可重用的图形节点
- 在 VisualShader 中实现程序纹理生成：FBM 噪声、Voronoi 模式、梯度斜坡 — 全部都在图表中
- 设计封装 PBR 图层混合的 VisualShader 子图，以便艺术家无需理解数学即可进行堆叠
- 使用VisualShader节点组系统构建材质库：将节点组导出为`.res`文件以供跨项目复用

### Godot 4 Forward+ 高级渲染
- 在 Forward+ 透明着色器中使用 `DEPTH_TEXTURE` 实现软粒子和交叉淡入淡出
- 通过使用由表面法线驱动的 UV 偏移对 `SCREEN_TEXTURE` 进行采样来实现屏幕空间反射
- 使用空间着色器中的 `fog_density` 输出构建体积雾效果 - 适用于内置体积雾通道
- 在空间着色器中使用 `light_vertex()` 函数在执行每像素着色之前修改每顶点光照数据

### 后处理流水线
- 链接多个 `CompositorEffect` 通道以进行多阶段后处理：边缘检测 → 膨胀 → 复合
- 使用深度缓冲区采样将全屏幕空间环境光遮挡 (SSAO) 效果实现为自定义 `CompositorEffect`
- 使用在后处理着色器中采样的 3D LUT 纹理构建颜色分级系统
- 设计性能分层的后处理预设：完全（向前+）、中等（移动、选择性效果）、最小（兼容性）
