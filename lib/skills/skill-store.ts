import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type {
  SkillAction,
  SkillCategory,
  SkillIconName,
  SkillOrigin,
  SkillRecord,
  SkillStatus,
} from "@/lib/resources/opencrab-api-types";
import {
  OPENCRAB_SKILLS_DIR,
  OPENCRAB_SKILLS_STORE_PATH,
} from "@/lib/resources/runtime-paths";
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";
import { resolveOpenCrabResourcePath } from "@/lib/runtime/app-resource-paths";

type CatalogSeed = {
  id: string;
  name: string;
  summary: string;
  category: SkillCategory;
  origin: SkillOrigin;
  icon: SkillIconName;
  sourceUrl: string | null;
  sourcePath: string | null;
  detailsMarkdown: string | null;
  defaultStatus: SkillStatus;
  note: string;
  order: number;
};

type StoredSkillState = {
  status: SkillStatus;
  origin: SkillOrigin;
  category?: SkillCategory;
  name?: string;
  summary?: string;
  detailsMarkdown?: string | null;
  icon?: SkillIconName;
  createdAt: string;
  updatedAt: string;
};

type SkillStoreState = {
  items: Record<string, StoredSkillState>;
};

const STORE_PATH = OPENCRAB_SKILLS_STORE_PATH;
const BUNDLED_SKILLS_SOURCE_ROOT = resolveOpenCrabResourcePath("skills");
let hasEnsuredBundledSkills = false;
const store = createSyncJsonFileStore<SkillStoreState>({
  filePath: STORE_PATH,
  seed: createSeedState,
  normalize: normalizeState,
});

const CODEX_ORDER = [
  "imagegen",
  "frontend-design-polish",
  "design-critique",
  "landing-page-composition",
  "openai-docs",
  "pdf",
  "playwright",
  "screenshot",
  "skill-creator",
  "skill-installer",
  "sora",
  "speech",
] as const;

const DISPLAY_OVERRIDES: Record<
  string,
  {
    name: string;
    summary: string;
    category: SkillCategory;
    icon: SkillIconName;
  }
> = {
  imagegen: {
    name: "Image Gen",
    summary: "Generate and edit images using OpenAI",
    category: "creative-media",
    icon: "image",
  },
  "frontend-design-polish": {
    name: "Frontend Design Polish",
    summary: "Polish existing web UI into a clearer, more intentional product surface",
    category: "product-tech",
    icon: "figma",
  },
  "design-critique": {
    name: "Design Critique",
    summary: "Diagnose visual issues and recommend high-leverage UI improvements",
    category: "creative-media",
    icon: "figma",
  },
  "landing-page-composition": {
    name: "Landing Page Composition",
    summary: "Shape homepages and landing pages with stronger narrative, structure, and CTA flow",
    category: "creative-media",
    icon: "figma",
  },
  "openai-docs": {
    name: "OpenAI Docs",
    summary: "Reference official OpenAI docs, including API guides and examples",
    category: "writing-knowledge",
    icon: "book",
  },
  pdf: {
    name: "PDF Skill",
    summary: "Create, edit, and review PDFs",
    category: "writing-knowledge",
    icon: "pdf",
  },
  playwright: {
    name: "Playwright CLI Skill",
    summary: "Automate real browsers from the terminal",
    category: "product-tech",
    icon: "playwright",
  },
  screenshot: {
    name: "Screenshot Capture",
    summary: "Capture screenshots",
    category: "product-tech",
    icon: "camera",
  },
  "skill-creator": {
    name: "Skill Creator",
    summary: "Create or update a skill",
    category: "product-tech",
    icon: "puzzle",
  },
  "skill-installer": {
    name: "Skill Installer",
    summary: "Install curated skills from openai/skills or other repos",
    category: "product-tech",
    icon: "puzzle",
  },
  sora: {
    name: "Sora Video Generation Skill",
    summary: "Generate and manage Sora videos",
    category: "creative-media",
    icon: "sora",
  },
  speech: {
    name: "Speech Generation Skill",
    summary: "Generate narrated audio from text",
    category: "creative-media",
    icon: "mic",
  },
};

const RECOMMENDED_SKILLS_IDS = [
  "social-content",
  "content-production",
  "content-strategy",
  "marketing-ideas",
  "paid-ads",
  "launch-strategy",
  "brand-guidelines",
  "sales-methodology-implementer",
  "personalization-at-scale",
  "cold-email",
  "email-sequence",
  "analyzing-financial-statements",
  "creating-financial-models",
  "financial-analyst",
  "xlsx",
  "doc-coauthoring",
  "internal-comms",
  "docx",
  "pptx",
  "transcribe",
  "canvas-design",
  "theme-factory",
  "slack-gif-creator",
  "cw-prose-writing",
  "cw-brainstorming",
  "cw-story-critique",
  "board-deck-builder",
  "pricing-strategy",
  "linear",
  "notion-knowledge-capture",
  "notion-meeting-intelligence",
  "notion-research-documentation",
  "notion-spec-to-implementation",
  "planning-with-files",
  "best-minds",
  "find-skills",
  "chatgpt-apps",
  "claude-api",
  "mcp-builder",
  "figma",
  "ui-ux-pro-max",
  "frontend-design",
  "webapp-testing",
] as const;

