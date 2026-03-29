import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const DEFAULT_STANDALONE_DIR = path.join(REPO_ROOT, ".next", "standalone");
const PRUNED_STANDALONE_DIR_NAMES = [
  ".playwright-cli",
  "coverage",
  "dist",
  "docs",
  "output",
  "tests",
  "tmp",
];
const PRUNED_STANDALONE_FILE_SUFFIXES = [".dmg", ".tgz", ".tar.gz", ".zip"];

export function copyDesktopRuntimeAssets(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || REPO_ROOT);
  const standaloneDir = path.resolve(input.standaloneDir || DEFAULT_STANDALONE_DIR);

  ensureStandaloneBuildExists(standaloneDir);

  for (const target of buildCopyTargets(repoRoot, standaloneDir)) {
    copyTarget(target);
  }

  copyCodexRuntimePackages(repoRoot, standaloneDir);
  copyStandalonePackage(repoRoot, standaloneDir, "chrome-devtools-mcp");
  pruneStandaloneArtifacts(standaloneDir);
}

if (isDirectRun()) {
  copyDesktopRuntimeAssets();
  console.log(`Desktop runtime assets copied into ${DEFAULT_STANDALONE_DIR}`);
}

function buildCopyTargets(repoRoot, standaloneDir) {
  return [
    {
      label: "public assets",
      sourcePath: path.join(repoRoot, "public"),
      targetPath: path.join(standaloneDir, "public"),
    },
    {
      label: "next static assets",
      sourcePath: path.join(repoRoot, ".next", "static"),
      targetPath: path.join(standaloneDir, ".next", "static"),
    },
    {
      label: "desktop runtime scripts",
      sourcePath: path.join(repoRoot, "scripts"),
      targetPath: path.join(standaloneDir, "scripts"),
    },
    {
      label: "bundled skills",
      sourcePath: path.join(repoRoot, "skills"),
      targetPath: path.join(standaloneDir, "skills"),
    },
    {
      label: "system agent sources",
      sourcePath: path.join(repoRoot, "agents-src"),
      targetPath: path.join(standaloneDir, "agents-src"),
    },
  ];
}

function copyCodexRuntimePackages(repoRoot, standaloneDir) {
  const openAiPackagesDir = path.join(repoRoot, "node_modules", "@openai");

  if (!existsSync(openAiPackagesDir)) {
    throw new Error("Missing node_modules/@openai. Reinstall dependencies before building the desktop bundle.");
  }

  const packageNames = readdirSync(openAiPackagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name === "codex" || name.startsWith("codex-"));

  if (!packageNames.includes("codex")) {
    throw new Error("Missing @openai/codex. Reinstall dependencies before building the desktop bundle.");
  }

  for (const packageName of packageNames) {
    copyTarget({
      label: `codex runtime package ${packageName}`,
      sourcePath: path.join(openAiPackagesDir, packageName),
      targetPath: path.join(standaloneDir, "node_modules", "@openai", packageName),
    });
  }
}

function ensureStandaloneBuildExists(standaloneDir) {
  if (existsSync(path.join(standaloneDir, "server.js"))) {
    return;
  }

  throw new Error(
    [
      "Next standalone output is missing.",
      "Run `npm run build:web` first so `.next/standalone/server.js` is generated.",
    ].join(" "),
  );
}

function copyStandalonePackage(repoRoot, standaloneDir, packageName) {
  copyTarget({
    label: `runtime package ${packageName}`,
    sourcePath: path.join(repoRoot, "node_modules", packageName),
    targetPath: path.join(standaloneDir, "node_modules", packageName),
  });
}

function copyTarget(input) {
  if (!existsSync(input.sourcePath)) {
    return;
  }

  mkdirSync(path.dirname(input.targetPath), { recursive: true });
  rmSync(input.targetPath, { recursive: true, force: true });
  cpSync(input.sourcePath, input.targetPath, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
  });
}

function pruneStandaloneArtifacts(standaloneDir) {
  for (const dirName of PRUNED_STANDALONE_DIR_NAMES) {
    rmSync(path.join(standaloneDir, dirName), {
      recursive: true,
      force: true,
    });
  }

  for (const entry of readdirSync(standaloneDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    if (!PRUNED_STANDALONE_FILE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      continue;
    }

    rmSync(path.join(standaloneDir, entry.name), {
      force: true,
    });
  }
}

function isDirectRun() {
  return path.resolve(process.argv[1] || "") === path.resolve(fileURLToPath(import.meta.url));
}
