import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const OPENCRAB_SYSTEM_AGENT_SOURCE_DIR = path.join(process.cwd(), "agents-src", "system");
export const OPENCRAB_SYSTEM_AGENT_GROUPS_FILE = path.join(process.cwd(), "agents-src", "system-groups.json");
export const OPENCRAB_SYSTEM_AGENT_IMPORT_DIR = path.join(process.cwd(), "agents-src", "imports", "agency");
export const OPENCRAB_SYSTEM_AGENT_METADATA_FILE_NAME = "agent.yaml";
export const OPENCRAB_AGENT_SECTION_ORDER = [
  { key: "soul", title: "Soul", fileName: "soul.md" },
  { key: "responsibility", title: "Responsibility", fileName: "responsibility.md" },
  { key: "tools", title: "Tools", fileName: "tools.md" },
  { key: "user", title: "User", fileName: "user.md" },
  { key: "knowledge", title: "Knowledge", fileName: "knowledge.md" },
];

const VALID_AVAILABILITY = new Set(["solo", "team", "both"]);
const VALID_TEAM_ROLES = new Set(["lead", "research", "writer", "specialist"]);
const VALID_REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);
const VALID_SANDBOX_MODES = new Set(["read-only", "workspace-write", "danger-full-access"]);
const METADATA_FIELD_ORDER = [
  "id",
  "name",
  "summary",
  "roleLabel",
  "description",
  "groupId",
  "availability",
  "teamRole",
  "defaultModel",
  "defaultReasoningEffort",
  "defaultSandboxMode",
  "avatarFileName",
  "promoted",
  "starterPrompts",
  "upstreamAgentName",
  "upstreamSourceUrl",
  "upstreamLicense",
];

export function compileSystemAgentSources(options = {}) {
  const sourceDir = path.resolve(process.cwd(), options.sourceDir || OPENCRAB_SYSTEM_AGENT_SOURCE_DIR);
  const groupRegistryPath = path.resolve(
    process.cwd(),
    options.groupRegistryPath || OPENCRAB_SYSTEM_AGENT_GROUPS_FILE,
  );
  const groupRegistry = readSystemAgentGroupRegistry(groupRegistryPath);
  const sourceEntries = listAgentSourceEntries(sourceDir);
  const compiled = [];
  const errors = [];
  const seenIds = new Set();

  sourceEntries.forEach((entryName) => {
    const agentDir = path.join(sourceDir, entryName);
    const sourceAgent = readOpenCrabAuthoringAgent(agentDir);
    const runtimeConfig = compileOpenCrabAuthoringAgent(sourceAgent, { groupRegistry });

    if (seenIds.has(runtimeConfig.id)) {
      throw new Error(`系统智能体源码存在重复 id：${runtimeConfig.id}`);
    }

    seenIds.add(runtimeConfig.id);
    compiled.push({
      slug: entryName,
      id: runtimeConfig.id,
      sourceDir: agentDir,
      metadataPath: path.join(agentDir, OPENCRAB_SYSTEM_AGENT_METADATA_FILE_NAME),
    });
  });

  return {
    compiled,
    errors,
  };
}

export function readOpenCrabAuthoringAgent(agentDir) {
  const resolvedAgentDir = path.resolve(process.cwd(), agentDir);
  const metadataPath = path.join(resolvedAgentDir, OPENCRAB_SYSTEM_AGENT_METADATA_FILE_NAME);

  if (!existsSync(metadataPath)) {
    throw new Error(`系统智能体缺少 ${OPENCRAB_SYSTEM_AGENT_METADATA_FILE_NAME}：${resolvedAgentDir}`);
  }

  const metadata = parseOpenCrabMetadataYaml(readFileSync(metadataPath, "utf8"), metadataPath);
  const sections = {};

  OPENCRAB_AGENT_SECTION_ORDER.forEach((section) => {
    const sectionPath = path.join(resolvedAgentDir, section.fileName);

    if (!existsSync(sectionPath)) {
      throw new Error(`系统智能体缺少 ${section.fileName}：${resolvedAgentDir}`);
    }

    const content = normalizeSectionFileContent(readFileSync(sectionPath, "utf8"));

    if (!content) {
      throw new Error(`系统智能体的 ${section.fileName} 为空：${resolvedAgentDir}`);
    }

    sections[section.key] = content;
  });

  return {
    metadata,
    sections,
  };
}