const RECOMMENDED_SKILLS: CatalogSeed[] = [
  createRecommendedSkill({
    id: "social-content",
    name: "Social Content",
    summary: "Create, schedule, and optimize social content for LinkedIn, X, Instagram, TikTok, and more.",
    category: "marketing-social",
    icon: "book",
    scenarios: ["平台差异化文案", "社媒内容排期", "涨粉与互动目标"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/social-content",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/social-content/",
  }),
  createRecommendedSkill({
    id: "content-production",
    name: "Content Production",
    summary: "Turn a topic into a publish-ready article, guide, or blog post with SEO and conversion in mind.",
    category: "marketing-social",
    icon: "doc",
    scenarios: ["博客写作", "长文内容制作", "从选题到成稿"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/content-production",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/content-production/",
  }),
  createRecommendedSkill({
    id: "content-strategy",
    name: "Content Strategy",
    summary: "Plan content themes, topic clusters, editorial calendars, and lead-generating content programs.",
    category: "marketing-social",
    icon: "book",
    scenarios: ["内容策略", "选题规划", "内容日历"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/content-strategy",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/content-strategy/",
  }),
  createRecommendedSkill({
    id: "marketing-ideas",
    name: "Marketing Ideas",
    summary: "Explore a large library of proven marketing tactics and promotion ideas.",
    category: "marketing-social",
    icon: "puzzle",
    scenarios: ["增长点子", "推广灵感", "营销策略发散"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/marketing-ideas",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/marketing-ideas/",
  }),
  createRecommendedSkill({
    id: "paid-ads",
    name: "Paid Ads",
    summary: "Design and optimize paid ad campaigns across Google, Meta, LinkedIn, and other platforms.",
    category: "marketing-social",
    icon: "cube",
    scenarios: ["广告投放策略", "受众与素材优化", "CPA / ROAS 目标管理"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/paid-ads",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/paid-ads/",
  }),
  createRecommendedSkill({
    id: "launch-strategy",
    name: "Launch Strategy",
    summary: "Plan feature launches, announcements, and go-to-market rollouts that build momentum.",
    category: "marketing-social",
    icon: "cube",
    scenarios: ["新品发布", "功能上线传播", "GTM 节奏规划"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/launch-strategy",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/launch-strategy/",
  }),
  createRecommendedSkill({
    id: "brand-guidelines",
    name: "Brand Guidelines",
    summary: "Apply consistent brand colors, typography, and visual rules across artifacts.",
    category: "marketing-social",
    icon: "image",
    scenarios: ["品牌一致性", "视觉规范", "营销素材统一"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/brand-guidelines",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/brand-guidelines/",
  }),
  createRecommendedSkill({
    id: "sales-methodology-implementer",
    name: "Sales Methodology Implementer",
    summary: "Operationalize MEDDIC, BANT, Sandler, Challenger, and SPIN across real sales workflows.",
    category: "sales-growth",
    icon: "puzzle",
    scenarios: ["销售流程标准化", "资格判定框架", "团队销售训练"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/OneWave-AI/claude-skills/tree/main/sales-methodology-implementer",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/sales-methodology-implementer/",
  }),
  createRecommendedSkill({
    id: "personalization-at-scale",
    name: "Personalization At Scale",
    summary: "Generate researched personalized outreach angles and first lines for many prospects at once.",
    category: "sales-growth",
    icon: "book",
    scenarios: ["外联个性化", "批量销售触达", "Prospect research"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/OneWave-AI/claude-skills/tree/main/personalization-at-scale",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/personalization-at-scale/",
  }),
  createRecommendedSkill({
    id: "cold-email",
    name: "Cold Email",
    summary: "Write thoughtful B2B cold outreach emails that feel human and improve reply rates.",
    category: "sales-growth",
    icon: "doc",
    scenarios: ["开发信", "冷启动外联", "销售跟进邮件"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/cold-email",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/cold-email/",
  }),
  createRecommendedSkill({
    id: "email-sequence",
    name: "Email Sequence",
    summary: "Build lifecycle, onboarding, re-engagement, and nurture email sequences.",
    category: "sales-growth",
    icon: "doc",
    scenarios: ["自动化邮件流程", "欢迎与激活邮件", "线索培育"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/email-sequence",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/email-sequence/",
  }),
  createRecommendedSkill({
    id: "analyzing-financial-statements",
    name: "Analyzing Financial Statements",
    summary: "Calculate and interpret profitability, liquidity, leverage, and valuation ratios from financial statements.",
    category: "finance-analysis",
    icon: "doc",
    scenarios: ["财报解读", "比率分析", "投资分析基础"],
    sourceLabel: "Anthropic Cookbook",
    sourceUrl: "https://github.com/anthropics/claude-cookbooks/tree/main/skills/custom_skills/analyzing-financial-statements",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/analyzing-financial-statements/",
  }),
  createRecommendedSkill({
    id: "creating-financial-models",
    name: "Creating Financial Models",
    summary: "Build DCFs, scenarios, sensitivity tables, and valuation models for strategic decisions.",
    category: "finance-analysis",
    icon: "cube",
    scenarios: ["财务建模", "估值分析", "情景推演"],
    sourceLabel: "Anthropic Cookbook",
    sourceUrl: "https://github.com/anthropics/claude-cookbooks/tree/main/skills/custom_skills/creating-financial-models",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/creating-financial-models/",
  }),
  createRecommendedSkill({
    id: "financial-analyst",
    name: "Financial Analyst",
    summary: "Perform ratio analysis, DCF valuation, budget variance analysis, and rolling forecasts.",
    category: "finance-analysis",
    icon: "book",
    scenarios: ["预算与预测", "管理报表分析", "公司估值"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/finance/financial-analyst",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/financial-analyst/",
  }),
  createRecommendedSkill({
    id: "xlsx",
    name: "XLSX",
    summary: "Create or fix professional spreadsheets, including formulas, charts, and finance-ready formatting.",
    category: "finance-analysis",
    icon: "doc",
    scenarios: ["专业 Excel 交付", "公式校验", "财务模型表格"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/xlsx",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/xlsx/",
  }),
  createRecommendedSkill({
    id: "doc-coauthoring",
    name: "Doc Coauthoring",
    summary: "Guide users through a structured workflow for collaboratively drafting docs, proposals, and specs.",
    category: "writing-knowledge",
    icon: "book",
    scenarios: ["共同写作", "提案与方案", "结构化文档推进"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/doc-coauthoring/",
  }),
  createRecommendedSkill({
    id: "internal-comms",
    name: "Internal Comms",
    summary: "Write status updates, leadership reports, newsletters, FAQs, and other internal communications.",
    category: "writing-knowledge",
    icon: "book",
    scenarios: ["周报月报", "领导更新", "FAQ 与公告"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/internal-comms",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/internal-comms/",
  }),
  createRecommendedSkill({
    id: "docx",
    name: "DOCX",
    summary: "Create, edit, or transform Word documents with stronger control over structure and formatting.",
    category: "writing-knowledge",
    icon: "doc",
    scenarios: ["Word 文档", "报告与备忘录", "目录页码与格式控制"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/docx",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/docx/",
  }),
  createRecommendedSkill({
    id: "pptx",
    name: "PPTX",
    summary: "Read, build, and edit presentation decks when PowerPoint is the primary deliverable.",
    category: "writing-knowledge",
    icon: "doc",
    scenarios: ["Pitch deck", "汇报材料", "演示文稿修改"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/pptx",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/pptx/",
  }),
  createRecommendedSkill({
    id: "transcribe",
    name: "Transcribe",
    summary: "Transcribe audio files to text with optional diarization and speaker hints.",
    category: "writing-knowledge",
    icon: "book",
    scenarios: ["会议录音转写", "采访整理", "带说话人标签的转录"],
    sourceLabel: "OpenAI Curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/transcribe",
    installHint: "$skill-installer transcribe",
  }),
  createRecommendedSkill({
    id: "canvas-design",
    name: "Canvas Design",
    summary: "Create polished visual assets in PNG or PDF formats using a strong design philosophy.",
    category: "creative-media",
    icon: "image",
    scenarios: ["海报与视觉稿", "品牌展示物料", "创意静态内容"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/canvas-design",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/canvas-design/",
  }),
  createRecommendedSkill({
    id: "theme-factory",
    name: "Theme Factory",
    summary: "Apply curated visual themes and font pairings to slides, docs, and landing pages.",
    category: "creative-media",
    icon: "image",
    scenarios: ["品牌视觉主题", "幻灯片换肤", "风格化内容包装"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/theme-factory",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/theme-factory/",
  }),
  createRecommendedSkill({
    id: "slack-gif-creator",
    name: "Slack GIF Creator",
    summary: "Create lightweight animated GIFs optimized for Slack sharing and internal communication.",
    category: "creative-media",
    icon: "image",
    scenarios: ["Slack 动图", "内部传播素材", "轻量动画内容"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/slack-gif-creator/",
  }),
  createRecommendedSkill({
    id: "cw-prose-writing",
    name: "Creative Prose Writing",
    summary: "Draft and edit narrative fiction while respecting project-specific style and voice guides.",
    category: "creative-media",
    icon: "doc",
    scenarios: ["小说与故事写作", "角色对白", "风格一致性"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/haowjy/creative-writing-skills/tree/main/creative-writing-skills/cw-prose-writing",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/cw-prose-writing/",
  }),
  createRecommendedSkill({
    id: "cw-brainstorming",
    name: "Creative Brainstorming",
    summary: "Capture story ideas, character notes, and plot exploration without over-constraining creativity.",
    category: "creative-media",
    icon: "puzzle",
    scenarios: ["灵感记录", "剧情脑暴", "人物与世界观发散"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/haowjy/creative-writing-skills/tree/main/creative-writing-skills/cw-brainstorming",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/cw-brainstorming/",
  }),
  createRecommendedSkill({
    id: "cw-story-critique",
    name: "Story Critique",
    summary: "Provide calibrated feedback on creative writing based on audience, draft stage, and critique goals.",
    category: "creative-media",
    icon: "book",
    scenarios: ["故事反馈", "内容修改建议", "面向目标读者的批评"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/haowjy/creative-writing-skills/tree/main/creative-writing-skills/cw-story-critique",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/cw-story-critique/",
  }),
  createRecommendedSkill({
    id: "board-deck-builder",
    name: "Board Deck Builder",
    summary: "Assemble board, investor, and quarterly update decks with a strong business narrative.",
    category: "business-ops",
    icon: "doc",
    scenarios: ["董事会汇报", "投资人更新", "季度业务复盘"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/c-level-advisor/board-deck-builder",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/board-deck-builder/",
  }),
  createRecommendedSkill({
    id: "pricing-strategy",
    name: "Pricing Strategy",
    summary: "Design pricing tiers, value metrics, packaging, and pricing-page narratives.",
    category: "business-ops",
    icon: "cube",
    scenarios: ["定价策略", "套餐设计", "涨价与包装方案"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/alirezarezvani/claude-skills/tree/main/marketing-skill/pricing-strategy",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/pricing-strategy/",
  }),
  createRecommendedSkill({
    id: "linear",
    name: "Linear",
    summary: "Manage issues, projects, and team workflows in Linear.",
    category: "business-ops",
    icon: "book",
    scenarios: ["Linear issue 管理", "项目推进", "团队协作流程"],
    sourceLabel: "OpenAI Curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/linear",
    installHint: "$skill-installer linear",
  }),
  createRecommendedSkill({
    id: "notion-knowledge-capture",
    name: "Notion Knowledge Capture",
    summary: "Capture conversations and decisions into structured Notion pages.",
    category: "business-ops",
    icon: "book",
    scenarios: ["决策沉淀", "FAQ / how-to 入库", "团队知识管理"],
    sourceLabel: "OpenAI Curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/notion-knowledge-capture",
    installHint: "$skill-installer notion-knowledge-capture",
  }),
  createRecommendedSkill({
    id: "notion-meeting-intelligence",
    name: "Notion Meeting Intelligence",
    summary: "Prepare meeting materials with Notion context and Codex research.",
    category: "business-ops",
    icon: "book",
    scenarios: ["会议议程", "pre-read 准备", "参会材料上下文整合"],
    sourceLabel: "OpenAI Curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/notion-meeting-intelligence",
    installHint: "$skill-installer notion-meeting-intelligence",
  }),
  createRecommendedSkill({
    id: "notion-research-documentation",
    name: "Notion Research Documentation",
    summary: "Research across Notion and synthesize into structured documentation.",
    category: "business-ops",
    icon: "book",
    scenarios: ["调研简报", "对比报告", "带引用的内部文档"],
    sourceLabel: "OpenAI Curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/notion-research-documentation",
    installHint: "$skill-installer notion-research-documentation",
  }),
  createRecommendedSkill({
    id: "notion-spec-to-implementation",
    name: "Notion Spec To Implementation",
    summary: "Turn Notion specs into implementation plans, tasks, and progress tracking.",
    category: "business-ops",
    icon: "book",
    scenarios: ["PRD 到任务拆解", "实施计划", "规格到交付追踪"],
    sourceLabel: "OpenAI Curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/notion-spec-to-implementation",
    installHint: "$skill-installer notion-spec-to-implementation",
  }),
  createRecommendedSkill({
    id: "planning-with-files",
    name: "Planning With Files",
    summary: "Use persistent markdown files like task_plan.md, findings.md, and progress.md to plan and track complex work.",
    category: "business-ops",
    icon: "doc",
    scenarios: ["复杂任务拆解", "持续记录进展", "多轮任务不中断接力"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/OthmanAdi/planning-with-files/tree/master/.codex/skills/planning-with-files",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/planning-with-files/",
  }),
  createRecommendedSkill({
    id: "best-minds",
    name: "Best Minds",
    summary: "Answer by simulating the world-class experts who understand a problem best, grounded in their real public ideas.",
    category: "writing-knowledge",
    icon: "book",
    scenarios: ["专家视角分析", "商业与战略判断", "更有依据的观点生成"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/Ceeon/best-minds",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/best-minds/",
  }),
  createRecommendedSkill({
    id: "find-skills",
    name: "Find Skills",
    summary: "Help users discover and install relevant skills when they ask for a capability, workflow, or specialized help.",
    category: "product-tech",
    icon: "puzzle",
    scenarios: ["帮用户找 skill", "按场景发现能力", "扩展 OpenCrab 技能库"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/vercel-labs/skills/tree/main/skills/find-skills",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/find-skills/",
  }),
  createRecommendedSkill({
    id: "chatgpt-apps",
    name: "ChatGPT Apps",
    summary: "Build, scaffold, refactor, and troubleshoot ChatGPT Apps SDK applications.",
    category: "product-tech",
    icon: "cube",
    scenarios: ["ChatGPT Apps SDK", "MCP server + widget UI", "官方 Apps 模式脚手架"],
    sourceLabel: "OpenAI Curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/chatgpt-apps",
    installHint: "$skill-installer chatgpt-apps",
  }),
  createRecommendedSkill({
    id: "claude-api",
    name: "Claude API",
    summary: "Build apps with the Claude API or Anthropic SDK.",
    category: "product-tech",
    icon: "puzzle",
    scenarios: ["Anthropic SDK 接入", "Claude Agent SDK", "Claude 应用开发"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/claude-api",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/claude-api/",
  }),
  createRecommendedSkill({
    id: "mcp-builder",
    name: "MCP Builder",
    summary: "Guide for creating high-quality MCP servers for external APIs or services.",
    category: "product-tech",
    icon: "puzzle",
    scenarios: ["MCP server 设计", "外部 API 集成", "Python / TS MCP 开发"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/mcp-builder",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/mcp-builder/",
  }),
  createRecommendedSkill({
    id: "figma",
    name: "Figma",
    summary: "Use the Figma MCP server to fetch design context and translate nodes into code.",
    category: "product-tech",
    icon: "figma",
    scenarios: ["Figma MCP", "设计到代码", "截图和 design context 拉取"],
    sourceLabel: "OpenAI Curated",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/figma",
    installHint: "$skill-installer figma",
  }),
  createRecommendedSkill({
    id: "ui-ux-pro-max",
    name: "UI UX Pro Max",
    summary: "Design intelligence for web and mobile UI/UX across multiple stacks, with style systems, color palettes, typography, accessibility, and layout rules.",
    category: "product-tech",
    icon: "figma",
    scenarios: ["网页与移动端界面设计", "设计系统与视觉规范", "UI/UX 评审与优化"],
    sourceLabel: "Community Verified",
    sourceUrl: "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/ui-ux-pro-max/",
  }),
  createRecommendedSkill({
    id: "frontend-design",
    name: "Frontend Design",
    summary: "Create distinctive, production-grade frontend interfaces with high design quality.",
    category: "product-tech",
    icon: "figma",
    scenarios: ["高设计质量前端", "Landing page / dashboard", "避免 AI slop 风格"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/frontend-design",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/frontend-design/",
  }),
  createRecommendedSkill({
    id: "webapp-testing",
    name: "Webapp Testing",
    summary: "Toolkit for interacting with and testing local web applications using Playwright.",
    category: "product-tech",
    icon: "playwright",
    scenarios: ["本地 WebApp 测试", "Playwright 脚本化检查", "前端功能验证"],
    sourceLabel: "Anthropic Official",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/webapp-testing",
    installHint: "复制上游技能目录到 ~/.opencrab/skills/webapp-testing/",
  }),
];

type RecommendedSkillInput = {
  id: string;
  name: string;
  summary: string;
  category: SkillCategory;
  icon: SkillIconName;
  scenarios: string[];
  sourceLabel:
    | "OpenAI Curated"
    | "Anthropic Official"
    | "Anthropic Cookbook"
    | "Community Verified";
  sourceUrl: string;
  installHint: string;
};

function createRecommendedSkill(input: RecommendedSkillInput): CatalogSeed {
  const sourceSummary =
    input.sourceLabel === "OpenAI Curated"
      ? "来自 OpenAI 官方 curated skills，可直接通过标准 Codex skill 目录安装。"
      : input.sourceLabel === "Anthropic Official"
        ? "来自 Anthropic 官方 skills 仓库，采用标准 SKILL.md 结构，可作为 Claude / Agent Skills 标准包来适配。"
        : input.sourceLabel === "Anthropic Cookbook"
          ? "来自 Anthropic 官方 cookbook 的 custom skills 示例，结构清晰，适合直接移植到 OpenCrab 的 skill 目录。"
          : "来自公开 GitHub 社区仓库，已核过标准 SKILL.md 结构和目录可读性后才纳入推荐。";

  return {
    id: input.id,
    name: input.name,
    summary: input.summary,
    category: input.category,
    origin: "recommended",
    icon: input.icon,
    sourceUrl: input.sourceUrl,
    sourcePath: null,
    detailsMarkdown: [
      `# ${input.name}`,
      "",
      input.summary,
      "",
      "## 推荐用途",
      ...input.scenarios.map((item) => `- ${item}`),
      "",
      "## 来源",
      `- 目录：${input.sourceLabel}`,
      `- 链接：[查看上游来源](${input.sourceUrl})`,
      `- 安装：\`${input.installHint}\``,
      "",
      "## 适配说明",
      `- ${sourceSummary}`,
      "- OpenCrab 只会推荐那些能映射到本地 skill 管理模型的来源项。",
    ].join("\n"),
    defaultStatus: "available",
    note:
      input.sourceLabel === "OpenAI Curated"
        ? `官方精选技能。来源：${input.sourceUrl}`
        : input.sourceLabel === "Anthropic Official"
          ? `Anthropic 官方技能。来源：${input.sourceUrl}`
          : input.sourceLabel === "Anthropic Cookbook"
            ? `Anthropic 官方 cookbook 技能。来源：${input.sourceUrl}`
            : `社区已验证技能。来源：${input.sourceUrl}`,
    order: 100 + (RECOMMENDED_SKILLS_IDS as readonly string[]).indexOf(input.id),
  };
}

export function listSkills(): SkillRecord[] {
  const catalog = buildCatalog();
  const state = readState();

  return catalog
    .map((seed, index) => ({
      skill: materializeSkill(seed, state.items[seed.id] ?? null),
      index,
    }))
    .sort((left, right) => compareSkills(left.skill, right.skill, left.index, right.index))
    .map((entry) => entry.skill);
}

export function listSkillsCatalog(): SkillRecord[] {
  return listSkills().map((skill) => ({
    ...skill,
    detailsMarkdown: null,
  }));
}

export function ensureBundledSkillsReady() {
  ensureBundledSkillsInstalled();
}

export function getSkill(skillId: string) {
  return listSkills().find((skill) => skill.id === skillId) ?? null;
}

export async function getSkillDetail(skillId: string) {
  const skill = getSkill(skillId);

  if (!skill) {
    return null;
  }

  if (skill.origin !== "recommended" || !skill.sourceUrl || skill.sourcePath) {
    if (skill.sourcePath && !skill.detailsMarkdown) {
      const parsed = parseSkillFile(skill.sourcePath, { includeDetails: true });

      return {
        ...skill,
        detailsMarkdown: parsed.detailsMarkdown,
      };
    }

    return skill;
  }

  const upstreamMarkdown = await fetchUpstreamSkillMarkdown(skill.sourceUrl);

  if (!upstreamMarkdown) {
    return skill;
  }

  return {
    ...skill,
    detailsMarkdown: upstreamMarkdown,
  };
}

export function createCustomSkill(input: {
  name: string;
  summary: string;
  detailsMarkdown?: string | null;
}) {
  const name = input.name.trim();
  const summary = input.summary.trim();

  if (!name || !summary) {
    throw new Error("技能名称和简介不能为空。");
  }

  const state = readState();
  const baseId = toSlug(name) || "custom-skill";
  let nextId = baseId;
  let suffix = 2;

  while (state.items[nextId] || getSkill(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const now = new Date().toISOString();
  state.items[nextId] = {
    status: "installed",
    origin: "custom",
    category: "general",
    name,
    summary,
    detailsMarkdown:
      input.detailsMarkdown?.trim() ||
      `# ${name}\n\n${summary}\n\nThis is a custom OpenCrab skill. It only exists in OpenCrab's local skills store.`,
    icon: "puzzle",
    createdAt: now,
    updatedAt: now,
  };
  writeState(state);

  return getSkill(nextId);
}

export async function mutateSkill(skillId: string, action: SkillAction) {
  const skill = getSkill(skillId);

  if (!skill) {
    throw new Error("技能不存在。");
  }

  const state = readState();
  const existing = state.items[skillId];
  const now = new Date().toISOString();

  if (action === "uninstall" && existing?.origin === "custom") {
    delete state.items[skillId];
    writeState(state);
    return null;
  }

  if ((action === "install" || action === "enable") && skill.origin === "recommended") {
    await ensureRecommendedSkillInstalled(skillId);
  }

  if (action === "uninstall" && skill.origin === "recommended") {
    removeManagedSkill(skillId);
  }

  const nextStatus =
    action === "disable"
      ? "disabled"
      : action === "uninstall"
        ? "available"
        : "installed";

  state.items[skillId] = {
    status: nextStatus,
    origin: existing?.origin || skill.origin,
    category: normalizeCategory(existing?.category || skill.category, skillId),
    name: existing?.name,
    summary: existing?.summary,
    detailsMarkdown: existing?.detailsMarkdown,
    icon: existing?.icon,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  writeState(state);

  return getSkill(skillId);
}

function buildCatalog() {
  const codexSkills = discoverCodexSkills();
  const recommendedSkills = RECOMMENDED_SKILLS.map((seed) => {
    const managedSourcePath = getManagedSkillFile(seed.id);

    if (!managedSourcePath) {
      return seed;
    }

    return {
      ...seed,
      sourcePath: managedSourcePath,
      detailsMarkdown: null,
      note: `已安装到 ${managedSourcePath}。卸载只会移除 OpenCrab 自己管理的技能目录，不会影响其他工具。`,
    };
  });
  const state = readState();
  const customSkills = Object.entries(state.items)
    .filter(([, item]) => item.origin === "custom")
    .map(([id, item], index) => ({
      id,
      name: item.name || "Custom Skill",
      summary: item.summary || "Custom OpenCrab skill",
      category: normalizeCategory(item.category, id),
      origin: "custom" as const,
      icon: item.icon || "puzzle",
      sourceUrl: null,
      sourcePath: null,
      detailsMarkdown: item.detailsMarkdown || null,
      defaultStatus: item.status,
      note: "仅保存在 OpenCrab 本地空间中，不会写入你电脑上其他工具的技能目录。",
      order: 10_000 + index,
    }));

  return dedupeById([...codexSkills, ...recommendedSkills, ...customSkills]);
}

function getRecommendedCatalogSeed(skillId: string) {
  return RECOMMENDED_SKILLS.find((seed) => seed.id === skillId) ?? null;
}

function discoverCodexSkills(): CatalogSeed[] {
  ensureBundledSkillsInstalled();

  const skillFiles = [
    ...collectSkillFiles(OPENCRAB_SKILLS_DIR),
    ...collectSkillFiles(path.join(OPENCRAB_SKILLS_DIR, ".system")),
  ];

  return skillFiles.map((filePath, index) => {
    const slug = path.basename(path.dirname(filePath));
    const parsed = parseSkillFile(filePath, { includeDetails: false });
    const override = DISPLAY_OVERRIDES[slug];

    return {
      id: slug,
      name: override?.name || parsed.name || humanizeSlug(slug),
      summary: override?.summary || parsed.summary || "Imported from your OpenCrab-managed skills library.",
      category: override?.category || inferCategory(slug),
      origin: "codex" as const,
      icon: override?.icon || inferIcon(slug),
      sourceUrl: null,
      sourcePath: filePath,
      detailsMarkdown: null,
      defaultStatus: "installed" as const,
      note: `这是 OpenCrab 当前管理的技能，当前副本位于 ${filePath}。`,
      order: getCodexOrder(slug, index),
    };
  });
}

function collectSkillFiles(root: string) {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, "SKILL.md"))
    .filter((filePath) => existsSync(filePath));
}

function ensureBundledSkillsInstalled() {
  if (hasEnsuredBundledSkills) {
    return;
  }

  if (!existsSync(BUNDLED_SKILLS_SOURCE_ROOT)) {
    hasEnsuredBundledSkills = true;
    return;
  }

  copyBundledSkillDirectories(BUNDLED_SKILLS_SOURCE_ROOT, OPENCRAB_SKILLS_DIR, [".system"]);
  copyBundledSkillDirectories(
    path.join(BUNDLED_SKILLS_SOURCE_ROOT, ".system"),
    path.join(OPENCRAB_SKILLS_DIR, ".system"),
  );
  hasEnsuredBundledSkills = true;
}

function copyBundledSkillDirectories(
  sourceRoot: string,
  targetRoot: string,
  excludeDirectoryNames: string[] = [],
) {
  if (!existsSync(sourceRoot)) {
    return;
  }

  mkdirSync(targetRoot, { recursive: true });

  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || excludeDirectoryNames.includes(entry.name)) {
      continue;
    }

    const sourceDir = path.join(sourceRoot, entry.name);
    const targetDir = path.join(targetRoot, entry.name);

    if (existsSync(path.join(targetDir, "SKILL.md"))) {
      continue;
    }

    rmSync(targetDir, { recursive: true, force: true });
    cpSync(sourceDir, targetDir, {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  }
}

function getManagedSkillFile(skillId: string) {
  const filePath = path.join(OPENCRAB_SKILLS_DIR, skillId, "SKILL.md");
  return existsSync(filePath) ? filePath : null;
}

function removeManagedSkill(skillId: string) {
  rmSync(path.join(OPENCRAB_SKILLS_DIR, skillId), { recursive: true, force: true });
}

async function ensureRecommendedSkillInstalled(skillId: string) {
  const seed = getRecommendedCatalogSeed(skillId);

  if (!seed?.sourceUrl) {
    throw new Error("这个推荐技能暂时没有可安装的来源。");
  }

  if (getManagedSkillFile(skillId)) {
    return;
  }

  const targetDir = path.join(OPENCRAB_SKILLS_DIR, skillId);
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  try {
    await downloadGitHubTree(seed.sourceUrl, targetDir);
  } catch (error) {
    rmSync(targetDir, { recursive: true, force: true });
    throw error;
  }

  if (!getManagedSkillFile(skillId)) {
    rmSync(targetDir, { recursive: true, force: true });
    throw new Error("安装失败：上游目录里没有找到可用的 SKILL.md。");
  }
}

async function downloadGitHubTree(treeUrl: string, destDir: string) {
  const parsed = parseGitHubTreeUrl(treeUrl);

  if (!parsed) {
    throw new Error("目前只支持从 GitHub tree 链接安装技能。");
  }

  await downloadGitHubDirectory(parsed.owner, parsed.repo, parsed.ref, parsed.treePath, destDir);
}

async function fetchUpstreamSkillMarkdown(treeUrl: string) {
  const parsed = parseGitHubTreeUrl(treeUrl);

  if (!parsed) {
    return null;
  }

  const rawUrl =
    "https://raw.githubusercontent.com/" +
    parsed.owner +
    "/" +
    parsed.repo +
    "/" +
    parsed.ref +
    "/" +
    (parsed.treePath ? parsed.treePath + "/" : "") +
    "SKILL.md";
  const response = await fetch(rawUrl, {
    headers: {
      "User-Agent": "OpenCrab",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const content = await response.text();
  return parseSkillMarkdown(content).detailsMarkdown;
}

function parseGitHubTreeUrl(treeUrl: string) {
  let url: URL;

  try {
    url = new URL(treeUrl);
  } catch {
    return null;
  }

  if (url.hostname !== "github.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  if (segments.length === 2) {
    return {
      owner: segments[0],
      repo: segments[1],
      ref: "main",
      treePath: "",
    };
  }

  if (segments[2] !== "tree" || segments.length < 4) {
    return null;
  }

  return {
    owner: segments[0],
    repo: segments[1],
    ref: segments[3],
    treePath: segments.slice(4).join("/"),
  };
}

async function downloadGitHubDirectory(
  owner: string,
  repo: string,
  ref: string,
  treePath: string,
  destDir: string,
) {
  const apiUrl = treePath
    ? `https://api.github.com/repos/${owner}/${repo}/contents/${treePath}?ref=${ref}`
    : `https://api.github.com/repos/${owner}/${repo}/contents?ref=${ref}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "OpenCrab",
    },
  });

  if (!response.ok) {
    throw new Error(`下载技能失败：${owner}/${repo} 返回 ${response.status}。`);
  }

  const payload = (await response.json()) as
    | Array<{ type: string; name: string; path: string; download_url?: string | null }>
    | { type: string; download_url?: string | null };

  if (!Array.isArray(payload)) {
    throw new Error("下载技能失败：GitHub 返回的目录结构不符合预期。");
  }

  for (const entry of payload) {
    if (entry.type === "dir") {
      const nextDir = path.join(destDir, entry.name);
      mkdirSync(nextDir, { recursive: true });
      await downloadGitHubDirectory(owner, repo, ref, entry.path, nextDir);
      continue;
    }

    if (entry.type !== "file" || !entry.download_url) {
      continue;
    }

    const fileResponse = await fetch(entry.download_url, {
      headers: {
        "User-Agent": "OpenCrab",
      },
    });

    if (!fileResponse.ok) {
      throw new Error(`下载技能文件失败：${entry.path}。`);
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    writeFileSync(path.join(destDir, entry.name), fileBuffer);
  }
}

function parseSkillFile(filePath: string, options?: { includeDetails?: boolean }) {
  return parseSkillMarkdown(readFileSync(filePath, "utf8"), options);
}

function parseSkillMarkdown(content: string, options?: { includeDetails?: boolean }) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = frontmatterMatch?.[1] || "";
  const detailsMarkdown =
    options?.includeDetails === false
      ? null
      : frontmatterMatch
        ? content.slice(frontmatterMatch[0].length).trim()
        : content.trim();

  return {
    name: extractFrontmatterValue(frontmatter, "name"),
    summary:
      extractFrontmatterValue(frontmatter, "description") ||
      extractFrontmatterValue(frontmatter, "short-description"),
    detailsMarkdown,
  };
}

function extractFrontmatterValue(frontmatter: string, key: string) {
  const match = frontmatter.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+)$`, "m"));

  if (!match) {
    return null;
  }

  const raw = match[1].trim();

  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, -1);
    }
  }

  return raw;
}

function materializeSkill(seed: CatalogSeed, stored: StoredSkillState | null): SkillRecord {
  const status = stored?.status || seed.defaultStatus;

  return {
    id: seed.id,
    name: stored?.name || seed.name,
    summary: stored?.summary || seed.summary,
    category: normalizeCategory(stored?.category || seed.category, seed.id),
    categoryLabel: getCategoryLabel(normalizeCategory(stored?.category || seed.category, seed.id)),
    status,
    statusLabel: getStatusLabel(status),
    origin: seed.origin,
    originLabel: getOriginLabel(seed.origin),
    icon: stored?.icon || seed.icon,
    sourceUrl: seed.sourceUrl ?? null,
    sourcePath: seed.sourcePath ?? null,
    detailsMarkdown: stored?.detailsMarkdown ?? seed.detailsMarkdown,
    note: seed.note,
    updatedAt: stored?.updatedAt || null,
    isCustom: seed.origin === "custom",
  };
}

function compareSkills(left: SkillRecord, right: SkillRecord, leftIndex: number, rightIndex: number) {
  const statusWeight = getStatusWeight(left.status) - getStatusWeight(right.status);

  if (statusWeight !== 0) {
    return statusWeight;
  }

  return leftIndex - rightIndex;
}

function getStatusWeight(status: SkillStatus) {
  if (status === "installed") {
    return 0;
  }

  if (status === "disabled") {
    return 1;
  }

  return 2;
}

function getStatusLabel(status: SkillStatus) {
  if (status === "installed") {
    return "已启用";
  }

  if (status === "disabled") {
    return "已禁用";
  }

  return "未安装";
}

function getOriginLabel(origin: SkillOrigin) {
  if (origin === "codex") {
    return "OpenCrab 技能库";
  }

  if (origin === "custom") {
    return "OpenCrab 自建";
  }

  return "OpenCrab 推荐";
}

function getCategoryLabel(category: SkillCategory) {
  switch (category) {
    case "marketing-social":
      return "营销与社媒";
    case "sales-growth":
      return "销售与增长";
    case "finance-analysis":
      return "金融与分析";
    case "writing-knowledge":
      return "写作与知识";
    case "creative-media":
      return "创意与内容";
    case "business-ops":
      return "业务运营";
    case "product-tech":
      return "产品与技术";
    case "general":
      return "通用";
  }
}

function getCodexOrder(slug: string, fallbackIndex: number) {
  const index = CODEX_ORDER.indexOf(slug as (typeof CODEX_ORDER)[number]);
  return index === -1 ? 1_000 + fallbackIndex : index;
}

function inferIcon(skillId: string): SkillIconName {
  if (skillId.includes("figma")) {
    return "figma";
  }

  if (skillId.includes("github") || skillId.includes("gh-")) {
    return "github";
  }

  if (skillId.includes("doc")) {
    return "doc";
  }

  return "puzzle";
}

function inferCategory(skillId: string): SkillCategory {
  if (
    skillId.includes("marketing") ||
    skillId.includes("brand") ||
    skillId.includes("content") ||
    skillId.includes("launch") ||
    skillId.includes("ads") ||
    skillId.includes("social")
  ) {
    return "marketing-social";
  }

  if (
    skillId.includes("sales") ||
    skillId.includes("email") ||
    skillId.includes("personalization") ||
    skillId.includes("outreach")
  ) {
    return "sales-growth";
  }

  if (
    skillId.includes("finance") ||
    skillId.includes("financial") ||
    skillId.includes("spreadsheet") ||
    skillId.includes("xlsx") ||
    skillId.includes("budget") ||
    skillId.includes("valuation")
  ) {
    return "finance-analysis";
  }

  if (
    skillId.includes("doc") ||
    skillId.includes("pdf") ||
    skillId.includes("slide") ||
    skillId.includes("pptx") ||
    skillId.includes("docx") ||
    skillId.includes("transcribe") ||
    skillId.includes("openai-docs") ||
    skillId.includes("comms") ||
    skillId.includes("coauthor")
  ) {
    return "writing-knowledge";
  }

  if (
    skillId.includes("image") ||
    skillId.includes("sora") ||
    skillId.includes("speech") ||
    skillId.includes("story") ||
    skillId.includes("canvas") ||
    skillId.includes("theme") ||
    skillId.includes("gif")
  ) {
    return "creative-media";
  }

  if (
    skillId.includes("board") ||
    skillId.includes("pricing") ||
    skillId.includes("notion") ||
    skillId.includes("linear") ||
    skillId.includes("meeting")
  ) {
    return "business-ops";
  }

  if (
    skillId.includes("figma") ||
    skillId.includes("playwright") ||
    skillId.includes("screenshot") ||
    skillId.includes("security") ||
    skillId.includes("gh-") ||
    skillId.includes("chatgpt") ||
    skillId.includes("claude") ||
    skillId.includes("mcp") ||
    skillId.includes("api") ||
    skillId.includes("aspnet") ||
    skillId.includes("jupyter") ||
    skillId.includes("deploy") ||
    skillId.includes("cloudflare") ||
    skillId.includes("render") ||
    skillId.includes("vercel") ||
    skillId.includes("netlify") ||
    skillId.includes("sentry")
  ) {
    return "product-tech";
  }

  return "general";
}

function normalizeCategory(category: string | undefined, skillId: string): SkillCategory {
  switch (category) {
    case "marketing-social":
    case "sales-growth":
    case "finance-analysis":
    case "writing-knowledge":
    case "creative-media":
    case "business-ops":
    case "product-tech":
    case "general":
      return category;
    case "ai-agents":
      return "product-tech";
    case "design-frontend":
      return "creative-media";
    case "backend-data":
      return "finance-analysis";
    case "cloud-devops":
    case "automation-qa":
      return "product-tech";
    case "docs-collab":
      return "writing-knowledge";
    default:
      return inferCategory(skillId);
  }
}

function dedupeById(items: CatalogSeed[]) {
  const map = new Map<string, CatalogSeed>();

  items.forEach((item) => {
    const current = map.get(item.id);

    if (!current || item.order < current.order) {
      map.set(item.id, item);
    }
  });

  return [...map.values()].sort((left, right) => left.order - right.order);
}

function readState(): SkillStoreState {
  return store.read();
}

function writeState(state: SkillStoreState) {
  store.write(state);
}

function createSeedState(): SkillStoreState {
  const now = new Date().toISOString();
  const codexSkills = discoverCodexSkills();

  return {
    items: Object.fromEntries(
      codexSkills.map((skill) => [
        skill.id,
        {
          status: "installed",
          origin: "codex",
          category: skill.category,
          createdAt: now,
          updatedAt: now,
        } satisfies StoredSkillState,
      ]),
    ),
  };
}

function normalizeState(state: Partial<SkillStoreState>): SkillStoreState {
  return {
    items: Object.fromEntries(
      Object.entries(state.items || {}).map(([id, item]) => [
        id,
        {
          status: item.status || "available",
          origin: item.origin || "recommended",
          category: normalizeCategory(item.category, id),
          name: item.name,
          summary: item.summary,
          detailsMarkdown: item.detailsMarkdown ?? null,
          icon: item.icon,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
        } satisfies StoredSkillState,
      ]),
    ),
  };
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeSlug(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
