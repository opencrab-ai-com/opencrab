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
  identity: "identity.md",
  contract: "contract.md",
  execution: "execution.md",
  quality: "quality.md",
  handoff: "handoff.md",
};
type LegacyAgentFileKey = "soul" | "responsibility" | "tools" | "user" | "knowledge";

const LEGACY_AGENT_FILE_NAMES: Record<LegacyAgentFileKey, string> = {
  soul: "soul.md",
  responsibility: "responsibility.md",
  tools: "tools.md",
  user: "user.md",
  knowledge: "knowledge.md",
};

const LEGACY_AGENT_FILE_KEY_BY_V2_KEY: Record<AgentFileKey, LegacyAgentFileKey> = {
  identity: "soul",
  contract: "responsibility",
  execution: "tools",
  quality: "user",
  handoff: "knowledge",
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
  defaultSkillIds?: string[];
  optionalSkillIds?: string[];
  files?: Partial<AgentFiles>;
};

type UpdateAgentInput = Partial<CreateAgentInput>;
type StoredAgentFiles = Partial<AgentFiles> & Partial<Record<LegacyAgentFileKey, string>>;
type NormalizeAgentDetailOptions = {
  systemSeedOverride?: ReturnType<typeof listBuiltInSystemAgents>[number] | null;
  allowSystemProfileOverrides?: boolean;
};

