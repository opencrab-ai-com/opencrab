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

const SYSTEM_AGENT_SOURCE_DIR = path.join(process.cwd(), "agents-src", "system");
const SYSTEM_AGENT_GROUPS_FILE = path.join(process.cwd(), "agents-src", "system-groups.json");
const SYSTEM_AGENT_METADATA_FILE_NAME = "agent.yaml";
const SYSTEM_AGENT_AVATAR_DIR = path.join(process.cwd(), "public", "agent-avatars", "system");
const AGENT_SECTION_DEFS: Array<{ key: AgentFileKey; title: string; fileName: string }> = [
  { key: "soul", title: "Soul", fileName: "soul.md" },
  { key: "responsibility", title: "Responsibility", fileName: "responsibility.md" },
  { key: "tools", title: "Tools", fileName: "tools.md" },
  { key: "user", title: "User", fileName: "user.md" },
  { key: "knowledge", title: "Knowledge", fileName: "knowledge.md" },
];
const VALID_AVAILABILITY = new Set<AgentAvailability>(["solo", "team", "both"]);
const VALID_TEAM_ROLES = new Set<AgentTeamRole>(["lead", "research", "writer", "specialist"]);
const VALID_REASONING_EFFORTS = new Set<CodexReasoningEffort>([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);
const VALID_SANDBOX_MODES = new Set<CodexSandboxMode>([
  "read-only",
  "workspace-write",
  "danger-full-access",
]);
const SYSTEM_AGENT_CACHE_TTL_MS = process.env.NODE_ENV === "development" ? 1_500 : 60_000;

let builtInSystemAgentCache:
  | {
      agents: BuiltInSystemAgentDefinition[];
      expiresAt: number;
    }
  | null = null;

type StoredSourceAgentConfig = {
  id?: string;
  name?: string;
  summary?: string;
  roleLabel?: string;
  description?: string;
  groupId?: string;
  availability?: AgentAvailability;
  teamRole?: AgentTeamRole;
  defaultModel?: string | null;
  defaultReasoningEffort?: CodexReasoningEffort | null;
  defaultSandboxMode?: CodexSandboxMode | null;
  starterPrompts?: string[];
  avatarFileName?: string | null;
  promoted?: boolean;
  upstreamAgentName?: string | null;
  upstreamSourceUrl?: string | null;
  upstreamLicense?: string | null;
};

type GroupRegistryCollection = {
  id: string;
  label: string;
  description: string;
  order: number;
};

type GroupRegistryGroup = {
  id: string;
  label: string;
  description: string;
  order: number;
  collection: GroupRegistryCollection;
};

type GroupRegistry = {
  groups: Map<string, GroupRegistryGroup>;
};

export type BuiltInSystemAgentDefinition = {
  id: string;
  name: string;
  avatarDataUrl: string | null;
  summary: string;
  roleLabel: string;
  description: string;
  groupId: string;
  groupLabel: string;
  groupDescription: string;
  groupOrder: number;
  collectionId: string;
  collectionLabel: string;
  collectionDescription: string;
  collectionOrder: number;
  source: "system";
  availability: AgentAvailability;
  teamRole: AgentTeamRole;
  defaultModel: string | null;
  defaultReasoningEffort: CodexReasoningEffort | null;
  defaultSandboxMode: CodexSandboxMode | null;
  starterPrompts: string[];
  promoted: boolean;
  upstreamAgentName: string | null;
  upstreamSourceUrl: string | null;
  upstreamLicense: string | null;
  files: AgentFiles;
};

export function listBuiltInSystemAgents() {
  const now = Date.now();

  if (builtInSystemAgentCache && builtInSystemAgentCache.expiresAt > now) {
    return builtInSystemAgentCache.agents;
  }

  const agents = loadBuiltInSystemAgents();

  builtInSystemAgentCache = {
    agents,
    expiresAt: now + SYSTEM_AGENT_CACHE_TTL_MS,
  };

  return agents;
}

function loadBuiltInSystemAgents() {
  if (!existsSync(SYSTEM_AGENT_SOURCE_DIR)) {
    return [];
  }

  const groupRegistry = readSystemAgentGroupRegistry(SYSTEM_AGENT_GROUPS_FILE);
  const agents = readdirSync(SYSTEM_AGENT_SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((entry) => readBuiltInSystemAgentSource(path.join(SYSTEM_AGENT_SOURCE_DIR, entry.name), groupRegistry));

  const seenIds = new Set<string>();

  agents.forEach((agent) => {
    if (seenIds.has(agent.id)) {
      throw new Error(`系统智能体源码存在重复 id：${agent.id}`);
    }

    seenIds.add(agent.id);
  });

  return agents;
}

function readBuiltInSystemAgentSource(
  agentDir: string,
  groupRegistry: GroupRegistry,
): BuiltInSystemAgentDefinition {
  const metadataPath = path.join(agentDir, SYSTEM_AGENT_METADATA_FILE_NAME);

  if (!existsSync(metadataPath)) {
    throw new Error(`系统智能体缺少 ${SYSTEM_AGENT_METADATA_FILE_NAME}：${agentDir}`);
  }

  const metadata = normalizeSourceMetadata(parseSimpleYaml(readFileSync(metadataPath, "utf8")), metadataPath);
  const groupMetadata = resolveSystemAgentGroupMetadata(metadata.groupId, groupRegistry);
  const files = {} as AgentFiles;

  AGENT_SECTION_DEFS.forEach((section) => {
    const sectionPath = path.join(agentDir, section.fileName);

    if (!existsSync(sectionPath)) {
      throw new Error(`系统智能体缺少 ${section.fileName}：${agentDir}`);
    }

    const body = readFileSync(sectionPath, "utf8").trim();

    if (!body) {
      throw new Error(`系统智能体的 ${section.fileName} 为空：${agentDir}`);
    }

    files[section.key] = buildRuntimeSectionContent(section.title, body, {
      name: metadata.name,
      roleLabel: metadata.roleLabel,
      summary: metadata.summary,
    });
  });

  return {
    id: metadata.id,
    name: metadata.name,
    avatarDataUrl: readSystemAgentAvatarDataUrl(metadata.avatarFileName),
    summary: metadata.summary,
    roleLabel: metadata.roleLabel,
    description: metadata.description,
    groupId: groupMetadata.id,
    groupLabel: groupMetadata.label,
    groupDescription: groupMetadata.description,
    groupOrder: groupMetadata.order,
    collectionId: groupMetadata.collection.id,
    collectionLabel: groupMetadata.collection.label,
    collectionDescription: groupMetadata.collection.description,
    collectionOrder: groupMetadata.collection.order,
    source: "system",
    availability: metadata.availability,
    teamRole: metadata.teamRole,
    defaultModel: metadata.defaultModel,
    defaultReasoningEffort: metadata.defaultReasoningEffort,
    defaultSandboxMode: metadata.defaultSandboxMode,
    starterPrompts: metadata.starterPrompts,
    promoted: metadata.promoted,
    upstreamAgentName: metadata.upstreamAgentName,
    upstreamSourceUrl: metadata.upstreamSourceUrl,
    upstreamLicense: metadata.upstreamLicense,
    files,
  };
}

function normalizeSourceMetadata(rawValue: StoredSourceAgentConfig, filePath: string) {
  const raw = rawValue || {};
  const id = requireTrimmedString(raw.id, "id", filePath);
  const name = requireTrimmedString(raw.name, "name", filePath);
  const summary = requireTrimmedString(raw.summary, "summary", filePath);

  return {
    id,
    name,
    summary,
    roleLabel: normalizeOptionalString(raw.roleLabel) || "Specialist",
    description: normalizeOptionalString(raw.description) || summary,
    groupId: normalizeOptionalString(raw.groupId) || "opencrab-core",
    availability: normalizeAvailability(raw.availability),
    teamRole: normalizeTeamRole(raw.teamRole),
    defaultModel: normalizeOptionalString(raw.defaultModel),
    defaultReasoningEffort: normalizeReasoningEffort(raw.defaultReasoningEffort),
    defaultSandboxMode: normalizeSandboxMode(raw.defaultSandboxMode),
    starterPrompts: normalizeStarterPrompts(raw.starterPrompts),
    avatarFileName: normalizeOptionalString(raw.avatarFileName),
    promoted: Boolean(raw.promoted),
    upstreamAgentName: normalizeOptionalString(raw.upstreamAgentName),
    upstreamSourceUrl: normalizeOptionalString(raw.upstreamSourceUrl),
    upstreamLicense: normalizeOptionalString(raw.upstreamLicense),
  };
}

function readSystemAgentGroupRegistry(filePath: string): GroupRegistry {
  if (!existsSync(filePath)) {
    throw new Error(`缺少系统智能体分组配置：${filePath}`);
  }

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
    collections?: Array<{
      id?: string;
      label?: string;
      description?: string;
      order?: number;
    }>;
    groups?: Array<{
      id?: string;
      collectionId?: string;
      label?: string;
      description?: string;
      order?: number;
    }>;
  };
  const collections = new Map<string, GroupRegistryCollection>();
  const groups = new Map<string, GroupRegistryGroup>();

  (parsed.collections || []).forEach((collection) => {
    const id = requireTrimmedString(collection.id, "collection.id", filePath);

    if (collections.has(id)) {
      throw new Error(`系统智能体分组配置存在重复 collection id：${id}`);
    }

    collections.set(id, {
      id,
      label: requireTrimmedString(collection.label, "collection.label", filePath),
      description: requireTrimmedString(collection.description, "collection.description", filePath),
      order: normalizeOrder(collection.order, 999),
    });
  });

  (parsed.groups || []).forEach((group) => {
    const id = requireTrimmedString(group.id, "group.id", filePath);
    const collectionId = requireTrimmedString(group.collectionId, "group.collectionId", filePath);
    const collection = collections.get(collectionId);

    if (!collection) {
      throw new Error(`系统智能体分组配置引用了不存在的 collection：${collectionId}`);
    }

    if (groups.has(id)) {
      throw new Error(`系统智能体分组配置存在重复 group id：${id}`);
    }

    groups.set(id, {
      id,
      label: requireTrimmedString(group.label, "group.label", filePath),
      description: requireTrimmedString(group.description, "group.description", filePath),
      order: normalizeOrder(group.order, 999),
      collection,
    });
  });

  return {
    groups,
  };
}

function resolveSystemAgentGroupMetadata(groupId: string, groupRegistry: GroupRegistry) {
  const resolved = groupRegistry.groups.get(groupId);

  if (!resolved) {
    throw new Error(`系统智能体源码引用了不存在的 groupId：${groupId}`);
  }

  return resolved;
}

function parseSimpleYaml(yamlText: string) {
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  const result: Record<string, unknown> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s+(.*))?$/);

    if (!match) {
      throw new Error(`无法解析 YAML 行：${line}`);
    }

    const [, key, rawValue = ""] = match;

    if (rawValue) {
      if (startsMultilineQuotedScalar(rawValue) && !endsMultilineQuotedScalar(rawValue)) {
        const collectedLines = [rawValue];
        let cursor = index + 1;

        while (cursor < lines.length) {
          const nextLine = lines[cursor];

          if (!nextLine.trim()) {
            collectedLines.push("");
            cursor += 1;
            continue;
          }

          if (!/^\s+/.test(nextLine)) {
            break;
          }

          collectedLines.push(nextLine.trimStart());
          cursor += 1;

          if (endsMultilineQuotedScalar(collectedLines[collectedLines.length - 1])) {
            break;
          }
        }

        result[key] = parseScalar(collectedLines.join("\n"));
        index = cursor - 1;
        continue;
      }

      result[key] = parseScalar(rawValue);
      continue;
    }

    const arrayValues: unknown[] = [];
    let cursor = index + 1;

    while (cursor < lines.length) {
      const nextLine = lines[cursor];

      if (!nextLine.trim()) {
        cursor += 1;
        continue;
      }

      const itemMatch = nextLine.match(/^\s*-\s+(.*)$/);

      if (!itemMatch) {
        break;
      }

      arrayValues.push(parseScalar(itemMatch[1]));
      cursor += 1;
    }

    if (arrayValues.length > 0) {
      result[key] = arrayValues;
      index = cursor - 1;
      continue;
    }

    result[key] = null;
  }

  return result as StoredSourceAgentConfig;
}

