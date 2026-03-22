"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { flushSync } from "react-dom";
import type {
  AppLanguage,
  AppSettings,
  ConversationItem,
  ConversationMessage,
  FolderItem,
} from "@/lib/seed-data";
import { buildConversationTitle } from "@/lib/conversations/utils";
import {
  cancelChatGptConnection as cancelChatGptConnectionResource,
  createAgent as createAgentResource,
  createConversation as createConversationResource,
  createFolder as createFolderResource,
  deleteConversation as deleteConversationResource,
  deleteFolder as deleteFolderResource,
  getAgents as getAgentsResource,
  getAppSnapshot,
  getChatGptConnectionStatus as getChatGptConnectionStatusResource,
  getCodexBrowserSessionStatus as getCodexBrowserSessionStatusResource,
  getCodexOptions as getCodexOptionsResource,
  getCodexStatus as getCodexStatusResource,
  deleteAgent as deleteAgentResource,
  disconnectChatGptConnection as disconnectChatGptConnectionResource,
  startChatGptConnection as startChatGptConnectionResource,
  replyToProjectConversation as replyToProjectConversationResource,
  streamReplyToConversation,
  updateAgent as updateAgentResource,
  updateConversation,
  updateFolder as updateFolderResource,
  updateSettings as updateSettingsResource,
  uploadAttachments as uploadAttachmentsResource,
  warmCodexBrowserSession as warmCodexBrowserSessionResource,
} from "@/lib/resources/opencrab-api";
import {
  buildUserMessagePreview,
  formatClientMessageTime,
  getUserFacingError,
} from "@/lib/opencrab/messages";
import type { AgentProfileDetail, AgentProfileRecord } from "@/lib/agents/types";
import type {
  AppSnapshot,
  BrowserConnectionMode,
  ChatGptConnectionStatusResponse,
  CodexBrowserSessionStatus,
  CodexModelOption,
  CodexReasoningEffort,
  CodexSandboxMode,
  CodexStatusResponse,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";

type SendMessageInput = {
  conversationId?: string;
  content?: string;
  attachments?: UploadedAttachment[];
};

type OpenCrabContextValue = {
  folders: FolderItem[];
  conversations: ConversationItem[];
  conversationMessages: Record<string, ConversationMessage[]>;
  agents: AgentProfileRecord[];
  codexModels: CodexModelOption[];
  codexStatus: CodexStatusResponse | null;
  chatGptConnectionStatus: ChatGptConnectionStatusResponse | null;
  browserSessionStatus: CodexBrowserSessionStatus | null;
  selectedBrowserConnectionMode: BrowserConnectionMode;
  selectedModel: string;
  selectedReasoningEffort: CodexReasoningEffort;
  selectedSandboxMode: CodexSandboxMode;
  selectedLanguage: AppLanguage;
  allowOpenAiApiKeyForCommands: boolean;
  expandedFolders: Record<string, boolean>;
  isHydrated: boolean;
  isMutating: boolean;
  isSendingMessage: boolean;
  isUploadingAttachments: boolean;
  isChatGptConnectionPending: boolean;
  activeStreamingConversationId: string | null;
  activeStreamingConversationIds: string[];
  errorMessage: string | null;
  clearError: () => void;
  refreshSnapshot: () => Promise<void>;
  isConversationStreaming: (conversationId?: string | null) => boolean;
  setSelectedModel: (model: string) => Promise<void>;
  setSelectedReasoningEffort: (effort: CodexReasoningEffort) => Promise<void>;
  setSelectedSandboxMode: (mode: CodexSandboxMode) => Promise<void>;
  setSelectedLanguage: (language: AppLanguage) => Promise<void>;
  setSelectedBrowserConnectionMode: (
    mode: BrowserConnectionMode,
  ) => Promise<void>;
  setAllowOpenAiApiKeyForCommands: (enabled: boolean) => Promise<void>;
  refreshChatGptConnectionStatus: () => Promise<ChatGptConnectionStatusResponse | null>;
  startChatGptConnection: () => Promise<ChatGptConnectionStatusResponse | null>;
  cancelChatGptConnection: () => Promise<ChatGptConnectionStatusResponse | null>;
  disconnectChatGptConnection: () => Promise<ChatGptConnectionStatusResponse | null>;
  toggleFolder: (folderId: string) => void;
  createFolder: (name: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  setConversationAgentProfile: (
    conversationId: string,
    agentProfileId: string | null,
  ) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  moveConversation: (
    conversationId: string,
    folderId: string | null,
  ) => Promise<void>;
  createConversation: (input?: {
    title?: string;
    folderId?: string | null;
    agentProfileId?: string | null;
  }) => Promise<string>;
  createAgent: (input: {
    name: string;
    summary: string;
    avatarDataUrl?: string | null;
    roleLabel?: string;
    description?: string;
    availability?: "solo" | "team" | "both";
    teamRole?: "lead" | "research" | "writer" | "specialist";
    defaultModel?: string | null;
    defaultReasoningEffort?: CodexReasoningEffort | null;
    defaultSandboxMode?: CodexSandboxMode | null;
    starterPrompts?: string[];
    files?: Partial<{
      soul: string;
      responsibility: string;
      tools: string;
      user: string;
      knowledge: string;
    }>;
  }) => Promise<AgentProfileDetail | null>;
  updateAgent: (
    agentId: string,
    patch: Partial<{
      name: string;
      summary: string;
      avatarDataUrl: string | null;
      roleLabel: string;
      description: string;
      availability: "solo" | "team" | "both";
      teamRole: "lead" | "research" | "writer" | "specialist";
      defaultModel: string | null;
      defaultReasoningEffort: CodexReasoningEffort | null;
      defaultSandboxMode: CodexSandboxMode | null;
      starterPrompts: string[];
      files: Partial<{
        soul: string;
        responsibility: string;
        tools: string;
        user: string;
        knowledge: string;
      }>;
    }>,
  ) => Promise<AgentProfileDetail | null>;
  deleteAgent: (agentId: string) => Promise<boolean>;
  refreshAgents: () => Promise<AgentProfileRecord[]>;
  uploadAttachments: (files: File[]) => Promise<UploadedAttachment[]>;
  sendMessage: (input: SendMessageInput) => Promise<string | null>;
  stopMessage: (conversationId?: string | null) => void;
};

const OpenCrabContext = createContext<OpenCrabContextValue | null>(null);

type OpenCrabProviderProps = {
  children: React.ReactNode;
};

type ActiveStreamState = {
  key: string;
  conversationId: string;
  assistantMessageId: string;
  controller: AbortController;
  model: string;
};

type PersistedSettingsPatch = Partial<
  Pick<
    AppSettings,
    | "defaultModel"
    | "defaultReasoningEffort"
    | "defaultSandboxMode"
    | "browserConnectionMode"
    | "defaultLanguage"
    | "allowOpenAiApiKeyForCommands"
  >
>;

const GLOBAL_SNAPSHOT_SYNC_INTERVAL_MS = 12_000;

export function OpenCrabProvider({ children }: OpenCrabProviderProps) {
  const pathname = usePathname();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationMessages, setConversationMessages] = useState<
    Record<string, ConversationMessage[]>
  >({});
  const [agents, setAgents] = useState<AgentProfileRecord[]>([]);
  const [codexModels, setCodexModels] = useState<CodexModelOption[]>([]);
  const [codexStatus, setCodexStatus] = useState<CodexStatusResponse | null>(
    null,
  );
  const [chatGptConnectionStatus, setChatGptConnectionStatus] =
    useState<ChatGptConnectionStatusResponse | null>(null);
  const [browserSessionStatus, setBrowserSessionStatus] =
    useState<CodexBrowserSessionStatus | null>(null);
  const [selectedBrowserConnectionMode, setSelectedBrowserConnectionModeState] =
    useState<BrowserConnectionMode>("current-browser");
  const [selectedModel, setSelectedModelState] = useState("");
  const [selectedReasoningEffort, setSelectedReasoningEffortState] =
    useState<CodexReasoningEffort>("medium");
  const [selectedSandboxMode, setSelectedSandboxModeState] =
    useState<CodexSandboxMode>("workspace-write");
  const [selectedLanguage, setSelectedLanguageState] =
    useState<AppLanguage>("zh-Hans");
  const [allowOpenAiApiKeyForCommands, setAllowOpenAiApiKeyForCommandsState] =
    useState(false);
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isChatGptConnectionPending, setIsChatGptConnectionPending] =
    useState(false);
  const [activeStreamingConversationId, setActiveStreamingConversationId] =
    useState<string | null>(null);
  const [activeStreamingConversationIds, setActiveStreamingConversationIds] =
    useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeStreamsRef = useRef<Map<string, ActiveStreamState>>(new Map());

  const applySnapshot = useCallback((snapshot: AppSnapshot) => {
    startTransition(() => {
      setFolders((current) =>
        areFoldersEqual(current, snapshot.folders) ? current : snapshot.folders,
      );
      setConversations((current) =>
        areConversationsEqual(current, snapshot.conversations)
          ? current
          : snapshot.conversations,
      );
      setConversationMessages((current) =>
        areConversationMessageMapsEqual(current, snapshot.conversationMessages)
          ? current
          : snapshot.conversationMessages,
      );
      setExpandedFolders((current) => {
        let changed = false;
        const next = { ...current };

        snapshot.folders.forEach((folder) => {
          if (typeof next[folder.id] !== "boolean") {
            next[folder.id] = false;
            changed = true;
          }
        });

        Object.keys(next).forEach((folderId) => {
          if (!snapshot.folders.some((folder) => folder.id === folderId)) {
            delete next[folderId];
            changed = true;
          }
        });

        return changed ? next : current;
      });
    });
  }, []);

  const patchConversation = useCallback(
    (conversationId: string, patch: Partial<ConversationItem>) => {
      setConversations((current) => {
        const target = current.find((item) => item.id === conversationId);

        if (!target) {
          return current;
        }

        const updated = { ...target, ...patch };

        return [
          updated,
          ...current.filter((item) => item.id !== conversationId),
        ];
      });
    },
    [],
  );

  const appendMessages = useCallback(
    (conversationId: string, nextMessages: ConversationMessage[]) => {
      setConversationMessages((current) => ({
        ...current,
        [conversationId]: [...(current[conversationId] ?? []), ...nextMessages],
      }));
    },
    [],
  );

  const patchMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      updater:
        | Partial<ConversationMessage>
        | ((message: ConversationMessage) => ConversationMessage),
    ) => {
      setConversationMessages((current) => {
        const messages = current[conversationId] ?? [];

        return {
          ...current,
          [conversationId]: messages.map((message) => {
            if (message.id !== messageId) {
              return message;
            }

            if (typeof updater === "function") {
              return updater(message);
            }

            return { ...message, ...updater };
          }),
        };
      });
    },
    [],
  );

  useEffect(() => {
    let active = true;

    async function hydrateSnapshot() {
      try {
        const snapshot = await getAppSnapshot();

        if (!active) {
          return;
        }

        applySnapshot(snapshot);
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
        setAllowOpenAiApiKeyForCommandsState(
          Boolean(snapshot.settings.allowOpenAiApiKeyForCommands),
        );
      } catch (error) {
        if (active) {
          setErrorMessage(
            getUserFacingError(error, "初始化失败，请刷新后重试。"),
          );
        }
      } finally {
        if (active) {
          setIsHydrated(true);
        }
      }
    }

    async function hydrateCodexMeta() {
      try {
        const [codexOptions, status, browserStatus, chatGptConnection] =
          await Promise.all([
            getCodexOptionsResource(),
            getCodexStatusResource(),
            getCodexBrowserSessionStatusResource(),
            getChatGptConnectionStatusResource(),
          ]);

        if (!active) {
          return;
        }

        setCodexModels(codexOptions.models);
        setCodexStatus(status);
        setBrowserSessionStatus(browserStatus);
        setChatGptConnectionStatus(chatGptConnection);
        setSelectedModelState((current) => {
          const preferredModelId = current || codexOptions.defaultModel;
          const resolvedModel =
            codexOptions.models.find((item) => item.id === preferredModelId) ||
            codexOptions.models[0] ||
            null;
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

        void warmCodexBrowserSessionResource()
          .then((nextStatus) => {
            if (active) {
              setBrowserSessionStatus(nextStatus);
            }
          })
          .catch(() => {
            // Ignore warmup noise here; the visible status card keeps the current state.
          });
      } catch (error) {
        if (active) {
          setCodexStatus({
            ok: false,
            error: getUserFacingError(
              error,
              "当前无法读取 OpenCrab 的运行状态。",
            ),
            loginStatus: "missing",
            loginMethod: "chatgpt",
          });
          setChatGptConnectionStatus({
            provider: "chatgpt",
            authMode: null,
            stage: "error",
            isConnected: false,
            authUrl: null,
            deviceCode: null,
            codeExpiresAt: null,
            startedAt: null,
            connectedAt: null,
            error: getUserFacingError(error, "当前无法读取 ChatGPT 连接状态。"),
            message: "当前无法读取 ChatGPT 连接状态。",
          });
        }
      }
    }

    async function hydrateAgents() {
      try {
        const response = await getAgentsResource();

        if (!active) {
          return;
        }

        setAgents(response.agents);
      } catch {
        // Keep agent hydration failures quiet here. Agent pages will show their own loading states.
      }
    }

    void hydrateSnapshot();
    void hydrateCodexMeta();
    void hydrateAgents();

    return () => {
      active = false;
    };
  }, [applySnapshot]);

  useEffect(() => {
    const stage = chatGptConnectionStatus?.stage;

    if (stage !== "connecting" && stage !== "waiting_browser_auth") {
      return;
    }

    let active = true;

    const intervalId = window.setInterval(() => {
      if (!active) {
        return;
      }

      void Promise.all([
        getChatGptConnectionStatusResource(),
        getCodexStatusResource(),
      ])
        .then(([chatGptConnection, status]) => {
          if (!active) {
            return;
          }

          setChatGptConnectionStatus(chatGptConnection);
          setCodexStatus(status);
        })
        .catch(() => {
          // Keep polling quiet. The visible connection card already shows the last good state.
        });
    }, 1500);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [chatGptConnectionStatus?.stage]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (pathname.startsWith("/projects/")) {
      return;
    }

    let active = true;

    async function syncExternalSnapshot() {
      if (
        !active ||
        document.visibilityState !== "visible" ||
        activeStreamsRef.current.size > 0
      ) {
        return;
      }

      try {
        const snapshot = await getAppSnapshot();

        if (active) {
          applySnapshot(snapshot);
        }
      } catch {
        // Keep this silent. External channel sync should not interrupt the user if one poll fails.
      }
    }

    const intervalId = window.setInterval(() => {
      void syncExternalSnapshot();
    }, GLOBAL_SNAPSHOT_SYNC_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncExternalSnapshot();
      }
    }

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applySnapshot, isHydrated, pathname]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !current[folderId],
    }));
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const refreshSnapshot = useCallback(async () => {
    const snapshot = await getAppSnapshot();
    applySnapshot(snapshot);
  }, [applySnapshot]);

  const syncStreamingState = useCallback(() => {
    const activeStreams = Array.from(activeStreamsRef.current.values());
    const conversationIds = activeStreams.map((item) => item.conversationId);
    setActiveStreamingConversationIds(conversationIds);
    setActiveStreamingConversationId(conversationIds[0] ?? null);
    setIsSendingMessage(activeStreams.length > 0);
  }, []);

  const clearStreamState = useCallback(
    (key: string) => {
      if (!activeStreamsRef.current.has(key)) {
        return;
      }

      activeStreamsRef.current.delete(key);
      syncStreamingState();
    },
    [syncStreamingState],
  );

  const persistedSettings = useMemo<PersistedSettingsPatch>(
    () => ({
      defaultModel: selectedModel,
      defaultReasoningEffort: selectedReasoningEffort,
      defaultSandboxMode: selectedSandboxMode,
      browserConnectionMode: selectedBrowserConnectionMode,
      defaultLanguage: selectedLanguage,
      allowOpenAiApiKeyForCommands,
    }),
    [
      allowOpenAiApiKeyForCommands,
      selectedBrowserConnectionMode,
      selectedLanguage,
      selectedModel,
      selectedReasoningEffort,
      selectedSandboxMode,
    ],
  );

  const handleSettingsSaveError = useCallback((error: unknown) => {
    setErrorMessage(getUserFacingError(error, "保存设置失败，请稍后再试。"));
  }, []);

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
      applySnapshot(result.snapshot);

      if (options?.warmBrowserSession) {
        const nextStatus = await warmCodexBrowserSessionResource();
        setBrowserSessionStatus(nextStatus);
      }
    },
    [applySnapshot, persistedSettings],
  );

  const setSelectedModel = useCallback(
    async (model: string) => {
      setSelectedModelState(model);
      const nextModel = codexModels.find((item) => item.id === model);

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
    [
      codexModels,
      handleSettingsSaveError,
      persistSettings,
      selectedReasoningEffort,
    ],
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
    setErrorMessage(null);

    try {
      const [chatGptConnection, status] = await Promise.all([
        getChatGptConnectionStatusResource(),
        getCodexStatusResource(),
      ]);
      setChatGptConnectionStatus(chatGptConnection);
      setCodexStatus(status);
      return chatGptConnection;
    } catch (error) {
      setErrorMessage(
        getUserFacingError(error, "刷新 ChatGPT 连接状态失败，请稍后再试。"),
      );
      return null;
    }
  }, []);

  const runChatGptConnectionAction = useCallback(
    async (
      action: () => Promise<ChatGptConnectionStatusResponse>,
      errorMessage: string,
    ) => {
      setIsChatGptConnectionPending(true);
      setErrorMessage(null);

      try {
        const [chatGptConnection, status] = await Promise.all([
          action(),
          getCodexStatusResource(),
        ]);
        setChatGptConnectionStatus(chatGptConnection);
        setCodexStatus(status);
        return chatGptConnection;
      } catch (error) {
        setErrorMessage(getUserFacingError(error, errorMessage));
        return null;
      } finally {
        setIsChatGptConnectionPending(false);
      }
    },
    [],
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

  const runMutation = useCallback(async <T,>(action: () => Promise<T>) => {
    setIsMutating(true);
    setErrorMessage(null);

    try {
      return await action();
    } catch (error) {
      setErrorMessage(getUserFacingError(error, "操作失败，请稍后再试。"));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const createFolder = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return;
      }

      await runMutation(async () => {
        const result = await createFolderResource(trimmedName);
        applySnapshot(result.snapshot);
      });
    },
    [applySnapshot, runMutation],
  );

  const renameFolder = useCallback(
    async (folderId: string, name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return;
      }

      await runMutation(async () => {
        const result = await updateFolderResource(folderId, trimmedName);
        applySnapshot(result.snapshot);
      });
    },
    [applySnapshot, runMutation],
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      await runMutation(async () => {
        const result = await deleteFolderResource(folderId);
        applySnapshot(result.snapshot);
      });
    },
    [applySnapshot, runMutation],
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      await runMutation(async () => {
        const result = await deleteConversationResource(conversationId);
        applySnapshot(result.snapshot);
      });
    },
    [applySnapshot, runMutation],
  );

  const renameConversation = useCallback(
    async (conversationId: string, title: string) => {
      const trimmedTitle = title.trim();

      if (!trimmedTitle) {
        return;
      }

      await runMutation(async () => {
        const result = await updateConversation(conversationId, {
          title: trimmedTitle,
        });
        applySnapshot(result.snapshot);
      });
    },
    [applySnapshot, runMutation],
  );

  const setConversationAgentProfile = useCallback(
    async (conversationId: string, agentProfileId: string | null) => {
      await runMutation(async () => {
        const result = await updateConversation(conversationId, {
          agentProfileId,
        });
        applySnapshot(result.snapshot);
      });
    },
    [applySnapshot, runMutation],
  );

  const moveConversation = useCallback(
    async (conversationId: string, folderId: string | null) => {
      await runMutation(async () => {
        const result = await updateConversation(conversationId, { folderId });
        applySnapshot(result.snapshot);

        if (folderId) {
          setExpandedFolders((current) => ({ ...current, [folderId]: true }));
        }
      });
    },
    [applySnapshot, runMutation],
  );

  const createConversation = useCallback(
    async (input?: {
      title?: string;
      folderId?: string | null;
      agentProfileId?: string | null;
    }) => {
      return runMutation(async () => {
        const result = await createConversationResource(input);
        flushSync(() => {
          applySnapshot(result.snapshot);
        });
        return result.conversationId;
      });
    },
    [applySnapshot, runMutation],
  );

  const refreshAgents = useCallback(async () => {
    const response = await getAgentsResource();
    setAgents(response.agents);
    return response.agents;
  }, []);

  const createAgent = useCallback(
    async (input: {
      name: string;
      summary: string;
      avatarDataUrl?: string | null;
      roleLabel?: string;
      description?: string;
      availability?: "solo" | "team" | "both";
      teamRole?: "lead" | "research" | "writer" | "specialist";
      defaultModel?: string | null;
      defaultReasoningEffort?: CodexReasoningEffort | null;
      defaultSandboxMode?: CodexSandboxMode | null;
      starterPrompts?: string[];
      files?: Partial<{
        soul: string;
        responsibility: string;
        tools: string;
        user: string;
        knowledge: string;
      }>;
    }) => {
      return runMutation(async () => {
        const response = await createAgentResource(input);

        if (!response.agent) {
          return null;
        }

        await refreshAgents();
        return response.agent;
      });
    },
    [refreshAgents, runMutation],
  );

  const updateAgent = useCallback(
    async (
      agentId: string,
      patch: Partial<{
        name: string;
        summary: string;
        avatarDataUrl: string | null;
        roleLabel: string;
        description: string;
        availability: "solo" | "team" | "both";
        teamRole: "lead" | "research" | "writer" | "specialist";
        defaultModel: string | null;
        defaultReasoningEffort: CodexReasoningEffort | null;
        defaultSandboxMode: CodexSandboxMode | null;
        starterPrompts: string[];
        files: Partial<{
          soul: string;
          responsibility: string;
          tools: string;
          user: string;
          knowledge: string;
        }>;
      }>,
    ) => {
      return runMutation(async () => {
        const response = await updateAgentResource(agentId, patch);

        if (!response.agent) {
          return null;
        }

        await refreshAgents();
        return response.agent;
      });
    },
    [refreshAgents, runMutation],
  );

  const deleteAgent = useCallback(
    async (agentId: string) => {
      return runMutation(async () => {
        const response = await deleteAgentResource(agentId);
        await refreshAgents();
        return response.ok;
      });
    },
    [refreshAgents, runMutation],
  );

  const uploadAttachments = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return [];
    }

    setIsUploadingAttachments(true);
    setErrorMessage(null);

    try {
      const result = await uploadAttachmentsResource(files);
      return result.attachments;
    } catch (error) {
      setErrorMessage(getUserFacingError(error, "上传附件失败，请稍后再试。"));
      return [];
    } finally {
      setIsUploadingAttachments(false);
    }
  }, []);

  const stopMessage = useCallback(
    (conversationId?: string | null) => {
      const activeStream = conversationId
        ? Array.from(activeStreamsRef.current.values()).find(
            (item) => item.conversationId === conversationId,
          )
        : Array.from(activeStreamsRef.current.values())[0];

      if (!activeStream) {
        return;
      }

      activeStream.controller.abort();
      patchMessage(
        activeStream.conversationId,
        activeStream.assistantMessageId,
        (message) => ({
          ...message,
          content: message.content.trim() || "已停止当前回复。",
          meta: `已停止 · ${activeStream.model}`,
          status: "stopped",
        }),
      );
      clearStreamState(activeStream.key);
    },
    [clearStreamState, patchMessage],
  );

  const isConversationStreaming = useCallback(
    (conversationId?: string | null) => {
      if (!conversationId) {
        return false;
      }

      return Array.from(activeStreamsRef.current.values()).some(
        (item) => item.conversationId === conversationId,
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (input: SendMessageInput) => {
      const content = input.content?.trim() || "";
      const attachments = input.attachments || [];

      if (!content && attachments.length === 0) {
        return null;
      }

      setErrorMessage(null);

      try {
        let conversationId = input.conversationId;
        let createdConversation = false;

        if (
          !conversationId ||
          !conversations.some((item) => item.id === conversationId)
        ) {
          const titleSource =
            content || attachments[0]?.name || "带附件的新对话";
          conversationId = await createConversation({
            title: buildConversationTitle(titleSource),
          });
          createdConversation = true;
        }

        const targetConversation = conversations.find((item) => item.id === conversationId) ?? null;

        if (targetConversation?.projectId) {
          const userMessageId = `message-${crypto.randomUUID()}`;
          const assistantMessageId = `message-${crypto.randomUUID()}`;
          const preview = buildUserMessagePreview(content, attachments.map((attachment) => attachment.name));

          patchConversation(conversationId, {
            preview,
            timeLabel: "刚刚",
          });
          appendMessages(conversationId, [
            {
              id: userMessageId,
              role: "user",
              content: preview,
              timestamp: new Date().toISOString(),
              meta: "团队群聊",
              status: "done",
            },
            {
              id: assistantMessageId,
              role: "assistant",
              actorLabel: "项目经理",
              content: "",
              timestamp: new Date().toISOString(),
              meta: "团队群聊 · 项目经理正在整理并安排",
              status: "pending",
            },
          ]);
          setIsSendingMessage(true);

          try {
            const result = await replyToProjectConversationResource(targetConversation.projectId, {
              conversationId,
              content,
            });
            applySnapshot(result.snapshot);
            return conversationId;
          } catch (error) {
            patchMessage(conversationId, assistantMessageId, {
              content: "项目经理这一轮回复失败了，请再试一次。",
              meta: "团队群聊 · 回复失败",
              status: "done",
            });
            throw error;
          } finally {
            setIsSendingMessage(false);
          }
        }

        const userMessageId = `message-${crypto.randomUUID()}`;
        const assistantMessageId = `message-${crypto.randomUUID()}`;
        const streamKey = crypto.randomUUID();
        const controller = new AbortController();
        activeStreamsRef.current.set(streamKey, {
          key: streamKey,
          conversationId,
          assistantMessageId,
          controller,
          model: selectedModel,
        });
        syncStreamingState();

        const preview = buildUserMessagePreview(
          content,
          attachments.map((attachment) => attachment.name),
        );
        const applyOptimisticMessageState = () => {
          patchConversation(conversationId, {
            preview,
            timeLabel: "刚刚",
          });
          appendMessages(conversationId, [
            {
              id: userMessageId,
              role: "user",
              content: preview,
              timestamp: new Date().toISOString(),
              attachments: attachments.map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                kind: attachment.kind,
                size: attachment.size,
                mimeType: attachment.mimeType,
              })),
              meta: formatClientMessageTime(),
              status: "done",
            },
            {
              id: assistantMessageId,
              role: "assistant",
              content: "",
              timestamp: new Date().toISOString(),
              thinking: ["OpenCrab 正在思考和整理上下文..."],
              meta: `OpenCrab 正在回复中... · ${selectedModel}`,
              status: "pending",
            },
          ]);
        };

        if (createdConversation) {
          flushSync(() => {
            applyOptimisticMessageState();
          });
        } else {
          applyOptimisticMessageState();
        }

        void streamReplyToConversation(
          conversationId,
          {
            content: content || undefined,
            attachmentIds: attachments.map((attachment) => attachment.id),
            model: selectedModel,
            reasoningEffort: selectedReasoningEffort,
            sandboxMode: selectedSandboxMode,
            userMessageId,
            assistantMessageId,
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === "thread") {
                patchConversation(conversationId, {
                  codexThreadId: event.threadId,
                });
                return;
              }

              if (event.type === "thinking") {
                patchMessage(conversationId, assistantMessageId, {
                  thinking: event.entries,
                });
                return;
              }

              if (event.type === "assistant") {
                patchMessage(conversationId, assistantMessageId, {
                  content: event.text,
                  meta: `OpenCrab 正在回复中... · ${selectedModel}`,
                  status: "pending",
                });
                return;
              }

              if (event.type === "done") {
                applySnapshot(event.snapshot);
                clearStreamState(streamKey);
                return;
              }

              patchMessage(conversationId, assistantMessageId, (message) => ({
                ...message,
                content: message.content.trim() || "这次回复失败了，请重试。",
                meta: `回复失败 · ${selectedModel}`,
                status: "stopped",
              }));
              setErrorMessage(
                getUserFacingError(event.error, "消息发送失败，请稍后再试。"),
              );
              clearStreamState(streamKey);
            },
          },
        ).catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          patchMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            content: message.content.trim() || "这次回复失败了，请重试。",
            meta: `回复失败 · ${selectedModel}`,
            status: "stopped",
          }));
          setErrorMessage(
            getUserFacingError(error, "消息发送失败，请稍后再试。"),
          );
          clearStreamState(streamKey);
        });

        return conversationId;
      } catch (error) {
        setErrorMessage(
          getUserFacingError(error, "消息发送失败，请稍后再试。"),
        );
        setIsSendingMessage(false);
        setActiveStreamingConversationId(null);
        activeStreamsRef.current.clear();
        syncStreamingState();
        return null;
      }
    },
    [
      appendMessages,
      applySnapshot,
      clearStreamState,
      conversations,
      createConversation,
      patchConversation,
      patchMessage,
      selectedModel,
      selectedReasoningEffort,
      selectedSandboxMode,
      syncStreamingState,
    ],
  );

  const value = useMemo<OpenCrabContextValue>(
    () => ({
      folders,
      conversations,
      conversationMessages,
      agents,
      codexModels,
      codexStatus,
      chatGptConnectionStatus,
      browserSessionStatus,
      selectedBrowserConnectionMode,
      selectedModel,
      selectedReasoningEffort,
      selectedSandboxMode,
      selectedLanguage,
      allowOpenAiApiKeyForCommands,
      expandedFolders,
      isHydrated,
      isMutating,
      isSendingMessage,
      isUploadingAttachments,
      isChatGptConnectionPending,
      activeStreamingConversationId,
      activeStreamingConversationIds,
      errorMessage,
      clearError,
      refreshSnapshot,
      isConversationStreaming,
      setSelectedModel,
      setSelectedReasoningEffort,
      setSelectedSandboxMode,
      setSelectedLanguage,
      setSelectedBrowserConnectionMode,
      setAllowOpenAiApiKeyForCommands,
      refreshChatGptConnectionStatus,
      startChatGptConnection,
      cancelChatGptConnection,
      disconnectChatGptConnection,
      toggleFolder,
      createFolder,
      renameFolder,
      deleteFolder,
      renameConversation,
      setConversationAgentProfile,
      deleteConversation,
      moveConversation,
      createConversation,
      createAgent,
      updateAgent,
      deleteAgent,
      refreshAgents,
      uploadAttachments,
      sendMessage,
      stopMessage,
    }),
    [
      folders,
      conversations,
      conversationMessages,
      agents,
      codexModels,
      codexStatus,
      chatGptConnectionStatus,
      browserSessionStatus,
      selectedBrowserConnectionMode,
      selectedModel,
      selectedReasoningEffort,
      selectedSandboxMode,
      selectedLanguage,
      allowOpenAiApiKeyForCommands,
      expandedFolders,
      isHydrated,
      isMutating,
      isSendingMessage,
      isUploadingAttachments,
      isChatGptConnectionPending,
      activeStreamingConversationId,
      activeStreamingConversationIds,
      errorMessage,
      clearError,
      refreshSnapshot,
      isConversationStreaming,
      setSelectedModel,
      setSelectedReasoningEffort,
      setSelectedSandboxMode,
      setSelectedLanguage,
      setSelectedBrowserConnectionMode,
      setAllowOpenAiApiKeyForCommands,
      refreshChatGptConnectionStatus,
      startChatGptConnection,
      cancelChatGptConnection,
      disconnectChatGptConnection,
      toggleFolder,
      createFolder,
      renameFolder,
      deleteFolder,
      renameConversation,
      setConversationAgentProfile,
      deleteConversation,
      moveConversation,
      createConversation,
      createAgent,
      updateAgent,
      deleteAgent,
      refreshAgents,
      uploadAttachments,
      sendMessage,
      stopMessage,
    ],
  );

  return (
    <OpenCrabContext.Provider value={value}>
      {children}
    </OpenCrabContext.Provider>
  );
}