export function listAgentProfiles() {
  ensureAgentsReady();

  const builtInSystemAgents = listBuiltInSystemAgents();
  const systemAgents = builtInSystemAgents.map((agent) => readAgentProfile(agent.id));
  const customAgents = readCustomAgentDirectoryIds().map((agentId) => readStoredCustomAgentProfile(agentId));

  return [...systemAgents, ...customAgents]
    .filter((agent): agent is AgentProfileDetail => Boolean(agent))
    .map(toAgentRecord)
    .sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === "system" ? -1 : 1;
      }

      const leftFamilyOrder = left.familyOrder ?? 1_000;
      const rightFamilyOrder = right.familyOrder ?? 1_000;

      if (leftFamilyOrder !== rightFamilyOrder) {
        return leftFamilyOrder - rightFamilyOrder;
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
    defaultSkillIds: input.defaultSkillIds ?? [],
    optionalSkillIds: input.optionalSkillIds ?? [],
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
    const systemSeed = listBuiltInSystemAgents().find((agent) => agent.id === agentId);

    if (!systemSeed) {
      throw new Error("没有找到这个核心岗位。");
    }

    const detail = normalizeAgentDetail(
      {
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
          input.defaultModel === undefined
            ? existing.defaultModel
            : normalizeNullableString(input.defaultModel),
        defaultReasoningEffort:
          input.defaultReasoningEffort === undefined
            ? existing.defaultReasoningEffort
            : input.defaultReasoningEffort,
        defaultSandboxMode:
          input.defaultSandboxMode === undefined
            ? existing.defaultSandboxMode
            : input.defaultSandboxMode,
        starterPrompts:
          input.starterPrompts === undefined
            ? existing.starterPrompts
            : normalizeStarterPrompts(input.starterPrompts),
        defaultSkillIds: input.defaultSkillIds ?? existing.defaultSkillIds,
        optionalSkillIds: input.optionalSkillIds ?? existing.optionalSkillIds,
        updatedAt: new Date().toISOString(),
        files: input.files
          ? {
              ...existing.files,
              ...buildAgentFiles(input.files, existing.files),
            }
          : existing.files,
      },
      {
        systemSeedOverride: systemSeed,
        allowSystemProfileOverrides: true,
      },
    );

    persistSystemAgentShadowProfile(detail);
    return detail;
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
    defaultSkillIds: input.defaultSkillIds ?? existing.defaultSkillIds,
    optionalSkillIds: input.optionalSkillIds ?? existing.optionalSkillIds,
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

export function resetSystemAgentProfile(agentId: string) {
  ensureAgentsReady();

  if (!isBuiltInSystemAgentId(agentId)) {
    throw new Error("只有核心岗位支持恢复默认。");
  }

  rmSync(getSystemAgentShadowDir(agentId), { recursive: true, force: true });
  const builtIn = listBuiltInSystemAgents().find((agent) => agent.id === agentId);
  return builtIn ? buildBuiltInSystemAgentDetail(builtIn) : null;
}

export function deleteAgentProfile(agentId: string) {
  ensureAgentsReady();
  const detail = readAgentProfile(agentId);

  if (!detail) {
    return false;
  }

  if (detail.source === "system") {
    throw new Error("核心岗位暂时不能删除。");
  }

  rmSync(getCustomAgentDir(agentId), { recursive: true, force: true });
  return true;
}

export function getSuggestedTeamAgents(leadAgentId?: string | null) {
  ensureAgentsReady();
  const agentsById = new Map(listAgentProfiles().map((agent) => [agent.id, agent] as const));
  const manager = agentsById.get("project-manager") || null;
  const lead =
    (leadAgentId && leadAgentId !== "project-manager" ? agentsById.get(leadAgentId) : null) || null;
  const designer = agentsById.get("ui-designer") || null;
  const product = agentsById.get("product-manager") || null;

  return [manager, lead || product, designer].filter((agent, index, array): agent is AgentProfileRecord => {
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
  const activeSystemAgentIds = new Set(listBuiltInSystemAgents().map((agent) => agent.id));
  const mirroredSystemAgentIds = new Set([
    ...DEPRECATED_SYSTEM_AGENT_IDS,
    ...activeSystemAgentIds,
  ]);

  mirroredSystemAgentIds.forEach((agentId) => {
    const agentDir = getCustomAgentDir(agentId);

    if (existsSync(agentDir)) {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  readAgentDirectoryIds().forEach((agentId) => {
    if (activeSystemAgentIds.has(agentId)) {
      return;
    }

    const stored = readStoredAgentProfile(agentId);

    if (stored?.source === "system") {
      rmSync(getCustomAgentDir(agentId), { recursive: true, force: true });
    }
  });
}

function getCustomAgentDir(agentId: string) {
  return path.join(OPENCRAB_AGENTS_DIR, agentId);
}

function getCustomAgentProfilePath(agentId: string) {
  return path.join(getCustomAgentDir(agentId), PROFILE_FILE_NAME);
}

function getSystemAgentShadowDir(agentId: string) {
  return path.join(OPENCRAB_AGENTS_DIR, "system", agentId);
}

function getSystemAgentShadowProfilePath(agentId: string) {
  return path.join(getSystemAgentShadowDir(agentId), PROFILE_FILE_NAME);
}

function readAgentDirectoryIds() {
  return readdirSync(OPENCRAB_AGENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function readCustomAgentDirectoryIds() {
  const builtInSystemAgentIds = new Set(listBuiltInSystemAgents().map((agent) => agent.id));
  return readAgentDirectoryIds().filter((agentId) => agentId !== "system" && !builtInSystemAgentIds.has(agentId));
}

function readAgentProfile(agentId: string): AgentProfileDetail | null {
  if (isBuiltInSystemAgentId(agentId)) {
    const systemSeed = listBuiltInSystemAgents().find((agent) => agent.id === agentId);

    if (!systemSeed) {
      return null;
    }

    return readStoredSystemAgentShadowProfile(agentId, systemSeed) ?? buildBuiltInSystemAgentDetail(systemSeed);
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
  }, { systemSeedOverride: systemSeed });
}

function readStoredCustomAgentProfile(agentId: string): AgentProfileDetail | null {
  const profilePath = getCustomAgentProfilePath(agentId);

  if (!existsSync(profilePath)) {
    return null;
  }

  const parsed = readStoredAgentProfileAtPath(profilePath);

  if (!parsed) {
    return null;
  }

  const legacyCatalog = parsed as Partial<{
    groupId: string;
    groupLabel: string;
    groupDescription: string;
    groupOrder: number;
  }>;
  const files = readAgentFilesFromDir(getCustomAgentDir(agentId), parsed.files as StoredAgentFiles | undefined);

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
    familyId: parsed.familyId || legacyCatalog.groupId || "custom",
    familyLabel: parsed.familyLabel || legacyCatalog.groupLabel || "我的智能体",
    familyDescription:
      parsed.familyDescription || legacyCatalog.groupDescription || "你自己创建和维护的长期角色。",
    familyOrder: parsed.familyOrder ?? legacyCatalog.groupOrder ?? 1_000,
    promoted: parsed.promoted,
    ownedOutcomes: parsed.ownedOutcomes || [],
    outOfScope: parsed.outOfScope || [],
    deliverables: parsed.deliverables || [],
    defaultSkillIds: parsed.defaultSkillIds || [],
    optionalSkillIds: parsed.optionalSkillIds || [],
    qualityGates: parsed.qualityGates || [],
    handoffTargets: parsed.handoffTargets || [],
    createdAt: parsed.createdAt || new Date().toISOString(),
    updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
    files,
  });
}

function readStoredAgentProfile(agentId: string): Partial<StoredAgentProfile> | null {
  const profilePath = getCustomAgentProfilePath(agentId);

  if (!existsSync(profilePath)) {
    return null;
  }

  return readStoredAgentProfileAtPath(profilePath);
}

function readStoredAgentProfileAtPath(profilePath: string): Partial<StoredAgentProfile> | null {
  if (!existsSync(profilePath)) {
    return null;
  }

  return JSON.parse(readFileSync(profilePath, "utf8")) as Partial<StoredAgentProfile>;
}

function readStoredSystemAgentShadowProfile(
  agentId: string,
  systemSeed: ReturnType<typeof listBuiltInSystemAgents>[number],
): AgentProfileDetail | null {
  const profilePath = getSystemAgentShadowProfilePath(agentId);

  if (!existsSync(profilePath)) {
    return null;
  }

  try {
    const parsed = readStoredAgentProfileAtPath(profilePath);

    if (!parsed) {
      return null;
    }

    const files = readAgentFilesFromDir(
      getSystemAgentShadowDir(agentId),
      parsed.files as StoredAgentFiles | undefined,
    );

    return normalizeAgentDetail(
      {
        ...systemSeed,
        ...parsed,
        id: systemSeed.id,
        source: "system",
        createdAt: parsed.createdAt || SYSTEM_AGENT_TIMESTAMP,
        updatedAt: parsed.updatedAt || parsed.createdAt || SYSTEM_AGENT_TIMESTAMP,
        files,
      },
      {
        systemSeedOverride: systemSeed,
        allowSystemProfileOverrides: true,
      },
    );
  } catch {
    return null;
  }
}

function readAgentFilesFromDir(agentDir: string, fallback?: StoredAgentFiles) {
  const nextFiles = {} as AgentFiles;

  (Object.keys(AGENT_FILE_NAMES) as AgentFileKey[]).forEach((key) => {
    const filePath = path.join(agentDir, AGENT_FILE_NAMES[key]);
    const legacyFilePath = path.join(agentDir, LEGACY_AGENT_FILE_NAMES[LEGACY_AGENT_FILE_KEY_BY_V2_KEY[key]]);
    nextFiles[key] = existsSync(filePath)
      ? readFileSync(filePath, "utf8")
      : existsSync(legacyFilePath)
        ? readFileSync(legacyFilePath, "utf8")
        : resolveStoredAgentFileValue(fallback, key);
  });

  return nextFiles;
}

function persistAgentProfile(detail: AgentProfileDetail) {
  persistAgentProfileToDir(detail, getCustomAgentDir(detail.id), getCustomAgentProfilePath(detail.id));
}

function persistSystemAgentShadowProfile(detail: AgentProfileDetail) {
  persistAgentProfileToDir(
    detail,
    getSystemAgentShadowDir(detail.id),
    getSystemAgentShadowProfilePath(detail.id),
  );
}

function persistAgentProfileToDir(
  detail: AgentProfileDetail,
  agentDir: string,
  profilePath: string,
) {
  mkdirSync(agentDir, { recursive: true });

  const stored: StoredAgentProfile = {
    ...detail,
  };

  writeFileSync(profilePath, JSON.stringify(stored, null, 2), "utf8");

  (Object.keys(AGENT_FILE_NAMES) as AgentFileKey[]).forEach((key) => {
    writeFileSync(path.join(agentDir, AGENT_FILE_NAMES[key]), `${detail.files[key].trim()}\n`, "utf8");
    rmSync(
      path.join(agentDir, LEGACY_AGENT_FILE_NAMES[LEGACY_AGENT_FILE_KEY_BY_V2_KEY[key]]),
      { force: true },
    );
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
    familyId: detail.familyId,
    familyLabel: detail.familyLabel,
    familyDescription: detail.familyDescription,
    familyOrder: detail.familyOrder,
    promoted: detail.promoted,
    ownedOutcomes: detail.ownedOutcomes,
    outOfScope: detail.outOfScope,
    deliverables: detail.deliverables,
    defaultSkillIds: detail.defaultSkillIds,
    optionalSkillIds: detail.optionalSkillIds,
    qualityGates: detail.qualityGates,
    handoffTargets: detail.handoffTargets,
    fileCount: countAgentFiles(detail.files),
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function normalizeAgentDetail(
  input: NormalizeAgentDetailInput,
  options: NormalizeAgentDetailOptions = {},
): AgentProfileDetail {
  const systemSeedOverride = options.systemSeedOverride ?? null;
  const allowSystemProfileOverrides = options.allowSystemProfileOverrides ?? false;
  const files = buildAgentFiles(input.files);
  const normalizedName = input.name.trim() || "未命名智能体";
  const source =
    input.source === "system" || systemSeedOverride || isBuiltInSystemAgentId(input.id) ? "system" : "custom";
  const systemSeed =
    source === "system"
      ? systemSeedOverride ?? listBuiltInSystemAgents().find((seed) => seed.id === input.id) ?? null
      : null;
  const teamRole =
    source === "system" && !allowSystemProfileOverrides
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
  const catalogMetadata = resolveCatalogMetadata(input, source, systemSeed, allowSystemProfileOverrides);

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
    defaultModel:
      source === "system" && !allowSystemProfileOverrides
        ? null
        : normalizeNullableString(input.defaultModel),
    defaultReasoningEffort:
      source === "system" && !allowSystemProfileOverrides
        ? null
        : normalizeReasoningEffort(input.defaultReasoningEffort),
    defaultSandboxMode:
      source === "system"
        ? allowSystemProfileOverrides
          ? normalizeSandboxMode(input.defaultSandboxMode)
            ?? systemSeed?.defaultSandboxMode
            ?? normalizeSystemSandboxMode(input.id, input.defaultSandboxMode)
          : systemSeed?.defaultSandboxMode ?? normalizeSystemSandboxMode(input.id, input.defaultSandboxMode)
        : normalizeSandboxMode(input.defaultSandboxMode),
    starterPrompts: normalizeStarterPrompts(input.starterPrompts),
    familyId: catalogMetadata.familyId,
    familyLabel: catalogMetadata.familyLabel,
    familyDescription: catalogMetadata.familyDescription,
    familyOrder: catalogMetadata.familyOrder,
    promoted: catalogMetadata.promoted,
    ownedOutcomes: catalogMetadata.ownedOutcomes,
    outOfScope: catalogMetadata.outOfScope,
    deliverables: catalogMetadata.deliverables,
    defaultSkillIds: catalogMetadata.defaultSkillIds,
    optionalSkillIds: catalogMetadata.optionalSkillIds,
    qualityGates: catalogMetadata.qualityGates,
    handoffTargets: catalogMetadata.handoffTargets,
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
  allowSystemProfileOverrides = false,
) {
  if (source === "system" && systemSeed && !allowSystemProfileOverrides) {
    return {
      familyId: systemSeed.familyId,
      familyLabel: systemSeed.familyLabel,
      familyDescription: systemSeed.familyDescription,
      familyOrder: systemSeed.familyOrder,
      promoted: systemSeed.promoted,
      ownedOutcomes: systemSeed.ownedOutcomes,
      outOfScope: systemSeed.outOfScope,
      deliverables: systemSeed.deliverables,
      defaultSkillIds: systemSeed.defaultSkillIds,
      optionalSkillIds: systemSeed.optionalSkillIds,
      qualityGates: systemSeed.qualityGates,
      handoffTargets: systemSeed.handoffTargets,
    };
  }

  if (source === "system" && systemSeed) {
    return {
      familyId: normalizeNullableString(input.familyId) || systemSeed.familyId,
      familyLabel: normalizeNullableString(input.familyLabel) || systemSeed.familyLabel,
      familyDescription:
        normalizeNullableString(input.familyDescription) || systemSeed.familyDescription,
      familyOrder: normalizeOrder(input.familyOrder, systemSeed.familyOrder),
      promoted: input.promoted ?? systemSeed.promoted,
      ownedOutcomes: Array.isArray(input.ownedOutcomes) ? input.ownedOutcomes : systemSeed.ownedOutcomes,
      outOfScope: Array.isArray(input.outOfScope) ? input.outOfScope : systemSeed.outOfScope,
      deliverables: Array.isArray(input.deliverables) ? input.deliverables : systemSeed.deliverables,
      defaultSkillIds:
        Array.isArray(input.defaultSkillIds) ? input.defaultSkillIds : systemSeed.defaultSkillIds,
      optionalSkillIds:
        Array.isArray(input.optionalSkillIds) ? input.optionalSkillIds : systemSeed.optionalSkillIds,
      qualityGates: Array.isArray(input.qualityGates) ? input.qualityGates : systemSeed.qualityGates,
      handoffTargets:
        Array.isArray(input.handoffTargets) ? input.handoffTargets : systemSeed.handoffTargets,
    };
  }

  return {
    familyId: normalizeNullableString(input.familyId) || "custom",
    familyLabel: normalizeNullableString(input.familyLabel) || "我的智能体",
    familyDescription:
      normalizeNullableString(input.familyDescription) || "你自己创建和维护的长期角色。",
    familyOrder: normalizeOrder(input.familyOrder, 1_000),
    promoted: Boolean(input.promoted),
    ownedOutcomes: Array.isArray(input.ownedOutcomes) ? input.ownedOutcomes : [],
    outOfScope: Array.isArray(input.outOfScope) ? input.outOfScope : [],
    deliverables: Array.isArray(input.deliverables) ? input.deliverables : [],
    defaultSkillIds: Array.isArray(input.defaultSkillIds) ? input.defaultSkillIds : [],
    optionalSkillIds: Array.isArray(input.optionalSkillIds) ? input.optionalSkillIds : [],
    qualityGates: Array.isArray(input.qualityGates) ? input.qualityGates : [],
    handoffTargets: Array.isArray(input.handoffTargets) ? input.handoffTargets : [],
  };
}

function normalizeNullableString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOrder(value: number | null | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function resolveStoredAgentFileValue(input: StoredAgentFiles | undefined, key: AgentFileKey) {
  const legacyKey = LEGACY_AGENT_FILE_KEY_BY_V2_KEY[key];
  return (input?.[key] ?? input?.[legacyKey] ?? "").trim();
}
