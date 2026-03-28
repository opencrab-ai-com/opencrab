# OpenCrab 对 Channels 的重新思考：它不是移动端聊天入口，而是 Agents 的外部参与层

更新时间：2026-03-23

这篇文章想认真回答一个很容易被低估的问题：

`AI 产品里的 Channels，到底应该是什么？`

如果不认真想这个问题，渠道能力很容易被做成两种浅层东西：

- 一个“让你在手机上也能继续聊天”的补充入口
- 一个“把 Telegram / 飞书接进来”的技术集成页

这两种理解都不完全错，但都太浅。

它们没有回答真正重要的问题：

`为什么一个 AI 工作台需要渠道？`

对 `OpenCrab` 来说，这个问题并不只是接不接 Telegram、飞书，也不只是外部 IM 能不能收发消息。

它背后真正的问题是：

`当 Agent 和 Team 不再只是一轮对话，而是开始持续运行、持续推进、持续等待用户参与时，用户应该通过什么入口参与这些工作？`

这才是 Channels 真正的产品命题。

## 一句话结论

`OpenCrab` 的 Channels，不应该被定义成“移动端聊天入口”。

它更合适的定位是：

`Agents 与 Team 工作的外部参与层。`

它的作用不是简单把网页聊天搬到 Telegram 或飞书上，而是让：

- 用户
- 团队成员
- 客户
- 外部系统

都能在自己的原生沟通环境里，持续参与、触发、打断、审批、接收和推进 Agent 的工作。

换句话说：

`Channels` 在 `OpenCrab` 里不是“聊天增强功能”，而是“工作流外部入口层”。`

## 一、为什么“Channels = 移动端聊天补充”这个理解太浅

很多产品一提渠道，默认想法都是：

- 网页里可以聊
- 手机上不方便
- 所以接 Telegram / Slack / 飞书，让用户在外面也能聊

这当然是一个真实需求。

但如果 `Channels` 只停留在这里，它的价值会非常有限。

因为这种理解隐含着一个前提：

`产品的主体仍然是“即时对话”。`

而当你的产品开始拥有这些能力时，问题就变了：

- 定时任务会自动跑
- Team Room 会持续推进
- Agent 会在后台工作
- 系统会在某些节点等待用户确认
- 某些结果需要主动送达，而不是等用户回来查看

到了这个阶段，`Channels` 的作用就不再是“随时聊天”，而是：

`随时参与正在发生的工作。`

“聊天”只是参与方式之一，不是本体。

## 二、真正值得问的问题不是“在哪聊”，而是“谁如何参与正在运行的工作”

如果把 `OpenCrab` 的未来方向往前推一点，你会发现：

用户和系统之间的关系，已经不只是问答关系了。

用户会越来越多地面对这些场景：

- 某个 Team Room 在持续推进项目
- 某个定时任务每周都在继续产出
- 某个 Agent 在后台整理信息
- 某个 run 卡在审批点，正在等人拍板
- 某个渠道来源的客户还在追问

这时真正要解决的问题是：

### 1. 用户如何在不打开网页的情况下继续参与

比如：

- 补一句上下文
- 批准某步执行
- 打断错误方向
- 接住系统抛出来的问题

### 2. 外部的人如何参与工作，而不必进入 OpenCrab

比如：

- 客户在 Telegram 里继续问
- 同事在飞书里追一条进展
- 某个运营同学只想接收日报结果，不想进入系统后台

### 3. 系统如何把“需要人参与的时刻”送达到正确地方

比如：

- 任务完成了
- run 失败了
- team 卡住了
- 某个审批需要处理

这时候你就会发现：

`Channels` 不是“聊天入口”，而是“参与入口、注意力入口、交付出口”。`

## 三、OpenClaw 给了什么真正重要的启发

如果只看当前公开资料里，谁把“Channels 不只是聊天”这件事想得比较清楚，`OpenClaw` 是很值得研究的对象。

它的官方定义非常清楚：它不是一个单纯的 chat UI，而是一个把：

- channel ingress
- automation
- agent execution
- gateway security boundary

组合在一起的系统。

参考：

