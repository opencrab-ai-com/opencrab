import packageJson from "../../package.json";

export const OPENCRAB_RELEASE_VERSION = packageJson.version;

export const OPENCRAB_ABOUT_LINKS = [
  {
    label: "官方网站",
    value: "opencrab-ai.com",
    href: "https://opencrab-ai.com",
    description: "了解产品定位、更新和对外信息。",
  },
  {
    label: "联系邮箱",
    value: "sky@opencrab-ai.com",
    href: "mailto:sky@opencrab-ai.com",
    description: "合作沟通、反馈问题或预约交流。",
  },
  {
    label: "GitHub",
    value: "github.com/opencrab-ai-com/opencrab",
    href: "https://github.com/opencrab-ai-com/opencrab",
    description: "查看源码、文档和公开迭代内容。",
  },
] as const;

export const OPENCRAB_ABOUT_HIGHLIGHTS = [
  "聊天是主入口，尽量让普通用户不必先学习开发者工具链。",
  "本地优先，运行时数据、附件和渠道密钥默认存储在仓库之外。",
  "统一工作空间，网页、Telegram 和飞书可以逐步接入到同一套会话上下文。",
  "保留强大的执行能力，但把日常使用界面做得更轻、更直观。",
] as const;

export const OPENCRAB_PRODUCT_PRINCIPLES = [
  "默认简单，不让普通用户先学术语。",
  "已有底层能力优先直接复用。",
  "少而稳，先把聊天主链路做扎实。",
  "中文优先，配置低频化。",
] as const;

export const OPENCRAB_ITERATION_HISTORY = [
  {
    stage: "Stage 01",
    title: "聊天主入口先成型",
    description:
      "先把首页、流式回复、历史对话和文件夹管理搭稳，让 OpenCrab 从第一天开始就是一只真正能对话的小螃蟹工作台。",
  },
  {
    stage: "Stage 02",
    title: "附件与浏览器能力打通",
    description:
      "补齐图片、文件上传和常见文档文本提取，并接入 current-browser 与 managed-browser 两种浏览器模式。",
  },
  {
    stage: "Stage 03",
    title: "Channels 进入可用的 V1",
    description:
      "Telegram webhook 与飞书长连接已经进入第一版实现，远程消息可以逐步回到同一套 OpenCrab conversation。",
  },
  {
    stage: "Stage 04",
    title: "任务与技能成为第二层能力",
    description:
      "任务中心支持创建、暂停、恢复、立即执行与结果回流；Skills 支持目录浏览、详情、启停状态和自定义条目。",
  },
] as const;

export const OPENCRAB_ROADMAP_PROGRESS = [
  {
    title: "对话主链路",
    progress: 92,
    status: "稳定推进",
    summary: "聊天、流式回复、历史持久化与附件链路已经是当前最完整的一块能力。",
    nextStep: "继续优化首页体验、稳定性和更细腻的空态反馈。",
  },
  {
    title: "Channels",
    progress: 78,
    status: "持续完善",
    summary: "Telegram 已覆盖较完整的文本 / 图片 / 文件闭环，飞书当前以文本消息闭环为主。",
    nextStep: "补齐飞书附件链路，并逐步扩展更完整的运维和运营面板。",
  },
  {
    title: "Tasks",
    progress: 74,
    status: "可用增强中",
    summary: "创建、暂停、恢复、立即执行、结果回流和从对话创建任务都已经打通。",
    nextStep: "增强系统级常驻调度能力，并补充更灵活的计划表达方式。",
  },
  {
    title: "Skills",
    progress: 68,
    status: "持续生长",
    summary: "本地技能目录浏览、详情查看、状态管理与自定义条目已经可用。",
    nextStep: "进一步完善技能安装、管理和更顺滑的扩展体验。",
  },
  {
    title: "协作与云能力",
    progress: 26,
    status: "规划中",
    summary: "当前仍以本地 JSON store 为主，还没有多人协作、账号体系和云同步。",
    nextStep: "后续评估数据库、协作权限和跨设备同步方案。",
  },
] as const;