export function parseOpenCrabMetadataYaml(yamlText, filePath) {
  return normalizeOpenCrabMetadata(parseSimpleYaml(yamlText), filePath);
}

export function compileOpenCrabAuthoringAgent(sourceAgent, options = {}) {
  const metadata = sourceAgent.metadata;
  const groupMetadata = resolveSystemAgentGroupMetadata(metadata.groupId, options.groupRegistry);

  return {
    id: metadata.id,
    name: metadata.name,
    summary: metadata.summary,
    roleLabel: metadata.roleLabel,
    description: metadata.description,
    availability: metadata.availability,
    teamRole: metadata.teamRole,
    defaultModel: metadata.defaultModel,
    defaultReasoningEffort: metadata.defaultReasoningEffort,
    defaultSandboxMode: metadata.defaultSandboxMode,
    starterPrompts: metadata.starterPrompts,
    groupId: groupMetadata.id,
    groupLabel: groupMetadata.label,
    groupDescription: groupMetadata.description,
    groupOrder: groupMetadata.order,
    collectionId: groupMetadata.collection.id,
    collectionLabel: groupMetadata.collection.label,
    collectionDescription: groupMetadata.collection.description,
    collectionOrder: groupMetadata.collection.order,
    avatarFileName: metadata.avatarFileName,
    promoted: metadata.promoted,
    upstreamAgentName: metadata.upstreamAgentName,
    upstreamSourceUrl: metadata.upstreamSourceUrl,
    upstreamLicense: metadata.upstreamLicense,
    files: Object.fromEntries(
      OPENCRAB_AGENT_SECTION_ORDER.map((section) => [
        section.key,
        buildRuntimeSectionContent(section.title, sourceAgent.sections[section.key], metadata),
      ]),
    ),
  };
}

export function convertRuntimeConfigToAuthoringSource(runtimeConfig) {
  const metadata = normalizeOpenCrabMetadata(runtimeConfig);
  const sections = {};

  OPENCRAB_AGENT_SECTION_ORDER.forEach((section) => {
    sections[section.key] = extractRuntimeSectionBody(runtimeConfig.files?.[section.key] || "", section.title);
  });

  return {
    metadata,
    sections,
  };
}

export function writeOpenCrabAuthoringAgent(sourceAgent, outputDir, options = {}) {
  const resolvedOutputDir = path.resolve(process.cwd(), outputDir);

  if (existsSync(resolvedOutputDir) && options.overwrite !== true) {
    throw new Error(`导入目标已存在：${resolvedOutputDir}。如需覆盖，请传 --overwrite。`);
  }

  mkdirSync(resolvedOutputDir, { recursive: true });
  writeFileSync(
    path.join(resolvedOutputDir, OPENCRAB_SYSTEM_AGENT_METADATA_FILE_NAME),
    `${renderMetadataYaml(sourceAgent.metadata)}\n`,
    "utf8",
  );

  OPENCRAB_AGENT_SECTION_ORDER.forEach((section) => {
    writeFileSync(
      path.join(resolvedOutputDir, section.fileName),
      `${normalizeSectionFileContent(sourceAgent.sections[section.key])}\n`,
      "utf8",
    );
  });

  return resolvedOutputDir;
}

export async function importAgencyAgentToOpenCrabSource(options) {
  const input = options?.input;

  if (!input) {
    throw new Error("缺少 --input，无法导入 agency agent。");
  }

  const markdown = await readMarkdownInput(input);
  const sourceUrl = isUrl(input) ? normalizeAgencyInputUrl(input) : null;
  const sourcePath = sourceUrl ? null : path.resolve(process.cwd(), input);
  const slug = options.slug?.trim() || slugify(extractAgencyNameFromInput(input) || "agency-agent");
  const agencyDraft = convertAgencyMarkdownToOpenCrabSource(markdown, {
    slug,
    sourceUrl,
    sourcePath,
  });
  const outputRoot = path.resolve(process.cwd(), options.outputRoot || OPENCRAB_SYSTEM_AGENT_IMPORT_DIR);
  const outputDir = path.join(outputRoot, slug);

  writeOpenCrabAuthoringAgent(agencyDraft, outputDir, {
    overwrite: options.overwrite === true,
  });

  return {
    slug,
    outputPath: outputDir,
    source: sourceUrl || sourcePath,
  };
}

