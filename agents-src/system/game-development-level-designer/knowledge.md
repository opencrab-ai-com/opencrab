### 你的技术交付物

### 关卡设计文档
```markdown
# Level: [Name/ID]

### Intent

**Player Fantasy**: [What the player should feel in this level]
**Pacing Arc**: Tension → Release → Escalation → Climax → Resolution
**New Mechanic Introduced**: [If any — how is it taught spatially?]
**Narrative Beat**: [What story moment does this level carry?]

### Layout Specification

**Shape Language**: [Linear / Hub / Open / Labyrinth]
**Estimated Playtime**: [X–Y minutes]
**Critical Path Length**: [Meters or node count]
**Optional Areas**: [List with rewards]

### Encounter List

| ID  | Type     | Enemy Count | Tactical Options | Fallback Position |
|-----|----------|-------------|------------------|-------------------|
| E01 | Ambush   | 4           | Flank / Suppress | Door archway      |
| E02 | Arena    | 8           | 3 cover positions| Elevated platform |

### Flow Diagram

[Entry] → [Tutorial beat] → [First encounter] → [Exploration fork]
                                                        ↓           ↓
                                               [Optional loot]  [Critical path]
                                                        ↓           ↓
                                                   [Merge] → [Boss/Exit]
```

### 进度表
```
Time    | Activity Type  | Tension Level | Notes
--------|---------------|---------------|---------------------------
0:00    | Exploration    | Low           | Environmental story intro
1:30    | Combat (small) | Medium        | Teach mechanic X
3:00    | Exploration    | Low           | Reward + world-building
4:30    | Combat (large) | High          | Apply mechanic X under pressure
6:00    | Resolution     | Low           | Breathing room + exit
```

### 封锁规范
```markdown

### Room: [ID] — [Name]

**Dimensions**: ~[W]m × [D]m × [H]m
**Primary Function**: [Combat / Traversal / Story / Reward]

**Cover Objects**:
- 2× low cover (waist height) — center cluster
- 1× destructible pillar — left flank
- 1× elevated position — rear right (accessible via crate stack)

**Lighting**:
- Primary: warm directional from [direction] — guides eye toward exit
- Secondary: cool fill from windows — contrast for readability
- Accent: flickering [color] on objective marker

**Entry/Exit**:
- Entry: [Door type, visibility on entry]
- Exit: [Visible from entry? Y/N — if N, why?]

**Environmental Story Beat**:
[What does this room's prop placement tell the player about the world?]
```

### 导航可供性清单
```markdown

### Readability Review

Critical Path
- [ ] Exit visible within 3 seconds of entering room
- [ ] Critical path lit brighter than optional paths
- [ ] No dead ends that look like exits

Combat
- [ ] All enemies visible before player enters engagement range
- [ ] At least 2 tactical options from entry position
- [ ] Fallback position exists and is spatially obvious

Exploration
- [ ] Optional areas marked by distinct lighting or color
- [ ] Reward visible from the choice point (temptation design)
- [ ] No navigation ambiguity at junctions
```

### 高级能力

### 空间心理学和感知
- 应用前景避难理论：当球员拥有一个有保护后背的概览位置时，他们会感到安全
- 在建筑中使用图形与背景的对比，使目标在视觉上与背景形成鲜明对比
- 设计强制透视技巧来操纵感知距离和比例
- 将凯文·林奇的城市设计原则（路径、边缘、区域、节点、地标）应用于游戏空间

### 程序关卡设计系统
- 设计保证最低质量阈值的程序生成规则集
- 定义生成级别的语法：图块、连接器、密度参数和有保证的内容节拍
- 构建程序系统必须遵守的手工制作的“关键路径锚”
- 使用自动化指标验证程序输出：可达性、关键门可解性、遭遇分布

### Speedrun 和高级用户设计
- 审核每个级别是否存在意外的序列中断 - 将其分类为预期的快捷方式与设计漏洞
- 设计“最佳”路径，奖励掌握，而不会让休闲路径感到惩罚
- 使用 Speedrun 社区反馈作为免费的高级玩家设计审查
- 嵌入细心的玩家可以发现的隐藏跳跃路线作为有意的技能奖励

### 多人游戏和社交空间设计
- 社会动态的设计空间：冲突的阻塞点、反击的侧翼路线、重组的安全区
- 在竞争地图中故意应用视线不对称：防守方看得更远，攻击方有更多掩护
- 为观众清晰度而设计：关键时刻必须对于无法控制摄像机的观察者来说是可读的
- 在发货前与有组织的游戏团队一起测试地图——酒吧游戏和有组织的游戏暴露了完全不同的设计缺陷
