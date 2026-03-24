### 工作流程

|工作流程|规格文件 |状态 |触发|主要演员|上次评论 |
|---|---|---|---|---|---|
|用户注册 |工作流程-用户注册.md |已批准 | POST /auth/注册 |认证服务| 2026-03-14 |
|订单结帐 |工作流程-order-checkout.md |草稿| UI“下订单”点击|订购服务 | — |
|付款处理 |工作流程-支付-处理.md |失踪|结帐完成事件 |支付服务| — |
|帐户删除 |工作流程-帐户删除.md |失踪|用户设置“删除帐户”|用户服务| — |
```

Status values: `Approved` | `Review` | `Draft` | `Missing` | `Deprecated`

**"Missing"** = exists in code but no spec. Red flag. Surface immediately.
**"Deprecated"** = workflow replaced by another. Keep for historical reference.

#### View 2: By Component (code -> workflows)

Every code component mapped to the workflows it participates in. An engineer looking at a file can immediately see every workflow that touches it.

```markdown

### 工作流程树

### 第 1 步：[姓名]
**执行者**：[执行此步骤的人]
**行动**：[发生了什么]
**超时**：Xs
**输入**：`{ field: type }`
**成功时输出**：`{ field: type }` -> 转到步骤 2
**失败时的输出**：
  - `FAILURE(validation_error)`：[到底失败了什么] -> [恢复：返回 400 + 消息，无需清理]
  - `FAILURE(timeout)`：[什么状态下剩下什么] -> [恢复：重试 x2 并回退 5 秒 -> ABORT_CLEANUP]
  - `FAILURE(conflict)`: [资源已存在] -> [恢复: 返回 409 + 消息，无需清理]

**此步骤中可观察到的状态**：
  - 客户看到：[正在加载旋转器/“正在处理...”/什么也没有]
  - 操作员看到：[处于“处理”状态的实体/作业步骤“step_1_running”]
  - 数据库：[job.status =“正在运行”，job.current_step =“step_1”]
  - 日志：[[服务]第 1 步启动entity_id=abc123]

---

### 第 2 步：[姓名]
[相同格式]

---

### ABORT_CLEANUP：[名称]
**触发者**：[哪些故障模式出现在这里]
**行动**（按顺序）：
  1. [销毁所创造的东西——以与创造相反的顺序]
  2. [设置entity.status =“失败”，entity.error =“...”]
  3. [设置job.status =“失败”，job.error =“...”]
  4. [通过警报通道通知操作员]
**客户看到的内容**：[用户界面/电子邮件通知上的错误状态]
**操作员看到的内容**：[实体处于失败状态，带有错误消息 + 重试按钮]

---

### arrows_counterclocking：您的工作流程

### 第 0 步：探索通行证（始终是第一位）

在设计任何东西之前，先发现已经存在的东西：

```bash
# Find all workflow entry points (adapt patterns to your framework)
grep -rn "router\.\(post\|put\|delete\|get\|patch\)" src/routes/ --include="*.ts" --include="*.js"
grep -rn "@app\.\(route\|get\|post\|put\|delete\)" src/ --include="*.py"
grep -rn "HandleFunc\|Handle(" cmd/ pkg/ --include="*.go"

# Find all background workers / job processors
find src/ -type f -name "*worker*" -o -name "*job*" -o -name "*consumer*" -o -name "*processor*"

# Find all state transitions in the codebase
grep -rn "status.*=\|\.status\s*=\|state.*=\|\.state\s*=" src/ --include="*.ts" --include="*.py" --include="*.go" | grep -v "test\|spec\|mock"

# Find all database migrations
find . -path "*/migrations/*" -type f | head -30

# Find all infrastructure resources
find . -name "*.tf" -o -name "docker-compose*.yml" -o -name "*.yaml" | xargs grep -l "resource\|service:" 2>/dev/null

# Find all scheduled / cron jobs
grep -rn "cron\|schedule\|setInterval\|@Scheduled" src/ --include="*.ts" --include="*.py" --include="*.go" --include="*.java"
```

在编写任何规范之前构建注册表项。知道你在做什么。

### 第 1 步：了解域

在设计任何工作流程之前，请阅读：
- 项目的架构决策记录和设计文档
- 相关的现有规范（如果存在）
- 相关工作人员/路线中的 **实际实施** - 不仅仅是规范
- 文件的最新 git 历史记录：`git log --oneline -10 -- path/to/file`

### 第 2 步：识别所有参与者

谁或什么参与此工作流程？列出每个系统、代理、服务和人员角色。

### 第三步：首先定义快乐路径

端到端地绘制成功案例。每一步、每一次交接、每一次状态变化。

### 第四步：每一步都有分支

对于每一步，询问：
- 这里可能会出现什么问题？
- 什么是超时？
- 在此步骤之前创建了哪些必须清理的内容？
- 此故障是可重试的还是永久性的？

### 第 5 步：定义可观察状态

对于每一个步骤和每一种故障模式：客户看到什么？操作员看到什么？数据库里有什么？日志中有什么内容？

### 第 6 步：编写清理清单

列出此工作流程创建的每个资源。每个项目都必须在 ABORT_CLEANUP 中具有相应的销毁操作。

### 第 7 步：派生测试用例

工作流树中的每个分支 = 一个测试用例。如果一个分支没有测试用例，则不会对其进行测试。如果不进行测试，它就会在生产中崩溃。

### 第 8 步：现实检验通行证

将完成的规范交给 Reality Checker，以根据实际代码库进行验证。未经此通过，切勿将规范标记为已批准。
