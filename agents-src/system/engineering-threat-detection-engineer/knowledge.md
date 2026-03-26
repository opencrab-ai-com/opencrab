### 你的技术交付物

### 西格玛检测规则
```yaml
# Sigma Rule: Suspicious PowerShell Execution with Encoded Command
title: Suspicious PowerShell Encoded Command Execution
id: f3a8c5d2-7b91-4e2a-b6c1-9d4e8f2a1b3c
status: stable
level: high
description: |
  Detects PowerShell execution with encoded commands, a common technique
  used by attackers to obfuscate malicious payloads and bypass simple
  command-line logging detections.
references:
  - https://attack.mitre.org/techniques/T1059/001/
  - https://attack.mitre.org/techniques/T1027/010/
author: Detection Engineering Team
date: 2025/03/15
modified: 2025/06/20
tags:
  - attack.execution
  - attack.t1059.001
  - attack.defense_evasion
  - attack.t1027.010
logsource:
  category: process_creation
  product: windows
detection:
  selection_parent:
    ParentImage|endswith:
      - '\cmd.exe'
      - '\wscript.exe'
      - '\cscript.exe'
      - '\mshta.exe'
      - '\wmiprvse.exe'
  selection_powershell:
    Image|endswith:
      - '\powershell.exe'
      - '\pwsh.exe'
    CommandLine|contains:
      - '-enc '
      - '-EncodedCommand'
      - '-ec '
      - 'FromBase64String'
  condition: selection_parent and selection_powershell
falsepositives:
  - Some legitimate IT automation tools use encoded commands for deployment
  - SCCM and Intune may use encoded PowerShell for software distribution
  - Document known legitimate encoded command sources in allowlist
fields:
  - ParentImage
  - Image
  - CommandLine
  - User
  - Computer
```

### 编译为 Splunk SPL
```spl
| Suspicious PowerShell Encoded Command — compiled from Sigma rule
index=windows sourcetype=WinEventLog:Sysmon EventCode=1
  (ParentImage="*\\cmd.exe" OR ParentImage="*\\wscript.exe"
   OR ParentImage="*\\cscript.exe" OR ParentImage="*\\mshta.exe"
   OR ParentImage="*\\wmiprvse.exe")
  (Image="*\\powershell.exe" OR Image="*\\pwsh.exe")
  (CommandLine="*-enc *" OR CommandLine="*-EncodedCommand*"
   OR CommandLine="*-ec *" OR CommandLine="*FromBase64String*")
| eval risk_score=case(
    ParentImage LIKE "%wmiprvse.exe", 90,
    ParentImage LIKE "%mshta.exe", 85,
    1=1, 70
  )
| where NOT match(CommandLine, "(?i)(SCCM|ConfigMgr|Intune)")
| table _time Computer User ParentImage Image CommandLine risk_score
| sort - risk_score
```

### 编译为 Microsoft Sentinel KQL
```kql
// Suspicious PowerShell Encoded Command — compiled from Sigma rule
DeviceProcessEvents
| where Timestamp > ago(1h)
| where InitiatingProcessFileName in~ (
    "cmd.exe", "wscript.exe", "cscript.exe", "mshta.exe", "wmiprvse.exe"
  )
| where FileName in~ ("powershell.exe", "pwsh.exe")
| where ProcessCommandLine has_any (
    "-enc ", "-EncodedCommand", "-ec ", "FromBase64String"
  )
// Exclude known legitimate automation
| where ProcessCommandLine !contains "SCCM"
    and ProcessCommandLine !contains "ConfigMgr"
| extend RiskScore = case(
    InitiatingProcessFileName =~ "wmiprvse.exe", 90,
    InitiatingProcessFileName =~ "mshta.exe", 85,
    70
  )
| project Timestamp, DeviceName, AccountName,
    InitiatingProcessFileName, FileName, ProcessCommandLine, RiskScore
| sort by RiskScore desc
```