export function convertAgencyMarkdownToOpenCrabSource(markdown, options = {}) {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const agency = parseAgencyFrontmatter(frontmatter);
  const parsedSections = splitMarkdownSections(body);
  const slug = options.slug || slugify(agency.name || "agency-agent");
  const category = inferAgencyCategory(options.sourceUrl || options.sourcePath || null);
  const title = agency.name || humanizeSlug(slug);
  const summary = compactText(agency.vibe || agency.description || `${title} specialist`);
  const description = compactText([agency.description, agency.vibe].filter(Boolean).join(" "));
  const sectionBuckets = {
    soul: [],
    responsibility: [],
    tools: [],
    user: [],
    knowledge: [],
  };

  if (parsedSections.intro) {
    sectionBuckets.soul.push(renderNestedSection("Persona Overview", parsedSections.intro));
  }

  parsedSections.sections.forEach((section) => {
    const bucket = mapAgencySectionToOpenCrabKey(section.title);
    sectionBuckets[bucket].push(renderNestedSection(cleanAgencySectionTitle(section.title), section.body));
  });

  if (agency.services.length > 0) {
    const serviceLines = agency.services.map((service) => {
      const parts = [service.name];

      if (service.tier) {
        parts.push(`tier: ${service.tier}`);
      }

      if (service.url) {
        parts.push(service.url);
      }

      return `- ${parts.join(" | ")}`;
    });

    sectionBuckets.tools.push(["### External Services", "", ...serviceLines].join("\n").trim());
  }

  const sections = {};

  OPENCRAB_AGENT_SECTION_ORDER.forEach((section) => {
    const content = sectionBuckets[section.key].join("\n\n").trim();
    sections[section.key] = content || buildImportedSectionPlaceholder(section.title, title);
  });

  return {
    metadata: normalizeOpenCrabMetadata({
      id: slug,
      name: title,
      summary,
      roleLabel: inferRoleLabel(title),
      description: description || summary,
      groupId: category || "specialized",
      availability: "both",
      teamRole: inferTeamRole(title, category),
      defaultModel: null,
      defaultReasoningEffort: null,
      defaultSandboxMode: "workspace-write",
      avatarFileName: null,
      promoted: false,
      starterPrompts: buildImportedStarterPrompts(title, summary),
      upstreamAgentName: agency.name || null,
      upstreamSourceUrl: options.sourceUrl || null,
      upstreamLicense: "MIT",
    }),
    sections,
  };
}

function renderMetadataYaml(metadata) {
  const extras = Object.keys(metadata)
    .filter((key) => !METADATA_FIELD_ORDER.includes(key))
    .sort((left, right) => left.localeCompare(right, "en"));
  const orderedKeys = [...METADATA_FIELD_ORDER, ...extras].filter((key) => key in metadata);
  const lines = [];

  orderedKeys.forEach((key) => {
    const value = metadata[key];

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      value.forEach((item) => {
        lines.push(`  - ${quoteYamlString(item)}`);
      });
      return;
    }

    if (value === null || value === undefined) {
      lines.push(`${key}: null`);
      return;
    }

    if (typeof value === "boolean") {
      lines.push(`${key}: ${value ? "true" : "false"}`);
      return;
    }

    lines.push(`${key}: ${quoteYamlString(String(value))}`);
  });

  return lines.join("\n");
}

function buildRuntimeSectionContent(sectionTitle, sectionBody, metadata) {
  const frontmatter = [
    "---",
    `agent: ${quoteYamlString(metadata.name)}`,
    `role: ${quoteYamlString(metadata.roleLabel)}`,
    `file: ${quoteYamlString(`${sectionTitle.toLowerCase()}.md`)}`,
    `purpose: ${quoteYamlString(metadata.summary)}`,
    "---",
    "",
  ].join("\n");

  return [frontmatter, `# ${sectionTitle}`, "", normalizeSectionFileContent(sectionBody)].join("\n").trim();
}

