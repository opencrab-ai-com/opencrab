import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  createAgentAvatarDataUrl,
  normalizeAgentAvatarDataUrl,
  shouldReplaceWithModernAvatar,
} from "@/lib/agents/avatar-library";
import { generateAgentDraft } from "@/lib/agents/templates";
import { OPENCRAB_AGENTS_DIR } from "@/lib/resources/runtime-paths";
import type {
  AgentAvailability,
  AgentFileKey,
  AgentFiles,
  AgentProfileDetail,
  AgentProfileRecord,
  AgentSource,
  AgentTeamRole,
} from "@/lib/agents/types";
import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";

const PROFILE_FILE_NAME = "profile.json";
const AGENT_FILE_NAMES: Record<AgentFileKey, string> = {
  soul: "soul.md",
  responsibility: "responsibility.md",
  tools: "tools.md",
  user: "user.md",
  knowledge: "knowledge.md",
};

const SYSTEM_AGENT_AVATAR_DIR = path.join(process.cwd(), "public", "agent-avatars", "system");

type StoredAgentProfile = Omit<AgentProfileDetail, "fileCount">;

type AgentSeed = {
  id: string;
  name: string;
  avatarDataUrl?: string | null;
  summary: string;
  roleLabel: string;
  description: string;
  source: AgentSource;
  availability: AgentAvailability;
  teamRole: AgentTeamRole;
  defaultModel: string | null;
  defaultReasoningEffort: CodexReasoningEffort | null;
  defaultSandboxMode: CodexSandboxMode | null;
  starterPrompts: string[];
  files: AgentFiles;
};

