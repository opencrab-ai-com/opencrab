# OpenCrab 的系统 Agents 构建策略：从 6 个角色到一个可生长的角色库

更新时间：2026-03-25

OpenCrab 这次对系统 Agents 做的，不只是“再多加一些角色”，而是把底层构建策略换了一遍。

过去更像是维护几张写死在代码里的角色卡片。  
现在，我们把系统 Agents 当成一个长期可生长的角色目录系统来做。

这篇文档想回答三个问题：

1. 为什么要改。
2. 现在的构建策略是什么。
3. 为什么我们特别感谢 [agency-agents](https://github.com/msitarzewski/agency-agents)。

## 为什么这次要重做

如果系统里只有 3 个、6 个角色，把配置写死在代码里还能勉强撑住。

但一旦角色库开始扩张，这种方式很快会出问题：

- 角色内容和运行逻辑混在一起，维护成本高
- 新增一个角色，要改 seed、改代码、改展示，很容易漏
- 角色一多，产品里没有分组，用户会直接被角色数量淹没
- 外部优秀角色库就算能借鉴，也很难系统化迁进来
- 内容一旦出现双份存储，就会开始漂移

所以我们这次不是简单“加角色”，而是先把系统 Agents 的生产方式改掉。

## 新的构建策略

我们现在把系统 Agents 收束成三层，但只有一份事实源：

```text
group registry
  -> agents-src/system-groups.json

authoring source
  -> agents-src/system/<slug>/
     agent.yaml + 5 section markdown

runtime compilation
  -> OpenCrab 启动时直接读取源码目录并在内存里编译
```

这里最重要的一点是：

不再提交 `config/system-agents/*.json` 这类重复运行时产物。

系统运行时直接消费源码目录，避免出现“改了 md，但 json 没同步”的双份漂移问题。

### 1. 人维护的是目录式源码

每个系统 Agent 现在都是一个目录：

```text
agents-src/system/<slug>/
  agent.yaml
  soul.md
  responsibility.md
  tools.md
  user.md
  knowledge.md
```

这里面：

- `agent.yaml` 负责元信息
- 5 个 Markdown 文件分别负责角色的 5 段长期上下文

这意味着我们终于把“怎么写角色”这件事，从“改代码”切回了“维护内容”。

### 2. 运行时直接读源码，不再吃重复 JSON

这次一个关键调整是：

OpenCrab runtime 不再依赖预先生成好的 `json` 文件，而是直接读取源码目录并在内存里编译成系统 agent 配置。

这样做的好处很直接：

- 源码只有一份，不会再出现内容双写
- 修改源码目录后，运行时读取到的就是当前内容
- `agency-agents` 的导入链路也能直接落到最终结构

### 3. 分组是独立注册表，不跟单个角色硬耦合

当系统里 agent 足够多时，真正重要的不是“多”，而是“怎么组织”。

所以我们把分组抽成了一层独立配置：

```text
agents-src/system-groups.json
```

这里定义两种东西：

- `collection`
  角色库层，比如 `OpenCrab Core`、`Agency Agents`
- `group`
  职能层，比如 `工程 Engineering`、`设计 Design`、`产品 Product`

单个 agent 只需要声明自己属于哪个 `groupId`。

这让系统具备了两个关键能力：

- 角色数量变多后，产品仍然能按职能组织
- 未来新增新的角色库时，不需要重构现有 agent 文件

## 这次具体引入了什么

截至 2026-03-25，这次迁移后的系统角色库由两部分组成：

- `OpenCrab Core`
  我们自己定义的 6 个核心角色
- `Agency Agents`
  从 `agency-agents` 再加工迁来的 157 个角色目录

这不是“直接搬运”。

我们做的是：

```text
上游单文件 agent markdown
  -> 解析章节结构
  -> 映射到 OpenCrab 的 5 段模型
  -> 拆成 agent.yaml + 5 个 section md
  -> 补充 group / collection / source metadata
  -> 让 OpenCrab runtime 直接读取
```

也就是说，我们吸收的是它的角色内容资产和 authoring 方式，而不是把整个项目原样塞进 OpenCrab。

## 产品层为什么一定要体现“分组”

当系统 agent 从个位数变成上百个时，产品设计如果还停留在“一个系统区 + 一个自定义区”，就已经不够用了。

因为用户真正需要的不是“看到很多角色”，而是：

- 我要找产品角色，去哪一组
- 我要找工程角色，去哪一组
- 我眼前看到的是 OpenCrab 默认核心角色，还是扩展角色库

所以这次产品上我们明确把系统 agent 按职能分组展示，并且让用户能看见每个角色属于：

- 哪个 `group`
- 哪个 `collection`
- 是否来自上游角色库

这不是信息装饰，而是角色库规模化之后的基础导航能力。

## 为什么要特别感谢 agency-agents

我们想明确致敬 [agency-agents](https://github.com/msitarzewski/agency-agents)。

原因不是“它帮我们省了写 prompt 的时间”，而是它把一件更重要的事做清楚了：

角色不是临时 prompt，而是可以长期维护的内容资产。

它给我们的启发主要有三层：

1. 单个 agent 应该有完整人格、任务、规则、工作流和交付物，而不是一句短 prompt。
2. 角色内容应该以作者友好的格式维护，而不是一开始就绑死在运行时结构里。
3. 一个优秀的角色库，不只是数量多，而是组织方式清楚、可持续扩展。

我们这次把它的大量角色内容再加工迁进 OpenCrab，本质上是在接力这条路线。

与此同时，我们也没有照搬它的边界。

OpenCrab 关心的不只是“有很多角色”，还关心：

- 这些角色怎么被分组管理
- 怎么进入 Team Mode
- 怎么和产品 UI、对话入口、系统默认行为结合
- 怎么在长期演进里保持可维护

所以最好的致敬，从来不是复制，而是继续把这条路往前做。

## 我们现在相信的方向

系统 Agents 不应该只是“默认自带几个角色”。

它应该像一个持续生长的能力目录：

- 有核心层
- 有扩展层
- 有分组
- 有来源
- 有 authoring spec
- 有统一源码目录
- 有直接面向运行时的读取链路
- 有清楚的产品入口

只有这样，系统角色库从 6 个扩到 60 个、160 个甚至更多时，OpenCrab 才不会变成一个“agent 仓库堆场”，而会更像一个真正可管理、可导航、可演进的团队能力系统。