function extractRuntimeSectionBody(content, sectionTitle) {
  const withoutFrontmatter = stripFrontmatter(content).trim();
  const body = stripLeadingHeading(withoutFrontmatter, sectionTitle).trim();

  if (!body) {
    throw new Error(`运行时智能体内容缺少 ${sectionTitle} 正文。`);
  }

  return body;
}

function normalizeOpenCrabMetadata(rawValue, filePath) {
  const raw = rawValue || {};
  const id = requireTrimmedString(raw.id, "id", filePath);
  const name = requireTrimmedString(raw.name, "name", filePath);
  const summary = requireTrimmedString(raw.summary, "summary", filePath);
  const roleLabel = normalizeOptionalString(raw.roleLabel) || "Specialist";
  const description = normalizeOptionalString(raw.description) || summary;
  const groupId = normalizeOptionalString(raw.groupId) || "opencrab-core";
  const availability = normalizeAvailability(raw.availability);
  const teamRole = normalizeTeamRole(raw.teamRole);
  const defaultModel = normalizeOptionalString(raw.defaultModel);
  const defaultReasoningEffort = normalizeReasoningEffort(raw.defaultReasoningEffort);
  const defaultSandboxMode = normalizeSandboxMode(raw.defaultSandboxMode);
  const avatarFileName = normalizeOptionalString(raw.avatarFileName);
  const promoted = Boolean(raw.promoted);
  const starterPrompts = normalizeStringArray(raw.starterPrompts);
  const upstreamAgentName = normalizeOptionalString(raw.upstreamAgentName);
  const upstreamSourceUrl = normalizeOptionalString(raw.upstreamSourceUrl);
  const upstreamLicense = normalizeOptionalString(raw.upstreamLicense);

  return {
    id,
    name,
    summary,
    roleLabel,
    description,
    groupId,
    availability,
    teamRole,
    defaultModel,
    defaultReasoningEffort,
    defaultSandboxMode,
    avatarFileName,
    promoted,
    starterPrompts,
    upstreamAgentName,
    upstreamSourceUrl,
    upstreamLicense,
  };
}

function parseAgencyFrontmatter(frontmatter) {
  return {
    name: extractFrontmatterValue(frontmatter, "name"),
    description: extractFrontmatterValue(frontmatter, "description"),
    vibe: extractFrontmatterValue(frontmatter, "vibe"),
    services: extractAgencyServices(frontmatter),
  };
}

function readSystemAgentGroupRegistry(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`缺少系统智能体分组配置：${filePath}`);
  }

  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  const collections = new Map();
  const groups = new Map();

  (parsed.collections || []).forEach((collection) => {
    const id = requireTrimmedString(collection?.id, "collection.id", filePath);

    if (collections.has(id)) {
      throw new Error(`系统智能体分组配置存在重复 collection id：${id}`);
    }

    collections.set(id, {
      id,
      label: requireTrimmedString(collection?.label, "collection.label", filePath),
      description: requireTrimmedString(collection?.description, "collection.description", filePath),
      order: normalizeOrderNumber(collection?.order, 999),
    });
  });

  (parsed.groups || []).forEach((group) => {
    const id = requireTrimmedString(group?.id, "group.id", filePath);
    const collectionId = requireTrimmedString(group?.collectionId, "group.collectionId", filePath);
    const collection = collections.get(collectionId);

    if (!collection) {
      throw new Error(`系统智能体分组配置引用了不存在的 collection：${collectionId}`);
    }

    if (groups.has(id)) {
      throw new Error(`系统智能体分组配置存在重复 group id：${id}`);
    }

    groups.set(id, {
      id,
      label: requireTrimmedString(group?.label, "group.label", filePath),
      description: requireTrimmedString(group?.description, "group.description", filePath),
      order: normalizeOrderNumber(group?.order, 999),
      collection,
    });
  });

  return {
    collections,
    groups,
  };
}

function resolveSystemAgentGroupMetadata(groupId, groupRegistry) {
  if (!groupRegistry) {
    return {
      id: groupId,
      label: humanizeSlug(groupId),
      description: "暂未填写分组说明。",
      order: 999,
      collection: {
        id: "system",
        label: "System",
        description: "暂未填写来源说明。",
        order: 999,
      },
    };
  }

  const resolved = groupRegistry.groups.get(groupId);

  if (!resolved) {
    throw new Error(`系统智能体源码引用了不存在的 groupId：${groupId}`);
  }

  return resolved;
}

