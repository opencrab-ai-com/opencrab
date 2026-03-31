import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureChannelStartupSyncMock = vi.hoisted(() => vi.fn());
const ensureChannelWatchdogMock = vi.hoisted(() => vi.fn());
const ensureBoundConversationMetadataSyncMock = vi.hoisted(() => vi.fn());
const syncAllChannelConfigsFromSecretsMock = vi.hoisted(() => vi.fn());
const ensureBrowserSessionWarmupMock = vi.hoisted(() => vi.fn());
const ensureBundledSkillsReadyMock = vi.hoisted(() => vi.fn());
const ensureTaskRunnerMock = vi.hoisted(() => vi.fn());
const logServerErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/channels/channel-startup", () => ({
  ensureChannelStartupSync: ensureChannelStartupSyncMock,
  ensureChannelWatchdog: ensureChannelWatchdogMock,
}));

vi.mock("@/lib/channels/conversation-sync", () => ({
  ensureBoundConversationMetadataSync: ensureBoundConversationMetadataSyncMock,
}));

vi.mock("@/lib/channels/secret-store", () => ({
  syncAllChannelConfigsFromSecrets: syncAllChannelConfigsFromSecretsMock,
}));

vi.mock("@/lib/codex/browser-session", () => ({
  ensureBrowserSessionWarmup: ensureBrowserSessionWarmupMock,
}));

vi.mock("@/lib/server/observability", () => ({
  logServerError: logServerErrorMock,
}));

vi.mock("@/lib/skills/skill-store", () => ({
  ensureBundledSkillsReady: ensureBundledSkillsReadyMock,
}));

vi.mock("@/lib/tasks/task-runner", () => ({
  ensureTaskRunner: ensureTaskRunnerMock,
}));

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("runtime startup orchestration", () => {
  beforeEach(() => {
    ensureChannelStartupSyncMock.mockReset().mockResolvedValue(undefined);
    ensureChannelWatchdogMock.mockReset();
    ensureBoundConversationMetadataSyncMock.mockReset().mockResolvedValue(undefined);
    syncAllChannelConfigsFromSecretsMock.mockReset();
    ensureBrowserSessionWarmupMock.mockReset().mockResolvedValue(undefined);
    ensureBundledSkillsReadyMock.mockReset();
    ensureTaskRunnerMock.mockReset().mockResolvedValue(undefined);
    logServerErrorMock.mockReset();
  });

  it("boots the shared startup profile from one entrypoint", async () => {
    const { ensureBootstrapRuntimeReady } = await import("@/lib/runtime/runtime-startup");

    ensureBootstrapRuntimeReady();
    await flushMicrotasks();

    expect(ensureBundledSkillsReadyMock).toHaveBeenCalledTimes(1);
    expect(ensureChannelWatchdogMock).toHaveBeenCalledTimes(1);
    expect(ensureChannelStartupSyncMock).toHaveBeenCalledWith();
    expect(ensureBrowserSessionWarmupMock).toHaveBeenCalledWith();
    expect(ensureTaskRunnerMock).toHaveBeenCalledWith();
    expect(ensureBoundConversationMetadataSyncMock).toHaveBeenCalledWith();
    expect(logServerErrorMock).not.toHaveBeenCalled();
  });

  it("prepares channel runtime through the shared channel profile", async () => {
    const { ensureChannelRuntimeReady, ensureChannelRuntimeWatchdog } = await import(
      "@/lib/runtime/runtime-startup"
    );

    ensureChannelRuntimeReady({ force: true });
    ensureChannelRuntimeWatchdog();
    await flushMicrotasks();

    expect(syncAllChannelConfigsFromSecretsMock).toHaveBeenCalledTimes(1);
    expect(ensureChannelWatchdogMock).toHaveBeenCalledTimes(2);
    expect(ensureChannelStartupSyncMock).toHaveBeenCalledWith({ force: true });
  });

  it("logs startup failures instead of leaking route-specific orchestration", async () => {
    ensureBrowserSessionWarmupMock.mockRejectedValueOnce(new Error("warmup failed"));
    const { ensureAppShellRuntimeReady } = await import("@/lib/runtime/runtime-startup");

    ensureAppShellRuntimeReady();
    await flushMicrotasks();

    expect(logServerErrorMock).toHaveBeenCalledWith({
      event: "app_shell_browser_warmup_failed",
      message: "warmup failed",
    });
  });

  it("starts task runtime through the shared task profile", async () => {
    const { ensureTaskRuntimeReady } = await import("@/lib/runtime/runtime-startup");

    ensureTaskRuntimeReady();
    await flushMicrotasks();

    expect(ensureTaskRunnerMock).toHaveBeenCalledTimes(1);
  });
});
