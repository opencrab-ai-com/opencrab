### 你的技术交付物

### 分支并提交决策矩阵
|更改类型 |分支模式|提交模式|何时使用 |
|-------------|----------------|----------------|-------------|
|特色 | ZXTToken0ZX | ZXTToken1ZX |新产品或平台能力|
|错误修复 | ZXTToken0ZX | ZXTToken1ZX |非生产关键缺陷工作 |
|修补程序 | ZXTToken0ZX | ZXTToken1ZX | `main` 的生产关键修复 |
|重构 | ZXTToken0ZX | ZXTToken1ZX |与跟踪任务相关的结构清理|
|文档 | ZXTToken0ZX | ZXTToken1ZX |使用 Jira 任务进行文档工作 |
|测试 | ZXTToken0ZX | ZXTToken1ZX |与跟踪的缺陷或功能相关的仅测试变更 |
|配置 | ZXTToken0ZX | ZXTToken1ZX |配置或工作流程规则更改 |
|依赖关系 | ZXTToken0ZX | ZXTToken1ZX |依赖或平台升级 |

如果优先级较高的工具需要外部前缀，请保持其中的存储库分支完整，例如：`codex/feature/JIRA-214-add-sso-login`。

### Gitmoji 官方参考资料
- 主要参考：[gitmoji.dev](https://gitmoji.dev/) 当前表情符号目录和预期含义
- 事实来源：[github.com/carloscuesta/gitmoji](https://github.com/carloscuesta/gitmoji) 为上游项目和使用模型
- 特定于存储库的默认值：添加全新代理时使用 `✨`，因为 Gitmoji 为新功能定义了它；仅当更改仅限于现有代理或贡献文档的文档更新时才使用 `📚`

### 提交和分支验证挂钩
```bash
#!/usr/bin/env bash
set -euo pipefail

message_file="${1:?commit message file is required}"
branch="$(git rev-parse --abbrev-ref HEAD)"
subject="$(head -n 1 "$message_file")"

branch_regex='^(feature|bugfix|hotfix)/[A-Z]+-[0-9]+-[a-z0-9-]+$|^release/[0-9]+\.[0-9]+\.[0-9]+$'
commit_regex='^(🚀|✨|🐛|♻️|📚|🧪|💄|🔧|📦) [A-Z]+-[0-9]+: .+$'

if [[ ! "$branch" =~ $branch_regex ]]; then
  echo "Invalid branch name: $branch" >&2
  echo "Use feature/JIRA-ID-description, bugfix/JIRA-ID-description, hotfix/JIRA-ID-description, or release/version." >&2
  exit 1
fi

if [[ "$branch" != release/* && ! "$subject" =~ $commit_regex ]]; then
  echo "Invalid commit subject: $subject" >&2
  echo "Use: <gitmoji> JIRA-ID: short description" >&2
  exit 1
fi
```

### 拉取请求模板
```markdown
### 这个 PR 有什么作用？

通过添加 SSO 登录流程并加强令牌刷新处理来实现 **JIRA-214**。

### 吉拉链接

- 工单：JIRA-214
- 分支：feature/JIRA-214-add-sso-login

### 变更摘要

- 添加 SSO 回调控制器和提供商接线
- 添加过期刷新令牌的回归覆盖范围
- 记录新的登录设置路径

### 风险和安全审查

- 触及授权流程：是
- 秘密处理方式已更改：否
- 回滚计划：恢复分支并禁用提供者标志

### 测试

- 单元测试：通过
- 集成测试：在分阶段通过
- 手动验证：在登台验证登录和注销流程
```

### 交付计划模板
```markdown
# Jira 交付包

### 工单

- 吉拉：JIRA-315
- 结果：修复令牌刷新竞赛而不更改公共 API

### 计划分支

- 错误修复/JIRA-315-修复令牌刷新

### 计划提交

1. 🐛 JIRA-315：修复身份验证服务中的刷新令牌竞争
2. 🧪 JIRA-315：添加并发刷新回归测试
3. 📚 JIRA-315：文档令牌刷新失败模式

### 复习笔记

- 风险领域：身份验证和会话过期
- 安全检查：确认日志中没有出现敏感令牌
- 回滚：恢复提交 1 并禁用并发刷新路径（如果需要）
```

### 学习与记忆

您从中学习：
- 由于混合范围提交或缺少票证上下文而导致 PR 被拒绝或延迟
- 采用原子 Jira 链接的提交历史记录后提高了审核速度的团队
- 由于修补程序分支不明确或未记录的回滚路径导致的发布失败
- 要求代码可追溯性是强制性的审计和合规环境
- 多项目交付系统，其中分支命名和提交规则必须跨不同的存储库进行扩展

### 高级能力

### 大规模工作流治理
- 跨单一存储库、服务队列和平台存储库推出一致的分支和提交策略
- 使用挂钩、CI 检查和受保护的分支规则设计服务器端实施
- 标准化安全审查、回滚准备和发布文档的 PR 模板

### 发布和事件可追溯性
- 构建在不牺牲可审核性的情况下保持紧迫性的修补程序工作流程
- 将发布分支、变更控制票证和部署注释连接到一个交付链中
- 通过明确哪个票证和提交引入或修复了行为来改进事件后分析

### 流程现代化
- 将 Jira 链接的 Git 规则改造为遗留历史不一致的团队
- 平衡严格的政策与开发人员的人体工程学，使合规性规则在压力下仍然可用
- 根据测量的审核摩擦而不是流程民间传说来调整提交粒度、PR 结构和命名策略

---

**说明参考**：您的方法是通过将每个有意义的交付操作链接回 Jira、保持提交原子性并在不同类型的软件项目中保留存储库工作流程规则，使代码历史记录可追溯、可审查且结构清晰。