function startsMultilineQuotedScalar(rawValue: string) {
  return rawValue.startsWith("'") || rawValue.startsWith('"');
}

function endsMultilineQuotedScalar(rawValue: string) {
  if (rawValue.length < 2) {
    return false;
  }

  const quote = rawValue[0];
  return (quote === "'" || quote === '"') && rawValue.endsWith(quote);
}

function parseScalar(rawValue: string) {
  const raw = rawValue.trim();

  if (!raw) {
    return null;
  }

  if (raw === "null") {
    return null;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  if (raw.startsWith('"') || raw.startsWith("'")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }

  return raw;
}

function requireTrimmedString(value: string | undefined, fieldName: string, filePath: string) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new Error(`系统智能体缺少 ${fieldName}：${filePath}`);
  }

  return normalized;
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeAvailability(value: AgentAvailability | undefined) {
  if (!value) {
    return "both" as const;
  }

  if (!VALID_AVAILABILITY.has(value)) {
    throw new Error(`availability 不合法：${value}`);
  }

  return value;
}

function normalizeTeamRole(value: AgentTeamRole | undefined) {
  if (!value) {
    return "specialist" as const;
  }

  if (!VALID_TEAM_ROLES.has(value)) {
    throw new Error(`teamRole 不合法：${value}`);
  }

  return value;
}

