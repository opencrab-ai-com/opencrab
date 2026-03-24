import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  convertAgencyMarkdownToOpenCrabSource,
  writeOpenCrabAuthoringAgent,
} from "./system_agent_authoring.mjs";

const argv = process.argv.slice(2);
const options = {
  outputDir: path.join(process.cwd(), "agents-src", "system"),
  overwrite: false,
};

for (let index = 0; index < argv.length; index += 1) {
  const token = argv[index];

  switch (token) {
    case "--source-dir":
      options.sourceDir = argv[index + 1];
      index += 1;
      break;
    case "--output-dir":
      options.outputDir = argv[index + 1];
      index += 1;
      break;
    case "--overwrite":
      options.overwrite = true;
      break;
    default:
      throw new Error(`不支持的参数：${token}`);
  }
}

if (!options.sourceDir) {
  throw new Error(
    "用法：node scripts/import_agency_catalog.mjs --source-dir <agency-agents-local-dir> [--output-dir <dir>] [--overwrite]",
  );
}

const sourceDir = path.resolve(process.cwd(), options.sourceDir);
const outputDir = path.resolve(process.cwd(), options.outputDir);
const agentFiles = listAgencyAgentFiles(sourceDir);

mkdirSync(outputDir, { recursive: true });

agentFiles.forEach((relativePath) => {
  const absolutePath = path.join(sourceDir, relativePath);
  const markdown = readFileSync(absolutePath, "utf8");
  const slug = makeAgencyCatalogSlug(relativePath);
  const outputPath = path.join(outputDir, slug);

  if (existsSync(outputPath) && !options.overwrite) {
    return;
  }

  const sourceAgent = convertAgencyMarkdownToOpenCrabSource(markdown, {
    slug,
    sourcePath: absolutePath,
  });
  writeOpenCrabAuthoringAgent(sourceAgent, outputPath, {
    overwrite: options.overwrite,
  });
});

console.log(`已导入 ${agentFiles.length} 个 agency-agents 源文件到 ${outputDir}`);

function listAgencyAgentFiles(rootDir) {
  const collected = [];
  walkAgencyDir(rootDir, rootDir, collected);
  return collected.sort((left, right) => left.localeCompare(right, "en"));
}

function walkAgencyDir(rootDir, currentDir, collected) {
  readdirSync(currentDir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name.startsWith(".git") || entry.name === ".github" || entry.name === "examples") {
      return;
    }

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);

    if (entry.isDirectory()) {
      walkAgencyDir(rootDir, absolutePath, collected);
      return;
    }

    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      return;
    }

    if (relativePath === path.join("integrations", "README.md")) {
      return;
    }

    const content = readFileSync(absolutePath, "utf8");

    if (!/^---\n[\s\S]*?\n---\n?/m.test(content)) {
      return;
    }

    if (!/^\s*name:\s+.+$/m.test(content) || !/^\s*description:\s+.+$/m.test(content)) {
      return;
    }

    collected.push(relativePath);
  });
}

function makeAgencyCatalogSlug(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  const top = segments[0].toLowerCase();
  const stem = path.basename(normalized, ".md").toLowerCase();

  if (stem.startsWith(`${top}-`)) {
    return stem;
  }

  if (segments.length === 2) {
    return `${top}-${stem}`;
  }

  return [...segments.slice(0, -1).map((segment) => segment.toLowerCase()), stem].join("-");
}