export function useOpenCrabApp() {
  const context = useContext(OpenCrabContext);

  if (!context) {
    throw new Error("useOpenCrabApp must be used within OpenCrabProvider");
  }

  return context;
}

function areFoldersEqual(current: FolderItem[], next: FolderItem[]) {
  return (
    current.length === next.length &&
    current.every(
      (folder, index) =>
        folder.id === next[index]?.id && folder.name === next[index]?.name,
    )
  );
}

function areConversationsEqual(
  current: ConversationItem[],
  next: ConversationItem[],
) {
  return (
    current.length === next.length &&
    current.every((conversation, index) => {
      const target = next[index];

      if (!target) {
        return false;
      }

      return (
        conversation.id === target.id &&
        conversation.title === target.title &&
        conversation.timeLabel === target.timeLabel &&
        conversation.preview === target.preview &&
        conversation.folderId === target.folderId &&
        conversation.hidden === target.hidden &&
        conversation.projectId === target.projectId &&
        conversation.source === target.source &&
        conversation.channelLabel === target.channelLabel &&
        conversation.remoteChatLabel === target.remoteChatLabel &&
        conversation.remoteUserLabel === target.remoteUserLabel &&
        conversation.codexThreadId === target.codexThreadId &&
        conversation.lastAssistantModel === target.lastAssistantModel &&
        conversation.agentProfileId === target.agentProfileId
      );
    })
  );
}

