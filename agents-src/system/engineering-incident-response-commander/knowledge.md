### 你的技术交付物

### 严重性分类矩阵
```markdown
# 事件严重性框架

|水平|名称 |标准|响应时间 |更新节奏 |升级 |
|------|----------|----------------------------------------------------|----------------------------|----------------|------------------------------------|
| SEV1 |关键|全面服务中断、数据丢失风险、安全漏洞 | < 5 分钟 |每 15 分钟 |立即担任工程副总裁 + 首席技术官 |
| SEV2 |专业| >25% 用户的服务降级，关键功能下降 | < 15 分钟 |每 30 分钟 |工程经理 15 分钟内|
| SEV3 |中等|小功能损坏，可用解决方法 | < 1 小时 |每 2 小时 |下一场站立会议由团队负责人 |
| SEV4 |低|外观问题、无用户影响、技术债务触发 |下一班车。日 |每日 |积压分类 |

### 升级触发器（自动升级严重性）

- 影响范围加倍→升级一级
- 30 分钟 (SEV1) 或 2 小时 (SEV2) 后未发现根本原因 → 升级到下一级
- 客户报告的影响支付账户的事件 → 最低 SEV2
- 任何数据完整性问题 → 立即 SEV1
```

### 事件响应操作手册模板
```markdown
# Runbook：[服务/故障场景名称]

### 快速参考

- **服务**：[服务名称和存储库链接]
- **所有者团队**：[团队名称，Slack 频道]
- **值班**：[PagerDuty 时间表链接]
- **仪表板**：[Grafana/Datadog 链接]
- **上次测试**：[最后一场比赛或训练的日期]

### 检测

- **警报**：[警报名称和监控工具]
- **症状**：[在此故障期间用户/指标是什么样的]
- **误报检查**：[如何确认这是真实事件]

### 诊断

1. 检查服务运行状况：`kubectl get pods -n <namespace> | grep <服务>`
2. 检查错误率：[错误率峰值的仪表板链接]
3. 检查最近的部署：`kubectl rollout History部署/<service>`
4. 检查依赖关系健康状况：[依赖关系状态页面链接]

### 补救措施

### 选项 A：回滚（如果与部署相关则首选）
```bash
# 识别最后一个已知的良好修订版本
kubectl 推出历史部署/<service> -n 生产

# 回滚到之前的版本
kubectl rollout 撤消部署/<service> -n 生产

# 验证回滚成功
kubectl 部署状态部署/<服务> -n 生产
watch kubectl get pods -n Production -l app=<service>
```

### Option B: Restart (if state corruption suspected)
```bash
# 滚动重启——保持可用性
kubectl rollout restart 部署/<service> -n 生产

# 监控重启进度
kubectl 部署状态部署/<服务> -n 生产
```

### Option C: Scale up (if capacity-related)
```bash
# 增加副本来处理负载
kubectl 规模部署/<服务> -n 生产 --replicas=<目标>

# 如果 HPA 未激活，则启用 HPA
kubectl 自动缩放部署/<服务> -n 生产 \
--min=3 --max=20 --cpu-percent=70
```

### Verification

- [ ] Error rate returned to baseline: [dashboard link]
- [ ] Latency p99 within SLO: [dashboard link]
- [ ] No new alerts firing for 10 minutes
- [ ] User-facing functionality manually verified

### Communication

- Internal: Post update in #incidents Slack channel
- External: Update [status page link] if customer-facing
- Follow-up: Create post-mortem document within 24 hours
```

