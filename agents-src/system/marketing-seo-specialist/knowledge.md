### 技术交付物

### 技术 SEO 审核模板
```markdown
# Technical SEO Audit Report

### Crawlability & Indexation

### Robots.txt Analysis
- Allowed paths: [list critical paths]
- Blocked paths: [list and verify intentional blocks]
- Sitemap reference: [verify sitemap URL is declared]

### XML Sitemap Health
- Total URLs in sitemap: X
- Indexed URLs (via Search Console): Y
- Index coverage ratio: Y/X = Z%
- Issues: [orphaned pages, 404s in sitemap, non-canonical URLs]

### Crawl Budget Optimization
- Total pages: X
- Pages crawled/day (avg): Y
- Crawl waste: [parameter URLs, faceted navigation, thin content pages]
- Recommendations: [noindex/canonical/robots directives]

### Site Architecture & Internal Linking

### URL Structure
- Hierarchy depth: Max X clicks from homepage
- URL pattern: [domain.com/category/subcategory/page]
- Issues: [deep pages, orphaned content, redirect chains]

### Internal Link Distribution
- Top linked pages: [list top 10]
- Orphaned pages (0 internal links): [count and list]
- Link equity distribution score: X/10

### Core Web Vitals (Field Data)

| Metric | Mobile | Desktop | Target | Status |
|--------|--------|---------|--------|--------|
| LCP    | X.Xs   | X.Xs    | <2.5s  | ✅/❌  |
| INP    | Xms    | Xms     | <200ms | ✅/❌  |
| CLS    | X.XX   | X.XX    | <0.1   | ✅/❌  |

### Structured Data Implementation

- Schema types present: [Article, Product, FAQ, HowTo, Organization]
- Validation errors: [list from Rich Results Test]
- Missing opportunities: [recommended schema for content types]

### Mobile Optimization

- Mobile-friendly status: [Pass/Fail]
- Viewport configuration: [correct/issues]
- Touch target spacing: [compliant/issues]
- Font legibility: [adequate/needs improvement]
```

### 关键词研究框架
```markdown
# Keyword Strategy Document

### Topic Cluster: [Primary Topic]

### Pillar Page Target
- **Keyword**: [head term]
- **Monthly Search Volume**: X,XXX
- **Keyword Difficulty**: XX/100
- **Current Position**: XX (or not ranking)
- **Search Intent**: [Informational/Commercial/Transactional/Navigational]
- **SERP Features**: [Featured Snippet, PAA, Video, Images]
- **Target URL**: /pillar-page-slug

### Supporting Content Cluster
| Keyword | Volume | KD | Intent | Target URL | Priority |
|---------|--------|----|--------|------------|----------|
| [long-tail 1] | X,XXX | XX | Info | /blog/subtopic-1 | High |
| [long-tail 2] | X,XXX | XX | Commercial | /guide/subtopic-2 | Medium |
| [long-tail 3] | XXX | XX | Transactional | /product/landing | High |

### Content Gap Analysis
- **Competitors ranking, we're not**: [keyword list with volumes]
- **Low-hanging fruit (positions 4-20)**: [keyword list with current positions]
- **Featured snippet opportunities**: [keywords where competitor snippets are weak]

### Search Intent Mapping
- **Informational** (top-of-funnel): [keywords] → Blog posts, guides, how-tos
- **Commercial Investigation** (mid-funnel): [keywords] → Comparisons, reviews, case studies
- **Transactional** (bottom-funnel): [keywords] → Landing pages, product pages
```

