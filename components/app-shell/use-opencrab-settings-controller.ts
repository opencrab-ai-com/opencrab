"use client";

import { useCallback, useMemo, useState } from "react";
import { getUserFacingError } from "@/lib/opencrab/messages";
import {
  cancelChatGptConnection as cancelChatGptConnectionResource,
  disconnectChatGptConnection as disconnectChatGptConnectionResource,
  getChatGptConnectionStatus as getChatGptConnectionStatusResource,
  getCodexStatus as getCodexStatusResource,
  startChatGptConnection as startChatGptConnectionResource,
  updateSettings as updateSettingsResource,
  warmCodexBrowserSession as warmCodexBrowserSessionResource,
} from "@/lib/resources/opencrab-api";
import type {
  AppSnapshot,
  BrowserConnectionMode,
  ChatGptConnectionStatusResponse,
  CodexBrowserSessionStatus,
  CodexModelOption,
  CodexReasoningEffort,
  CodexSandboxMode,
  CodexStatusResponse,
} from "@/lib/resources/opencrab-api-types";
import type { AppLanguage, AppSettings } from "@/lib/seed-data";

type PersistedSettingsPatch = Partial<
  Pick<
    AppSettings,
    | "defaultModel"
    | "defaultReasoningEffort"
    | "defaultSandboxMode"
    | "browserConnectionMode"
    | "defaultLanguage"
    | "userDisplayName"
    | "userAvatarDataUrl"
    | "thinkingModeEnabled"
    | "allowOpenAiApiKeyForCommands"
  >
>;

type UseOpenCrabSettingsControllerInput = {
  codexModels: CodexModelOption[];
  applySnapshot: (snapshot: AppSnapshot) => void;
  onCodexStatusChange: (status: CodexStatusResponse | null) => void;
  onChatGptConnectionStatusChange: (
    status: ChatGptConnectionStatusResponse | null,
  ) => void;
  onBrowserSessionStatusChange: (
    status: CodexBrowserSessionStatus | null,
  ) => void;
  onError: (message: string | null) => void;
  onChatGptPendingChange: (pending: boolean) => void;
};