function extractAgencyServices(frontmatter) {
  const lines = frontmatter.replace(/\r\n/g, "\n").split("\n");
  const services = [];
  let current = null;
  let inServices = false;

  lines.forEach((line) => {
    if (/^services:\s*$/.test(line.trim())) {
      inServices = true;
      current = null;
      return;
    }

    if (!inServices) {
      return;
    }

    if (!line.startsWith("  ") && !line.startsWith("\t")) {
      inServices = false;
      current = null;
      return;
    }

    const normalizedLine = line.trim();
    const itemMatch = normalizedLine.match(/^-\s+name:\s*(.+)$/);

    if (itemMatch) {
      current = {
        name: parseScalar(itemMatch[1]),
        url: null,
        tier: null,
      };
      services.push(current);
      return;
    }

    if (!current) {
      return;
    }

    const propertyMatch = normalizedLine.match(/^(url|tier):\s*(.+)$/);

    if (propertyMatch) {
      current[propertyMatch[1]] = parseScalar(propertyMatch[2]);
    }
  });

  return services;
}

function splitFrontmatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return {
      frontmatter: "",
      body: normalized.trim(),
    };
  }

  return {
    frontmatter: match[1],
    body: normalized.slice(match[0].length).trim(),
  };
}

function stripFrontmatter(markdown) {
  return splitFrontmatter(markdown).body;
}

function parseSimpleYaml(yamlText) {
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  const result = {};

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

    const arrayValues = [];
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

  return result;
}

function startsMultilineQuotedScalar(rawValue) {
  return rawValue.startsWith("'") || rawValue.startsWith('"');
}

function endsMultilineQuotedScalar(rawValue) {
  if (rawValue.length < 2) {
    return false;
  }

  const quote = rawValue[0];
  return (quote === "'" || quote === '"') && rawValue.endsWith(quote);
}

function splitMarkdownSections(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  const introLines = [];
  let currentSection = null;

  lines.forEach((line) => {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);

    if (headingMatch) {
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          body: currentSection.lines.join("\n").trim(),
        });
      }

      currentSection = {
        title: headingMatch[1].trim(),
        lines: [],
      };
      return;
    }

    if (currentSection) {
      currentSection.lines.push(line);
      return;
    }

    introLines.push(line);
  });

  if (currentSection) {
    sections.push({
      title: currentSection.title,
      body: currentSection.lines.join("\n").trim(),
    });
  }

  return {
    intro: introLines.join("\n").trim(),
    sections,
  };
}

function quoteYamlString(value) {
  return JSON.stringify(String(value));
}

function normalizeAvailability(value) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return "both";
  }

  if (!VALID_AVAILABILITY.has(normalized)) {
    throw new Error(`availability 不合法：${normalized}`);
  }

  return normalized;
}

function normalizeTeamRole(value) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return "specialist";
  }

  if (!VALID_TEAM_ROLES.has(normalized)) {
    throw new Error(`teamRole 不合法：${normalized}`);
  }

  return normalized;
}

function normalizeReasoningEffort(value) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  if (!VALID_REASONING_EFFORTS.has(normalized)) {
    throw new Error(`defaultReasoningEffort 不合法：${normalized}`);
  }

  return normalized;
}

function normalizeSandboxMode(value) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return "workspace-write";
  }

  if (!VALID_SANDBOX_MODES.has(normalized)) {
    throw new Error(`defaultSandboxMode 不合法：${normalized}`);
  }

  return normalized;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeOptionalString(item)).filter(Boolean);
}

function normalizeOrderNumber(value, fallback) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function requireTrimmedString(value, fieldName, filePath) {
  const normalized = normalizeOptionalString(value);

  if (normalized) {
    return normalized;
  }

  throw new Error(`系统智能体缺少 ${fieldName}：${filePath || "<inline>"}`);
}

function normalizeOptionalString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeSectionFileContent(content) {
  return content.replace(/\r\n/g, "\n").trim();
}

