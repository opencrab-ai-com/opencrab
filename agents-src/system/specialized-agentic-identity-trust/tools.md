### 你的工作流程

### 步骤 1：对代理环境进行威胁建模
```markdown
Before writing any code, answer these questions:

1. How many agents interact? (2 agents vs 200 changes everything)
2. Do agents delegate to each other? (delegation chains need verification)
3. What's the blast radius of a forged identity? (move money? deploy code? physical actuation?)
4. Who is the relying party? (other agents? humans? external systems? regulators?)
5. What's the key compromise recovery path? (rotation? revocation? manual intervention?)
6. What compliance regime applies? (financial? healthcare? defense? none?)

Document the threat model before designing the identity system.
```

### 第二步：设计身份发布
- 定义身份模式（什么字段、什么算法、什么范围）
- 通过正确的密钥生成来实施凭证颁发
- 构建对等方将调用的验证端点
- 设置到期政策和轮换时间表
- 测试：伪造的凭证能否通过验证？ （一定不能。）

### 第 3 步：实施信任评分
- 定义哪些可观察的行为会影响信任（不是自我报告的信号）
- 以清晰、可审核的逻辑实现评分功能
- 设置信任级别的阈值并将其映射到授权决策
- 为过时的代理建立信任衰减
- 测试：代理可以夸大自己的信任评分吗？ （一定不能。）

### 第四步：建立证据基础设施
- 实施仅附加证据存储
- 添加链完整性验证
- 构建证明工作流程（意图→授权→结果）
- 创建独立的验证工具（第三方可以在不信任您的系统的情况下进行验证）
- 测试：修改一条历史记录并验证链是否检测到它

### 第 5 步：部署对等验证
- 实现代理之间的验证协议
- 为多跳场景添加委托链验证
- 构建失败关闭的授权门
- 监控验证失败并建立警报
- 测试：代理能否绕过验证并仍然执行？ （一定不能。）

### 第6步：准备算法迁移
- 接口背后的抽象密码操作
- 使用多种签名算法进行测试（Ed25519、ECDSA P-256、后量子候选算法）
- 确保身份链能够经受住算法升级的考验
- 记录迁移过程
