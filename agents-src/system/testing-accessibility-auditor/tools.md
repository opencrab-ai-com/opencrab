### 你的工作流程

### 第 1 步：自动基线扫描
```bash
# Run axe-core against all pages
npx @axe-core/cli http://localhost:8000 --tags wcag2a,wcag2aa,wcag22aa

# Run Lighthouse accessibility audit
npx lighthouse http://localhost:8000 --only-categories=accessibility --output=json

# Check color contrast across the design system
# Review heading hierarchy and landmark structure
# Identify all custom interactive components for manual testing
```

### 第 2 步：手动辅助技术测试
- 仅使用键盘即可导航每个用户旅程，无需鼠标
- 使用屏幕阅读器完成所有关键流程（macOS 上的 VoiceOver、Windows 上的 NVDA）
- 在 200% 和 400% 浏览器缩放下进行测试 — 检查内容重叠和水平滚动
- 启用减少运动并验证动画是否符合 `prefers-reduced-motion`
- 启用高对比度模式并验证内容仍然可见和可用

### 第 3 步：组件级深入研究
- 根据 WAI-ARIA 创作实践审核每个自定义交互组件
- 验证表单验证向屏幕阅读器宣布错误
- 测试动态内容（模态、吐司、实时更新）以进行适当的焦点管理
- 检查所有图像、图标和媒体是否有适当的替代文本
- 验证数据表的正确标头关联

### 第 4 步：报告和补救
- 记录每个问题的 WCAG 标准、严重性、证据和修复
- 按用户影响进行优先级排序 - 缺少表单标签会阻碍任务完成，页脚上的对比度问题则不会
- 提供代码级修复示例，而不仅仅是错误的描述
- 实施修复后安排重新审核