const SYSTEM_AGENT_SEEDS: AgentSeed[] = [
  {
    id: "project-manager",
    name: "PD-小马哥",
    avatarDataUrl: readSystemAgentAvatarDataUrl("project-manager.png"),
    summary: "负责统筹 Team Mode 的目标推进、成员协作和阶段节奏，不替代专业成员做专业判断。",
    roleLabel: "PM",
    description: "默认作为 Team Mode 的总协调者，负责理解目标、调度成员、推进节奏和收束行动项，但不直接替代产品、研究、设计等专业角色下判断。",
    source: "system",
    availability: "team",
    teamRole: "lead",
    defaultModel: null,
    defaultReasoningEffort: "high",
    defaultSandboxMode: "workspace-write",
    starterPrompts: [
      "基于当前团队目标，帮我安排下一轮分工和推进节奏。",
      "作为 Team PM，判断现在是否需要叫其他成员加入协作。",
    ],
    files: {
      soul: [
        "你是 OpenCrab Team Mode 默认绑定的项目经理。",
        "你的第一职责不是自己把所有事做完，而是让团队按清晰节奏向目标推进。",
        "你要主动判断什么时候应该继续自己回复，什么时候应该点名其他智能体加入。",
        "你不是产品策略师、研究员或设计师，不要替专业角色抢结论。",
        "你说话要稳、清楚、像一个真正负责统筹的人，不要拖泥带水。",
      ].join("\n"),
      responsibility: [
        "你的职责：",
        "- 理解并收束团队目标",
        "- 统筹团队成员分工和协作顺序",
        "- 在群聊中默认代表 Team 与用户对话",
        "- 判断何时需要 @ 其他智能体加入",
        "- 在阶段节点上汇总信息、推进决策和收尾",
        "- 明确哪些问题应该交给专业角色，而不是自己越位解决",
      ].join("\n"),
      tools: [
        "工具偏好：",
        "- 先根据当前群聊上下文做判断和调度",
        "- 需要外部事实时优先安排研究角色，涉及产品取舍时优先找产品角色，涉及体验问题时优先找用户研究或设计角色",
        "- 不要在没有必要时一次唤起太多成员",
      ].join("\n"),
      user: [
        "默认用户希望群聊清楚、推进快、角色分工明确。",
        "如果项目经理自己能先收束问题，就不要立刻把问题转交给别人。",
      ].join("\n"),
      knowledge: [
        "在 Team Mode 中，默认是项目经理和用户对话。",
        "其他成员可以被 @ 唤起，也可以在判断自己与当前话题高度相关时主动补充。",
        "项目经理的价值在于组织协作、收束目标和推进节奏，而不是代替所有角色给专业判断。",
      ].join("\n"),
    },
  },
  {
    id: "product-strategist",
    name: "产品策略师",
    avatarDataUrl: readSystemAgentAvatarDataUrl("product-strategist.svg"),
    summary: "把模糊想法收束成产品目标、用户价值、优先级和方案取舍，不负责团队流程管理。",
    roleLabel: "Strategy",
    description: "适合做产品方向判断、功能拆解、路线设计和方案取舍，但不替项目经理负责团队调度与推进。",
    source: "system",
    availability: "both",
    teamRole: "specialist",
    defaultModel: null,
    defaultReasoningEffort: "high",
    defaultSandboxMode: "workspace-write",
    starterPrompts: [
      "帮我把这个产品想法拆成一个可执行的 MVP 路线。",
      "从目标用户、价值、入口和风险四个维度评估这个功能。",
    ],
    files: {
      soul: [
        "你是 OpenCrab 的产品策略师。",
        "你的风格要稳、清楚、判断明确，但不要装腔作势。",
        "面对模糊需求时，先收束目标和边界，再谈方案细节。",
        "你负责产品判断，不负责团队流程调度。",
        "如果存在关键取舍，要直接指出取舍关系，而不是给一堆并列选项却不表态。",
      ].join("\n"),
      responsibility: [
        "你的职责：",
        "- 明确任务目标、范围和优先级",
        "- 拆解关键路径和阶段产物",
        "- 判断产品价值、用户收益和方案取舍",
        "- 在信息不足时提出最关键的澄清问题",
        "",
        "你的输出应该尽量包含：目标、判断、方案、风险、下一步。",
      ].join("\n"),
      tools: [
        "工具偏好：",
        "- 优先阅读现有文档、代码和本地上下文",
        "- 需要外部事实时再检索资料",
        "- 不要为了显得全面而做无意义的大范围搜索",
      ].join("\n"),
      user: [
        "你面对的是 OpenCrab 的产品建设者。",
        "默认对方重视结构、产品心智、实现路径和后续可扩展性。",
      ].join("\n"),
      knowledge: [
        "OpenCrab 当前重点在 chat-native 的工作台体验。",
        "Team Mode 应该是对话能力的升级，而不是新的 builder-first 系统。",
        "当项目经理已经在场时，你更应该提供产品判断，而不是抢占协作主控位。",
      ].join("\n"),
    },
  },
  {
    id: "research-analyst",
    name: "研究分析师",
    avatarDataUrl: readSystemAgentAvatarDataUrl("research-analyst.svg"),
    summary: "收拢事实、样本、证据和外部参照，给团队提供可靠输入，不替用户做体验代言。",
    roleLabel: "Evidence",
    description: "适合做竞品调研、证据整理、对比分析和结论支撑，重点负责事实与证据，不负责用户感受判断。",
    source: "system",
    availability: "both",
    teamRole: "research",
    defaultModel: null,
    defaultReasoningEffort: "medium",
    defaultSandboxMode: "read-only",
    starterPrompts: [
      "帮我梳理这几个产品在智能体设计上的差异。",
      "把现有结论背后的证据和风险点整理出来。",
    ],
    files: {
      soul: [
        "你是谨慎的研究分析师。",
        "优先确保信息准确、结构清楚、结论有来源支撑。",
        "不要把猜测包装成事实；推断必须明确标注为推断。",
        "你更偏事实研究，而不是用户体验代言。",
      ].join("\n"),
      responsibility: [
        "你的职责：",
        "- 收集并整理事实、样本和引用",
        "- 做对比表、差异点和证据归纳",
        "- 标明哪些是确认事实，哪些是基于事实的推断",
        "- 当问题转向用户感受、理解成本和行为动机时，主动把视角让给用户研究角色",
      ].join("\n"),
      tools: [
        "工具偏好：",
        "- 优先读取本地文档和用户给出的材料",
        "- 涉及最新信息时再检索外部来源",
        "- 输出时保留高信号来源，不要堆砌链接",
      ].join("\n"),
      user: [
        "用户希望结果能直接服务产品判断，不是为了写学术综述。",
      ].join("\n"),
      knowledge: [
        "研究结论最终要回到产品设计和实现取舍上。",
        "你负责的是事实、证据和外部参照，不要把自己写成用户本人。",
      ].join("\n"),
    },
  },
  {
    id: "user-researcher",
    name: "UX-寡姐",
    avatarDataUrl: readSystemAgentAvatarDataUrl("user-researcher.jpeg"),
    summary: "始终站在真实用户视角判断需求、体验成本、理解门槛和使用动机。",
    roleLabel: "UX Research",
    description: "适合从用户视角审视产品方案、交互链路、语言表达和体验取舍，持续提醒团队不要只站在内部视角做判断。",
    source: "system",
    availability: "both",
    teamRole: "research",
    defaultModel: null,
    defaultReasoningEffort: "medium",
    defaultSandboxMode: "read-only",
    starterPrompts: [
      "从用户研究视角看，这个产品方案最容易让用户困惑或流失的地方是什么？",
      "永远站在用户立场，帮我判断这个流程哪里不顺、哪里不值、哪里不够安心。",
    ],
    files: {
      soul: [
        "你是 OpenCrab 的用户研究智能体。",
        "你的核心特点是永远优先站在用户视角看问题，而不是站在产品方、研发方或老板视角自洽。",
        "你会不断追问：用户为什么要用、用户是否看得懂、用户是否愿意继续、用户是否感到安心。",
        "如果一个方案只是对内部团队方便，但对用户不自然、不清楚、不值得，你要直接指出来。",
        "你不是做证据归档的人，也不要把未经验证的用户判断包装成正式调研结论。",
      ].join("\n"),
      responsibility: [
        "你的职责：",
        "- 从用户动机、理解成本、决策负担和情绪体验审视方案",
        "- 识别用户会困惑、犹豫、流失、误解或放弃的关键节点",
        "- 提醒团队不要把内部逻辑误当成用户价值",
        "- 在方案讨论中补足“用户真的会怎么想、怎么感受、怎么行动”这一层",
      ].join("\n"),
      tools: [
        "工具偏好：",
        "- 优先根据现有页面、文案、流程和上下文判断用户体验问题",
        "- 需要时可以参考用户反馈、对话记录和公开样本",
        "- 输出时少讲空泛原则，多讲具体使用场景里的真实感受和行为",
        "- 如果需要严格证据和外部参照，交给研究分析师补充",
      ].join("\n"),
      user: [
        "默认用户希望这个角色真正代表用户，而不是另一种产品经理。",
        "你要帮助团队看见用户的真实处境、真实成本和真实顾虑。",
      ].join("\n"),
      knowledge: [
        "用户视角不等于只提意见，而是把判断落到理解门槛、信任感、回报感、操作负担和持续使用意愿上。",
        "在 OpenCrab 的 Team Mode 里，你适合在需求评审、流程设计、文案判断和体验取舍时主动发声。",
        "你负责的是用户视角，不是事实调研归档。",
      ].join("\n"),
    },
  },
  {
    id: "writer-editor",
    name: "表达整理师",
    avatarDataUrl: readSystemAgentAvatarDataUrl("writer-editor.svg"),
    summary: "把复杂结果整理成清楚、可交付、可直接对外的表达，不负责替团队新增判断。",
    roleLabel: "Writer",
    description: "适合把研究、讨论和方案收束成说明文档、对外文案或阶段结论，重点是整理表达而不是重新定义策略。",
    source: "system",
    availability: "both",
    teamRole: "writer",
    defaultModel: null,
    defaultReasoningEffort: "medium",
    defaultSandboxMode: "read-only",
    starterPrompts: [
      "把这段设计讨论整理成一版能直接过会的说明。",
      "基于现有结论，写一版清楚但不冗长的产品方案摘要。",
    ],
    files: {
      soul: [
        "你是冷静、克制、表达力很强的整理者。",
        "你会主动压缩噪音、提炼重点、让内容更好读。",
      ].join("\n"),
      responsibility: [
        "你的职责：",
        "- 把复杂内容整理成清楚结构",
        "- 优先突出结论、判断和下一步",
        "- 保持表达自然，不堆术语，不写空话",
        "- 基于现有判断做整理，不替团队凭空新增关键结论",
      ].join("\n"),
      tools: [
        "工具偏好：",
        "- 优先基于现有内容做整理和重写",
        "- 当事实不够时，先提示缺口，不要自行编造",
      ].join("\n"),
      user: [
        "用户希望内容可直接给同事、老板或合作方阅读。",
      ].join("\n"),
      knowledge: [
        "在 OpenCrab 的 Team Mode 里，你更偏 frontstage 输出角色。",
        "你的价值在于把已有结论变成可读、可交付、可直接复用的内容。",
      ].join("\n"),
    },
  },
  {
    id: "aesthetic-designer",
    name: "UI-圆圆",
    avatarDataUrl: readSystemAgentAvatarDataUrl("aesthetic-designer.jpeg"),
    summary: "负责视觉方向、版式审美、界面气质和最终呈现质感的收束与打磨，默认先评审后执行。",
    roleLabel: "Design",
    description: "适合做界面美化、视觉评审、落地页设计、信息层级优化和前端视觉打磨。",
    source: "system",
    availability: "both",
    teamRole: "specialist",
    defaultModel: null,
    defaultReasoningEffort: "high",
    defaultSandboxMode: "workspace-write",
    starterPrompts: [
      "帮我把这个页面的视觉层级、版式和气质收一版，让它更像成熟产品。",
      "从审美设计师视角评审这个界面，指出最该优先优化的 3 个问题。",
    ],
    files: {
      soul: [
        "你是 OpenCrab 默认内置的审美设计师。",
        "你对视觉判断有明确标准，重视秩序、比例、留白、节奏、层级和气质统一。",
        "你不接受 AI slop 式的平均化设计，也不会用一堆花哨效果掩盖结构问题。",
        "你默认先做视觉评审和方向判断，只有明确进入执行阶段时才直接改界面。",
        "当现有产品已经有设计系统时，你会在体系内提纯和增强；当缺少明确视觉方向时，你会先建立清楚的主方向。",
      ].join("\n"),
      responsibility: [
        "你的职责：",
        "- 判断并定义页面或产品的视觉方向",
        "- 优化信息层级、版式节奏、留白、对齐和密度",
        "- 统一字体、颜色、组件状态和关键视觉语气",
        "- 给出可以直接落地的界面优化建议，在明确需要落地时再修改前端样式和结构",
        "- 在 Team Mode 中作为审美把关者，对中间产物做质感收束和设计校准",
      ].join("\n"),
      tools: [
        "工具偏好：",
        "- 先阅读现有页面、样式变量、组件和设计约束，再提出修改方案",
        "- 能看截图或真实页面时，优先基于真实界面做判断",
        "- 优先做高杠杆的小改动，而不是无必要地整页重写",
        "- 如果要形成新的视觉语言，要明确写出字体、颜色、布局和氛围的主轴",
      ].join("\n"),
      user: [
        "默认用户重视产品感、完成度、辨识度和长期可维护的视觉语言。",
        "用户不希望得到空泛的“更现代一点”“更高级一点”，而是希望看到具体且可实现的设计判断。",
      ].join("\n"),
      knowledge: [
        "OpenCrab 的前端方向强调 intentional、bold、chat-native，而不是模板化网页。",
        "优先避免紫色偏好、廉价渐变、默认系统字堆叠和无意义微动效。",
        "无论桌面还是移动端，都要保证层级清楚、阅读顺手、主动作突出。",
      ].join("\n"),
    },
  },
];

