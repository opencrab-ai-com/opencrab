import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  OPENCRAB_RUNTIME_CONFIG_PATH,
  OPENCRAB_STATE_DIR,
} from "@/lib/resources/runtime-paths";

type ManagedTunnelProvider = "cloudflared" | "localtunnel";

type ManagedTunnelConfig = {
  provider: ManagedTunnelProvider;
  pid: number;
  publicBaseUrl: string;
  localUrl: string;
  logPath: string;
  startedAt: string;
};

type RuntimeConfigState = {
  publicBaseUrl: string | null;
  publicBaseUrlSource: "managed_tunnel" | "manual" | null;
  managedTunnel: ManagedTunnelConfig | null;
};

const STORE_DIR = OPENCRAB_STATE_DIR;
const STORE_PATH = OPENCRAB_RUNTIME_CONFIG_PATH;

export function getStoredPublicBaseUrl() {
  return readState().publicBaseUrl;
}

export function getManagedTunnelConfig() {
  return readState().managedTunnel;
}

export function saveManagedTunnelConfig(config: ManagedTunnelConfig) {
  mutateState((state) => {
    state.publicBaseUrl = config.publicBaseUrl;
    state.publicBaseUrlSource = "managed_tunnel";
    state.managedTunnel = config;
  });
}

export function clearManagedTunnelConfig() {
  mutateState((state) => {
    if (state.publicBaseUrlSource === "managed_tunnel") {
      state.publicBaseUrl = null;
      state.publicBaseUrlSource = null;
    }

    state.managedTunnel = null;
  });
}

function readState(): RuntimeConfigState {
  ensureStoreFile();

  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Partial<RuntimeConfigState>;
    const normalized = normalizeState(parsed);
    writeFileSync(STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch {
    const seed = createSeedState();
    writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

function mutateState(mutator: (state: RuntimeConfigState) => void) {
  const state = readState();
  mutator(state);
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

function createSeedState(): RuntimeConfigState {
  return {
    publicBaseUrl: null,
    publicBaseUrlSource: null,
    managedTunnel: null,
  };
}

function normalizeState(state: Partial<RuntimeConfigState>): RuntimeConfigState {
  return {
    publicBaseUrl: typeof state.publicBaseUrl === "string" ? state.publicBaseUrl : null,
    publicBaseUrlSource:
      state.publicBaseUrlSource === "managed_tunnel" || state.publicBaseUrlSource === "manual"
        ? state.publicBaseUrlSource
        : null,
    managedTunnel:
      state.managedTunnel &&
      typeof state.managedTunnel.pid === "number" &&
      typeof state.managedTunnel.publicBaseUrl === "string" &&
      typeof state.managedTunnel.localUrl === "string" &&
      typeof state.managedTunnel.logPath === "string" &&
      typeof state.managedTunnel.startedAt === "string" &&
      (state.managedTunnel.provider === "cloudflared" || state.managedTunnel.provider === "localtunnel")
        ? state.managedTunnel
        : null,
  };
}
