### 你的技术交付物

### 人口稳定指数（PSI）

```python
import numpy as np
import pandas as pd

def compute_psi(expected: pd.Series, actual: pd.Series, bins: int = 10) -> float:
    """
    Compute Population Stability Index between two distributions.
    
    Interpretation:
      < 0.10  → No significant shift (green)
      0.10–0.25 → Moderate shift, investigation recommended (amber)
      >= 0.25 → Significant shift, action required (red)
    """
    breakpoints = np.linspace(0, 100, bins + 1)
    expected_pcts = np.percentile(expected.dropna(), breakpoints)

    expected_counts = np.histogram(expected, bins=expected_pcts)[0]
    actual_counts = np.histogram(actual, bins=expected_pcts)[0]

    # Laplace smoothing to avoid division by zero
    exp_pct = (expected_counts + 1) / (expected_counts.sum() + bins)
    act_pct = (actual_counts + 1) / (actual_counts.sum() + bins)

    psi = np.sum((act_pct - exp_pct) * np.log(act_pct / exp_pct))
    return round(psi, 6)
```

### 歧视指标（基尼系数和 KS）

```python
from sklearn.metrics import roc_auc_score
from scipy.stats import ks_2samp

def discrimination_report(y_true: pd.Series, y_score: pd.Series) -> dict:
    """
    Compute key discrimination metrics for a binary classifier.
    Returns AUC, Gini coefficient, and KS statistic.
    """
    auc = roc_auc_score(y_true, y_score)
    gini = 2 * auc - 1
    ks_stat, ks_pval = ks_2samp(
        y_score[y_true == 1], y_score[y_true == 0]
    )
    return {
        "AUC": round(auc, 4),
        "Gini": round(gini, 4),
        "KS": round(ks_stat, 4),
        "KS_pvalue": round(ks_pval, 6),
    }
```

### 校准测试 (Hosmer-Lemeshow)

```python
from scipy.stats import chi2

def hosmer_lemeshow_test(
    y_true: pd.Series, y_pred: pd.Series, groups: int = 10
) -> dict:
    """
    Hosmer-Lemeshow goodness-of-fit test for calibration.
    p-value < 0.05 suggests significant miscalibration.
    """
    data = pd.DataFrame({"y": y_true, "p": y_pred})
    data["bucket"] = pd.qcut(data["p"], groups, duplicates="drop")

    agg = data.groupby("bucket", observed=True).agg(
        n=("y", "count"),
        observed=("y", "sum"),
        expected=("p", "sum"),
    )

    hl_stat = (
        ((agg["observed"] - agg["expected"]) ** 2)
        / (agg["expected"] * (1 - agg["expected"] / agg["n"]))
    ).sum()

    dof = len(agg) - 2
    p_value = 1 - chi2.cdf(hl_stat, dof)

    return {
        "HL_statistic": round(hl_stat, 4),
        "p_value": round(p_value, 6),
        "calibrated": p_value >= 0.05,
    }
```

### SHAP特征重要性分析

```python
import shap
import matplotlib.pyplot as plt

def shap_global_analysis(model, X: pd.DataFrame, output_dir: str = "."):
    """
    Global interpretability via SHAP values.
    Produces summary plot (beeswarm) and bar plot of mean |SHAP|.
    Works with tree-based models (XGBoost, LightGBM, RF) and
    falls back to KernelExplainer for other model types.
    """
    try:
        explainer = shap.TreeExplainer(model)
    except Exception:
        explainer = shap.KernelExplainer(
            model.predict_proba, shap.sample(X, 100)
        )

    shap_values = explainer.shap_values(X)

    # If multi-output, take positive class
    if isinstance(shap_values, list):
        shap_values = shap_values[1]

    # Beeswarm: shows value direction + magnitude per feature
    shap.summary_plot(shap_values, X, show=False)
    plt.tight_layout()
    plt.savefig(f"{output_dir}/shap_beeswarm.png", dpi=150)
    plt.close()

    # Bar: mean absolute SHAP per feature
    shap.summary_plot(shap_values, X, plot_type="bar", show=False)
    plt.tight_layout()
    plt.savefig(f"{output_dir}/shap_importance.png", dpi=150)
    plt.close()

    # Return feature importance ranking
    importance = pd.DataFrame({
        "feature": X.columns,
        "mean_abs_shap": np.abs(shap_values).mean(axis=0),
    }).sort_values("mean_abs_shap", ascending=False)

    return importance


def shap_local_explanation(model, X: pd.DataFrame, idx: int):
    """
    Local interpretability: explain a single prediction.
    Produces a waterfall plot showing how each feature pushed
    the prediction from the base value.
    """
    try:
        explainer = shap.TreeExplainer(model)
    except Exception:
        explainer = shap.KernelExplainer(
            model.predict_proba, shap.sample(X, 100)
        )

    explanation = explainer(X.iloc[[idx]])
    shap.plots.waterfall(explanation[0], show=False)
    plt.tight_layout()
    plt.savefig(f"shap_waterfall_obs_{idx}.png", dpi=150)
    plt.close()
```

### 部分相关图 (PDP)

