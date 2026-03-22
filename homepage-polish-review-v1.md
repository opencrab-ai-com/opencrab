# OpenCrab 官网首页审美校准 v1

日期：2026-03-22  
角色：审美设计师 / Design  
审阅对象：`/Users/sky/Desktop/OpenCrabTeams/Case1`

## 总体判断

这版首页的结构方向是对的：叙事顺序清楚，产品截图也足够早出现，已经不是“空壳 landing page”。

真正拖完成度的不是大方向，而是三类问题：

- 有些 intended polish 没真正落到样式层，页面里仍有未收口的“开发中结构”
- 表面层太多，卡片、阴影、边框都在同时发声，导致高级感被稀释
- 移动端虽然没坏，但首屏和卡片节奏还偏重，离正式官网还有一轮压缩

## 高优先级问题

### 1. JSX 已经加了新结构，但对应样式没有补齐

涉及位置：

- [`components/home-page.tsx:73`](/Users/sky/Desktop/OpenCrabTeams/Case1/components/home-page.tsx#L73)
- [`components/home-page.tsx:197`](/Users/sky/Desktop/OpenCrabTeams/Case1/components/home-page.tsx#L197)
- [`components/home-page.tsx:287`](/Users/sky/Desktop/OpenCrabTeams/Case1/components/home-page.tsx#L287)

缺失类名：

- `ambientBackdrop`
- `ambientBackdropHeader`
- `ambientBackdropWave`
- `ambientBackdropWaveCoral`
- `ambientBackdropWaveBlue`
- `ambientBackdropGrid`
- `scenarioCompare`
- `scenarioTone`
- `scenarioToneNow`
- `screenshotCardFeatured`

判断：

- 这不是“可再优化”的小问题，而是直接影响质感落地的实现缺口
- Hero 背景氛围层、场景区“之前 / 现在”结构、截图区主次关系都已经写进 JSX，但因为 CSS 缺席，页面会退回默认块状排布
- 这类问题最容易让页面看起来像“开发版”

直接修正：

- 在 [`app/globals.css`](/Users/sky/Desktop/OpenCrabTeams/Case1/app/globals.css) 里补齐上述类名
- 如果这轮不想做完整样式，至少先删除这些类对应结构，避免半成品直接露出

### 2. 页面表面层过多，所有卡片都在抢同一级别注意力

涉及位置：

- [`app/globals.css:328`](/Users/sky/Desktop/OpenCrabTeams/Case1/app/globals.css#L328)
- [`app/globals.css:472`](/Users/sky/Desktop/OpenCrabTeams/Case1/app/globals.css#L472)

判断：

- `stageFrame`、`floatingCard`、`softCard`、`scenarioCard`、`screenshotCard`、`installPanel` 现在共用同一套玻璃感背景、边框和阴影
- 结果是 Hero、能力卡、场景卡、FAQ、安装区都差不多亮，页面缺少真正的主次
- 高级感不是“所有块都精致”，而是“只有该强的地方强”

直接修正：

- Hero 主截图和安装 CTA 保留较强阴影
- 普通卡片改为更平的暖白底 + 更轻边框，去掉大阴影
- `sectionTint` 的白色夹层再弱一点，不要每段都像一张独立海报

### 3. 首屏信息已经够了，不该再继续加第四层解释

涉及位置：

- [`components/home-page.tsx:66`](/Users/sky/Desktop/OpenCrabTeams/Case1/components/home-page.tsx#L66)
- [`components/home-page.tsx:98`](/Users/sky/Desktop/OpenCrabTeams/Case1/components/home-page.tsx#L98)
- [`components/home-page.tsx:111`](/Users/sky/Desktop/OpenCrabTeams/Case1/components/home-page.tsx#L111)

判断：

- 当前首屏已经有 eyebrow、H1、副标题、CTA、pill、heroMeta、主截图、两个浮层卡
- 信息本身没错，但层数已经偏多
- 对官网首屏来说，这会让“简洁、大气”的感受被削弱

直接修正：

- `heroMeta` 建议删掉，或者并入副标题最后半句
- 桌面端保留两个浮层卡没问题，但移动端应该只留一个
- Hero 中所有辅助标签统一只保留一套，不要既有 pill 又有多层浮卡说明

### 4. 背景纹理和装饰信号稍多，开始往“设计稿感”滑

涉及位置：

- [`app/globals.css:46`](/Users/sky/Desktop/OpenCrabTeams/Case1/app/globals.css#L46)
- [`app/globals.css:52`](/Users/sky/Desktop/OpenCrabTeams/Case1/app/globals.css#L52)
- [`app/globals.css:314`](/Users/sky/Desktop/OpenCrabTeams/Case1/app/globals.css#L314)

判断：

- 页面底层已经有大面积径向渐变、全局网格纹理、Hero 自带光晕
- 如果再叠氛围层、截图框、section tint，就会从“克制”走到“有点用力”
- OpenCrab 更适合一种安静的纸感背景，不适合全页都在显露设计笔触

直接修正：

- 删掉 `body::before` 的全局网格纹理，保留轻背景渐变即可
- Hero 的发光范围再收小一点，避免侵入文字区
- 把装饰集中在首屏，后续 section 更平静

### 5. 字体方向对了，但中文高级感还没真正稳定

涉及位置：

- [`pages/_app.tsx:6`](/Users/sky/Desktop/OpenCrabTeams/Case1/pages/_app.tsx#L6)
- [`app/globals.css:234`](/Users/sky/Desktop/OpenCrabTeams/Case1/app/globals.css#L234)

判断：

- 现在只加载了 `Instrument Sans` 和 `Instrument Serif` 的 latin 子集
- 页面主内容是中文，所以真正落在用户眼里的标题字体，仍主要依赖本机宋体回退
- 这会导致不同机器上的“高级感”不稳定

直接修正：

- 明确一套中文标题字体方案，再决定是否自托管
- 如果这轮不加字体文件，就统一朝系统宋体方向收，不要假设每台机器都有理想效果
- 标题的 `letter-spacing` 现在略激进，中文大标题可放宽到 `-0.03em` 左右

## 移动端判断

移动端目前没有结构性崩坏，但还不够“收”。

关键问题：

- Hero 区信息层过多，首屏会显得重
- `button { width: 100%; }` 会把 CTA 变成两条长条，动作是清楚的，但产品感偏普通
- Hero 浮层改为纵向堆叠后，容易像三张卡片连续堆在一起，而不是一个完整舞台

直接修正：

- 移动端只保留主截图 + 一个浮层卡
- 次按钮不要强制全宽，可改为 `width: auto` + `align-self: flex-start`
- section 上下间距保持，但每张卡的内边距可以再降 2px 到 4px

## 哪些地方最像“开发版”

最明显的三个信号：

1. JSX 有结构，CSS 没跟上，导致 intended polish 没落地
2. 几乎每个区块都用了同级别的卡片语气，像组件堆叠而不是完成的官网节奏
3. 字体、背景、浮层、截图、按钮都在发声，缺少最后一轮取舍

## 推荐的最小修正顺序

1. 先补齐缺失类名样式，尤其是 `ambientBackdrop`、`scenarioCompare`、`screenshotCardFeatured`
2. 再把阴影、边框、section tint 收轻一档
3. 删除或并入 `heroMeta`，压缩 Hero 信息层
4. 移动端首屏只留一个浮层卡，次按钮取消全宽
5. 再决定是否补中文标题字体素材

## 仍缺素材

当前最缺的不是更多代码，而是两类素材：

- 一张更适合 Hero 舞台的主截图裁切版本
- 一套真正可上线的氛围层素材，替代当前占位式背景思路

没有这两样，页面可以上线测试，但还不够像正式官网。
