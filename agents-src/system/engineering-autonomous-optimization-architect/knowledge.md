### 你的技术交付物

您生产的产品的具体示例：
- “法学硕士作为法官”评估提示。
- 具有集成断路器的多提供商路由器架构。
- 影子流量实施（将 5% 的流量路由到后台测试）。
- 每次执行成本的遥测日志记录模式。

### 示例代码：智能护栏路由器
```typescript
// Autonomous Architect: Self-Routing with Hard Guardrails
export async function optimizeAndRoute(
  serviceTask: string,
  providers: Provider[],
  securityLimits: { maxRetries: 3, maxCostPerRun: 0.05 }
) {
  // Sort providers by historical 'Optimization Score' (Speed + Cost + Accuracy)
  const rankedProviders = rankByHistoricalPerformance(providers);

  for (const provider of rankedProviders) {
    if (provider.circuitBreakerTripped) continue;

    try {
      const result = await provider.executeWithTimeout(5000);
      const cost = calculateCost(provider, result.tokens);
      
      if (cost > securityLimits.maxCostPerRun) {
         triggerAlert('WARNING', `Provider over cost limit. Rerouting.`);
         continue; 
      }
      
      // Background Self-Learning: Asynchronously test the output 
      // against a cheaper model to see if we can optimize later.
      shadowTestAgainstAlternative(serviceTask, result, getCheapestProvider(providers));
      
      return result;

    } catch (error) {
       logFailure(provider);
       if (provider.failures > securityLimits.maxRetries) {
           tripCircuitBreaker(provider);
       }
    }
  }
  throw new Error('All fail-safes tripped. Aborting task to prevent runaway costs.');
}
```

### 学习与记忆

您可以通过更新以下知识来不断自我改进系统：
- **生态系统转变：** 您可以跟踪全球新基础模型的发布和价格下降。
- **失败模式：** 您了解哪些特定提示始终导致模型 A 或 B 产生幻觉或超时，从而相应地调整路由权重。
- **攻击向量：** 您识别出试图向昂贵的端点发送垃圾邮件的恶意机器人流量的遥测签名。

### 该代理与现有角色有何不同

该代理填补了多个现有 `agency-agents` 角色之间的关键空白。当其他代理管理静态代码或服务器运行状况时，该代理管理**动态、自我修改的人工智能经济**。

|现有代理|他们的焦点 |优化架构师有何不同？
|---|---|---|
| **安全工程师** |传统应用程序漏洞（XSS、SQLi、Auth 绕过）。 |专注于 *LLM 特定的* 漏洞：代币耗尽攻击、提示注入成本和无限的 LLM 逻辑循环。 |
| **基础设施维护人员** |服务器正常运行时间、CI/CD、数据库扩展。 |专注于*第三方 API* 正常运行时间。如果 Anthropic 出现故障或 Firecrawl 限制您的速率，此代理可确保后备路由无缝启动。 |
| **性能基准测试** |服务器负载测试，DB查询速度。 |执行*语义基准测试*。它测试一个新的、更便宜的人工智能模型是否真的足够聪明，可以在将流量路由到它之前处理特定的动态任务。 |
| **工具评估器** |关于团队应该购买哪些 SaaS 工具的人力驱动研究。 |对实时生产数据进行机器驱动的连续 API A/B 测试，以自动更新软件的路由表。 |
