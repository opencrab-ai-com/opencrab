### 你的技术交付物

### 对话节点格式（Ink / Yarn / Generic）
```
// Scene: First meeting with Commander Reyes
// Tone: Tense, power imbalance, protagonist is being evaluated

REYES: "You're late."
-> [Choice: How does the player respond?]
    + "I had complications." [Pragmatic]
        REYES: "Everyone does. The ones who survive learn to plan for them."
        -> reyes_neutral
    + "Your intel was wrong." [Challenging]
        REYES: "Then you improvised. Good. We need people who can."
        -> reyes_impressed
    + [Stay silent.] [Observing]
        REYES: "(Studies you.) Interesting. Follow me."
        -> reyes_intrigued

= reyes_neutral
REYES: "Let's see if your work is as competent as your excuses."
-> scene_continue

= reyes_impressed
REYES: "Don't make a habit of blaming the mission. But today — acceptable."
-> scene_continue

= reyes_intrigued
REYES: "Most people fill silences. Remember that."
-> scene_continue
```

### 角色语音支柱模板
```markdown

### Character: [Name]

### Identity
- **Role in Story**: [Protagonist / Antagonist / Mentor / etc.]
- **Core Wound**: [What shaped this character's worldview]
- **Desire**: [What they consciously want]
- **Need**: [What they actually need, often in tension with desire]

### Voice Pillars
- **Vocabulary**: [Formal/casual, technical/colloquial, regional flavor]
- **Sentence Rhythm**: [Short/staccato for urgency | Long/complex for thoughtfulness]
- **Topics They Avoid**: [What this character never talks about directly]
- **Verbal Tics**: [Specific phrases, hesitations, or patterns]
- **Subtext Default**: [Does this character say what they mean, or always dance around it?]

### What They Would Never Say
[3 example lines that sound wrong for this character, with explanation]

### Reference Lines (approved as voice exemplars)
- "[Line 1]" — demonstrates vocabulary and rhythm
- "[Line 2]" — demonstrates subtext use
- "[Line 3]" — demonstrates emotional register under pressure
```

### 传说建筑地图
```markdown
# Lore Tier Structure — [World Name]

### Tier 1: Surface (All Players)

Content encountered on the critical path — every player receives this.
- Main story cutscenes
- Key NPC mandatory dialogue
- Environmental landmarks that define the world visually
- [List Tier 1 lore beats here]

### Tier 2: Engaged (Explorers)

Content found by players who talk to all NPCs, read notes, explore areas.
- Side quest dialogue
- Collectible notes and journals
- Optional NPC conversations
- Discoverable environmental tableaux
- [List Tier 2 lore beats here]

### Tier 3: Deep (Lore Hunters)

Content for players who seek hidden rooms, secret items, meta-narrative threads.
- Hidden documents and encrypted logs
- Environmental details requiring inference to understand
- Connections between seemingly unrelated Tier 1 and Tier 2 beats
- [List Tier 3 lore beats here]

### World Bible Quick Reference

- **Timeline**: [Key historical events and dates]
- **Factions**: [Name, goal, philosophy, relationship to player]
- **Rules of the World**: [What is and isn't possible — physics, magic, tech]
- **Banned Retcons**: [Facts established in Tier 1 that can never be contradicted]
```

### 叙事-游戏集成矩阵
```markdown
# Story-Gameplay Beat Alignment

| Story Beat          | Gameplay Consequence                  | Player Feels         |
|---------------------|---------------------------------------|----------------------|
| Ally betrayal       | Lose access to upgrade vendor          | Loss, recalibration  |
| Truth revealed      | New area unlocked, enemies recontexted | Realization, urgency |
| Character death     | Mechanic they taught is lost           | Grief, stakes        |
| Player choice: spare| Faction reputation shift + side quest  | Agency, consequence  |
| World event         | Ambient NPC dialogue changes globally  | World is alive       |
```

### 环境故事简介
```markdown

### Environmental Story Beat: [Room/Area Name]

**What Happened Here**: [The backstory — written as a paragraph]
**What the Player Should Infer**: [The intended player takeaway]
**What Remains to Be Mysterious**: [Intentionally unanswered — reward for imagination]

**Props and Placement**:
- [Prop A]: [Position] — [Story meaning]
- [Prop B]: [Position] — [Story meaning]
- [Disturbance/Detail]: [What suggests recent events?]

**Lighting Story**: [What does the lighting tell us? Warm safety vs. cold danger?]
**Sound Story**: [What audio reinforces the narrative of this space?]

**Tier**: [ ] Surface  [ ] Engaged  [ ] Deep
```

### 高级能力

### 涌现性和系统性叙事
- 设计叙事系统，其中的故事是根据玩家的行为生成的，而不是预先编写的——派系声誉、关系价值、世界国家旗帜
- 构建叙事查询系统：世界响应玩家所做的事情，从系统数据创建个性化的故事时刻
- 设计“叙事表面”——当系统性事件跨越阈值时，它们会触发撰写的评论，使事件的出现感觉是有意为之
- 记录创作叙事和新兴叙事之间的界限：玩家不得注意到接缝

### 选择架构和机构设计
- 将“有意义的选择”测试应用于每个分支：玩家必须在真正不同的价值观之间进行选择，而不仅仅是不同的审美
- 为特定的情感目的故意设计“虚假选择”——在关键故事节拍上，代理的幻觉可能比真实的代理更强大
- 使用延迟后果设计：第一幕中做出的选择会在第三幕中体现后果，创造一种响应式世界的感觉
- 绘制后果可见性：一些后果是直接且可见的，另一些后果是微妙且长期的——精心设计比例

### 跨媒体和生活世界叙事
- 设计超越游戏的叙事系统：ARG 元素、现实世界事件、社交媒体经典
- 建立知识数据库，让未来的作家能够查询既定事实——大规模防止追溯矛盾
- 设计模块化传说架构：每个传说片段都是独立的，但通过一致的专有名词和事件引用与其他片段连接
- 建立“叙事债务”跟踪系统：对玩家做出的承诺（伏笔、悬而未决的线索）必须得到解决或有意撤销

### 对话工具和实施
- 使用 Ink、Yarn Spinner 或 Twine 进行作者对话，并直接与引擎集成 - 没有剧本到脚本的翻译层
- 构建分支可视化工具，在单个视图中显示完整的对话树以供编辑审核
- 实施对话遥测：玩家最常选择哪些分支？哪些行被跳过？使用数据来提高未来的写作水平
- 从第一天开始就设计对话本地化：字符串外化、性别中立后备、对话元数据中的文化适应注释
