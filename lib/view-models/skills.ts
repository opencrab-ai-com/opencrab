import { skills, type SkillItem } from "@/lib/seed-data";

type SkillDetail = {
  category: string;
  categoryDescription: string;
  headline: string;
  capabilities: string[];
  useCases: string[];
  guardrails: string[];
  nextStep: string;
  coverageLabel: string;
  idealFor: string;
  dependencyLabel: string;
};

export type SkillViewModel = SkillItem &
  SkillDetail & {
    isEnabled: boolean;
  };

const SKILL_DETAILS: Record<SkillItem["id"], SkillDetail> = {
  "doc-structuring": {
    category: "文档协作",
    categoryDescription: "围绕需求、方案和说明文档做结构化整理。",
    headline: "把零散需求和说明整理成清晰、可继续协作的文档结构。",
    capabilities: ["需求拆解", "章节重组", "说明润色", "交付文档收口"],
    useCases: ["PRD 草稿整理", "技术方案目录梳理", "交付说明收口"],
    guardrails: ["不会替代事实核验", "不负责大型知识库维护", "需要用户提供原始材料"],
    nextStep: "后续适合补模板化输出，让常见文档可以一键起稿。",
    coverageLabel: "需求到说明文档",
    idealFor: "有大量文字整理需求的日常协作",
    dependencyLabel: "直接复用对话主链路，无额外依赖",
  },
  "task-automation": {
    category: "自动执行",
    categoryDescription: "围绕提醒、整理和固定时间触发的执行动作。",
    headline: "把重复性的整理、提醒和回顾任务收成固定执行流程。",
    capabilities: ["定时提醒", "周期回顾", "固定格式整理", "执行结果回流"],
    useCases: ["日报整理", "每周产品回顾", "客户跟进提醒"],
    guardrails: ["依赖明确触发条件", "复杂审批流尚未覆盖", "暂未和任务中心完全打通"],
    nextStep: "下一步应与任务中心共用执行记录和触发配置，避免两套产品心智。",
    coverageLabel: "提醒与回顾型任务",
    idealFor: "有稳定节奏、固定格式输出的工作流",
    dependencyLabel: "后续将与任务中心共享调度能力",
  },
  "channel-assistant": {
    category: "远程入口",
    categoryDescription: "围绕外部渠道接入、会话绑定和结果回流。",
    headline: "把 OpenCrab 对话带到外部渠道，同时保持消息和结果可追踪。",
    capabilities: ["外部消息接入", "会话自动绑定", "结果回流", "渠道上下文承接"],
    useCases: ["Telegram 私聊入口", "飞书机器人协作", "异步远程追问"],
    guardrails: ["附件回传未完成", "多租户权限未实现", "复杂运营面板暂不支持"],
    nextStep: "优先跟随 Channels 完成文本闭环，再扩展附件和更细的权限边界。",
    coverageLabel: "远程文本对话入口",
    idealFor: "需要把同一套对话能力带到站外渠道",
    dependencyLabel: "直接依赖 Channels 的接入与回推能力",
  },
};

export function getSkillViewModels(): SkillViewModel[] {
  return skills.map((skill) => ({
    ...skill,
    ...SKILL_DETAILS[skill.id],
    isEnabled: skill.status === "已启用",
  }));
}

export function getSkillViewModelById(skillId: string) {
  return getSkillViewModels().find((skill) => skill.id === skillId) ?? null;
}

export function getSkillOverviewStats() {
  const viewModels = getSkillViewModels();

  return {
    total: viewModels.length,
    enabled: viewModels.filter((skill) => skill.isEnabled).length,
    pending: viewModels.filter((skill) => !skill.isEnabled).length,
    categories: new Set(viewModels.map((skill) => skill.category)).size,
  };
}
