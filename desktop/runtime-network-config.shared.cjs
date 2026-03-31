const path = require("node:path");

const DEFAULT_OPENCRAB_RUNTIME_HOST = "127.0.0.1";
const DEFAULT_OPENCRAB_APP_PORT = 3000;
const DEFAULT_OPENCRAB_DESKTOP_PORT = 3400;

/**
 * Shared runtime network helpers used by both the web runtime and the packaged
 * desktop shell. Keep this file inside `desktop/` so electron-builder always
 * bundles it alongside `runtime-manager.cjs`.
 */

/**
 * @param {string | undefined | null} value
 * @param {number} fallback
 */
function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * @param {string | undefined | null} value
 */
function normalizeOpenCrabBaseUrl(value) {
  const raw = value?.trim();

  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   hostname?: string | null | undefined,
 *   port?: string | number | null | undefined,
 *   protocol?: string | null | undefined,
 *   fallbackHostname?: string | null | undefined,
 *   fallbackPort?: number | null | undefined,
 * }} [input]
 */
function buildOpenCrabBaseUrl(input = {}) {
  const hostname =
    input.hostname?.toString().trim() ||
    input.fallbackHostname ||
    DEFAULT_OPENCRAB_RUNTIME_HOST;
  const fallbackPort = input.fallbackPort || DEFAULT_OPENCRAB_APP_PORT;
  const port = parsePositiveInt(
    input.port === undefined || input.port === null ? "" : String(input.port),
    fallbackPort,
  );
  const protocol = input.protocol?.trim() || "http:";
  return `${protocol}//${hostname}:${port}`;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{
 *   envKey?: string | null | undefined,
 *   fallbackHostname?: string | null | undefined,
 * }} [input]
 */
function resolveOpenCrabRuntimeHostname(env = process.env, input = {}) {
  const envKey = input.envKey?.trim() || "HOSTNAME";
  return env[envKey]?.trim() || input.fallbackHostname || DEFAULT_OPENCRAB_RUNTIME_HOST;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{
 *   envKey?: string | null | undefined,
 *   fallbackPort?: number | null | undefined,
 * }} [input]
 */
function resolveOpenCrabRuntimePort(env = process.env, input = {}) {
  const envKey = input.envKey?.trim() || "PORT";
  return parsePositiveInt(env[envKey], input.fallbackPort || DEFAULT_OPENCRAB_APP_PORT);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{
 *   fallbackHostname?: string | null | undefined,
 *   fallbackPort?: number | null | undefined,
 *   protocol?: string | null | undefined,
 * }} [input]
 */
function resolveOpenCrabLocalBaseUrl(env = process.env, input = {}) {
  return buildOpenCrabBaseUrl({
    hostname: resolveOpenCrabRuntimeHostname(env, {
      fallbackHostname: input.fallbackHostname,
    }),
    port: resolveOpenCrabRuntimePort(env, {
      fallbackPort: input.fallbackPort,
    }),
    protocol: input.protocol,
    fallbackHostname: input.fallbackHostname,
    fallbackPort: input.fallbackPort || DEFAULT_OPENCRAB_APP_PORT,
  });
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{
 *   fallbackHostname?: string | null | undefined,
 *   fallbackPort?: number | null | undefined,
 *   protocol?: string | null | undefined,
 * }} [input]
 */
function resolveOpenCrabAppOrigin(env = process.env, input = {}) {
  const explicitOrigin = normalizeOpenCrabBaseUrl(env.OPENCRAB_APP_ORIGIN);

  if (explicitOrigin) {
    return explicitOrigin;
  }

  return resolveOpenCrabLocalBaseUrl(env, input);
}

/**
 * @param {string} urlValue
 * @param {string} baseUrl
 */
function isOpenCrabAppUrl(urlValue, baseUrl) {
  try {
    return new URL(urlValue).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   appOrigin?: string | null | undefined,
 *   port?: string | number | null | undefined,
 *   hostname?: string | null | undefined,
 *   fallbackPort?: number | null | undefined,
 *   fallbackHostname?: string | null | undefined,
 *   protocol?: string | null | undefined,
 *   resourceRoot?: string | null | undefined,
 *   executionRoot?: string | null | undefined,
 *   nodeEnv?: string | null | undefined,
 * }} [input]
 */
function buildOpenCrabRuntimeEnv(input = {}) {
  const fallbackHostname = input.fallbackHostname || DEFAULT_OPENCRAB_RUNTIME_HOST;
  const fallbackPort = input.fallbackPort || DEFAULT_OPENCRAB_APP_PORT;
  const hostname = input.hostname?.trim() || input.fallbackHostname || fallbackHostname;
  const port = parsePositiveInt(
    input.port === undefined || input.port === null ? "" : String(input.port),
    fallbackPort,
  );
  const appOrigin =
    normalizeOpenCrabBaseUrl(input.appOrigin) ||
    buildOpenCrabBaseUrl({
      hostname,
      port,
      protocol: input.protocol,
      fallbackHostname,
      fallbackPort,
    });

  const env = {
    HOSTNAME: hostname,
    PORT: String(port),
    OPENCRAB_APP_ORIGIN: appOrigin,
  };

  if (input.nodeEnv?.trim()) {
    env.NODE_ENV = input.nodeEnv.trim();
  }

  if (input.resourceRoot?.trim()) {
    env.OPENCRAB_RESOURCE_ROOT = path.resolve(input.resourceRoot);
  }

  if (input.executionRoot?.trim()) {
    env.OPENCRAB_EXECUTION_ROOT = path.resolve(input.executionRoot);
  }

  return env;
}

module.exports = {
  DEFAULT_OPENCRAB_APP_PORT,
  DEFAULT_OPENCRAB_DESKTOP_PORT,
  DEFAULT_OPENCRAB_RUNTIME_HOST,
  buildOpenCrabBaseUrl,
  buildOpenCrabRuntimeEnv,
  isOpenCrabAppUrl,
  normalizeOpenCrabBaseUrl,
  parsePositiveInt,
  resolveOpenCrabAppOrigin,
  resolveOpenCrabLocalBaseUrl,
  resolveOpenCrabRuntimeHostname,
  resolveOpenCrabRuntimePort,
};
