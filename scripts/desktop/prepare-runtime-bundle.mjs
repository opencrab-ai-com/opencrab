import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const nextStandaloneDir = path.join(projectRoot, ".next", "standalone");
const nextStaticDir = path.join(projectRoot, ".next", "static");
const bundleRoot = path.join(projectRoot, ".opencrab-desktop", "runtime");

ensureExists(nextStandaloneDir, "缺少 .next/standalone，请先运行 next build。");
ensureExists(path.join(nextStandaloneDir, "server.js"), "缺少 standalone server.js，请确认 Next 已启用 output: 'standalone'。");

rmSync(bundleRoot, { recursive: true, force: true });
mkdirSync(bundleRoot, { recursive: true });

copyIntoBundle(nextStandaloneDir, bundleRoot);
copyIntoBundle(nextStaticDir, path.join(bundleRoot, ".next", "static"));
copyIntoBundle(path.join(projectRoot, "public"), path.join(bundleRoot, "public"));
copyIntoBundle(path.join(projectRoot, "skills"), path.join(bundleRoot, "skills"));
copyIntoBundle(path.join(projectRoot, "agents-src"), path.join(bundleRoot, "agents-src"));
copyIntoBundle(
  path.join(projectRoot, "scripts", "browser_mcp_stdio_proxy.mjs"),
  path.join(bundleRoot, "scripts", "browser_mcp_stdio_proxy.mjs"),
);
copyIntoBundle(
  path.join(projectRoot, "scripts", "pdf_extract.mjs"),
  path.join(bundleRoot, "scripts", "pdf_extract.mjs"),
);

// Next standalone traces our repo layout conservatively. Strip nested desktop
// build outputs so the packaged app never contains another packaged app.
removeIfExists(path.join(bundleRoot, "dist"));

copyIfExists(
  path.join(projectRoot, "node_modules", "@openai", "codex"),
  path.join(bundleRoot, "node_modules", "@openai", "codex"),
);
copyIfExists(
  path.join(projectRoot, "node_modules", "@openai", "codex-sdk"),
  path.join(bundleRoot, "node_modules", "@openai", "codex-sdk"),
);

const openAiNodeModulesDir = path.join(projectRoot, "node_modules", "@openai");

if (existsSync(openAiNodeModulesDir)) {
  for (const entry of readdirSync(openAiNodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (!entry.name.startsWith("codex-")) {
      continue;
    }

    copyIfExists(
      path.join(openAiNodeModulesDir, entry.name),
      path.join(bundleRoot, "node_modules", "@openai", entry.name),
    );
  }
}

copyIfExists(
  path.join(projectRoot, "node_modules", "pdf-parse"),
  path.join(bundleRoot, "node_modules", "pdf-parse"),
);
copyIfExists(
  path.join(projectRoot, "node_modules", "pdfjs-dist"),
  path.join(bundleRoot, "node_modules", "pdfjs-dist"),
);
copyIfExists(
  path.join(projectRoot, "node_modules", "@napi-rs"),
  path.join(bundleRoot, "node_modules", "@napi-rs"),
);
copyIfExists(
  path.join(projectRoot, "node_modules", "chrome-devtools-mcp"),
  path.join(bundleRoot, "node_modules", "chrome-devtools-mcp"),
);
removeIfExists(path.join(bundleRoot, "node_modules", ".bin", "codex"));
removeIfExists(path.join(bundleRoot, "node_modules", ".bin", "codex.cmd"));

// Trim repo-only and dev-only artifacts that can be conservatively traced into
// the standalone output but are not required by the packaged runtime.
for (const relativePath of [
  "build",
  "desktop",
  "docs",
  "tests",
  "tmp",
  "scripts/desktop",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "README-en.md",
  "README.md",
  "SECURITY.md",
  "eslint.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "postcss.config.mjs",
  "tsconfig.json",
  "tsconfig.tsbuildinfo",
  "vitest.config.mts",
]) {
  removeIfExists(path.join(bundleRoot, relativePath));
}

console.log(`[desktop:bundle] Runtime bundle is ready at ${bundleRoot}`);

function ensureExists(targetPath, message) {
  if (!existsSync(targetPath)) {
    throw new Error(message);
  }
}

function copyIntoBundle(fromPath, toPath) {
  ensureExists(fromPath, `缺少打包资源：${fromPath}`);
  mkdirSync(path.dirname(toPath), { recursive: true });
  cpSync(fromPath, toPath, { recursive: true });
}

function copyIfExists(fromPath, toPath) {
  if (!existsSync(fromPath)) {
    return;
  }

  mkdirSync(path.dirname(toPath), { recursive: true });
  cpSync(fromPath, toPath, { recursive: true });
}

function removeIfExists(targetPath) {
  rmSync(targetPath, { recursive: true, force: true });
}