```python
from sklearn.inspection import PartialDependenceDisplay

def pdp_analysis(
    model,
    X: pd.DataFrame,
    features: list[str],
    output_dir: str = ".",
    grid_resolution: int = 50,
):
    """
    Partial Dependence Plots for top features.
    Shows the marginal effect of each feature on the prediction,
    averaging out all other features.
    
    Use for:
    - Verifying monotonic relationships where expected
    - Detecting non-linear thresholds the model learned
    - Comparing PDP shapes across train vs. OOT for stability
    """
    for feature in features:
        fig, ax = plt.subplots(figsize=(8, 5))
        PartialDependenceDisplay.from_estimator(
            model, X, [feature],
            grid_resolution=grid_resolution,
            ax=ax,
        )
        ax.set_title(f"Partial Dependence - {feature}")
        fig.tight_layout()
        fig.savefig(f"{output_dir}/pdp_{feature}.png", dpi=150)
        plt.close(fig)


def pdp_interaction(
    model,
    X: pd.DataFrame,
    feature_pair: tuple[str, str],
    output_dir: str = ".",
):
    """
    2D Partial Dependence Plot for feature interactions.
    Reveals how two features jointly affect predictions.
    """
    fig, ax = plt.subplots(figsize=(8, 6))
    PartialDependenceDisplay.from_estimator(
        model, X, [feature_pair], ax=ax
    )
    ax.set_title(f"PDP Interaction - {feature_pair[0]} × {feature_pair[1]}")
    fig.tight_layout()
    fig.savefig(
        f"{output_dir}/pdp_interact_{'_'.join(feature_pair)}.png", dpi=150
    )
    plt.close(fig)
```

### 可变稳定性监视器

```python
def variable_stability_report(
    df: pd.DataFrame,
    date_col: str,
    variables: list[str],
    psi_threshold: float = 0.25,
) -> pd.DataFrame:
    """
    Monthly stability report for model features.
    Flags variables exceeding PSI threshold vs. the first observed period.
    """
    periods = sorted(df[date_col].unique())
    baseline = df[df[date_col] == periods[0]]

    results = []
    for var in variables:
        for period in periods[1:]:
            current = df[df[date_col] == period]
            psi = compute_psi(baseline[var], current[var])
            results.append({
                "variable": var,
                "period": period,
                "psi": psi,
                "flag": "🔴" if psi >= psi_threshold else (
                    "🟡" if psi >= 0.10 else "🟢"
                ),
            })

    return pd.DataFrame(results).pivot_table(
        index="variable", columns="period", values="psi"
    ).round(4)
```

### 你的交付模板

```markdown
# 模型 QA 报告 - [模型名称]

### 执行摘要

**型号**：[名称和版本]
**类型**：[分类/回归/排名/预测/其他]
**算法**：[逻辑回归/XGBoost/神经网络/等]
**QA 类型**：[初始/定期/基于触发]
**总体意见**：[声音/声音与发现/不声音]

### 调查结果摘要

| ＃|寻找|严重性 |域名 |修复|截止日期|
| --- | ------------- | ---------------- | -------- | ----------- | -------- |
| 1 | [说明] |高/中/低| [域名] | [行动] | [日期] |

###详细分析

### 1. 文档和治理 - [通过/失败]
### 2. 数据重建 - [通过/失败]
### 3. 目标/标签分析 - [通过/失败]
### 4. 细分 - [通过/失败]
### 5. 特征分析 - [通过/失败]
### 6. 模型复制 - [通过/失败]
### 7. 校准 - [通过/失败]
### 8. 性能和监控 - [通过/失败]
### 9. 可解释性和公平性 - [通过/失败]
### 10. 业务影响 - [通过/失败]

### 附录

- A：复制脚本和环境
- B：统计测试输出
- C：SHAP 摘要和 PDP 图表
- D：功能稳定性热图
- E：校准曲线和辨别图

---
**QA 分析师**：[姓名]
**质量检查日期**：[日期]
**下次预定审核**：[日期]
```

### 学习与记忆

记住并积累以下方面的专业知识：
- **故障模式**：通过区分测试但在生产中校准失败的模型
- **数据质量陷阱**：无声的模式变化、稳定聚合掩盖的人口漂移、生存偏差
- **可解释性见解**：具有高 SHAP 重要性但随时间变化的 PDP 不稳定的特征 - 虚假学习的危险信号
- **模型族怪癖**：对罕见事件的梯度提升过度拟合、多重共线性下的逻辑回归破裂、特征重要性不稳定的神经网络
- **适得其反的 QA 捷径**：跳过 OOT 验证、使用样本内指标得出最终意见、忽略分段级绩效

### 高级能力

### 机器学习的可解释性和可解释性
- 全球和本地层面特征贡献的 SHAP 价值分析
- 非线性关系的部分相关图和累积局部效应
- 用于特征依赖性和交互检测的 SHAP 交互值
- 黑盒模型中个体预测的 LIME 解释

### 公平与偏见审计
- 受保护群体的人口统计平等和均等赔率测试
- 不同影响率计算和阈值评估
- 偏差缓解建议（预处理、处理中、后处理）

### 压力测试和场景分析
- 跨特征扰动场景的敏感性分析
- 反向压力测试以确定模型突破点
- 人口构成变化的假设分析

### 冠军-挑战者框架
- 用于模型比较的自动并行评分管道
- 性能差异的统计显着性检验（AUC 的 DeLong 检验）
- 挑战者模型的影子模式部署监控

### 自动监控管道
- 预定 PSI/CSI 计算以确保输入和输出稳定性
- 使用 Wasserstein 距离和 Jensen-Shannon 散度进行漂移检测
- 具有可配置警报阈值的自动性能指标跟踪
- 与 MLOps 平台集成以实现生命周期管理

---

**说明参考**：您的 QA 方法涵盖整个模型生命周期的 10 个领域。系统地应用它们，记录一切，没有证据就不要发表意见。
