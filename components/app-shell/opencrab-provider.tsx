"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { flushSync } from "react-dom";
import type {
  AppLanguage,
  ConversationItem,
  ConversationMessage,
  FolderItem,
} from "@/lib/seed-data";
import {
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
  updateAgent as updateAgentResource,
  updateConversation,
  updateFolder as updateFolderResource,
  warmCodexBrowserSession as warmCodexBrowserSessionResource,
} from "@/lib/resources/opencrab-api";
import { useOpenCrabSettingsController } from "@/components/app-shell/use-opencrab-settings-controller";
import {
  getUserFacingError,
} from "@/lib/opencrab/messages";
import {
  type SendMessageInput,
  useOpenCrabMessageController,
} from "@/components/app-shell/use-opencrab-message-controller";
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
  selectedUserDisplayName: string;
  selectedUserAvatarDataUrl: string | null;
  thinkingModeEnabled: boolean;
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
  setSelectedUserDisplayName: (name: string) => Promise<void>;
  setSelectedUserAvatarDataUrl: (avatarDataUrl: string | null) => Promise<void>;
  setThinkingModeEnabled: (enabled: boolean) => Promise<void>;
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
  setConversationWorkspaceDir: (
    conversationId: string,
    workspaceDir: string | null,
  ) => Promise<void>;
  setConversationSandboxMode: (
    conversationId: string,
    sandboxMode: CodexSandboxMode | null,
  ) => Promise<void>;
  createConversation: (input?: {
    title?: string;
    folderId?: string | null;
    workspaceDir?: string | null;
    sandboxMode?: CodexSandboxMode | null;
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
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isChatGptConnectionPending, setIsChatGptConnectionPending] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const {
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
  } = useOpenCrabSettingsController({
    codexModels,
    applySnapshot,
    onCodexStatusChange: setCodexStatus,
    onChatGptConnectionStatusChange: setChatGptConnectionStatus,
    onBrowserSessionStatusChange: setBrowserSessionStatus,
    onError: setErrorMessage,
    onChatGptPendingChange: setIsChatGptConnectionPending,
  });

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
        hydrateFromSnapshot(snapshot);
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
        reconcileModelSelection(codexOptions.models, codexOptions.defaultModel);

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
  }, [applySnapshot, hydrateFromSnapshot, reconcileModelSelection]);

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
    hydrateFromSnapshot(snapshot);
  }, [applySnapshot, hydrateFromSnapshot]);

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

  const setConversationWorkspaceDir = useCallback(
    async (conversationId: string, workspaceDir: string | null) => {
      await runMutation(async () => {
        const result = await updateConversation(conversationId, { workspaceDir });
        applySnapshot(result.snapshot);
      });
    },
    [applySnapshot, runMutation],
  );

  const setConversationSandboxMode = useCallback(
    async (conversationId: string, sandboxMode: CodexSandboxMode | null) => {
      await runMutation(async () => {
        const result = await updateConversation(conversationId, { sandboxMode });
        applySnapshot(result.snapshot);
      });
    },
    [applySnapshot, runMutation],
  );

  const createConversation = useCallback(
    async (input?: {
      title?: string;
      folderId?: string | null;
      workspaceDir?: string | null;
      sandboxMode?: CodexSandboxMode | null;
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

  const {
    activeStreamingConversationId,
    activeStreamingConversationIds,
    isConversationStreaming,
    isSendingMessage,
    isUploadingAttachments,
    sendMessage,
    stopMessage,
    uploadAttachments,
  } = useOpenCrabMessageController({
    conversations,
    selectedModel,
    selectedReasoningEffort,
    createConversation,
    applySnapshot,
    patchConversation,
    appendMessages,
    patchMessage,
    onError: setErrorMessage,
  });

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
        isSendingMessage
      ) {
        return;
      }

      try {
        const snapshot = await getAppSnapshot();

        if (active) {
          applySnapshot(snapshot);
          hydrateFromSnapshot(snapshot);
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
  }, [applySnapshot, hydrateFromSnapshot, isHydrated, isSendingMessage, pathname]);

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
      selectedUserDisplayName,
      selectedUserAvatarDataUrl,
      thinkingModeEnabled,
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
      setSelectedUserDisplayName,
      setSelectedUserAvatarDataUrl,
      setThinkingModeEnabled,
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
      setConversationWorkspaceDir,
      setConversationSandboxMode,
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
      selectedUserDisplayName,
      selectedUserAvatarDataUrl,
      thinkingModeEnabled,
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
      setSelectedUserDisplayName,
      setSelectedUserAvatarDataUrl,
      setThinkingModeEnabled,
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
      setConversationWorkspaceDir,
      setConversationSandboxMode,
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
        conversation.workspaceDir === target.workspaceDir &&
        conversation.sandboxMode === target.sandboxMode &&
        conversation.hidden === target.hidden &&
        conversation.projectId === target.projectId &&
        conversation.source === target.source &&
        conversation.channelLabel === target.channelLabel &&
        conversation.remoteChatLabel === target.remoteChatLabel &&
        conversation.remoteUserLabel === target.remoteUserLabel &&
        conversation.codexThreadId === target.codexThreadId &&
        conversation.lastAssistantModel === target.lastAssistantModel &&
        conversation.agentProfileId === target.agentProfileId &&
        conversation.lastActivityAt === target.lastActivityAt
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