function areConversationMessageMapsEqual(
  current: Record<string, ConversationMessage[]>,
  next: Record<string, ConversationMessage[]>,
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((conversationId) =>
    areConversationMessagesEqual(current[conversationId] ?? [], next[conversationId] ?? []),
  );
}

function areConversationMessagesEqual(
  current: ConversationMessage[],
  next: ConversationMessage[],
) {
  return (
    current.length === next.length &&
    current.every((message, index) => {
      const target = next[index];

      if (!target) {
        return false;
      }

      return (
        message.id === target.id &&
        message.role === target.role &&
        message.actorLabel === target.actorLabel &&
        message.content === target.content &&
        message.timestamp === target.timestamp &&
        message.source === target.source &&
        message.remoteMessageId === target.remoteMessageId &&
        message.meta === target.meta &&
        message.status === target.status &&
        areStringListsEqual(message.usedAttachmentNames, target.usedAttachmentNames) &&
        areStringListsEqual(message.thinking, target.thinking) &&
        areAttachmentsEqual(message.attachments, target.attachments)
      );
    })
  );
}

function areStringListsEqual(current?: string[], next?: string[]) {
  if (!current && !next) {
    return true;
  }

  if (!current || !next || current.length !== next.length) {
    return false;
  }

  return current.every((value, index) => value === next[index]);
}

function areAttachmentsEqual(
  current?: ConversationMessage["attachments"],
  next?: ConversationMessage["attachments"],
) {
  if (!current && !next) {
    return true;
  }

  if (!current || !next || current.length !== next.length) {
    return false;
  }

  return current.every((attachment, index) => {
    const target = next[index];

    return (
      attachment.id === target?.id &&
      attachment.name === target.name &&
      attachment.kind === target.kind &&
      attachment.size === target.size &&
      attachment.mimeType === target.mimeType &&
      attachment.wasUsedInReply === target.wasUsedInReply
    );
  });
}
