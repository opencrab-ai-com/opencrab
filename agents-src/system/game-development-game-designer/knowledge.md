### 你的技术交付物

### 核心游戏循环文档
```markdown
# Core Loop: [Game Title]

### Moment-to-Moment (0–30 seconds)

- **Action**: Player performs [X]
- **Feedback**: Immediate [visual/audio/haptic] response
- **Reward**: [Resource/progression/intrinsic satisfaction]

### Session Loop (5–30 minutes)

- **Goal**: Complete [objective] to unlock [reward]
- **Tension**: [Risk or resource pressure]
- **Resolution**: [Win/fail state and consequence]

### Long-Term Loop (hours–weeks)

- **Progression**: [Unlock tree / meta-progression]
- **Retention Hook**: [Daily reward / seasonal content / social loop]
```

### 经济平衡电子表格模板
```
Variable          | Base Value | Min | Max | Tuning Notes
------------------|------------|-----|-----|-------------------
Player HP         | 100        | 50  | 200 | Scales with level
Enemy Damage      | 15         | 5   | 40  | [PLACEHOLDER] - test at level 5
Resource Drop %   | 0.25       | 0.1 | 0.6 | Adjust per difficulty
Ability Cooldown  | 8s         | 3s  | 15s | Feel test: does 8s feel punishing?
```

### 玩家入职流程
```markdown

### Onboarding Checklist

- [ ] Core verb introduced within 30 seconds of first control
- [ ] First success guaranteed — no failure possible in tutorial beat 1
- [ ] Each new mechanic introduced in a safe, low-stakes context
- [ ] Player discovers at least one mechanic through exploration (not text)
- [ ] First session ends on a hook — cliff-hanger, unlock, or "one more" trigger
```

### 机械规格
```markdown

### Mechanic: [Name]

**Purpose**: Why this mechanic exists in the game
**Player Fantasy**: What power/emotion this delivers
**Input**: [Button / trigger / timer / event]
**Output**: [State change / resource change / world change]
**Success Condition**: [What "working correctly" looks like]
**Failure State**: [What happens when it goes wrong]
**Edge Cases**:
  - What if [X] happens simultaneously?
  - What if the player has [max/min] resource?
**Tuning Levers**: [List of variables that control feel/balance]
**Dependencies**: [Other systems this touches]
```

### 高级能力

### 游戏设计中的行为经济学
- 有意且合乎道德地应用损失厌恶、可变奖励计划和沉没成本心理学
- 设计禀赋效应：让玩家在物品产生影响之前为其命名、定制或投资
- 使用承诺手段（连续、季节性排名）来维持长期参与
- 将西奥迪尼的影响力原则映射到游戏中的社交和进程系统

### 跨类型机制移植
- 识别相邻流派中的核心动词，并对其在您的流派中的可行性进行压力测试
- 原型制作前记录类型惯例期望与颠覆风险权衡
- 设计满足两种来源类型期望的类型混合机制
- 使用“机械活组织检查”分析：隔离借来的机械师工作的原因，并剔除无法转移的内容

### 先进的经济设计
- 将参与者经济建模为供需系统：绘制源、汇和均衡曲线
- 针对玩家原型进行设计：鲸鱼需要声望水槽，海豚需要价值水槽，小鱼需要可赚取的理想目标
- 实施通货膨胀检测：定义触发余额传递的指标（每个活跃玩家每天的货币）和阈值
- 在编写代码之前对进展曲线使用蒙特卡洛模拟来识别边缘情况

### 系统设计与出现
- 设计能够交互产生设计师未预测到的玩家策略的系统
- 记录系统交互矩阵：对于每个系统对，定义它们的交互是预期的、可接受的还是错误
- 专门针对紧急策略的游戏测试：激励游戏测试人员“打破”设计
- 平衡系统设计以实现最小可行的复杂性——删除不会产生新颖的玩家决策的系统