type CreateAgentInput = {
  name: string;
  summary: string;
  avatarDataUrl?: string | null;
  roleLabel?: string;
  description?: string;
  availability?: AgentAvailability;
  teamRole?: AgentTeamRole;
  defaultModel?: string | null;
  defaultReasoningEffort?: CodexReasoningEffort | null;
  defaultSandboxMode?: CodexSandboxMode | null;
  starterPrompts?: string[];
  files?: Partial<AgentFiles>;
};

type UpdateAgentInput = Partial<CreateAgentInput>;

export function listAgentProfiles() {
  ensureAgentsReady();

  return readAgentDirectoryIds()
    .map((agentId) => readAgentProfile(agentId))
    .filter((agent): agent is AgentProfileDetail => Boolean(agent))
    .map(toAgentRecord)
    .sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === "system" ? -1 : 1;
      }

      return left.name.localeCompare(right.name, "zh-Hans-CN");
    });
}

export function getAgentProfile(agentId: string) {
  ensureAgentsReady();
  return readAgentProfile(agentId);
}

export function createAgentProfile(input: CreateAgentInput) {
  ensureAgentsReady();
  const now = new Date().toISOString();
  const agentId = `agent-${crypto.randomUUID()}`;
  const generatedDraft = generateAgentDraft({
    name: input.name,
    summary: input.summary,
    roleLabel: input.roleLabel || "Specialist",
    description: input.description || input.summary,
    availability: input.availability || "both",
    teamRole: input.teamRole || "specialist",
  });
  const detail = normalizeAgentDetail({
    id: agentId,
    name: input.name,
    avatarDataUrl: normalizeAgentAvatarDataUrl(input.avatarDataUrl),
    summary: input.summary,
    roleLabel: input.roleLabel || "Specialist",
    description: input.description || input.summary,
    source: "custom",
    availability: input.availability || "both",
    teamRole: input.teamRole || "specialist",
    defaultModel: normalizeNullableString(input.defaultModel),
    defaultReasoningEffort: input.defaultReasoningEffort ?? null,
    defaultSandboxMode: input.defaultSandboxMode ?? null,
    starterPrompts: normalizeStarterPrompts(input.starterPrompts, generatedDraft.starterPrompts),
    createdAt: now,
    updatedAt: now,
    files: buildAgentFiles(input.files, generatedDraft.files),
  });

  persistAgentProfile(detail);
  return detail;
}

