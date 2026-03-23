type ServerLogLevel = "info" | "warn" | "error";

type ServerLogEntry = {
  level?: ServerLogLevel;
  event: string;
  requestId?: string;
  method?: string;
  pathname?: string;
  status?: number;
  code?: string;
  message?: string;
  details?: Record<string, unknown> | null;
};

export function logServerEvent(entry: ServerLogEntry) {
  const level = entry.level ?? "info";
  const payload = {
    ts: new Date().toISOString(),
    scope: "opencrab-server",
    ...entry,
    level,
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function logServerError(entry: Omit<ServerLogEntry, "level">) {
  logServerEvent({
    ...entry,
    level:
      typeof entry.status === "number" && entry.status < 500 ? "warn" : "error",
  });
}
