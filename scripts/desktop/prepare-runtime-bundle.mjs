import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const projectRoot = process.cwd();
const projectPackageJsonPath = path.join(projectRoot, "package.json");
const projectNodeModulesDir = path.join(projectRoot, "node_modules");
const nextStandaloneDir = path.join(projectRoot, ".next", "standalone");
const nextStaticDir = path.join(projectRoot, ".next", "static");
const bundleRoot = path.join(projectRoot, ".opencrab-desktop", "runtime");
const copiedPackageDirs = new Set();

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
copyInstalledPackageClosure("@modelcontextprotocol/sdk");
removeIfExists(path.join(bundleRoot, "node_modules", ".bin", "codex"));
removeIfExists(path.join(bundleRoot, "node_modules", ".bin", "codex.cmd"));

// Trim repo-only and dev-only artifacts that can be conservatively traced into
// the standalone output but are not required by the packaged runtime.
for (const relativePath of [
  ".artifacts",
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

removeMatchingFiles(bundleRoot, ".DS_Store");
sanitizeBundleBuildMetadata(bundleRoot, projectRoot);

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

function copyInstalledPackageClosure(packageName) {
  if (!packageName) {
    return;
  }

  const packageDir = resolveInstalledPackageDir(packageName, projectPackageJsonPath);

  if (!packageDir) {
    return;
  }

  copyResolvedPackageClosure(packageDir);
}

function copyResolvedPackageClosure(sourceDir) {
  const packageJsonPath = path.join(sourceDir, "package.json");
  const relativeDir = path.relative(projectNodeModulesDir, sourceDir);

  if (relativeDir.startsWith("..")) {
    return;
  }

  if (copiedPackageDirs.has(relativeDir)) {
    return;
  }

  copiedPackageDirs.add(relativeDir);
  copyIfExists(sourceDir, path.join(bundleRoot, "node_modules", relativeDir));

  const payload = JSON.parse(readUtf8(packageJsonPath));

  for (const dependencyName of Object.keys(payload.dependencies || {})) {
    const dependencyDir = resolveInstalledPackageDir(
      dependencyName,
      packageJsonPath,
    );

    if (!dependencyDir) {
      continue;
    }

    copyResolvedPackageClosure(dependencyDir);
  }
}

function resolveInstalledPackageDir(packageName, parentPackageJsonPath) {
  try {
    const localRequire = createRequire(parentPackageJsonPath);
    let resolvedPath = null;

    try {
      resolvedPath = localRequire.resolve(packageName);
    } catch {
      resolvedPath = localRequire.resolve(`${packageName}/package.json`);
    }

    let currentDir = path.dirname(resolvedPath);
    let matchedDir = null;

    while (currentDir.startsWith(projectNodeModulesDir)) {
      const currentPackageJsonPath = path.join(currentDir, "package.json");

      if (existsSync(currentPackageJsonPath)) {
        const payload = JSON.parse(readUtf8(currentPackageJsonPath));

        if (payload?.name === packageName) {
          matchedDir = currentDir;
        }
      }

      const parentDir = path.dirname(currentDir);

      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
    }

    return matchedDir;
  } catch {
    return null;
  }
}

function removeIfExists(targetPath) {
  rmSync(targetPath, { recursive: true, force: true });
}

function removeMatchingFiles(targetDir, fileName) {
  if (!existsSync(targetDir)) {
    return;
  }

  for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
    const nextPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      removeMatchingFiles(nextPath, fileName);
      continue;
    }

    if (entry.name === fileName) {
      removeIfExists(nextPath);
    }
  }
}

function sanitizeBundleBuildMetadata(runtimeRoot, buildRoot) {
  const requiredServerFilesPath = path.join(runtimeRoot, ".next", "required-server-files.json");

  if (existsSync(requiredServerFilesPath)) {
    const payload = JSON.parse(readUtf8(requiredServerFilesPath));

    if (payload?.config?.outputFileTracingRoot) {
      payload.config.outputFileTracingRoot = ".";
    }

    if (payload?.config?.turbopack?.root) {
      payload.config.turbopack.root = ".";
    }

    if (payload?.appDir) {
      payload.appDir = ".";
    }

    writeUtf8(requiredServerFilesPath, `${JSON.stringify(payload, null, 2)}\n`);
  }

  const standaloneServerPath = path.join(runtimeRoot, "server.js");

  if (existsSync(standaloneServerPath)) {
    const normalizedBuildRoot = JSON.stringify(buildRoot);
    const sanitizedRoot = JSON.stringify(".");
    const nextServerSource = readUtf8(standaloneServerPath).split(normalizedBuildRoot).join(sanitizedRoot);
    writeUtf8(standaloneServerPath, nextServerSource);
  }
}

function readUtf8(targetPath) {
  return readFileSync(targetPath, "utf8");
}

function writeUtf8(targetPath, content) {
  writeFileSync(targetPath, content, "utf8");
}