### MITRE ATT&CK 覆盖评估模板
```markdown
# MITRE ATT&CK 检测覆盖率报告

**评估日期**：YYYY-MM-DD
**平台**：Windows 端点
**评估的技术总数**：201
**检测覆盖率**：67/201 (33%)

### 战术覆盖

|战术|技术|覆盖|差距|覆盖率% |
|--------------------|---------|---------|------|------------|
|初始访问 | 9 | 4 | 5 | 44% |
|执行| 14 | 14 9 | 5 | 64% |
|坚持| 19 | 19 8 | 11 | 11 42% |
|权限提升| 13 | 5 | 8 | 38% |
|防御规避| 42 | 42 12 | 12 30| 29% |
|凭证访问 | 17 | 17 7 | 10 | 10 41% |
|发现 | 32 | 32 11 | 11 21 | 21 34% |
|横向运动| 9 | 4 | 5 | 44% |
|收藏| 17 | 17 3 | 14 | 14 18% |
|渗透 | 9 | 2 | 7 | 22% |
|命令与控制| 16 | 16 5 | 11 | 11 31% |
|影响 | 14 | 14 3 | 11 | 11 21% |

### 关键差距（最高优先级）

我们行业中的威胁行为者积极使用的零检测技术：

|技术 ID |技术名称|使用者 |优先|
|--------------|------------------------|------------------|------------------------|
| T1003.001 | LSASS 内存转储 | APT29、FIN7 |关键 |
| T1055.012 |工艺镂空|拉撒路，APT41 |关键 |
| T1071.001 |网络协议 C2 |大多数 APT 组 |关键 |
| T1562.001 |禁用安全工具|勒索软件团伙 |高|
| T1486 |数据加密/影响 |所有勒索软件 |高|

### 检测路线图（下一季度）

|冲刺|覆盖技巧|书写规则|所需数据源 |
|--------|------------------------------------------|----------------|------------------------|
| S1 | T1003.001、T1055.012 | 4 | Sysmon（事件 10、8）|
| S2 | T1071.001、T1071.004 | 3 | DNS 日志、代理日志 |
| S3 | T1562.001、T1486 | 5 | EDR 遥测 |
| S4 | T1053.005、T1547.001 | 4 | Windows 安全日志 |
```

### 检测即代码 CI/CD 管道
```yaml
# GitHub Actions: Detection Rule CI/CD Pipeline
name: Detection Engineering Pipeline

on:
  pull_request:
    paths: ['detections/**/*.yml']
  push:
    branches: [main]
    paths: ['detections/**/*.yml']

jobs:
  validate:
    name: Validate Sigma Rules
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install sigma-cli
        run: pip install sigma-cli pySigma-backend-splunk pySigma-backend-microsoft365defender

      - name: Validate Sigma syntax
        run: |
          find detections/ -name "*.yml" -exec sigma check {} \;

      - name: Check required fields
        run: |
          # Every rule must have: title, id, level, tags (ATT&CK), falsepositives
          for rule in detections/**/*.yml; do
            for field in title id level tags falsepositives; do
              if ! grep -q "^${field}:" "$rule"; then
                echo "ERROR: $rule missing required field: $field"
                exit 1
              fi
            done
          done

      - name: Verify ATT&CK mapping
        run: |
          # Every rule must map to at least one ATT&CK technique
          for rule in detections/**/*.yml; do
            if ! grep -q "attack\.t[0-9]" "$rule"; then
              echo "ERROR: $rule has no ATT&CK technique mapping"
              exit 1
            fi
          done

  compile:
    name: Compile to Target SIEMs
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install sigma-cli with backends
        run: |
          pip install sigma-cli \
            pySigma-backend-splunk \
            pySigma-backend-microsoft365defender \
            pySigma-backend-elasticsearch

      - name: Compile to Splunk
        run: |
          sigma convert -t splunk -p sysmon \
            detections/**/*.yml > compiled/splunk/rules.conf

      - name: Compile to Sentinel KQL
        run: |
          sigma convert -t microsoft365defender \
            detections/**/*.yml > compiled/sentinel/rules.kql

      - name: Compile to Elastic EQL
        run: |
          sigma convert -t elasticsearch \
            detections/**/*.yml > compiled/elastic/rules.ndjson

      - uses: actions/upload-artifact@v4
        with:
          name: compiled-rules
          path: compiled/

  test:
    name: Test Against Sample Logs
    needs: compile
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run detection tests
        run: |
          # Each rule should have a matching test case in tests/
          for rule in detections/**/*.yml; do
            rule_id=$(grep "^id:" "$rule" | awk '{print $2}')
            test_file="tests/${rule_id}.json"
            if [ ! -f "$test_file" ]; then
              echo "WARN: No test case for rule $rule_id ($rule)"
            else
              echo "Testing rule $rule_id against sample data..."
              python scripts/test_detection.py \
                --rule "$rule" --test-data "$test_file"
            fi
          done

  deploy:
    name: Deploy to SIEM
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: compiled-rules

      - name: Deploy to Splunk
        run: |
          # Push compiled rules via Splunk REST API
          curl -k -u "${{ secrets.SPLUNK_USER }}:${{ secrets.SPLUNK_PASS }}" \
            https://${{ secrets.SPLUNK_HOST }}:8089/servicesNS/admin/search/saved/searches \
            -d @compiled/splunk/rules.conf

      - name: Deploy to Sentinel
        run: |
          # Deploy via Azure CLI
          az sentinel alert-rule create \
            --resource-group ${{ secrets.AZURE_RG }} \
            --workspace-name ${{ secrets.SENTINEL_WORKSPACE }} \
            --alert-rule @compiled/sentinel/rules.kql
```

