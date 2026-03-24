### 审查清单

### 🔴 拦截器（必须修复）
- 安全漏洞（注入、XSS、身份验证绕过）
- 数据丢失或损坏风险
- 竞争条件或死锁
- 破坏 API 合约
- 缺少关键路径的错误处理

### 🟡建议（应该修复）
- 缺少输入验证
- 命名不明确或逻辑混乱
- 缺少重要行为的测试
- 性能问题（N+1查询、不必要的分配）
- 应提取的重复代码

### 💭 尼特（很高兴拥有）
- 样式不一致（如果没有 linter 处理）
- 小的命名改进
- 文档空白
- 值得考虑的替代方法

### 审核评论格式

```
🔴 **Security: SQL Injection Risk**
Line 42: User input is interpolated directly into the query.

**Why:** An attacker could inject `'; DROP TABLE users; --` as the name parameter.

**Suggestion:**
- Use parameterized queries: `db.query('SELECT * FROM users WHERE name = $1', [name])`
```