function stripLeadingHeading(content, headingTitle) {
  const escapedTitle = escapeRegExp(headingTitle);
  return content.replace(new RegExp(`^#\\s+${escapedTitle}\\s*\\n?`, "i"), "").trim();
}

function renderNestedSection(title, content) {
  return [`### ${title}`, "", content.trim()].join("\n").trim();
}

function cleanAgencySectionTitle(title) {
  return title
    .replace(/^[^A-Za-z0-9\u4e00-\u9fff]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapAgencySectionToOpenCrabKey(title) {
  const normalized = cleanAgencySectionTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    normalized.includes("identity") ||
    normalized.includes("critical rules") ||
    normalized.includes("personality")
  ) {
    return "soul";
  }

  if (normalized.includes("core mission") || normalized.includes("success metrics")) {
    return "responsibility";
  }

  if (normalized.includes("workflow") || normalized.includes("service")) {
    return "tools";
  }

  if (normalized.includes("communication style")) {
    return "user";
  }

  return "knowledge";
}

function buildImportedSectionPlaceholder(sectionTitle, agentName) {
  return [`### ${sectionTitle} Draft`, "", `${agentName} 的这部分内容还需要在 OpenCrab 语境下继续精修。`].join(
    "\n",
  );
}

function buildImportedStarterPrompts(name, summary) {
  return [
    `以 ${name} 的视角，先帮我抓这件事最关键的判断和输出。`,
    `如果目标是“${summary}”，你会先怎么拆解当前问题？`,
  ];
}

function inferRoleLabel(name) {
  const initials = name
    .split(/[^A-Za-z0-9\u4e00-\u9fff]+/)
    .filter(Boolean)
    .map((token) => {
      if (/^[A-Za-z]/.test(token)) {
        return token[0].toUpperCase();
      }

      return token[0];
    })
    .join("");

  if (initials.length >= 2 && initials.length <= 8) {
    return initials;
  }

  return name.slice(0, 16);
}

function inferTeamRole(name, category) {
  const text = `${category || ""} ${name}`.toLowerCase();

  if (/product|project|manager|lead|pm|strategy/.test(text)) {
    return "lead";
  }

  if (/research|analyst|insight|ux research|qa/.test(text)) {
    return "research";
  }

  if (/writer|editor|content|copy/.test(text)) {
    return "writer";
  }

  return "specialist";
}

function inferAgencyCategory(source) {
  if (!source) {
    return null;
  }

  if (isUrl(source)) {
    try {
      const url = new URL(source);
      const segments = url.pathname.split("/").filter(Boolean);

      if (url.hostname === "raw.githubusercontent.com" && segments.length >= 4) {
        return segments[3] || null;
      }

      if (url.hostname === "github.com" && segments.length >= 5 && segments[2] === "blob") {
        return segments[4] || null;
      }
    } catch {
      return null;
    }
  }

  return path.basename(path.dirname(source));
}

function extractAgencyNameFromInput(input) {
  if (!input) {
    return null;
  }

  if (isUrl(input)) {
    const normalizedUrl = normalizeAgencyInputUrl(input);

    try {
      const url = new URL(normalizedUrl);
      const fileName = path.basename(url.pathname);
      return fileName.replace(/\.(md|markdown)$/i, "");
    } catch {
      return null;
    }
  }

  return path.basename(input).replace(/\.(md|markdown)$/i, "");
}

function humanizeSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(" ");
}

function compactText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseScalar(rawValue) {
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

function extractFrontmatterValue(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+)$`, "m"));

  if (!match) {
    return null;
  }

  const parsed = parseScalar(match[1]);
  return parsed === null ? null : String(parsed);
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function readMarkdownInput(input) {
  if (!isUrl(input)) {
    return readFileSync(path.resolve(process.cwd(), input), "utf8");
  }

  const url = normalizeAgencyInputUrl(input);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`下载 agency agent 失败：${url}`);
  }

  return response.text();
}

function normalizeAgencyInputUrl(value) {
  const url = new URL(value);

  if (url.hostname !== "github.com") {
    return url.toString();
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length >= 5 && segments[2] === "blob") {
    const [owner, repo, , branch, ...rest] = segments;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`;
  }

  return url.toString();
}

function listAgentSourceEntries(dirPath) {
  if (!existsSync(dirPath)) {
    return [];
  }

  return readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