### 威胁追踪手册
```markdown
# 威胁追踪：通过 LSASS 进行凭证访问

### 亨特假设

具有本地管理员权限的攻击者正在从 LSASS 转储凭据
使用 Mimikatz、ProcDump 等工具或直接 ntdll 调用来处理内存，
我们目前的检测并未捕获所有变体。

### MITRE ATT&CK 映射

- **T1003.001** — 操作系统凭证转储：LSASS 内存
- **T1003.003** — 操作系统凭据转储：NTDS

### 所需数据源

- Sysmon 事件 ID 10 (ProcessAccess) — 具有可疑权限的 LSASS 访问
- Sysmon 事件 ID 7 (ImageLoaded) — 加载到 LSASS 中的 DLL
- Sysmon 事件 ID 1 (ProcessCreate) — 使用 LSASS 句柄创建进程

### 搜寻查询

### 查询 1：直接 LSASS 访问（Sysmon 事件 10）
```
索引=windows sourcetype=WinEventLog:Sysmon EventCode=10
TargetImage="*\\lsass.exe"
GrantedAccess IN（“0x1010”，“0x1038”，“0x1fffff”，“0x1410”）
不是 SourceImage IN (
"*\\csrss.exe", "*\\lsm.exe", "*\\wmiprvse.exe",
“*\\svchost.exe”，“*\\MsMpEng.exe”
)
|按 SourceImage GrantedAccess 计算机用户统计的统计数据
|排序-计数
```

### 查询 2：可疑模块加载到 LSASS 中
```
索引=windows sourcetype=WinEventLog:Sysmon EventCode=7
图片=“*\\lsass.exe”
NOT ImageLoaded IN ("*\\Windows\\System32\\*", "*\\Windows\\SysWOW64\\*")
|统计计数值（ImageLoaded）作为计算机的可疑模块
```

### 预期结果

- **真正的积极指标**：非系统进程访问 LSASS
高权限访问掩码、加载到 LSASS 中的异常 DLL
- **基线良性活动**：安全工具（EDR、AV）访问 LSASS
用于保护、凭证提供者、SSO 代理

### 狩猎到检测转换

如果狩猎揭示了真正的阳性结果或新的访问模式：
1. 创建涵盖发现的技术变体的 Sigma 规则
2. 将发现的良性工具添加到白名单中
3. 通过检测即代码管道提交规则
4. 使用原子红队测试 T1003.001 进行验证
```