### 页面优化清单
```markdown
# On-Page SEO Optimization: [Target Page]

### Meta Tags

- [ ] Title tag: [Primary Keyword] - [Modifier] | [Brand] (50-60 chars)
- [ ] Meta description: [Compelling copy with keyword + CTA] (150-160 chars)
- [ ] Canonical URL: self-referencing canonical set correctly
- [ ] Open Graph tags: og:title, og:description, og:image configured
- [ ] Hreflang tags: [if multilingual — specify language/region mappings]

### Content Structure

- [ ] H1: Single, includes primary keyword, matches search intent
- [ ] H2-H3 hierarchy: Logical outline covering subtopics and PAA questions
- [ ] Word count: [X words] — competitive with top 5 ranking pages
- [ ] Keyword density: Natural integration, primary keyword in first 100 words
- [ ] Internal links: [X] contextual links to related pillar/cluster content
- [ ] External links: [X] citations to authoritative sources (E-E-A-T signal)

### Media & Engagement

- [ ] Images: Descriptive alt text, compressed (<100KB), WebP/AVIF format
- [ ] Video: Embedded with schema markup where relevant
- [ ] Tables/Lists: Structured for featured snippet capture
- [ ] FAQ section: Targeting People Also Ask questions with concise answers

### Schema Markup

- [ ] Primary schema type: [Article/Product/HowTo/FAQ]
- [ ] Breadcrumb schema: Reflects site hierarchy
- [ ] Author schema: Linked to author entity with credentials (E-E-A-T)
- [ ] FAQ schema: Applied to Q&A sections for rich result eligibility
```

### 链接建设策略
```markdown
# Link Authority Building Plan

### Current Link Profile

- Domain Rating/Authority: XX
- Referring Domains: X,XXX
- Backlink quality distribution: [High/Medium/Low percentages]
- Toxic link ratio: X% (disavow if >5%)

### Link Acquisition Tactics

### Digital PR & Data-Driven Content
- Original research and industry surveys → journalist outreach
- Data visualizations and interactive tools → resource link building
- Expert commentary and trend analysis → HARO/Connectively responses

### Content-Led Link Building
- Definitive guides that become reference resources
- Free tools and calculators (linkable assets)
- Original case studies with shareable results

### Strategic Outreach
- Broken link reclamation: [identify broken links on authority sites]
- Unlinked brand mentions: [convert mentions to links]
- Resource page inclusion: [target curated resource lists]

### Monthly Link Targets

| Source Type | Target Links/Month | Avg DR | Approach |
|-------------|-------------------|--------|----------|
| Digital PR  | 5-10              | 60+    | Data stories, expert commentary |
| Content     | 10-15             | 40+    | Guides, tools, original research |
| Outreach    | 5-8               | 50+    | Broken links, unlinked mentions |
```

### 学习与记忆

- **算法模式识别**：跟踪与已确认的 Google 更新相关的排名波动
- **内容表现模式**：了解哪些内容格式、长度和结构在每个细分市场中排名最佳
- **技术基线保留**：记住站点架构、CMS 限制以及已解决/未解决的技术债务
- **关键字格局演变**：监控搜索趋势变化、新兴查询和季节性模式
- **竞争情报**：跟踪竞争对手的内容发布、链接获取和排名随时间的变化

### 高级能力

### 国际搜索引擎优化
- 多语言、多区域网站的Hreflang实施策略
- 针对文化搜索行为差异的国家/地区特定关键词研究
- 国际网站架构决策：ccTLD 与子目录与子域
- 地理定位配置和 Search Console 国际定位设置

### 程序化搜索引擎优化
- 基于模板的页面生成，用于可扩展的长尾关键字定位
- 大型电子商务和市场网站的动态内容优化
- 适用于拥有数千个页面的网站的自动内部链接系统
- 大型库存的索引管理策略（分面导航、分页）

### 算法恢复
- 通过流量模式分析和手动操作审核来识别处罚
- 内容质量修复以恢复有用内容和核心更新
- 链接配置文件清理并拒绝文件管理以进行与链接相关的处罚
- E-E-A-T 改进计划：作者简介、编辑政策、来源引用

### 精通搜索控制台和分析
- 用于大规模性能分析的高级 Search Console API 查询
- 用于精确关键字和页面分割的自定义正则表达式过滤器
- Looker Studio / 创建仪表板以实现自动 SEO 报告
- Search Analytics 与 GA4 进行数据协调以实现全渠道归因

### AI搜索&SGE适配
- 针对人工智能生成的搜索概述和引文进行内容优化
- 结构化数据策略可提高人工智能搜索功能的可见性
- 将内容定位为值得信赖的人工智能培训来源的权威建设策略
- 监控和适应超越传统蓝色链接的不断发展的搜索界面
