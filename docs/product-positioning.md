# Product Positioning

更新时间：2026-03-23

这份文档用于回答 3 个问题：

1. `OpenCrab` 到底是什么产品，而不是什么
2. 它和 `OpenClaw`、`Codex`、`Claude Cowork` 这类产品的关系是什么
3. 按“顶级开源项目 + 商业级产品”的标准，`OpenCrab` 现在的优势、短板和边界分别在哪里

说明：

- 下面对外部产品的判断，基于 `2026-03-23` 可公开访问的官方资料，以及当前 `OpenCrab` 仓库实现
- `优势 / 劣势` 是产品判断，不是对外部产品官方定位的复述
- 这些比较会随外部产品快速演化而变化，因此更适合拿来说明 `OpenCrab` 的产品选择，而不是做永久结论

## 一句话定位

`OpenCrab` 是一个中文优先、本地优先、chat-native 的开源 AI 工作台。

它不是把“会写代码的智能体”单独包装成一个 CLI，也不是只做纯 SaaS 聊天界面，而是试图把：

- 聊天
- 本地执行
- 智能体
- 团队协作
- 渠道接入
- 定时任务
- 技能扩展

收进同一个产品表面里，让普通用户也能用，而不要求先适应终端、工作流编排、插件生态或复杂部署术语。

## OpenCrab 是什么

### 产品形态

- 一个以聊天为主入口的 Web 工作台
- 一个本地优先的 AI runtime 外壳
- 一个把“对话、执行、渠道、调度、协作”放在一起的统一产品面
- 一个可以逐步长成商业产品的开源项目，而不只是研发脚手架

### 核心特征

- 中文优先：默认语言、文案、心智和页面组织都优先服务中文用户
- 本地优先：运行时数据、附件、浏览器 profile、渠道配置默认不进仓库
- chat-native：不是先让用户搭 agent graph，而是从“发一句话”开始
- 非终端优先：普通用户可以在网页里完成大部分主链路
- 能力统一：对话、渠道、任务、技能、团队模式不是四套割裂产品

### 它不是什么

- 不是“多模型大卖场”
- 不是“只面向开发者的终端代理”
- 不是“只有研究演示价值的 agent demo”
- 不是“纯云端闭源 SaaS 的克隆版”

## 当前产品能力地图

按用户真正能感知的结果来分，`OpenCrab` 当前能力主要分成 6 层：

### 1. 对话与执行

- 流式回复
- 历史对话与文件夹
- 浏览器能力接入
- 图片 / 文件上传与文本抽取
- 默认语言、模型、推理强度、权限模式配置

### 2. 智能体与 Team Mode

- 系统智能体与自定义智能体
- 智能体详情与角色设定
- 从智能体直接发起对话
- Team Room 创建与成员选择
- 项目经理式推进、检查点、运行恢复

### 3. 渠道

- Telegram webhook 接入
- 飞书长连接接入
- 远程 chat 与本地对话绑定
- 渠道入站到本地对话再到渠道回推的闭环

### 4. 定时任务

- 从页面创建任务
- 暂停、恢复、立即执行
- 结果回流到对话或团队房间
- 把“长期任务”收进统一工作台

### 5. 技能

- 技能目录浏览
- 状态启停
- 自定义技能条目
- 让能力扩展不只停留在 prompt

### 6. 本地运行与产品治理

- 本地运行时目录隔离
- 附件 allowlist
- JSON store 原子写入
- CI、基础测试、文档、隐私与运维说明

## 为什么会有 OpenCrab

如果只看“会不会调模型”“会不会跑工具”，今天已经有很多强产品。

`OpenCrab` 想解决的不是“让世界上再多一个智能体”，而是下面这几个产品空档：

- 很多强 agent 产品偏终端或偏工程师，不够 chat-native，也不够普通用户友好
- 很多聊天产品表面很好，但对本地执行、渠道、任务、协作的统一不够深
- 很多 agent 项目能力很强，但产品表面、信息架构、中文体验、默认心智不够稳定
- 很多商业产品很好用，但不开源、不本地优先、可控性不够高

所以 `OpenCrab` 选择的是一条相对少见的路线：

- 产品表面先向 `ChatGPT` 靠近
- 执行能力向强 agent 靠近
- 交互门槛向普通用户降低
- 可控性向开源、本地优先、自托管方向保留

## 技术路线对产品定位的影响

