const DEFAULT_APP_PROTOCOL = "http";
const DEFAULT_APP_HOST = "127.0.0.1";
const DEFAULT_APP_PORT = 3000;

export function getOpenCrabAppOrigin() {
  const explicitOrigin = process.env.OPENCRAB_APP_ORIGIN?.trim();

  if (explicitOrigin) {
    return explicitOrigin.replace(/\/+$/, "");
  }

  const protocol = normalizeProtocol(process.env.OPENCRAB_APP_PROTOCOL) || DEFAULT_APP_PROTOCOL;
  const host = normalizeHost(process.env.OPENCRAB_APP_HOST) || DEFAULT_APP_HOST;
  const port = normalizePort(process.env.OPENCRAB_APP_PORT || process.env.PORT);

  if (!port || (protocol === "http" && port === 80) || (protocol === "https" && port === 443)) {
    return `${protocol}://${host}`;
  }

  return `${protocol}://${host}:${port}`;
}

function normalizeProtocol(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase();

  if (trimmed === "http" || trimmed === "https") {
    return trimmed;
  }

  return null;
}

function normalizeHost(value: string | undefined) {
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
    return DEFAULT_APP_HOST;
  }

  return trimmed.replace(/\/+$/, "");
}

function normalizePort(value: string | undefined) {
  const parsed = Number.parseInt(value?.trim() || "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_APP_PORT;
  }

  return parsed;
}