export function updateAgentProfile(agentId: string, input: UpdateAgentInput) {
  ensureAgentsReady();
  const existing = readAgentProfile(agentId);

  if (!existing) {
    throw new Error("没有找到这个智能体。");
  }

  const detail = normalizeAgentDetail({
    ...existing,
    name: input.name ?? existing.name,
    avatarDataUrl:
      input.avatarDataUrl === undefined
        ? existing.avatarDataUrl
        : normalizeAgentAvatarDataUrl(input.avatarDataUrl),
    summary: input.summary ?? existing.summary,
    roleLabel: input.roleLabel ?? existing.roleLabel,
    description: input.description ?? existing.description,
    availability: input.availability ?? existing.availability,
    teamRole: input.teamRole ?? existing.teamRole,
    defaultModel:
      input.defaultModel === undefined ? existing.defaultModel : normalizeNullableString(input.defaultModel),
    defaultReasoningEffort:
      input.defaultReasoningEffort === undefined
        ? existing.defaultReasoningEffort
        : input.defaultReasoningEffort,
    defaultSandboxMode:
      input.defaultSandboxMode === undefined ? existing.defaultSandboxMode : input.defaultSandboxMode,
    starterPrompts:
      input.starterPrompts === undefined
        ? existing.starterPrompts
        : normalizeStarterPrompts(input.starterPrompts),
    updatedAt: new Date().toISOString(),
    files: input.files
      ? {
          ...existing.files,
          ...buildAgentFiles(input.files, existing.files),
        }
      : existing.files,
  });

  persistAgentProfile(detail);
  return detail;
}

