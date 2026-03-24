import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  AgentAvailability,
  AgentFileKey,
  AgentFiles,
  AgentTeamRole,
} from "@/lib/agents/types";
import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";

const SYSTEM_AGENT_CONFIG_DIR = path.join(process.cwd(), "config", "system-agents");
const SYSTEM_AGENT_AVATAR_DIR = path.join(process.cwd(), "public", "agent-avatars", "system");
const AGENT_FILE_KEYS: AgentFileKey[] = [
  "soul",
  "responsibility",
  "tools",
  "user",
  "knowledge",
];

type StoredSystemAgentConfig = {
  id: string;
  name: string;
  summary: string;
  roleLabel: string;
  description: string;
  availability?: AgentAvailability;
  teamRole?: AgentTeamRole;
  defaultModel?: string | null;
  defaultReasoningEffort?: CodexReasoningEffort | null;
  defaultSandboxMode?: CodexSandboxMode | null;
  starterPrompts?: string[];
  avatarFileName?: string | null;
  promoted?: boolean;
  files?: Partial<AgentFiles>;
};

export type BuiltInSystemAgentDefinition = {
  id: string;
  name: string;
  avatarDataUrl: string | null;
  summary: string;
  roleLabel: string;
  description: string;
  source: "system";
  availability: AgentAvailability;
  teamRole: AgentTeamRole;
  defaultModel: string | null;
  defaultReasoningEffort: CodexReasoningEffort | null;
  defaultSandboxMode: CodexSandboxMode | null;
  starterPrompts: string[];
  promoted: boolean;
  files: AgentFiles;
};

let cachedBuiltInSystemAgents: BuiltInSystemAgentDefinition[] | null = null;

export function listBuiltInSystemAgents() {
  if (cachedBuiltInSystemAgents) {
    return cachedBuiltInSystemAgents;
  }

  cachedBuiltInSystemAgents = loadBuiltInSystemAgents();
  return cachedBuiltInSystemAgents;
}

function loadBuiltInSystemAgents() {
  if (!existsSync(SYSTEM_AGENT_CONFIG_DIR)) {
    return [];
  }

  const agents = readdirSync(SYSTEM_AGENT_CONFIG_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((entry) => readBuiltInSystemAgentConfig(path.join(SYSTEM_AGENT_CONFIG_DIR, entry.name)));

  const seenIds = new Set<string>();

  agents.forEach((agent) => {
    if (seenIds.has(agent.id)) {
      throw new Error(`系统智能体配置存在重复 id：${agent.id}`);
    }

    seenIds.add(agent.id);
  });

  return agents;
}

function readBuiltInSystemAgentConfig(filePath: string): BuiltInSystemAgentDefinition {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<StoredSystemAgentConfig>;
  const id = parsed.id?.trim();

  if (!id) {
    throw new Error(`系统智能体配置缺少 id：${filePath}`);
  }

  const name = parsed.name?.trim();

  if (!name) {
    throw new Error(`系统智能体配置缺少 name：${filePath}`);
  }

  return {
    id,
    name,
    avatarDataUrl: readSystemAgentAvatarDataUrl(normalizeNullableString(parsed.avatarFileName)),
    summary: parsed.summary?.trim() || "暂未填写说明。",
    roleLabel: parsed.roleLabel?.trim() || "Specialist",
    description: parsed.description?.trim() || parsed.summary?.trim() || "暂未填写说明。",
    source: "system",
    availability: normalizeAvailability(parsed.availability),
    teamRole: normalizeTeamRole(parsed.teamRole),
    defaultModel: normalizeNullableString(parsed.defaultModel),
    defaultReasoningEffort: normalizeReasoningEffort(parsed.defaultReasoningEffort),
    defaultSandboxMode: normalizeSandboxMode(parsed.defaultSandboxMode),
    starterPrompts: normalizeStarterPrompts(parsed.starterPrompts),
    promoted: Boolean(parsed.promoted),
    files: normalizeFiles(parsed.files),
  };
}

function normalizeFiles(value: Partial<AgentFiles> | undefined): AgentFiles {
  const files = {} as AgentFiles;

  AGENT_FILE_KEYS.forEach((key) => {
    files[key] = value?.[key]?.trim() || "";
  });

  return files;
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

function normalizeStarterPrompts(value: string[] | undefined) {
  return (value || []).map((item) => item.trim()).filter(Boolean);
}

function normalizeNullableString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readSystemAgentAvatarDataUrl(fileName: string | null) {
  if (!fileName) {
    return null;
  }

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