function normalizeReasoningEffort(value: CodexReasoningEffort | null | undefined) {
  if (!value) {
    return null;
  }

  if (!VALID_REASONING_EFFORTS.has(value)) {
    throw new Error(`defaultReasoningEffort 不合法：${value}`);
  }

  return value;
}

function normalizeSandboxMode(value: CodexSandboxMode | null | undefined) {
  if (!value) {
    return "workspace-write" as const;
  }

  if (!VALID_SANDBOX_MODES.has(value)) {
    throw new Error(`defaultSandboxMode 不合法：${value}`);
  }

  return value;
}

function normalizeStarterPrompts(value: string[] | undefined) {
  return (value || []).map((item) => item.trim()).filter(Boolean);
}

function normalizeOrder(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function buildRuntimeSectionContent(
  sectionTitle: string,
  sectionBody: string,
  metadata: { name: string; roleLabel: string; summary: string },
) {
  const frontmatter = [
    "---",
    `agent: ${JSON.stringify(metadata.name)}`,
    `role: ${JSON.stringify(metadata.roleLabel)}`,
    `file: ${JSON.stringify(`${sectionTitle.toLowerCase()}.md`)}`,
    `purpose: ${JSON.stringify(metadata.summary)}`,
    "---",
    "",
  ].join("\n");

  return [frontmatter, `# ${sectionTitle}`, "", sectionBody.trim()].join("\n").trim();
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
