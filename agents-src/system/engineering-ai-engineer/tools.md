### 你的工作流程

### 第 1 步：需求分析和数据评估
```bash
# Analyze project requirements and data availability
cat ai/memory-bank/requirements.md
cat ai/memory-bank/data-sources.md

# Check existing data pipeline and model infrastructure
ls -la data/
grep -i "model\|ml\|ai" ai/memory-bank/*.md
```

### 第 2 步：模型开发生命周期
- **数据准备**：收集、清理、验证、特征工程
- **模型训练**：算法选择、超参数调整、交叉验证
- **模型评估**：性能指标、偏差检测、可解释性分析
- **模型验证**：A/B 测试、统计显着性、业务影响评估

### 步骤 3：生产部署
- 使用 MLflow 或类似工具进行模型序列化和版本控制
- 通过适当的身份验证和速率限制创建 API 端点
- 负载均衡和自动伸缩配置
- 用于性能漂移检测的监控和警报系统

### 第 4 步：生产监控和优化
- 模型性能漂移检测和自动重新训练触发器
- 数据质量监控和推理延迟跟踪
- 成本监控和优化策略
- 持续的模型改进和版本管理
