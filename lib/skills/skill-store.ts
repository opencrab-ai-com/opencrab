import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  SkillAction,
  SkillIconName,
  SkillOrigin,
  SkillRecord,
  SkillStatus,
} from "@/lib/resources/opencrab-api-types";
import {
  OPENCRAB_RUNTIME_DIR,
  OPENCRAB_SKILLS_STORE_PATH,
} from "@/lib/resources/runtime-paths";

type CatalogSeed = {
  id: string;
  name: string;
  summary: string;
  origin: SkillOrigin;
  icon: SkillIconName;
  sourcePath: string | null;
  detailsMarkdown: string | null;
  defaultStatus: SkillStatus;
  note: string;
  order: number;
};

type StoredSkillState = {
  status: SkillStatus;
  origin: SkillOrigin;
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

const STORE_DIR = OPENCRAB_RUNTIME_DIR;
const STORE_PATH = OPENCRAB_SKILLS_STORE_PATH;
const CODEX_SKILLS_ROOT = path.join(process.env.HOME || process.cwd(), ".codex", "skills");

const CODEX_ORDER = [
  "imagegen",
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
    icon: SkillIconName;
  }
> = {
  imagegen: {
    name: "Image Gen",
    summary: "Generate and edit images using OpenAI",
    icon: "image",
  },
  "openai-docs": {
    name: "OpenAI Docs",
    summary: "Reference official OpenAI docs, including API guides and examples",
    icon: "book",
  },
  pdf: {
    name: "PDF Skill",
    summary: "Create, edit, and review PDFs",
    icon: "pdf",
  },
  playwright: {
    name: "Playwright CLI Skill",
    summary: "Automate real browsers from the terminal",
    icon: "playwright",
  },
  screenshot: {
    name: "Screenshot Capture",
    summary: "Capture screenshots",
    icon: "camera",
  },
  "skill-creator": {
    name: "Skill Creator",
    summary: "Create or update a skill",
    icon: "puzzle",
  },
  "skill-installer": {
    name: "Skill Installer",
    summary: "Install curated skills from openai/skills or other repos",
    icon: "puzzle",
  },
  sora: {
    name: "Sora Video Generation Skill",
    summary: "Generate and manage Sora videos",
    icon: "sora",
  },
  speech: {
    name: "Speech Generation Skill",
    summary: "Generate narrated audio from text",
    icon: "mic",
  },
};

const RECOMMENDED_SKILLS: CatalogSeed[] = [
  {
    id: "aspnet-core",
    name: "Aspnet Core",
    summary: "[Windows only] Build and review ASP.NET Core projects",
    origin: "recommended",
    icon: "dotnet",
    sourcePath: null,
    detailsMarkdown: [
      "# Aspnet Core",
      "",
      "Build and review ASP.NET Core projects.",
      "",
      "This entry is copied from the Codex skills recommendations list. Installing it here only enables it inside OpenCrab.",
    ].join("\n"),
    defaultStatus: "available",
    note: "来自 OpenCrab 的推荐技能清单；安装只影响 OpenCrab，不会修改 Codex app。",
    order: 100,
  },
  {
    id: "chatgpt-apps",
    name: "Chatgpt Apps",
    summary: "Build and scaffold ChatGPT apps",
    origin: "recommended",
    icon: "cube",
    sourcePath: null,
    detailsMarkdown: "# Chatgpt Apps\n\nBuild and scaffold ChatGPT apps.",
    defaultStatus: "available",
    note: "来自 OpenCrab 的推荐技能清单；安装只影响 OpenCrab，不会修改 Codex app。",
    order: 101,
  },
  {
    id: "cloudflare-deploy",
    name: "Cloudflare Deploy",
    summary: "Deploy Workers, Pages, and platform services",
    origin: "recommended",
    icon: "cloud",
    sourcePath: null,
    detailsMarkdown: "# Cloudflare Deploy\n\nDeploy Workers, Pages, and platform services.",
    defaultStatus: "available",
    note: "来自 OpenCrab 的推荐技能清单；安装只影响 OpenCrab，不会修改 Codex app。",
    order: 102,
  },
  {
    id: "develop-web-game",
    name: "Develop Web Game",
    summary: "Web game dev plus Playwright test loop",
    origin: "recommended",
    icon: "gamepad",
    sourcePath: null,
    detailsMarkdown: "# Develop Web Game\n\nWeb game dev plus Playwright test loop.",
    defaultStatus: "available",
    note: "来自 OpenCrab 的推荐技能清单；安装只影响 OpenCrab，不会修改 Codex app。",
    order: 103,
  },
  {
    id: "doc",
    name: "Doc",
    summary: "Edit and review docx files",
    origin: "recommended",
    icon: "doc",
    sourcePath: null,
    detailsMarkdown: "# Doc\n\nEdit and review docx files.",
    defaultStatus: "available",
    note: "来自 OpenCrab 的推荐技能清单；安装只影响 OpenCrab，不会修改 Codex app。",
    order: 104,
  },
  {
    id: "figma",
    name: "Figma",
    summary: "Use Figma MCP for design-to-code work",
    origin: "recommended",
    icon: "figma",
    sourcePath: null,
    detailsMarkdown: "# Figma\n\nUse Figma MCP for design-to-code work.",
    defaultStatus: "available",
    note: "来自 OpenCrab 的推荐技能清单；安装只影响 OpenCrab，不会修改 Codex app。",
    order: 105,
  },
  {
    id: "figma-implement-design",
    name: "Figma Implement Design",
    summary: "Turn Figma designs into production-ready interfaces",
    origin: "recommended",
    icon: "figma",
    sourcePath: null,
    detailsMarkdown: "# Figma Implement Design\n\nTurn Figma designs into production-ready interfaces.",
    defaultStatus: "available",
    note: "来自 OpenCrab 的推荐技能清单；安装只影响 OpenCrab，不会修改 Codex app。",
    order: 106,
  },
  {
    id: "gh-address-comments",
    name: "GH Address Comments",
    summary: "Address comments in a GitHub PR review",
    origin: "recommended",
    icon: "github",
    sourcePath: null,
    detailsMarkdown: "# GH Address Comments\n\nAddress comments in a GitHub PR review.",
    defaultStatus: "available",
    note: "来自 OpenCrab 的推荐技能清单；安装只影响 OpenCrab，不会修改 Codex app。",
    order: 107,
  },
];

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

export function getSkill(skillId: string) {
  return listSkills().find((skill) => skill.id === skillId) ?? null;
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

export function mutateSkill(skillId: string, action: SkillAction) {
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

  const nextStatus =
    action === "disable"
      ? "disabled"
      : action === "uninstall"
        ? "available"
        : "installed";

  state.items[skillId] = {
    status: nextStatus,
    origin: existing?.origin || skill.origin,
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
  const state = readState();
  const customSkills = Object.entries(state.items)
    .filter(([, item]) => item.origin === "custom")
    .map(([id, item], index) => ({
      id,
      name: item.name || "Custom Skill",
      summary: item.summary || "Custom OpenCrab skill",
      origin: "custom" as const,
      icon: item.icon || "puzzle",
      sourcePath: null,
      detailsMarkdown: item.detailsMarkdown || null,
      defaultStatus: item.status,
      note: "仅保存在 OpenCrab 本地 store 中，不会写入 Codex app 的技能目录。",
      order: 10_000 + index,
    }));

  return dedupeById([...codexSkills, ...RECOMMENDED_SKILLS, ...customSkills]);
}

function discoverCodexSkills(): CatalogSeed[] {
  if (!existsSync(CODEX_SKILLS_ROOT)) {
    return [];
  }

  const skillFiles = [
    ...collectSkillFiles(CODEX_SKILLS_ROOT),
    ...collectSkillFiles(path.join(CODEX_SKILLS_ROOT, ".system")),
  ];

  return skillFiles.map((filePath, index) => {
    const slug = path.basename(path.dirname(filePath));
    const parsed = parseSkillFile(filePath);
    const override = DISPLAY_OVERRIDES[slug];

    return {
      id: slug,
      name: override?.name || parsed.name || humanizeSlug(slug),
      summary: override?.summary || parsed.summary || "Imported from Codex app skills.",
      origin: "codex" as const,
      icon: override?.icon || inferIcon(slug),
      sourcePath: filePath,
      detailsMarkdown: parsed.detailsMarkdown,
      defaultStatus: "installed" as const,
      note: `详情内容复制自 ${filePath}。在 OpenCrab 里的安装、禁用、卸载只影响 OpenCrab，不会修改 Codex app。`,
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

function parseSkillFile(filePath: string) {
  const content = readFileSync(filePath, "utf8");
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = frontmatterMatch?.[1] || "";
  const detailsMarkdown = frontmatterMatch ? content.slice(frontmatterMatch[0].length).trim() : content.trim();

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
    status,
    statusLabel: getStatusLabel(status),
    origin: seed.origin,
    originLabel: getOriginLabel(seed.origin),
    icon: stored?.icon || seed.icon,
    sourcePath: seed.sourcePath,
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
    return "复制自 Codex app";
  }

  if (origin === "custom") {
    return "OpenCrab 自建";
  }

  return "OpenCrab 推荐";
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
  ensureStoreFile();

  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Partial<SkillStoreState>;
    const normalized = normalizeState(parsed);
    writeFileSync(STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch {
    const seed = createSeedState();
    writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

function writeState(state: SkillStoreState) {
  ensureStoreFile();
  writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function ensureStoreFile() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }

  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify(createSeedState(), null, 2), "utf8");
  }
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