当前 `OpenCrab` 的技术路线，本质上是在服务上面的产品定位：

- `Next.js + React`：优先保证 Web 产品表面与页面迭代速度
- 本地 runtime home：保证附件、会话、渠道状态、浏览器状态都能留在本机
- SDK + 本地执行桥：把底层 agent 能力接进产品，而不是只做静态聊天
- 渠道 / 任务 / Team Mode / Skills：让产品不是“一个对话页”，而是一个工作台
- 模块化单体重构方向：逐步把原型期代码收紧成可持续演进的产品架构

更细的实现细节见：

- [Architecture](./architecture.md)
- [Development Guide](./development.md)
- [隐私与数据边界](./privacy-and-data.md)
- [运维与排障](./operations.md)

## 与参考产品的关系

## 1. 相比 OpenClaw

基于公开资料，`OpenClaw` 更强调“多入口 + 单内核”的 runtime 设计、Gateway 控制平面、安全边界、审批、自动化与插件化扩展。

官方资料参考：

- [OpenClaw 首页](https://openclawlab.com/en/)
- [OpenClaw 系统架构](https://openclawlab.com/zh-cn/docs/concepts/system-architecture/)
- [OpenClaw 安全配置](https://openclawlab.com/zh-cn/docs/gateway/security/)
- [OpenClaw 执行审批](https://openclawlab.com/zh-cn/docs/tools/exec-approvals//)

### OpenCrab 相对更强的地方

- 更接近聊天产品，而不是系统 runtime 产品
- 页面结构更容易让普通用户理解
- 中文默认心智更明确
- 对话、团队模式、渠道、定时任务、技能被收进同一个 UI 里，产品感更强
- 更适合做“ChatGPT 风格工作台”的产品迭代

### OpenCrab 相对更弱的地方

- 安全边界、审批、网关隔离、远程访问治理明显不如 OpenClaw 硬
- 自动化、控制平面、运维模型、插件治理成熟度不如 OpenClaw
- 渠道面更窄，工程化强度还不够
- 当前还没有 OpenClaw 那种“把运行时当成核心产品”的深度

### 结论

如果你的重点是：

- 多入口统一接入
- Gateway 安全边界
- 更强的自动化 / 控制平面 / 运维治理

那 OpenClaw 的产品思路更完整。

如果你的重点是：

- 中文优先
- 聊天主入口
- 更像产品而不是中枢 runtime
- 把执行、团队、任务、渠道收在一个工作台里

那 `OpenCrab` 的方向更鲜明。

## 2. 相比 Codex CLI / App

公开资料显示，`Codex` 当前已经不只是 CLI，还包括桌面 app、云任务、Slack、SDK、IDE 集成和更强的多 agent 协作能力。

官方资料参考：

- [Codex is now generally available](https://openai.com/index/codex-now-generally-available/)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)

### OpenCrab 相对更强的地方

- 不要求用户把“终端”当主入口
- 更接近统一工作台，而不是偏工程/编码表面
- 把渠道、定时任务、技能、团队模式放进一个产品表面
- 对普通中文用户更友好，心智更轻

### OpenCrab 相对更弱的地方

- 编码深度、工作树、并行 agent 协调、原生生态整合明显不如 Codex
- 官方模型、官方工作流、官方 admin / analytics / enterprise control 不具备
- 对大型工程团队的可信度、成熟度、规模化治理能力仍有差距
- 多 surface 连续性不如官方体系完整

### 结论

`Codex` 更像“开发者与工程团队的原生 agent 平台”。  
`OpenCrab` 更像“把 agent 能力做成中文优先工作台产品”的尝试。

如果用户是重度工程团队、强依赖 worktree、强依赖官方生态与安全治理，`Codex` 明显更强。  
如果目标是把 agent 能力包装成更低门槛的产品体验，而不只服务工程师，`OpenCrab` 更有自己的空间。

## 3. 相比 Claude Cowork

公开资料显示，`Cowork` 是 Anthropic 放在 Claude Desktop 里的 agentic workspace，重点是知识工作、多步骤任务、桌面文件操作、Chrome 联动、插件、连接器和专业交付物。

官方资料参考：

- [Cowork Overview](https://claude.com/docs/cowork/overview)
- [Get started with Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork)
- [Cowork product page](https://claude.com/product/cowork)

### OpenCrab 相对更强的地方

- 开源、可改、可自托管
- Web 工作台形态更灵活，不绑定单一桌面 app
- 编码、渠道、定时任务、团队房间这几条产品线组合更特别
- 对“中文优先 + 本地优先 + 产品化工作台”的方向更明确

### OpenCrab 相对更弱的地方

- Cowork 在知识工作交付物、桌面文件工作流、连接器和插件包装上更成熟
- Cowork 的 polished output、桌面体验、知识工作场景讲述更完整
- Cowork 目前已经把“非编码知识工作”讲得很清楚，`OpenCrab` 这一层叙事还在补
- 在商业化包装、行业案例和产品完成度上，OpenCrab 还有明显差距

### 结论

`Cowork` 更偏“桌面知识工作 agent”。  
`OpenCrab` 更偏“聊天工作台 + 本地执行 + 团队协作 + 渠道/任务”的统一产品。

如果用户是桌面知识工作、文档整理、研究交付、连接器驱动型场景，Cowork 的方向更成熟。  
如果用户希望把聊天、执行、定时、渠道和多智能体协作整合到一个开源产品里，`OpenCrab` 更有差异化。

## 快速对比表

| 维度 | OpenCrab | OpenClaw | Codex | Claude Cowork |
| --- | --- | --- | --- | --- |
| 核心形态 | chat-native Web 工作台 | gateway / runtime 中枢 + 多入口 | 开发者 agent 平台（CLI / app / cloud / IDE） | 桌面 knowledge-work agent workspace |
| 主要用户 | 中文用户、普通用户、小团队、想要统一工作台的人 | 重自动化、多入口、强控制平面用户 | 工程师、工程团队、强编码场景 | 知识工作者、研究 / 文档 / 桌面任务用户 |
| 入口心智 | 对话优先 | Gateway / channels / tools | 终端、桌面、IDE、云任务 | Claude Desktop 里的任务模式 |
| 强项 | 中文优先、产品表面统一、渠道 + 任务 + Team Mode 组合 | 安全边界、控制平面、自动化、插件治理 | 编码深度、多 agent、worktree、官方生态 | 非编码知识工作、连接器、桌面文件任务、专业交付物 |
| 当前弱项 | 安全、数据层、可观测性、企业治理仍在补 | 产品表面更工程化、普通用户门槛更高 | 非工程普通用户门槛更高 | 开源和本地自控能力不如 OpenCrab，统一渠道/任务/团队工作台不是重点 |

## OpenCrab 当前最清晰的优势

- 中文优先的产品定位清楚
- 本地优先和开源属性同时成立
- 聊天主入口与执行能力结合得更自然
- 团队模式、渠道、定时任务、技能被放进同一产品表面，这个组合在同类产品里并不常见
- 更适合从“产品工作台”角度继续长，而不是只长成一个 CLI

## OpenCrab 当前最明显的短板

- 安全与权限体系还不够硬
- 可靠持久化还没升级到正式数据库层
- 自动化测试、E2E、可观测性还不够商业级
- 文档、截图、能力叙事刚开始收紧，外部认知仍不够完整
- Team Mode 和 runtime 底层架构仍在重构期

## 谁应该优先尝试 OpenCrab

- 想要一个更接近 `ChatGPT` 使用习惯的开源工作台
- 更习惯中文，不想从终端开始
- 同时需要对话、执行、团队协作、定时任务和渠道接入
- 希望后续能继续把它做成真正产品，而不只是工具集合

## 当前不适合谁

- 需要成熟多人权限体系和企业级审计的团队
- 把“超强代码代理”放在绝对第一优先级的工程组织
- 需要成熟数据库、云同步、正式部署与 SLA 的生产场景
- 需要极强自动化 / Gateway / 控制平面治理的场景

## 外部资料

### OpenClaw

- [OpenClaw Home](https://openclawlab.com/en/)
- [System Architecture](https://openclawlab.com/zh-cn/docs/concepts/system-architecture/)
- [Gateway Security](https://openclawlab.com/zh-cn/docs/gateway/security/)
- [Exec Approvals](https://openclawlab.com/zh-cn/docs/tools/exec-approvals//)

### OpenAI / Codex

- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [Codex is now generally available](https://openai.com/index/codex-now-generally-available/)

### Anthropic / Cowork

- [Cowork Overview](https://claude.com/docs/cowork/overview)
- [Get started with Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork)
- [Cowork product page](https://claude.com/product/cowork)