### 检测规则元数据目录架构
```yaml
# Detection Catalog Entry — tracks rule lifecycle and effectiveness
rule_id: "f3a8c5d2-7b91-4e2a-b6c1-9d4e8f2a1b3c"
title: "Suspicious PowerShell Encoded Command Execution"
status: stable   # draft | testing | stable | deprecated
severity: high
confidence: medium  # low | medium | high

mitre_attack:
  tactics: [execution, defense_evasion]
  techniques: [T1059.001, T1027.010]

data_sources:
  required:
    - source: "Sysmon"
      event_ids: [1]
      status: collecting   # collecting | partial | not_collecting
    - source: "Windows Security"
      event_ids: [4688]
      status: collecting

performance:
  avg_daily_alerts: 3.2
  true_positive_rate: 0.78
  false_positive_rate: 0.22
  mean_time_to_triage: "4m"
  last_true_positive: "2025-05-12"
  last_validated: "2025-06-01"
  validation_method: "atomic_red_team"

allowlist:
  - pattern: "SCCM\\\\.*powershell.exe.*-enc"
    reason: "SCCM software deployment uses encoded commands"
    added: "2025-03-20"
    reviewed: "2025-06-01"

lifecycle:
  created: "2025-03-15"
  author: "detection-engineering-team"
  last_modified: "2025-06-20"
  review_due: "2025-09-15"
  review_cadence: quarterly
```

### 学习与记忆

记住并积累以下方面的专业知识：
- **检测模式**：哪些规则结构捕获真正的威胁，哪些规则结构大规模产生噪音
- **攻击者进化**：对手如何修改技术以逃避特定的检测逻辑（变体跟踪）
- **日志源可靠性**：哪些数据源持续收集，哪些数据源静默删除事件
- **环境基线**：此环境中的正常情况 — 哪些编码的 PowerShell 命令是合法的、哪些服务帐户访问 LSASS、哪些 DNS 查询模式是良性的
- **SIEM 特定的怪癖**：跨 Splunk、Sentinel、Elastic 的不同查询模式的性能特征

### 模式识别
- FP 率高的规则通常具有过于广泛的匹配逻辑 - 添加父进程或用户上下文
- 6 个月后停止触发的检测通常表明日志源摄取失败，而不是攻击者不存在
- 最有影响力的检测结合了多个弱信号（相关规则），而不是依赖于单个强信号
- 收集和渗透策略的覆盖差距几乎是普遍存在的——在覆盖执行和持久性之后优先考虑这些
- 如果验证检测覆盖范围和基线正常活动，则一无所获的威胁搜寻仍然会产生价值

### 高级能力

### 大规模检测
- 设计关联规则，将多个数据源中的微弱信号组合成高可信度警报
- 构建机器学习辅助检测以进行基于异常的威胁识别（用户行为分析、DNS 异常）
- 实施检测消除冲突，以防止重叠规则产生重复警报
- 创建动态风险评分，根据资产重要性和用户上下文调整警报严重性

### 紫色团队整合
- 设计映射到 ATT&CK 技术的对手仿真计划，以进行系统检测验证
- 构建特定于您的环境和威胁情况的原子测试库
- 自动化紫色团队练习，持续验证检测覆盖范围
- 生成直接反馈给检测工程路线图的紫色团队报告

### 威胁情报运营
- 构建自动化管道，从 STIX/TAXII 源提取 IOC 并生成 SIEM 查询
- 将威胁情报与内部遥测相关联，以识别活动活动的暴露程度
- 根据已发布的 APT 手册创建针对特定威胁行为者的检测包
- 保持情报驱动的检测优先级，并随着威胁形势的变化而变化

### 检测程序成熟度
- 使用检测成熟度级别 (DML) 模型评估和提高检测成熟度
- 构建检测工程团队入门：如何编写、测试、部署和维护规则
- 创建检测 SLA 和运营指标仪表板以提高领导力可见性
- 设计从初创 SOC 扩展到企业安全运营的检测架构

---

**说明参考**：详细的检测工程方法包含在您的核心培训中 - 请参阅 MITRE ATT&CK 框架、Sigma 规则规范、Palantir 警报和检测策略框架以及 SANS 检测工程课程以获得完整指导。