export function useOpenCrabSettingsController(
  input: UseOpenCrabSettingsControllerInput,
) {
  const [selectedBrowserConnectionMode, setSelectedBrowserConnectionModeState] =
    useState<BrowserConnectionMode>("current-browser");
  const [selectedModel, setSelectedModelState] = useState("");
  const [selectedReasoningEffort, setSelectedReasoningEffortState] =
    useState<CodexReasoningEffort>("medium");
  const [selectedSandboxMode, setSelectedSandboxModeState] =
    useState<CodexSandboxMode>("workspace-write");
  const [selectedLanguage, setSelectedLanguageState] =
    useState<AppLanguage>("zh-Hans");
  const [selectedUserDisplayName, setSelectedUserDisplayNameState] =
    useState("我");
  const [selectedUserAvatarDataUrl, setSelectedUserAvatarDataUrlState] =
    useState<string | null>(null);
  const [thinkingModeEnabled, setThinkingModeEnabledState] = useState(true);
  const [allowOpenAiApiKeyForCommands, setAllowOpenAiApiKeyForCommandsState] =
    useState(false);

  const hydrateFromSnapshot = useCallback((snapshot: AppSnapshot) => {
    setSelectedModelState(snapshot.settings.defaultModel || "");
    setSelectedReasoningEffortState(
      snapshot.settings.defaultReasoningEffort || "medium",
    );
    setSelectedSandboxModeState(
      snapshot.settings.defaultSandboxMode || "workspace-write",
    );
    setSelectedBrowserConnectionModeState(
      snapshot.settings.browserConnectionMode || "current-browser",
    );
    setSelectedLanguageState(snapshot.settings.defaultLanguage || "zh-Hans");
    setSelectedUserDisplayNameState(snapshot.settings.userDisplayName || "我");
    setSelectedUserAvatarDataUrlState(snapshot.settings.userAvatarDataUrl || null);
    setThinkingModeEnabledState(snapshot.settings.thinkingModeEnabled !== false);
    setAllowOpenAiApiKeyForCommandsState(
      Boolean(snapshot.settings.allowOpenAiApiKeyForCommands),
    );
  }, []);

  const reconcileModelSelection = useCallback(
    (models: CodexModelOption[], defaultModel: string) => {
      setSelectedModelState((current) => {
        const preferredModelId = current || defaultModel;
        const resolvedModel =
          models.find((item) => item.id === preferredModelId) || models[0] || null;
        const resolvedModelId = resolvedModel?.id || "";

        setSelectedReasoningEffortState((effort) => {
          if (!resolvedModel) {
            return effort;
          }

          return resolvedModel.reasoningOptions.some(
            (item) => item.effort === effort,
          )
            ? effort
            : resolvedModel.defaultReasoningEffort;
        });

        return resolvedModelId;
      });
    },
    [],
  );

  const persistedSettings = useMemo<PersistedSettingsPatch>(
    () => ({
      defaultModel: selectedModel,
      defaultReasoningEffort: selectedReasoningEffort,
      defaultSandboxMode: selectedSandboxMode,
      browserConnectionMode: selectedBrowserConnectionMode,
      defaultLanguage: selectedLanguage,
      userDisplayName: selectedUserDisplayName,
      userAvatarDataUrl: selectedUserAvatarDataUrl,
      thinkingModeEnabled,
      allowOpenAiApiKeyForCommands,
    }),
    [
      allowOpenAiApiKeyForCommands,
      selectedBrowserConnectionMode,
      selectedLanguage,
      selectedUserAvatarDataUrl,
      selectedUserDisplayName,
      thinkingModeEnabled,
      selectedModel,
      selectedReasoningEffort,
      selectedSandboxMode,
    ],
  );

  const handleSettingsSaveError = useCallback(
    (error: unknown) => {
      input.onError(getUserFacingError(error, "保存设置失败，请稍后再试。"));
    },
    [input],
  );

  const persistSettings = useCallback(
    async (
      patch: PersistedSettingsPatch,
      options?: {
        warmBrowserSession?: boolean;
      },
    ) => {
      const result = await updateSettingsResource({
        ...persistedSettings,
        ...patch,
      });
      input.applySnapshot(result.snapshot);
      hydrateFromSnapshot(result.snapshot);

      if (options?.warmBrowserSession) {
        const nextStatus = await warmCodexBrowserSessionResource();
        input.onBrowserSessionStatusChange(nextStatus);
      }
    },
    [hydrateFromSnapshot, input, persistedSettings],
  );

  const setSelectedModel = useCallback(
    async (model: string) => {
      setSelectedModelState(model);
      const nextModel = input.codexModels.find((item) => item.id === model);

      if (!nextModel) {
        return;
      }

      const nextReasoningEffort = nextModel.reasoningOptions.some(
        (item) => item.effort === selectedReasoningEffort,
      )
        ? selectedReasoningEffort
        : nextModel.defaultReasoningEffort;

      setSelectedReasoningEffortState(nextReasoningEffort);

      try {
        await persistSettings({
          defaultModel: model,
          defaultReasoningEffort: nextReasoningEffort,
        });
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, input.codexModels, persistSettings, selectedReasoningEffort],
  );

  const setSelectedReasoningEffort = useCallback(
    async (effort: CodexReasoningEffort) => {
      setSelectedReasoningEffortState(effort);

      try {
        await persistSettings({
          defaultReasoningEffort: effort,
        });
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, persistSettings],
  );

  const setSelectedSandboxMode = useCallback(
    async (mode: CodexSandboxMode) => {
      setSelectedSandboxModeState(mode);

      try {
        await persistSettings({
          defaultSandboxMode: mode,
        });
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, persistSettings],
  );

  const setSelectedLanguage = useCallback(
    async (language: AppLanguage) => {
      setSelectedLanguageState(language);

      try {
        await persistSettings({
          defaultLanguage: language,
        });
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, persistSettings],
  );

  const setSelectedUserDisplayName = useCallback(
    async (name: string) => {
      const normalizedName = name.trim() || "我";
      setSelectedUserDisplayNameState(normalizedName);

      try {
        await persistSettings({
          userDisplayName: normalizedName,
        });
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, persistSettings],
  );

  const setSelectedUserAvatarDataUrl = useCallback(
    async (avatarDataUrl: string | null) => {
      setSelectedUserAvatarDataUrlState(avatarDataUrl);

      try {
        await persistSettings({
          userAvatarDataUrl: avatarDataUrl,
        });
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, persistSettings],
  );

  const setThinkingModeEnabled = useCallback(
    async (enabled: boolean) => {
      setThinkingModeEnabledState(enabled);

      try {
        await persistSettings({
          thinkingModeEnabled: enabled,
        });
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, persistSettings],
  );

  const setSelectedBrowserConnectionMode = useCallback(
    async (mode: BrowserConnectionMode) => {
      setSelectedBrowserConnectionModeState(mode);

      try {
        await persistSettings(
          {
            browserConnectionMode: mode,
          },
          { warmBrowserSession: true },
        );
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, persistSettings],
  );

  const setAllowOpenAiApiKeyForCommands = useCallback(
    async (enabled: boolean) => {
      setAllowOpenAiApiKeyForCommandsState(enabled);

      try {
        await persistSettings({
          allowOpenAiApiKeyForCommands: enabled,
        });
      } catch (error) {
        handleSettingsSaveError(error);
      }
    },
    [handleSettingsSaveError, persistSettings],
  );

  const refreshChatGptConnectionStatus = useCallback(async () => {
    input.onError(null);

    try {
      const [chatGptConnection, status] = await Promise.all([
        getChatGptConnectionStatusResource(),
        getCodexStatusResource(),
      ]);
      input.onChatGptConnectionStatusChange(chatGptConnection);
      input.onCodexStatusChange(status);
      return chatGptConnection;
    } catch (error) {
      input.onError(
        getUserFacingError(error, "刷新 ChatGPT 连接状态失败，请稍后再试。"),
      );
      return null;
    }
  }, [input]);

  const runChatGptConnectionAction = useCallback(
    async (
      action: () => Promise<ChatGptConnectionStatusResponse>,
      errorMessage: string,
    ) => {
      input.onChatGptPendingChange(true);
      input.onError(null);

      try {
        const [chatGptConnection, status] = await Promise.all([
          action(),
          getCodexStatusResource(),
        ]);
        input.onChatGptConnectionStatusChange(chatGptConnection);
        input.onCodexStatusChange(status);
        return chatGptConnection;
      } catch (error) {
        input.onError(getUserFacingError(error, errorMessage));
        return null;
      } finally {
        input.onChatGptPendingChange(false);
      }
    },
    [input],
  );

  const startChatGptConnection = useCallback(async () => {
    return runChatGptConnectionAction(
      startChatGptConnectionResource,
      "发起 ChatGPT 连接失败，请稍后再试。",
    );
  }, [runChatGptConnectionAction]);

  const cancelChatGptConnection = useCallback(async () => {
    return runChatGptConnectionAction(
      cancelChatGptConnectionResource,
      "取消 ChatGPT 连接失败，请稍后再试。",
    );
  }, [runChatGptConnectionAction]);

  const disconnectChatGptConnection = useCallback(async () => {
    return runChatGptConnectionAction(
      disconnectChatGptConnectionResource,
      "断开 ChatGPT 连接失败，请稍后再试。",
    );
  }, [runChatGptConnectionAction]);

  return {
    selectedBrowserConnectionMode,
    selectedModel,
    selectedReasoningEffort,
    selectedSandboxMode,
    selectedLanguage,
    selectedUserDisplayName,
    selectedUserAvatarDataUrl,
    thinkingModeEnabled,
    allowOpenAiApiKeyForCommands,
    hydrateFromSnapshot,
    reconcileModelSelection,
    setSelectedModel,
    setSelectedReasoningEffort,
    setSelectedSandboxMode,
    setSelectedLanguage,
    setSelectedUserDisplayName,
    setSelectedUserAvatarDataUrl,
    setThinkingModeEnabled,
    setSelectedBrowserConnectionMode,
    setAllowOpenAiApiKeyForCommands,
    refreshChatGptConnectionStatus,
    startChatGptConnection,
    cancelChatGptConnection,
    disconnectChatGptConnection,
  };
}
