import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const STANDALONE_DIR = path.join(REPO_ROOT, ".next", "standalone");
const STANDALONE_SERVER_PATH = path.join(STANDALONE_DIR, "server.js");
const SERVER_ENTRY_WRAPPER_PATH = path.join(REPO_ROOT, "scripts", "desktop", "server-entry.mjs");

main();

function main() {
  ensureStandaloneServerExists();

  const protocol = normalizeProtocol(process.env.OPENCRAB_APP_PROTOCOL) || "http";
  const host = normalizeHost(process.env.OPENCRAB_APP_HOST) || "127.0.0.1";
  const port = normalizePort(process.env.OPENCRAB_APP_PORT || process.env.PORT) || 3000;
  const executionRoot = process.env.OPENCRAB_EXECUTION_ROOT?.trim() || REPO_ROOT;
  const appOrigin =
    process.env.OPENCRAB_APP_ORIGIN?.trim() || buildOrigin(protocol, host, port);

  const child = spawn(process.execPath, [SERVER_ENTRY_WRAPPER_PATH, STANDALONE_SERVER_PATH], {
    cwd: STANDALONE_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "production",
      HOSTNAME: process.env.HOSTNAME || host,
      PORT: String(port),
      OPENCRAB_APP_MODE: process.env.OPENCRAB_APP_MODE || "standalone",
      OPENCRAB_APP_PROTOCOL: protocol,
      OPENCRAB_APP_HOST: host,
      OPENCRAB_APP_PORT: String(port),
      OPENCRAB_APP_ORIGIN: appOrigin,
      OPENCRAB_RESOURCE_ROOT: process.env.OPENCRAB_RESOURCE_ROOT || STANDALONE_DIR,
      OPENCRAB_EXECUTION_ROOT: executionRoot,
    },
  });

  const forwardSignal = (signal) => {
    if (child.killed) {
      return;
    }

    child.kill(signal);
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  child.on("exit", (code, signal) => {
    process.off("SIGINT", forwardSignal);
    process.off("SIGTERM", forwardSignal);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  console.log(`OpenCrab standalone server starting at ${appOrigin}`);
}

function ensureStandaloneServerExists() {
  if (existsSync(STANDALONE_SERVER_PATH)) {
    return;
  }

  throw new Error(
    [
      "Standalone server bundle is missing.",
      "Run `npm run desktop:build` first.",
    ].join(" "),
  );
}

function normalizeProtocol(value) {
  const trimmed = value?.trim().toLowerCase();

  if (trimmed === "http" || trimmed === "https") {
    return trimmed;
  }

  return null;
}

function normalizeHost(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed === "0.0.0.0" ||
    trimmed === "::" ||
    trimmed === "[::]" ||
    trimmed === "::0"
  ) {
    return "127.0.0.1";
  }

  return trimmed.replace(/\/+$/, "");
}

function normalizePort(value) {
  const parsed = Number.parseInt(value?.trim() || "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function buildOrigin(protocol, host, port) {
  if ((protocol === "http" && port === 80) || (protocol === "https" && port === 443)) {
    return `${protocol}://${host}`;
  }

  return `${protocol}://${host}:${port}`;
}
