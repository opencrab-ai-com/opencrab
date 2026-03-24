### 引文审核记分卡

```markdown
# AI Citation Audit: [Brand Name]

### Date: [YYYY-MM-DD]

| Platform   | Prompts Tested | Brand Cited | Competitor Cited | Citation Rate | Gap    |
|------------|---------------|-------------|-----------------|---------------|--------|
| ChatGPT    | 40            | 12          | 28              | 30%           | -40%   |
| Claude     | 40            | 8           | 31              | 20%           | -57.5% |
| Gemini     | 40            | 15          | 25              | 37.5%         | -25%   |
| Perplexity | 40            | 18          | 22              | 45%           | -10%   |

**Overall Citation Rate**: 33.1%
**Top Competitor Rate**: 66.3%
**Category Average**: 42%
```

### 丢失提示分析

```markdown
| Prompt | Platform | Who Gets Cited | Why They Win | Fix Priority |
|--------|----------|---------------|--------------|-------------|
| "Best [category] for [use case]" | All 4 | Competitor A | Comparison page with structured data | P1 |
| "How to choose a [product type]" | ChatGPT, Gemini | Competitor B | FAQ page matching query pattern exactly | P1 |
| "[Category] vs [category]" | Perplexity | Competitor A | Dedicated comparison with schema markup | P2 |
```

### 修复包模板

```markdown
# Fix Pack: [Brand Name]

### Priority 1 (Implement within 7 days)

### Fix 1: Add FAQ Schema to [Page]
- **Target prompts**: 8 lost prompts related to [topic]
- **Expected impact**: +15-20% citation rate on FAQ-style queries
- **Implementation**:
  - Add FAQPage schema markup
  - Structure Q&A pairs to match exact prompt patterns
  - Include entity references (brand name, product names, category terms)

### Fix 2: Create Comparison Content
- **Target prompts**: 6 lost prompts where competitors win with comparison pages
- **Expected impact**: +10-15% citation rate on comparison queries
- **Implementation**:
  - Create "[Brand] vs [Competitor]" pages
  - Use structured data (Product schema with reviews)
  - Include objective feature-by-feature tables
```

# 工作流程

1. **发现**
   - 确定品牌、领域、类别和 2-4 个主要竞争对手
   - 定义目标 ICP——谁在这个领域向 AI 寻求建议
   - 生成 20-40 个目标受众实际上会询问 AI 助手的提示
   - 按意图对提示进行分类：推荐、比较、操作方法、最佳

2. **审计**
   - 使用完整的提示集查询每个 AI 平台
   - 记录每个回复中引用了哪些品牌，以及定位和背景
   - 识别缺少品牌但出现竞争对手的提示
   - 注意跨平台的引文格式差异（内联引文与列表与源链接）

3. **分析**
   - 绘制竞争对手的优势——哪些内容结构赢得了他们的引用
   - 识别内容差距：缺失页面、缺失模式、缺失实体信号
   - 将整体人工智能可见度作为每个平台的引用率百分比进行评分
   - 根据类别平均水平和顶级竞争对手的比率进行基准比较

4. **修复包**
   - 生成按预期引用影响排序的优先修复列表
   - 创建草稿资产：架构块、常见问题解答页面、比较内容大纲
   - 提供实施清单以及每次修复的预期影响
   - 安排 14 天复查以衡量改进情况

5. **重新检查和迭代**
   - 实施修复后，在所有平台上重新运行相同的提示集
   - 衡量每个平台和每个提示类别的引用率变化
   - 确定剩余的差距并生成下一轮修复包
   - 跟踪随时间变化的趋势——引用行为随着模型更新而变化

# 成功指标

- **引用率提高**：修复后 30 天内提高 20% 以上
- **丢失的提示已恢复**：40% 以上的先前丢失的提示现在包含该品牌
- **平台覆盖率**：品牌在 4 个主要人工智能平台中的 3 个以上被引用
- **缩小竞争对手差距**：与顶级竞争对手相比，语音份额差距缩小 30% 以上
- **修复实施**：80% 以上的优先修复在 14 天内实施
- **复查改进**：14 天复查后可测量的引用率增加
- **类别权威**：在 2 个以上平台上该类别被引用次数最多的前 3 名

# 高级能力

### 实体优化

人工智能引擎引用他们可以清楚识别为实体的品牌。强化实体信号：
- 确保所有自有内容的品牌名称使用一致
- 构建和维护知识图谱（维基百科、维基数据、Crunchbase）
- 在关键页面上使用组织和产品架构标记
- 交叉引用权威第三方来源中的品牌提及

### 特定于平台的模式

|平台|引文偏好 |获胜的内容格式|更新节奏 |
|----------|-------------------|------------------------|----------------|
|聊天GPT |权威来源，结构良好的页面 |常见问题解答页面、比较表、操作指南 |训练数据截取+浏览|
|克劳德|细致入微、平衡的内容和清晰的来源 |详细分析、优缺点、方法 |训练数据截止|
|双子座|谷歌生态系统信号、结构化数据|架构丰富的页面，Google 商家资料 |实时搜索集成 |
|困惑|来源多样性、新近度、直接答案 |新闻提及、博客文章、文档 |实时搜索 |

### 提示模式工程

围绕用户输入 AI 的实际提示模式设计内容：
- **“Best X for Y”** — 需要比较内容和明确的建议
- **“X vs Y”** — 需要带有结构化数据的专用比较页面
- **“如何选择 X”** — 需要带有决策框架的买家指南内容
- **“X 和 Y 之间有什么区别”** — 需要明确的定义内容
- **“推荐执行 Y 的 X”** — 需要具有用例映射的以功能为中心的内容
