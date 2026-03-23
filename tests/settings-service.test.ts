import { describe, expect, it, vi } from "vitest";
import { createSettingsService } from "@/lib/modules/settings/settings-service";
import type { AppSnapshot } from "@/lib/resources/opencrab-api-types";

describe("settingsService", () => {
  it("returns and updates settings via repository", () => {
    const snapshot: AppSnapshot = {
      folders: [],
      conversations: [],
      conversationMessages: {},
      settings: {
        defaultModel: "gpt-5.4",
        defaultReasoningEffort: "medium",
        defaultSandboxMode: "workspace-write",
        browserConnectionMode: "current-browser",
        defaultLanguage: "zh-Hans",
        userDisplayName: "我",
        userAvatarDataUrl: null,
        thinkingModeEnabled: true,
        allowOpenAiApiKeyForCommands: false,
      },
    };
    const repository = {
      getSnapshot: vi.fn(() => snapshot),
      updateSettings: vi.fn((patch) => ({
        ...snapshot,
        settings: {
          ...snapshot.settings,
          ...patch,
        },
      })),
    };
    const service = createSettingsService({ repository });

    expect(service.getSettings()).toEqual(snapshot.settings);
    expect(service.updateSettings({ defaultLanguage: "en" }).settings.defaultLanguage).toBe("en");
    expect(repository.getSnapshot).toHaveBeenCalled();
    expect(repository.updateSettings).toHaveBeenCalledWith({ defaultLanguage: "en" });
  });
});
