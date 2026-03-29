import {
  OPENCRAB_RUNTIME_CONFIG_PATH,
} from "@/lib/resources/runtime-paths";
import { createSyncJsonFileStore } from "@/lib/infrastructure/json-store/sync-json-file-store";

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

const STORE_PATH = OPENCRAB_RUNTIME_CONFIG_PATH;
const store = createSyncJsonFileStore<RuntimeConfigState>({
  filePath: STORE_PATH,
  seed: createSeedState,
  normalize: normalizeState,
});

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
  return store.read();
}

function mutateState(mutator: (state: RuntimeConfigState) => void) {
  store.mutate((state) => {
    mutator(state);
  });
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
