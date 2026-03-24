# OpenCrab 对 gstack 的调研：它不是一个技能仓库，而是一套 AI 软件工厂运行时

更新时间：2026-03-25

这篇文章不是功能说明，也不是集成方案。

它想认真回答 5 个问题：

1. `gstack` 到底是什么，它解决的是哪一类问题
2. 它最强的能力来自哪里，是 skills 本身，还是运行时架构
3. 它和 `OpenCrab` 现有能力有哪些重合与冲突
4. 它适不适合被直接接入 `OpenCrab`
5. 如果不直接接，`OpenCrab` 最值得从它身上学什么

## 一句话结论

`gstack` 不是一个“值得拿来装几个 skill”的仓库。

它更像：

`一套带持久浏览器、流程编排、安装器、护栏机制和多宿主适配的 AI 软件工厂运行时。`

所以对 `OpenCrab` 来说，最好的使用方式不是“整包接入”，而是：

- 把它当成上游架构参考
- 拆着学习它最强的几部分
- 只吸收那些适合 `OpenCrab` 产品方向的能力

## 一、gstack 到底是什么

从 [gstack 的 README](https://github.com/garrytan/gstack) 来看，它的目标不是提供几个零散技能，而是把 `Claude Code` 变成一个“虚拟工程团队”。

它覆盖的角色和流程非常完整：

- 产品与需求澄清
- CEO / PM 视角规划
- 工程方案评审
- 代码 review
- QA
- ship / release
- retro

它的主张不是：

`给模型多一点知识。`

而是：

`给模型一套工程组织方式。`

这也是为什么它的价值不在单个 `SKILL.md`，而在整条流程如何被组织起来。

## 二、gstack 最强的部分，不是 skills，而是运行时

如果只看表层，很容易把 `gstack` 理解成：

- 一组 slash commands
- 一套 skills
- 一些 prompt 模板

但从它的 [ARCHITECTURE 文档](https://raw.githubusercontent.com/garrytan/gstack/main/ARCHITECTURE.md) 来看，它真正的护城河主要有 4 个。

### 1. 持久浏览器守护进程

`gstack` 的核心基础设施之一，是一个长期存活的 Chromium daemon。

它的特点是：

- 首次启动大约 3 秒
- 后续每次命令调用大约 100-200ms
- 保留 cookies、tabs、localStorage、登录态

这件事非常关键。

因为一旦系统要做连续 QA、回归测试、带登录态页面检查、复杂多步浏览器流程，冷启动浏览器的方案很快就会变笨重。

`gstack` 的浏览器不是一个附属工具，而是一个长期在线的执行器。

### 2. 流程化的软件交付链路

`gstack` 不是“谁想用哪个 skill 就点哪个”。

它强调的是一条相互衔接的工程流水线：

`office-hours -> plan -> implement -> review -> qa -> ship -> retro`

前一步的产物，会成为后一步的输入。

这意味着它更像 workflow system，而不是 skill launcher。

### 3. 文档不是手写维护，而是由源码生成

`gstack` 专门提到它使用 `SKILL.md.tmpl` 和命令元数据来生成最终文档，目的是避免：

- 文档和命令行为漂移
- 技能说明过时
- 宿主适配版本之间不一致

这个设计很值得重视。

因为当 skill 数量越来越多时，最大的风险之一往往不是“功能做不出来”，而是“说明和真实行为不再一致”。

### 4. 面向多宿主的安装与分发

它不是只围绕 Claude Code 设计。

README 和 setup 里明确提到它支持：

- Claude Code
- Codex
- Gemini CLI
- Kiro

而且不是简单说一句“理论支持”，而是有具体的宿主安装逻辑，例如 `setup --host codex` 会生成面向 Codex 的运行目录和技能版本。

这说明它本质上已经在做：

`一个 AI workflow runtime 的宿主适配层。`

## 三、gstack 和 OpenCrab 的重合点

如果站在 `OpenCrab` 的视角看，`gstack` 和我们并不是完全无关，甚至有不少重合。

### 1. 都在处理 AI 工作流，而不是单轮聊天

`OpenCrab` 也早就不只是一个“用户发一句、系统答一句”的产品。

我们已经在往这些方向走：

- skills
- tasks
- browser runtime
- channels
- team mode

而 `gstack` 恰好也是在回答：

`如何让 AI 持续推进真实工作。`

### 2. 都需要浏览器能力

`OpenCrab` 现在已经有浏览器接入和自动化能力。  
`gstack` 则把浏览器直接升格成了核心 runtime。

这说明我们和它关注的问题是同一类，只是成熟度和组织方式不同。

### 3. 都在探索多角色 / 多阶段协作

`OpenCrab` 现在在思考：

- team mode
- task graph
- learning loop
- 更像真实团队的数字组织

而 `gstack` 已经把一部分工程协作角色和阶段具体产品化了。

这点尤其值得研究。

## 四、gstack 和 OpenCrab 的冲突点

虽然有很多可学之处，但它和 `OpenCrab` 之间也有明显冲突，不能简单直接接。

### 1. 它会强烈地“接管默认工作方式”

例如在 README 里，它会明确建议把浏览器类工作统一交给自己的 `/browse`。

这意味着：

- 它不是一个安静附加的 skill
- 它会改变 agent 的默认行为
- 它会和宿主自己的浏览器 / MCP / QA 策略发生竞争

对 `OpenCrab` 来说，这种级别的接入已经不是“推荐技能”，而是“运行策略覆盖”。

### 2. 它面向的是工程交付，不是普通用户

`gstack` 的核心受众明显是：

- 技术 founder
- builder
- 开发者
- 工程团队

而 `OpenCrab` 近阶段明确强调过：

- 普通用户优先
- 非程序员优先
- 商业、内容、写作、运营、社媒等场景优先

这两个目标人群不完全一致。

### 3. 它依赖的不只是 skills

从仓库结构和文档上看，`gstack` 的有效性并不只来自 skills 目录。

它还依赖：

- setup
- 宿主适配逻辑
- 浏览器 daemon
- 命令体系
- 运行时状态与生成物

这就决定了：

`gstack` 不是一个适合按“单 skill 安装”方式消费的项目。`

## 五、OpenCrab 不适合直接整包接入 gstack

基于上面的判断，我认为：

`OpenCrab` 现阶段不适合直接整包接入 gstack。`

原因不是它不够强，而是它太完整了。

整包接入的代价包括：

- 引入新的工作流主张
- 与现有浏览器 runtime 重叠
- 改变技能体系边界
- 给普通用户引入过重的工程心智负担

换句话说，`gstack` 更像一个平行系统，而不是一个轻量扩展件。

## 六、OpenCrab 最值得从 gstack 学什么

虽然不适合整包接，但它确实有几个部分非常值得借鉴。

## 1. 持久浏览器 session 架构

这是我认为最值得优先学习的一点。

很多 AI 产品都有浏览器能力，但真正决定体验差异的，不是“能不能打开页面”，而是：

- 能否保留登录态
- 能否连续执行
- 能否低延迟复用
- 能否把浏览器当长期运行资源而不是一次性工具

`gstack` 在这个方向上明显做得很成熟。

## 2. 工件驱动的流程编排

`gstack` 的很多能力之所以不只是 prompt 模板，是因为它依赖“前一步产物进入后一步”。

这个思路非常适合 `OpenCrab` 后续的：

- tasks
- team mode
- 项目推进
- 周期复盘

与其做很多孤立 skill，不如做能传递工件的工作流。

## 3. 文档生成机制

随着 `OpenCrab` 的 skills 越来越多，手工维护说明文档的成本和风险都会上升。

`gstack` 那种“从源码生成技能文档”的方式，很值得吸收。

它能解决两个长期问题：

- 技能文档和真实行为漂移
- 多宿主版本文档不一致

## 4. 宿主适配安装器

`gstack` 的一个重要启发是：

`真正成熟的 skill / workflow 生态，最终一定要有宿主适配层。`

不是所有仓库都应该被当作一个普通 skill 目录来消费。

有些上游项目本质上更像：

- bundle
- workflow suite
- plugin runtime

这对 `OpenCrab` 很重要，因为后面如果我们真的要支持更复杂生态，单一 `SKILL.md` 模型会不够。

## 七、如果未来真的要兼容 gstack，最小接入面应该是什么

如果以后 `OpenCrab` 真要吸收 `gstack`，我认为最合理的顺序不是“整包导入”，而是：

### 第一阶段：学浏览器 runtime

只吸收：

- 持久浏览器 session
- token / state file / idle timeout 这类守护进程设计

这部分最通用，复用价值最高。

### 第二阶段：学流程与工件

吸收：

- review
- qa
- ship
- retro

但不是照搬命令，而是把它们变成更适合 `OpenCrab` 的工作流节点。

### 第三阶段：再考虑 bundle / plugin 模型

只有当 `OpenCrab` 自己的 skill、task、team runtime 已经足够稳定，才值得讨论：

- 是否引入 workflow bundle
- 是否支持更重型的上游生态

也就是说，`gstack` 更适合当路线参考，而不是当前版本的直接集成对象。

## 八、最终结论

`gstack` 不是一个“该不该安装”的问题，而是一个“该不该学习它的系统设计”的问题。

我的判断是：

- 值得认真研究
- 值得拆着学
- 不值得现阶段整包接入

如果只用一句话概括这次调研结论，就是：

`gstack` 不是一个技能仓库，它是一套 AI 软件工厂运行时；OpenCrab 最应该借鉴的是它的浏览器、流程和安装架构，而不是直接把它当成推荐 skill 引进来。`
