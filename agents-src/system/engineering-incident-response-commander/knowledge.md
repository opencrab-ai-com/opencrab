### 你的技术交付物

### 严重性分类矩阵
```markdown
# Incident Severity Framework

| Level | Name      | Criteria                                           | Response Time | Update Cadence | Escalation              |
|-------|-----------|----------------------------------------------------|---------------|----------------|-------------------------|
| SEV1  | Critical  | Full service outage, data loss risk, security breach | < 5 min       | Every 15 min   | VP Eng + CTO immediately |
| SEV2  | Major     | Degraded service for >25% users, key feature down   | < 15 min      | Every 30 min   | Eng Manager within 15 min|
| SEV3  | Moderate  | Minor feature broken, workaround available           | < 1 hour      | Every 2 hours  | Team lead next standup   |
| SEV4  | Low       | Cosmetic issue, no user impact, tech debt trigger    | Next bus. day  | Daily          | Backlog triage           |

### Escalation Triggers (auto-upgrade severity)

- Impact scope doubles → upgrade one level
- No root cause identified after 30 min (SEV1) or 2 hours (SEV2) → escalate to next tier
- Customer-reported incidents affecting paying accounts → minimum SEV2
- Any data integrity concern → immediate SEV1
```

### 事件响应操作手册模板
```markdown
# Runbook: [Service/Failure Scenario Name]

### Quick Reference

- **Service**: [service name and repo link]
- **Owner Team**: [team name, Slack channel]
- **On-Call**: [PagerDuty schedule link]
- **Dashboards**: [Grafana/Datadog links]
- **Last Tested**: [date of last game day or drill]

### Detection

- **Alert**: [Alert name and monitoring tool]
- **Symptoms**: [What users/metrics look like during this failure]
- **False Positive Check**: [How to confirm this is a real incident]

### Diagnosis

1. Check service health: `kubectl get pods -n <namespace> | grep <service>`
2. Review error rates: [Dashboard link for error rate spike]
3. Check recent deployments: `kubectl rollout history deployment/<service>`
4. Review dependency health: [Dependency status page links]

### Remediation

### Option A: Rollback (preferred if deploy-related)
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
# Post-Mortem: [Incident Title]

**Date**: YYYY-MM-DD
**Severity**: SEV[1-4]
**Duration**: [start time] – [end time] ([total duration])
**Author**: [name]
**Status**: [Draft / Review / Final]

### Executive Summary

[2-3 sentences: what happened, who was affected, how it was resolved]

### Impact

- **Users affected**: [number or percentage]
- **Revenue impact**: [estimated or N/A]
- **SLO budget consumed**: [X% of monthly error budget]
- **Support tickets created**: [count]

### Timeline (UTC)

| Time  | Event                                           |
|-------|--------------------------------------------------|
| 14:02 | Monitoring alert fires: API error rate > 5%      |
| 14:05 | On-call engineer acknowledges page               |
| 14:08 | Incident declared SEV2, IC assigned              |
| 14:12 | Root cause hypothesis: bad config deploy at 13:55|
| 14:18 | Config rollback initiated                        |
| 14:23 | Error rate returning to baseline                 |
| 14:30 | Incident resolved, monitoring confirms recovery  |
| 14:45 | All-clear communicated to stakeholders           |

### Root Cause Analysis

### What happened
[Detailed technical explanation of the failure chain]

### Contributing Factors
1. **Immediate cause**: [The direct trigger]
2. **Underlying cause**: [Why the trigger was possible]
3. **Systemic cause**: [What organizational/process gap allowed it]

### 5 Whys
1. Why did the service go down? → [answer]
2. Why did [answer 1] happen? → [answer]
3. Why did [answer 2] happen? → [answer]
4. Why did [answer 3] happen? → [answer]
5. Why did [answer 4] happen? → [root systemic issue]

### What Went Well

- [Things that worked during the response]
- [Processes or tools that helped]

### What Went Poorly

- [Things that slowed down detection or resolution]
- [Gaps that were exposed]

### Action Items

| ID | Action                                     | Owner       | Priority | Due Date   | Status      |
|----|---------------------------------------------|-------------|----------|------------|-------------|
| 1  | Add integration test for config validation  | @eng-team   | P1       | YYYY-MM-DD | Not Started |
| 2  | Set up canary deploy for config changes     | @platform   | P1       | YYYY-MM-DD | Not Started |
| 3  | Update runbook with new diagnostic steps    | @on-call    | P2       | YYYY-MM-DD | Not Started |
| 4  | Add config rollback automation              | @platform   | P2       | YYYY-MM-DD | Not Started |

### Lessons Learned

[Key takeaways that should inform future architectural and process decisions]
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
# SEV1 — Initial Notification (within 10 minutes)
**Subject**: [SEV1] [Service Name] — [Brief Impact Description]

**Current Status**: We are investigating an issue affecting [service/feature].
**Impact**: [X]% of users are experiencing [symptom: errors/slowness/inability to access].
**Next Update**: In 15 minutes or when we have more information.

---

# SEV1 — Status Update (every 15 minutes)
**Subject**: [SEV1 UPDATE] [Service Name] — [Current State]

**Status**: [Investigating / Identified / Mitigating / Resolved]
**Current Understanding**: [What we know about the cause]
**Actions Taken**: [What has been done so far]
**Next Steps**: [What we're doing next]
**Next Update**: In 15 minutes.

---

# Incident Resolved
**Subject**: [RESOLVED] [Service Name] — [Brief Description]

**Resolution**: [What fixed the issue]
**Duration**: [Start time] to [end time] ([total])
**Impact Summary**: [Who was affected and how]
**Follow-up**: Post-mortem scheduled for [date]. Action items will be tracked in [link].
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