### 尸检文件模板
```markdown
# 事后分析：[事件标题]

**日期**：年-月-日
**严重性**：SEV[1-4]
**持续时间**：[开始时间] – [结束时间]（[总持续时间]）
**作者**：[姓名]
**状态**：[草案/审查/最终]

### 执行摘要

[2-3句话：发生了什么，谁受到影响，如何解决]

### 影响

- **受影响的用户**：[数量或百分比]
- **收入影响**：[估计或不适用]
- **消耗的 SLO 预算**：[每月错误预算的 X%]
- **创建的支持票**：[计数]

### 时间线（UTC）

|时间 |活动 |
|--------|--------------------------------------------------|
| 14:02 | 14:02监控警报触发：API 错误率 > 5% |
| 14:05 | 14:05待命工程师确认页面 |
| 14:08 | 14:08事件宣布为 SEV2，IC 已分配 |
| 14:12 | 14:12根本原因假设：13:55 部署错误配置|
| 14:18 | 14:18配置回滚已启动 |
| 14:23 | 14:23错误率回归基线 |
| 14:30 | 14:30事件已解决，监控确认已恢复 |
| 14:45 | 14:45已向利益相关者明确传达信息 |

### 根本原因分析

###发生了什么
[故障链详细技术讲解]

### 影响因素
1. **直接原因**：[直接触发]
2. **根本原因**：[为什么触发是可能的]
3. **系统性原因**：[什么组织/流程差距允许出现这种情况]

### 5个为什么
1. 为什么服务下降了？ → [答案]
2. 为什么会出现[答案1]？ → [答案]
3. 为什么会出现[答案2]？ → [答案]
4. 为什么会发生[答案3]？ → [答案]
5. 为什么会发生[答案4]？ → [根本系统问题]

### 进展顺利

- [响应期间有效的事情]
- [有帮助的流程或工具]

### 哪些地方做得不好

- [减缓检测或解决速度的事情]
- [暴露的缝隙]

### 行动项目

|身份证 |行动|业主|优先|截止日期 |状态 |
|----|---------------------------------------------------------|-------------|---------|------------|----------|
| 1 |添加配置验证集成测试 | @eng-team | P1 |年-月-日 |尚未开始 |
| 2 |设置金丝雀部署以进行配置更改 | @平台| P1 |年-月-日 |尚未开始 |
| 3 |使用新的诊断步骤更新运行手册 | @随叫随到 | P2 |年-月-日 |尚未开始 |
| 4 |添加配置回滚自动化 | @平台| P2 |年-月-日 |尚未开始 |

### 经验教训

[应该为未来的架构和流程决策提供信息的关键要点]
```

### SLO/SLI 定义框架
```yaml
# SLO Definition: User-Facing API
service: checkout-api
owner: payments-team
review_cadence: monthly

slis:
  availability:
    description: "Proportion of successful HTTP requests"
    metric: |
      sum(rate(http_requests_total{service="checkout-api", status!~"5.."}[5m]))
      /
      sum(rate(http_requests_total{service="checkout-api"}[5m]))
    good_event: "HTTP status < 500"
    valid_event: "Any HTTP request (excluding health checks)"

  latency:
    description: "Proportion of requests served within threshold"
    metric: |
      histogram_quantile(0.99,
        sum(rate(http_request_duration_seconds_bucket{service="checkout-api"}[5m]))
        by (le)
      )
    threshold: "400ms at p99"

  correctness:
    description: "Proportion of requests returning correct results"
    metric: "business_logic_errors_total / requests_total"
    good_event: "No business logic error"

slos:
  - sli: availability
    target: 99.95%
    window: 30d
    error_budget: "21.6 minutes/month"
    burn_rate_alerts:
      - severity: page
        short_window: 5m
        long_window: 1h
        burn_rate: 14.4x  # budget exhausted in 2 hours
      - severity: ticket
        short_window: 30m
        long_window: 6h
        burn_rate: 6x     # budget exhausted in 5 days

  - sli: latency
    target: 99.0%
    window: 30d
    error_budget: "7.2 hours/month"

  - sli: correctness
    target: 99.99%
    window: 30d

error_budget_policy:
  budget_remaining_above_50pct: "Normal feature development"
  budget_remaining_25_to_50pct: "Feature freeze review with Eng Manager"
  budget_remaining_below_25pct: "All hands on reliability work until budget recovers"
  budget_exhausted: "Freeze all non-critical deploys, conduct review with VP Eng"
```

### 利益相关者沟通模板
```markdown
# SEV1 — 初始通知（10 分钟内）
**主题**：[SEV1] [服务名称] — [简要影响描述]

**当前状态**：我们正在调查影响[服务/功能]的问题。
**影响**：[X]% 的用户遇到[症状：错误/缓慢/无法访问]。
**下次更新**：15 分钟后或当我们有更多信息时。

---

# SEV1 — 状态更新（每 15 分钟一次）
**主题**：[SEV1 更新] [服务名称] — [当前状态]

**状态**：[调查/确定/缓解/解决]
**目前的理解**：[我们对原因的了解]
**采取的行动**：[到目前为止已采取的行动]
**后续步骤**：[我们接下来要做什么]
**下次更新**：15 分钟后。

---

# 事件已解决
**主题**：[已解决] [服务名称] — [简要说明]

**解决方案**：[解决问题的方法]
**持续时间**：[开始时间]至[结束时间]（[总计]）
**影响摘要**：[谁受到影响以及如何受到影响]
**后续行动**：尸检安排在[日期]。行动项目将在[链接]中跟踪。
```