- [OpenClaw 官网](https://openclawlab.com/en/)
- [OpenClaw System Architecture](https://openclawlab.com/zh-cn/docs/concepts/system-architecture/)

这背后的关键判断是：

`外部世界进入 agent runtime，不应该是“UI 页面上的一个功能”，而应该是系统级入口层。`

### 1. OpenClaw 把 Channels 当 ingress / egress 层，而不是聊天页面

它的系统结构很清楚：

- 入口层：Channels、Webhooks、Cron
- 控制平面：Gateway
- 执行平面：Agent
- 能力层：Tools / Providers

这说明在 OpenClaw 里，Channels 的地位不是：

- “一个 Telegram 页面”

而是：

- “外部请求进入系统的正规入口”
- “系统结果离开系统的正规出口”

这点非常重要。

因为它直接把 `Channels` 从“产品小功能”提升成了“系统边界的一部分”。

### 2. OpenClaw 把 routing 当成渠道系统的核心

它的多 Agent 路由文档也说明了同样的思路：

- 不同 account / channel / peer 可以确定性路由到不同 agent
- 每个 agent 可以有独立 workspace、session、auth profile
- 渠道消息不是随便进一个大聊天池，而是进入某个明确执行上下文

参考：

- [OpenClaw Multi-Agent Routing](https://openclawlab.com/en/docs/concepts/multi-agent/)

这个产品层结论其实很深：

`Channels 的价值，不是多了一个说话的地方，而是把外部事件精准送进正确的工作单元。`

### 3. OpenClaw 同时把自动化、渠道、Agent 放在同一套 Gateway 视角下

这一点我认为尤其值得借鉴。

因为它隐含着一个更大的判断：

`用户消息、定时任务、外部 webhook，本质上都只是进入 agent runtime 的不同触发源。`

这个统一视角很强。

它意味着：

- Channels 不是独立孤岛
- Channels 和 Tasks、Automation 是同一层问题的不同表现

这对 `OpenCrab` 后面做统一工作流边界非常重要。

## 四、但 OpenClaw 的产品边界也很清楚：它更像 Gateway，而不是工作台

虽然我很认可 `OpenClaw` 的底层判断，但如果从产品角度看，它也有明显边界。

我的总结是：

`OpenClaw` 很强地回答了“外部消息如何进入系统”，但没有把“用户如何把渠道理解成工作台的一部分”放到最前面。

### 1. 它更偏 gateway-first，而不是 workspace-first

从产品表达上看，OpenClaw 更强调：

- routing
- gateway
- channel
- automation
- security boundary

这对 runtime 非常合理，但对普通用户来说，它更像一个系统平台，而不是一个围绕“工作对象”组织起来的工作台。

### 2. 它强在系统能力，不强在工作叙事

OpenClaw 非常清楚：

- 消息怎么进来
- 路由到哪
- 跑在哪
- 结果怎么送回去

但它并不天然强调这些更产品化的问题：

- 这个渠道消息属于哪个 ongoing work
- 用户是在参与对话，还是参与项目推进
- 某个飞书线程在产品里到底对应什么
- 用户为什么要在这里持续回来参与

也就是说，它强的是系统语义，不是工作叙事语义。

### 3. 它不一定天然适合普通用户产品表达

从系统设计看，`OpenClaw` 很成熟；  
但如果直接照搬到 `OpenCrab`，风险也很明显：

- 产品会变得太 infra
- 页面会更像配置中心
- 用户理解成本会上升
- Channels 会看起来像“通道管理”，而不是“参与工作”

所以对 `OpenCrab` 来说，`OpenClaw` 最值得借的不是页面形态，而是：

- ingress / egress 思维
- routing 思维
- security boundary 思维
- channel / task / automation 统一思维

而不是直接把前台做成一个 gateway dashboard。

## 五、OpenCrab 到底该怎么定义 Channels

我现在更明确的判断是：

`OpenCrab` 的 Channels，应该被定义成外部参与层。`

这里“参与”比“聊天”更重要。

### 我为什么强调“参与”

因为如果只强调“聊天”，Channels 的价值会被限制在：

- 说一句
- 回一句
- 在手机上用

而“参与”意味着更完整的动作集合：

- 触发
- 追问
- 打断
- 补充上下文
- 审批
- 接收结果
- 接收告警
- 推进下一步

这才更符合 `OpenCrab` 未来的形态。

## 六、我对 OpenCrab Channels 的正式产品定义

如果要把它写成一句正式产品定义，我会这样写：

`Channels 是 OpenCrab 的外部参与层，让用户、团队成员与外部系统在 Telegram、飞书等原生入口中，持续参与、触发、接收和推进 Agent / Team 的工作。`

这句话里最重要的不是 Telegram、飞书，而是这四个动作：

- 参与
- 触发
- 接收
- 推进

这四个动作决定了 Channels 在产品里的地位，不再只是“对话镜像”。

## 七、对 OpenCrab 来说，Channels 至少承担四种角色

## 1. Ingress

这是最基本的一层。

外部的人和系统，不必先进入 OpenCrab Web，就能把工作带进来。

比如：

- 用户在 Telegram 私聊里发一句需求
- 客户在飞书群里继续追问
- 外部系统通过 webhook 推送一个事件

这些都应该被理解成：

`把工作送进 OpenCrab。`

而不是：

`给聊天机器人发了一条消息。`

## 2. Ambient Collaboration

这是我觉得最容易被忽略、但最重要的一层。

真实工作不是只有“打开网页那一刻”才发生。

很多时候，人是在：

- 走路时
- 开会间隙
- 手机上
- 聊天窗口里

继续参与工作。

所以 Channels 的第二个角色，不是消息通道，而是：

`让人可以在自己的原生沟通环境里，持续参与正在运行的 Agent 工作。`

这和“移动端也能聊”不是一回事。

它更像：

- 让工作流从网页里溢出
- 让用户随时重新进入工作

## 3. Attention Layer

很多 Agent / Team 系统真正的问题不是不会做事，而是：

`不知道什么时候把用户拉回来。`

比如：

- 某个 run 失败了
- 某个 Team Room 卡住了
- 某个审批需要确认
- 某个任务有异常变化

这时 Channels 的价值不是“再开一个聊天入口”，而是：

`成为注意力回流层。`

也就是：

- 在需要人的时候，把人叫回来
- 不需要人的时候，不要打扰

这会和任务系统、审批系统、Team Mode 深度相关。

## 4. Delivery Layer

不是所有结果都应该留在 Web 里等人来看。

很多结果天然适合直接送达：

- 日报
- 简报
- 告警
- 总结
- 对外回复

所以 Channels 还应该承担一个出口角色：

`让 OpenCrab 的工作成果进入用户原本就在使用的沟通环境。`

这和“聊天”也不是一回事。

它更接近：

`交付。`

## 八、所以 OpenCrab 不应该是 channel-first，而应该是 workspace-first, channel-enabled

这是我认为和 OpenClaw 最大的产品分路。

`OpenClaw` 更像：

- gateway-first
- routing-first
- infra-first

而 `OpenCrab` 更适合：

- workspace-first
- task-aware
- team-aware
- channel-enabled

这意味着什么？

意味着在 `OpenCrab` 里：

- channel 不是一个独立宇宙
- channel 不是另一个聊天系统
- channel 不是简单镜像 Web 对话

它应该始终挂在某个工作对象上。

比如：

- 一个 conversation 的外部入口
- 一个 Team Room 的外部参与入口
- 一个任务的通知出口
- 一个审批流的回传入口

所以，`OpenCrab` 的关键不是“有多少渠道”，而是：

`这些渠道是否被正确地绑定到了工作对象。`

## 九、OpenCrab 当前做对了什么，还差什么

从现在的实现看，`OpenCrab` 已经有了一个很正确的基础：

- 远程 chat 会自动绑定到 OpenCrab conversation
- 渠道消息不会进入一个独立的外部聊天池
- 渠道状态、事件、绑定关系都已持久化

对应代码：

- [Channel dispatcher](../../lib/channels/dispatcher.ts)
- [Channel activity panel](../../components/channels/channel-activity-panel.tsx)
- [Architecture: Channel Flow](../engineering/architecture.md)

这说明方向已经不是“做一个 Telegram Bot 页面”，而是在往工作对象绑定走。

但距离理想中的产品定位，还差几层关键语义：

### 1. 现在更像“渠道接入”，还不是“外部参与层”

当前页面更偏：

- 配置
- 状态
- webhook
- 最近事件

这很重要，但还不够说明：

- 这个渠道如何参与 ongoing work
- 它是 conversation 入口，还是 Team Room 入口
- 它承担的是交付、审批还是协作

### 2. 缺少“工作对象绑定”的更强表达

现在已有绑定，但表达仍然偏技术。

理想状态下，用户应该更清楚地看到：

- 这个 Telegram 对话当前绑定的是哪个工作空间
- 这个飞书入口会唤醒哪个 Team
- 这个渠道是否主要用于提问、接收结果、还是审批

### 3. 缺少对“需要人参与时刻”的产品表达

如果 Channels 真的是外部参与层，那它不能只负责收发消息。

它还要能表达：

- 这里有个待你确认的事项
- 这里有个 Team 正在等你补信息
- 这里有个任务产生了异常

也就是说，它要和：

- Tasks
- Team Mode
- Approval
- Alerts

连成一套。

### 4. 缺少对 delivery 角色的正式定位

现在渠道更多还是“对话入口”。

但未来它还应该是：

- 报告投递出口
- 任务结果投递出口
- Team 更新通知出口

这件事一旦成立，Channels 在产品里的地位会明显上升。

## 十、OpenCrab 接下来在 Channels 上要做什么，为什么

我认为 `OpenCrab` 后面应该坚持一个很明确的方向：

`把 Channels 从“渠道接入页”升级成“外部参与层”。`

这件事不是文案调整，而是整个产品理解方式要变。

## 1. 把 Channels 和工作对象正式绑定

Channels 不该只显示：

- Telegram 已连接
- 飞书已连接
- 最近事件

它还应该更清楚地表达：

- 绑定了哪些 conversations
- 哪些 Team Room 可以被这个 channel 唤醒
- 哪些任务结果会从这个 channel 送达

## 2. 把 Channels 和 Team Mode / Tasks 连起来

如果一个产品同时有：

- Team Mode
- Tasks
- Channels

但这三者是分裂的，那产品就会显得很碎。

真正有价值的是：

- task 到点运行后，可以把结果投递到 channel
- Team Room 卡住时，可以通过 channel 追问用户
- 用户可以在 channel 里批准、补充、打断

这时 Channels 才真正成为“工作参与层”。

## 3. 把“注意力”作为 Channels 的正式使命

我认为这是 `OpenCrab` 和很多产品可以拉开差距的一点。

不是所有消息都值得进入 channel。

值得进入 channel 的，通常是这些时刻：

- 需要人
- 有异常
- 有值得立刻知道的结果
- 有需要继续推进的下一步

这意味着后面应该引入更成熟的：

- delivery policy
- notification policy
- attention queue

Channels 才不会变成噪音源。

## 4. 保持 workspace-first 的产品边界

最重要的是，`OpenCrab` 不能为了 Channels 把自己做成一个 gateway dashboard。

因为 `OpenCrab` 的产品根基仍然应该是：

- 对话
- Team Room
- Tasks
- 工作上下文

Channels 是这些对象的外部入口层，而不是要反过来成为整个产品的主中心。

这也是我认为 `OpenCrab` 和 `OpenClaw` 最好的分工方式：

- 学它的 ingress / routing / security 思路
- 但坚持自己的 workspace-first 产品表达

## 十一、我的最终判断

如果让我把这篇文章压缩成一句话，我会这样说：

`OpenCrab` 的 Channels，不应该被设计成“让人在 Telegram / 飞书里也能聊天”，而应该被设计成“让人能够在自己的原生沟通环境里持续参与 Agent 与 Team 工作”的外部参与层。

这也是为什么我很认同 `OpenClaw` 的一些底层判断，但不建议直接复制它的前台产品表达。

`OpenClaw` 告诉我们：

- Channels 是系统边界的一部分
- Routing 很重要
- Gateway 视角很重要
- Channel / Task / Automation 可以统一看成外部触发源

但 `OpenCrab` 还要再往前走一步：

- 把 Channels 明确绑定到工作对象
- 把 Channels 变成参与层、注意力层、交付层
- 让用户感觉自己不是在“另一个聊天入口”里，而是在“继续参与同一个工作”

如果这条路走对了，`Channels` 对 `OpenCrab` 的价值就不会停留在“支持 Telegram / 飞书”，而会成为产品从“聊天工作台”走向“持续运行的 Agent 工作系统”的关键组成部分。

## 参考资料

- [OpenClaw 官网](https://openclawlab.com/en/)
- [OpenClaw System Architecture](https://openclawlab.com/zh-cn/docs/concepts/system-architecture/)
- [OpenClaw Multi-Agent Routing](https://openclawlab.com/en/docs/concepts/multi-agent/)
- [Channel dispatcher](../../lib/channels/dispatcher.ts)
- [Channel activity panel](../../components/channels/channel-activity-panel.tsx)
- [Engineering architecture](../engineering/architecture.md)
