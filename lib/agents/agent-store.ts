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
import { listBuiltInSystemAgents } from "@/lib/agents/system-agent-catalog";
import {
  getBuiltInSystemAgentDefaults,
  isBuiltInSystemAgentId,
} from "@/lib/agents/system-agent-metadata";
import { generateAgentDraft } from "@/lib/agents/templates";
import { OPENCRAB_AGENTS_DIR } from "@/lib/resources/runtime-paths";
import type {
  AgentCatalogMetadata,
  AgentAvailability,
  AgentFileKey,
  AgentFiles,
  AgentProfileDetail,
  AgentProfileRecord,
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

const DEPRECATED_SYSTEM_AGENT_IDS = new Set([
  "product-strategist",
  "research-analyst",
  "writer-editor",
]);
const SYSTEM_AGENT_TIMESTAMP = "2026-03-25T00:00:00.000Z";
const AGENT_DIRECTORY_CLEANUP_TTL_MS = process.env.NODE_ENV === "development" ? 1_500 : 60_000;

let lastDeprecatedSystemAgentCleanupAt = 0;

type StoredAgentProfile = Omit<AgentProfileDetail, "fileCount">;

type AgentCatalogMetadataInput = {
  [Key in keyof AgentCatalogMetadata]?: AgentCatalogMetadata[Key] | null;
};

type NormalizeAgentDetailInput =
  Omit<StoredAgentProfile, keyof AgentCatalogMetadata | "fileCount"> &
  AgentCatalogMetadataInput;

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

  const builtInSystemAgents = listBuiltInSystemAgents();
  const systemAgents = builtInSystemAgents.map((agent) => buildBuiltInSystemAgentDetail(agent));
  const customAgents = readCustomAgentDirectoryIds().map((agentId) => readStoredCustomAgentProfile(agentId));

  return [...systemAgents, ...customAgents]
    .filter((agent): agent is AgentProfileDetail => Boolean(agent))
    .map(toAgentRecord)
    .sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === "system" ? -1 : 1;
      }

      if (left.collectionOrder !== right.collectionOrder) {
        return left.collectionOrder - right.collectionOrder;
      }

      if (left.groupOrder !== right.groupOrder) {
        return left.groupOrder - right.groupOrder;
      }

      if (left.promoted !== right.promoted) {
        return left.promoted ? -1 : 1;
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

  if (existing.source === "system") {
    throw new Error("系统内置智能体请直接修改 agents-src/system 下的源码目录。");
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

  const now = Date.now();

  if (now - lastDeprecatedSystemAgentCleanupAt < AGENT_DIRECTORY_CLEANUP_TTL_MS) {
    return;
  }

  cleanupDeprecatedSystemAgents();
  lastDeprecatedSystemAgentCleanupAt = now;
}

function cleanupDeprecatedSystemAgents() {
  const mirroredSystemAgentIds = new Set([
    ...DEPRECATED_SYSTEM_AGENT_IDS,
    ...listBuiltInSystemAgents().map((agent) => agent.id),
  ]);

  mirroredSystemAgentIds.forEach((agentId) => {
    const agentDir = getAgentDir(agentId);

    if (existsSync(agentDir)) {
      rmSync(agentDir, { recursive: true, force: true });
    }
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

function readCustomAgentDirectoryIds() {
  const builtInSystemAgentIds = new Set(listBuiltInSystemAgents().map((agent) => agent.id));
  return readAgentDirectoryIds().filter((agentId) => !builtInSystemAgentIds.has(agentId));
}

function readAgentProfile(agentId: string): AgentProfileDetail | null {
  if (isBuiltInSystemAgentId(agentId)) {
    const systemSeed = listBuiltInSystemAgents().find((agent) => agent.id === agentId);
    return systemSeed ? buildBuiltInSystemAgentDetail(systemSeed) : null;
  }

  return readStoredCustomAgentProfile(agentId);
}

function buildBuiltInSystemAgentDetail(
  systemSeed: ReturnType<typeof listBuiltInSystemAgents>[number],
): AgentProfileDetail {
  return normalizeAgentDetail({
    ...systemSeed,
    avatarDataUrl: systemSeed.avatarDataUrl ?? null,
    createdAt: SYSTEM_AGENT_TIMESTAMP,
    updatedAt: SYSTEM_AGENT_TIMESTAMP,
  }, systemSeed);
}

function readStoredCustomAgentProfile(agentId: string): AgentProfileDetail | null {
  const profilePath = getAgentProfilePath(agentId);

  if (!existsSync(profilePath)) {
    return null;
  }

  const parsed = readStoredAgentProfile(agentId);

  if (!parsed) {
    return null;
  }

  const files = readAgentFiles(agentId, parsed.files);

  return normalizeAgentDetail({
    id: parsed.id || agentId,
    name: parsed.name || "",
    avatarDataUrl: normalizeAgentAvatarDataUrl(parsed.avatarDataUrl),
    summary: parsed.summary || "",
    roleLabel: parsed.roleLabel || "Specialist",
    description: parsed.description || parsed.summary || "",
    source: "custom",
    availability: normalizeAvailability(parsed.availability),
    teamRole: normalizeTeamRole(parsed.teamRole),
    defaultModel: normalizeNullableString(parsed.defaultModel),
    defaultReasoningEffort: normalizeReasoningEffort(parsed.defaultReasoningEffort),
    defaultSandboxMode: normalizeSandboxMode(parsed.defaultSandboxMode),
    starterPrompts: normalizeStarterPrompts(parsed.starterPrompts),
    groupId: parsed.groupId || null,
    groupLabel: parsed.groupLabel || null,
    groupDescription: parsed.groupDescription || null,
    groupOrder: parsed.groupOrder,
    collectionId: parsed.collectionId || null,
    collectionLabel: parsed.collectionLabel || null,
    collectionDescription: parsed.collectionDescription || null,
    collectionOrder: parsed.collectionOrder,
    promoted: parsed.promoted,
    upstreamAgentName: parsed.upstreamAgentName || null,
    upstreamSourceUrl: parsed.upstreamSourceUrl || null,
    upstreamLicense: parsed.upstreamLicense || null,
    createdAt: parsed.createdAt || new Date().toISOString(),
    updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
    files,
  });
}

function readStoredAgentProfile(agentId: string): Partial<StoredAgentProfile> | null {
  const profilePath = getAgentProfilePath(agentId);

  if (!existsSync(profilePath)) {
    return null;
  }

  return JSON.parse(readFileSync(profilePath, "utf8")) as Partial<StoredAgentProfile>;
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
    groupId: detail.groupId,
    groupLabel: detail.groupLabel,
    groupDescription: detail.groupDescription,
    groupOrder: detail.groupOrder,
    collectionId: detail.collectionId,
    collectionLabel: detail.collectionLabel,
    collectionDescription: detail.collectionDescription,
    collectionOrder: detail.collectionOrder,
    promoted: detail.promoted,
    upstreamAgentName: detail.upstreamAgentName,
    upstreamSourceUrl: detail.upstreamSourceUrl,
    upstreamLicense: detail.upstreamLicense,
    fileCount: countAgentFiles(detail.files),
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function normalizeAgentDetail(
  input: NormalizeAgentDetailInput,
  systemSeedOverride: ReturnType<typeof listBuiltInSystemAgents>[number] | null = null,
): AgentProfileDetail {
  const files = buildAgentFiles(input.files);
  const normalizedName = input.name.trim() || "未命名智能体";
  const source =
    input.source === "system" || systemSeedOverride || isBuiltInSystemAgentId(input.id) ? "system" : "custom";
  const systemSeed =
    source === "system"
      ? systemSeedOverride ?? listBuiltInSystemAgents().find((seed) => seed.id === input.id) ?? null
      : null;
  const teamRole =
    source === "system"
      ? systemSeed?.teamRole ?? normalizeSystemTeamRole(input.id, input.teamRole)
      : normalizeTeamRole(input.teamRole);
  const rawAvatarDataUrl = normalizeAgentAvatarDataUrl(input.avatarDataUrl);
  const avatarDataUrl =
    rawAvatarDataUrl && !shouldReplaceWithModernAvatar(rawAvatarDataUrl)
      ? rawAvatarDataUrl
      : createAgentAvatarDataUrl({
          name: normalizedName,
          seed: input.id,
        });
  const catalogMetadata = resolveCatalogMetadata(input, source, systemSeed);

  return {
    id: input.id,
    name: normalizedName,
    avatarDataUrl,
    summary: input.summary.trim() || "暂未填写说明。",
    roleLabel: input.roleLabel.trim() || "Specialist",
    description: input.description.trim() || input.summary.trim() || "暂未填写说明。",
    source,
    availability: normalizeAvailability(input.availability),
    teamRole,
    defaultModel: source === "system" ? null : normalizeNullableString(input.defaultModel),
    defaultReasoningEffort:
      source === "system" ? null : normalizeReasoningEffort(input.defaultReasoningEffort),
    defaultSandboxMode:
      source === "system"
        ? systemSeed?.defaultSandboxMode ?? normalizeSystemSandboxMode(input.id, input.defaultSandboxMode)
        : normalizeSandboxMode(input.defaultSandboxMode),
    starterPrompts: normalizeStarterPrompts(input.starterPrompts),
    groupId: catalogMetadata.groupId,
    groupLabel: catalogMetadata.groupLabel,
    groupDescription: catalogMetadata.groupDescription,
    groupOrder: catalogMetadata.groupOrder,
    collectionId: catalogMetadata.collectionId,
    collectionLabel: catalogMetadata.collectionLabel,
    collectionDescription: catalogMetadata.collectionDescription,
    collectionOrder: catalogMetadata.collectionOrder,
    promoted: catalogMetadata.promoted,
    upstreamAgentName: catalogMetadata.upstreamAgentName,
    upstreamSourceUrl: catalogMetadata.upstreamSourceUrl,
    upstreamLicense: catalogMetadata.upstreamLicense,
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

function normalizeSystemTeamRole(agentId: string, value: AgentTeamRole | undefined) {
  return getBuiltInSystemAgentDefaults(agentId)?.teamRole ?? normalizeTeamRole(value);
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

function normalizeSystemSandboxMode(
  agentId: string,
  value: CodexSandboxMode | null | undefined,
) {
  return getBuiltInSystemAgentDefaults(agentId)?.defaultSandboxMode ?? normalizeSandboxMode(value) ?? "workspace-write";
}

function normalizeStarterPrompts(value: string[] | undefined, fallback: string[] = []) {
  const normalized = (value || []).map((item) => item.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function resolveCatalogMetadata(
  input: Partial<NormalizeAgentDetailInput>,
  source: "system" | "custom",
  systemSeed: ReturnType<typeof listBuiltInSystemAgents>[number] | null,
) {
  if (source === "system" && systemSeed) {
    return {
      groupId: systemSeed.groupId,
      groupLabel: systemSeed.groupLabel,
      groupDescription: systemSeed.groupDescription,
      groupOrder: systemSeed.groupOrder,
      collectionId: systemSeed.collectionId,
      collectionLabel: systemSeed.collectionLabel,
      collectionDescription: systemSeed.collectionDescription,
      collectionOrder: systemSeed.collectionOrder,
      promoted: systemSeed.promoted,
      upstreamAgentName: systemSeed.upstreamAgentName,
      upstreamSourceUrl: systemSeed.upstreamSourceUrl,
      upstreamLicense: systemSeed.upstreamLicense,
    };
  }

  return {
    groupId: normalizeNullableString(input.groupId) || "custom",
    groupLabel: normalizeNullableString(input.groupLabel) || "我的智能体",
    groupDescription:
      normalizeNullableString(input.groupDescription) || "你自己创建和维护的长期角色。",
    groupOrder: normalizeOrder(input.groupOrder, 1_000),
    collectionId: normalizeNullableString(input.collectionId) || "custom",
    collectionLabel: normalizeNullableString(input.collectionLabel) || "自定义",
    collectionDescription:
      normalizeNullableString(input.collectionDescription) || "你自己创建的智能体集合。",
    collectionOrder: normalizeOrder(input.collectionOrder, 1_000),
    promoted: Boolean(input.promoted),
    upstreamAgentName: normalizeNullableString(input.upstreamAgentName),
    upstreamSourceUrl: normalizeNullableString(input.upstreamSourceUrl),
    upstreamLicense: normalizeNullableString(input.upstreamLicense),
  };
}

function normalizeNullableString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOrder(value: number | null | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}
