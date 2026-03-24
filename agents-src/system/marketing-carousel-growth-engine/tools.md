### 工作流程

### 第一阶段：从历史中学习
1. **获取分析**：通过 `check-analytics.sh` 调用 Upload-Post 分析端点以获取配置文件指标和每个帖子的性能
2. **提取见解**：运行 `learn-from-analytics.js` 来识别性能最佳的挂钩、最佳发布时间和参与模式
3. **更新学习**：积累对 `learnings.json` 持久知识库的见解
4. **计划下一个轮播**：阅读 `learnings.json`，从最佳表现者中选择挂钩样式，安排在最佳时间，应用建议

### 第二阶段：研究与分析
1. **网站抓取**：运行 `analyze-web.js` 对目标 URL 进行基于 Playwright 的完整分析
2. **品牌提取**：颜色、版式、徽标、图标以实现视觉一致性
3. **内容挖掘**：来自所有内部页面的功能、推荐、统计数据、定价、CTA
4. **利基检测**：对业务类型进行分类并生成适合利基的故事讲述
5. **竞争对手映射**：识别网站内容中提到的竞争对手

### 第 3 阶段：生成和验证
1. **幻灯片生成**：运行 `generate-slides.sh`，它通过 `uv` 调用 `generate_image.py`，以使用 Gemini (`gemini-3.1-flash-image-preview`) 创建 6 张幻灯片
2. **视觉连贯性**：文本提示中的幻灯片 1；幻灯片 2-6 使用 Gemini 图像到图像，将 `slide-1.jpg` 用作 `--input-image`
3. **视觉验证**：代理使用自己的视觉模型来检查每张幻灯片的文本易读性、拼写、质量以及底部 20% 中没有文本
4. **自动重新生成**：如果任何幻灯片失败，则仅使用 Gemini 重新生成该幻灯片（使用 `slide-1.jpg` 作为参考），重新验证，直到所有 6 个通过

### 第 4 阶段：发布和跟踪
1. **多平台发布**：运行 `publish-carousel.sh` 以使用 `platform[]=tiktok&platform[]=instagram` 将 6 张幻灯片推送到 Upload-Post API (`POST /api/upload_photos`)
2. **流行音乐**：`auto_add_music=true` 在 TikTok 上添加流行音乐以提升算法性能
3. **元数据捕获**：将 API 响应中的 `request_id` 保存到 `post-info.json` 以进行分析跟踪
4. **用户通知**：仅在一切成功后报告已发布的 TikTok + Instagram URL
5. **自我调度**：读取 `learnings.json` bestTimes 并设置下一个 cron 执行在最佳时间

### 外部服务

- 双子座 API |等级：免费| ZXTToken0ZX
- 上传-发布 |等级：免费 | ZXTToken0ZX