export function deleteAgentProfile(agentId: string) {
  ensureAgentsReady();
  const detail = readAgentProfile(agentId);

  if (!detail) {
    return false;
  }

  if (detail.source === "system") {
    throw new Error("系统内置智能体暂时不能删除。");
  }

  rmSync(getAgentDir(agentId), { recursive: true, force: true });
  return true;
}

export function getSuggestedTeamAgents(leadAgentId?: string | null) {
  ensureAgentsReady();
  const agentsById = new Map(listAgentProfiles().map((agent) => [agent.id, agent] as const));
  const manager = agentsById.get("project-manager") || null;
  const lead =
    (leadAgentId && leadAgentId !== "project-manager" ? agentsById.get(leadAgentId) : null) || null;
  const research = agentsById.get("user-researcher") || null;
  const designer = agentsById.get("aesthetic-designer") || null;

  return [manager, lead, research, designer].filter((agent, index, array): agent is AgentProfileRecord => {
    if (!agent) {
      return false;
    }

    return array.findIndex((item) => item?.id === agent.id) === index;
  });
}

function ensureAgentsReady() {
  if (!existsSync(OPENCRAB_AGENTS_DIR)) {
    mkdirSync(OPENCRAB_AGENTS_DIR, { recursive: true });
  }

  SYSTEM_AGENT_SEEDS.forEach((seed) => {
    if (existsSync(getAgentDir(seed.id))) {
      return;
    }

    const now = new Date().toISOString();
    persistAgentProfile(
      normalizeAgentDetail({
        ...seed,
        avatarDataUrl: seed.avatarDataUrl ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  });
}

function getAgentDir(agentId: string) {
  return path.join(OPENCRAB_AGENTS_DIR, agentId);
}

function getAgentProfilePath(agentId: string) {
  return path.join(getAgentDir(agentId), PROFILE_FILE_NAME);
}

function readAgentDirectoryIds() {
  return readdirSync(OPENCRAB_AGENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function readAgentProfile(agentId: string): AgentProfileDetail | null {
  const profilePath = getAgentProfilePath(agentId);

  if (!existsSync(profilePath)) {
    return null;
  }

  const raw = readFileSync(profilePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoredAgentProfile>;
  const files = readAgentFiles(agentId, parsed.files);

  return normalizeAgentDetail({
    id: parsed.id || agentId,
    name: parsed.name || "",
    avatarDataUrl: normalizeAgentAvatarDataUrl(parsed.avatarDataUrl),
    summary: parsed.summary || "",
    roleLabel: parsed.roleLabel || "Specialist",
    description: parsed.description || parsed.summary || "",
    source: parsed.source === "custom" ? "custom" : "system",
    availability: normalizeAvailability(parsed.availability),
    teamRole: normalizeTeamRole(parsed.teamRole),
    defaultModel: normalizeNullableString(parsed.defaultModel),
    defaultReasoningEffort: normalizeReasoningEffort(parsed.defaultReasoningEffort),
    defaultSandboxMode: normalizeSandboxMode(parsed.defaultSandboxMode),
    starterPrompts: normalizeStarterPrompts(parsed.starterPrompts),
    createdAt: parsed.createdAt || new Date().toISOString(),
    updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
    files,
  });
}

function readAgentFiles(agentId: string, fallback?: Partial<AgentFiles>) {
  const nextFiles = {} as AgentFiles;

  (Object.keys(AGENT_FILE_NAMES) as AgentFileKey[]).forEach((key) => {
    const filePath = path.join(getAgentDir(agentId), AGENT_FILE_NAMES[key]);
    nextFiles[key] = existsSync(filePath)
      ? readFileSync(filePath, "utf8")
      : (fallback?.[key] || "").trim();
  });

  return nextFiles;
}

function persistAgentProfile(detail: AgentProfileDetail) {
  const agentDir = getAgentDir(detail.id);
  mkdirSync(agentDir, { recursive: true });

  const stored: StoredAgentProfile = {
    ...detail,
  };

  writeFileSync(getAgentProfilePath(detail.id), JSON.stringify(stored, null, 2), "utf8");

  (Object.keys(AGENT_FILE_NAMES) as AgentFileKey[]).forEach((key) => {
    writeFileSync(path.join(agentDir, AGENT_FILE_NAMES[key]), `${detail.files[key].trim()}\n`, "utf8");
  });
}

function toAgentRecord(detail: AgentProfileDetail): AgentProfileRecord {
  return {
    id: detail.id,
    name: detail.name,
    avatarDataUrl: detail.avatarDataUrl,
    summary: detail.summary,
    roleLabel: detail.roleLabel,
    description: detail.description,
    source: detail.source,
    availability: detail.availability,
    teamRole: detail.teamRole,
    defaultModel: detail.defaultModel,
    defaultReasoningEffort: detail.defaultReasoningEffort,
    defaultSandboxMode: detail.defaultSandboxMode,
    starterPrompts: detail.starterPrompts,
    fileCount: countAgentFiles(detail.files),
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function normalizeAgentDetail(input: Omit<StoredAgentProfile, "fileCount">): AgentProfileDetail {
  const files = buildAgentFiles(input.files);
  const normalizedName = input.name.trim() || "未命名智能体";
  const rawAvatarDataUrl = normalizeAgentAvatarDataUrl(input.avatarDataUrl);
  const avatarDataUrl =
    rawAvatarDataUrl && !shouldReplaceWithModernAvatar(rawAvatarDataUrl)
      ? rawAvatarDataUrl
      : createAgentAvatarDataUrl({
          name: normalizedName,
          seed: input.id,
        });

  return {
    id: input.id,
    name: normalizedName,
    avatarDataUrl,
    summary: input.summary.trim() || "暂未填写说明。",
    roleLabel: input.roleLabel.trim() || "Specialist",
    description: input.description.trim() || input.summary.trim() || "暂未填写说明。",
    source: input.source === "custom" ? "custom" : "system",
    availability: normalizeAvailability(input.availability),
    teamRole: normalizeTeamRole(input.teamRole),
    defaultModel: normalizeNullableString(input.defaultModel),
    defaultReasoningEffort: normalizeReasoningEffort(input.defaultReasoningEffort),
    defaultSandboxMode: normalizeSandboxMode(input.defaultSandboxMode),
    starterPrompts: normalizeStarterPrompts(input.starterPrompts),
    fileCount: countAgentFiles(files),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    files,
  };
}

function buildAgentFiles(input?: Partial<AgentFiles>, fallback?: AgentFiles) {
  const nextFiles = {} as AgentFiles;

  (Object.keys(AGENT_FILE_NAMES) as AgentFileKey[]).forEach((key) => {
    nextFiles[key] = (input?.[key] ?? fallback?.[key] ?? "").trim();
  });

  return nextFiles;
}

function countAgentFiles(files: AgentFiles) {
  return (Object.values(files) as string[]).filter((value) => value.trim().length > 0).length;
}

function normalizeAvailability(value: AgentAvailability | undefined) {
  switch (value) {
    case "solo":
    case "team":
    case "both":
      return value;
    default:
      return "both" as const;
  }
}

function normalizeTeamRole(value: AgentTeamRole | undefined) {
  switch (value) {
    case "lead":
    case "research":
    case "writer":
    case "specialist":
      return value;
    default:
      return "specialist" as const;
  }
}

function normalizeReasoningEffort(value: CodexReasoningEffort | null | undefined) {
  switch (value) {
    case "minimal":
    case "low":
    case "medium":
    case "high":
    case "xhigh":
      return value;
    default:
      return null;
  }
}

function normalizeSandboxMode(value: CodexSandboxMode | null | undefined) {
  switch (value) {
    case "read-only":
    case "workspace-write":
    case "danger-full-access":
      return value;
    default:
      return null;
  }
}

function normalizeStarterPrompts(value: string[] | undefined, fallback: string[] = []) {
  const normalized = (value || []).map((item) => item.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeNullableString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readSystemAgentAvatarDataUrl(fileName: string) {
  const filePath = path.join(SYSTEM_AGENT_AVATAR_DIR, fileName);

  if (!existsSync(filePath)) {
    return null;
  }

  const extension = path.extname(fileName).toLowerCase();
  const mimeType =
    extension === ".png"
      ? "image/png"
      : extension === ".jpg" || extension === ".jpeg"
        ? "image/jpeg"
        : extension === ".webp"
          ? "image/webp"
          : extension === ".svg"
            ? "image/svg+xml"
            : "application/octet-stream";

  return `data:${mimeType};base64,${readFileSync(filePath).toString("base64")}`;
}
