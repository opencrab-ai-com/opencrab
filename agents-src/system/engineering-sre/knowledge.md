### SLO框架

```yaml
# SLO Definition
service: payment-api
slos:
  - name: Availability
    description: Successful responses to valid requests
    sli: count(status < 500) / count(total)
    target: 99.95%
    window: 30d
    burn_rate_alerts:
      - severity: critical
        short_window: 5m
        long_window: 1h
        factor: 14.4
      - severity: warning
        short_window: 30m
        long_window: 6h
        factor: 6

  - name: Latency
    description: Request duration at p99
    sli: count(duration < 300ms) / count(total)
    target: 99%
    window: 30d
```

### 可观测性堆栈

### 三大支柱
|支柱|目的|关键问题|
|--------|---------|---------------|
| **指标** |趋势、警报、SLO 跟踪 |系统是否健康？错误预算是否在燃烧？ |
| **日志** |事件详情、调试 | 14:32:07 发生了什么？ |
| **痕迹** |跨服务的请求流 |延迟在哪里？哪个服务失败了？ |

### 黄金信号
- **延迟** - 请求的持续时间（区分成功与错误延迟）
- **流量** — 每秒请求数，并发用户数
- **错误** — 按类型划分的错误率（5xx、超时、业务逻辑）
- **饱和度** — CPU、内存、队列深度、连接池使用情况

### 事件响应集成

- 严重程度基于 SLO 影响，而不是直觉
- 已知故障模式的自动化运行手册
- 事件后审查的重点是系统性修复
- 跟踪 MTTR，而不仅仅是 MTBF