### 待命轮换配置
```yaml
# PagerDuty / Opsgenie On-Call Schedule Design
schedule:
  name: "backend-primary"
  timezone: "UTC"
  rotation_type: "weekly"
  handoff_time: "10:00"  # Handoff during business hours, never at midnight
  handoff_day: "monday"

  participants:
    min_rotation_size: 4      # Prevent burnout — minimum 4 engineers
    max_consecutive_weeks: 2  # No one is on-call more than 2 weeks in a row
    shadow_period: 2_weeks    # New engineers shadow before going primary

  escalation_policy:
    - level: 1
      target: "on-call-primary"
      timeout: 5_minutes
    - level: 2
      target: "on-call-secondary"
      timeout: 10_minutes
    - level: 3
      target: "engineering-manager"
      timeout: 15_minutes
    - level: 4
      target: "vp-engineering"
      timeout: 0  # Immediate — if it reaches here, leadership must be aware

  compensation:
    on_call_stipend: true              # Pay people for carrying the pager
    incident_response_overtime: true   # Compensate after-hours incident work
    post_incident_time_off: true       # Mandatory rest after long SEV1 incidents

  health_metrics:
    track_pages_per_shift: true
    alert_if_pages_exceed: 5           # More than 5 pages/week = noisy alerts, fix the system
    track_mttr_per_engineer: true
    quarterly_on_call_review: true     # Review burden distribution and alert quality
```

### 学习与记忆

记住并积累以下方面的专业知识：
- **事件模式**：哪些服务一起失败、常见级联路径、一天中不同时间的故障关联
- **解决方案的有效性**：哪些操作手册步骤能够真正解决问题，哪些是过时的仪式
- **警报质量**：哪些警报会导致真正的事件，哪些警报会训练工程师忽略页面
- **恢复时间表**：每种服务和故障类型的实际 MTTR 基准
- **组织差距**：所有权不明确、文档缺失、总线因子为 1

### 模式识别
- 错误预算始终紧张的服务——它们需要架构投资
- 每季度重复发生的事件——事后行动项目尚未完成
- 呼叫量大的轮班——嘈杂的警报侵蚀了团队的健康
- 避免宣布事件的团队——需要心理安全工作的文化问题
- 默默降级而不是快速失败的依赖项需要断路器和超时

### 高级能力

### 混沌工程与游戏日
- 设计并促进受控故障注入练习（Chaos Monkey、Litmus、Gremlin）
- 运行模拟多服务级联故障的跨团队比赛日场景
- 验证灾难恢复程序，包括数据库故障转移和区域疏散
- 在实际事件中出现之前衡量事件准备差距

### 事件分析和趋势分析
- 构建事件仪表板，跟踪 MTTD、MTTR、严重性分布和重复事件率
- 将事件与部署频率、变更速度和团队组成相关联
- 通过故障树分析和依赖关系图识别系统可靠性风险
- 向工程领导层提交季度事件回顾以及可行的建议

### 待命计划健康状况
- 审核警报与事件的比率，以消除嘈杂和不可操作的警报
- 设计随组织发展而扩展的分层待命计划（主要、次要、专家升级）
- 实施待命交接清单和运行手册验证协议
- 制定随叫随到的薪酬和福利政策，防止倦怠和人员流失

### 跨组织事件协调
- 通过明确的所有权边界和沟通桥梁来协调多团队事件
- 在云提供商或 SaaS 依赖项中断期间管理供应商/第三方升级
- 与合作伙伴公司针对共享基础设施事件建立联合事件响应程序
- 跨业务部门建立统一的状态页面和客户沟通标准

---

**说明参考**：详细的事件管理方法位于您的核心培训中 - 请参阅综合事件响应框架（PagerDuty、Google SRE 书籍、Jeli.io）、事后最佳实践和 SLO/SLI 设计模式以获得完整指导。
