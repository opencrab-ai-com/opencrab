"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ConversationItem, ConversationMessage, FolderItem } from "@/lib/mock-data";
import { buildConversationTitle } from "@/lib/conversations/utils";
import {
  createConversation as createConversationResource,
  createFolder as createFolderResource,
  deleteConversation as deleteConversationResource,
  deleteFolder as deleteFolderResource,
  getAppSnapshot,
  getCodexBrowserSessionStatus as getCodexBrowserSessionStatusResource,
  getCodexOptions as getCodexOptionsResource,
  getCodexStatus as getCodexStatusResource,
  streamReplyToConversation,
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
import type {
  AppSnapshot,
  BrowserConnectionMode,
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
  codexModels: CodexModelOption[];
  codexStatus: CodexStatusResponse | null;
  browserSessionStatus: CodexBrowserSessionStatus | null;
  selectedBrowserConnectionMode: BrowserConnectionMode;
  selectedModel: string;
  selectedReasoningEffort: CodexReasoningEffort;
  selectedSandboxMode: CodexSandboxMode;
  expandedFolders: Record<string, boolean>;
  isHydrated: boolean;
  isMutating: boolean;
  isSendingMessage: boolean;
  isUploadingAttachments: boolean;
  activeStreamingConversationId: string | null;
  activeStreamingConversationIds: string[];
  errorMessage: string | null;
  clearError: () => void;
  isConversationStreaming: (conversationId?: string | null) => boolean;
  setSelectedModel: (model: string) => Promise<void>;
  setSelectedReasoningEffort: (effort: CodexReasoningEffort) => Promise<void>;
  setSelectedSandboxMode: (mode: CodexSandboxMode) => Promise<void>;
  setSelectedBrowserConnectionMode: (mode: BrowserConnectionMode) => Promise<void>;
  toggleFolder: (folderId: string) => void;
  createFolder: (name: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  moveConversation: (conversationId: string, folderId: string | null) => Promise<void>;
  createConversation: (input?: { title?: string; folderId?: string | null }) => Promise<string>;
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

export function OpenCrabProvider({ children }: OpenCrabProviderProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationMessages, setConversationMessages] = useState<
    Record<string, ConversationMessage[]>
  >({});
  const [codexModels, setCodexModels] = useState<CodexModelOption[]>([]);
  const [codexStatus, setCodexStatus] = useState<CodexStatusResponse | null>(null);
  const [browserSessionStatus, setBrowserSessionStatus] =
    useState<CodexBrowserSessionStatus | null>(null);
  const [selectedBrowserConnectionMode, setSelectedBrowserConnectionModeState] =
    useState<BrowserConnectionMode>("current-browser");
  const [selectedModel, setSelectedModelState] = useState("");
  const [selectedReasoningEffort, setSelectedReasoningEffortState] =
    useState<CodexReasoningEffort>("medium");
  const [selectedSandboxMode, setSelectedSandboxModeState] =
    useState<CodexSandboxMode>("workspace-write");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [activeStreamingConversationId, setActiveStreamingConversationId] = useState<string | null>(
    null,
  );
  const [activeStreamingConversationIds, setActiveStreamingConversationIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeStreamsRef = useRef<Map<string, ActiveStreamState>>(new Map());

  const applySnapshot = useCallback((snapshot: AppSnapshot) => {
    setFolders(snapshot.folders);
    setConversations(snapshot.conversations);
    setConversationMessages(snapshot.conversationMessages);
    setExpandedFolders((current) => {
      const next = { ...current };

      snapshot.folders.forEach((folder) => {
        if (typeof next[folder.id] !== "boolean") {
          next[folder.id] = true;
        }
      });

      Object.keys(next).forEach((folderId) => {
        if (!snapshot.folders.some((folder) => folder.id === folderId)) {
          delete next[folderId];
        }
      });

      return next;
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

        return [updated, ...current.filter((item) => item.id !== conversationId)];
      });
    },
    [],
  );

  const appendMessages = useCallback((conversationId: string, nextMessages: ConversationMessage[]) => {
    setConversationMessages((current) => ({
      ...current,
      [conversationId]: [...(current[conversationId] ?? []), ...nextMessages],
    }));
  }, []);

  const patchMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      updater: Partial<ConversationMessage> | ((message: ConversationMessage) => ConversationMessage),
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
        setSelectedReasoningEffortState(snapshot.settings.defaultReasoningEffort || "medium");
        setSelectedSandboxModeState(snapshot.settings.defaultSandboxMode || "workspace-write");
        setSelectedBrowserConnectionModeState(snapshot.settings.browserConnectionMode || "current-browser");
      } catch (error) {
        if (active) {
          setErrorMessage(getUserFacingError(error, "初始化失败，请刷新后重试。"));
        }
      } finally {
        if (active) {
          setIsHydrated(true);
        }
      }
    }

    async function hydrateCodexMeta() {
      try {
        const [codexOptions, status, browserStatus] = await Promise.all([
          getCodexOptionsResource(),
          getCodexStatusResource(),
          getCodexBrowserSessionStatusResource(),
        ]);

        if (!active) {
          return;
        }

        setCodexModels(codexOptions.models);
        setCodexStatus(status);
        setBrowserSessionStatus(browserStatus);
        setSelectedModelState((current) => {
          const resolvedModelId = current || codexOptions.defaultModel;

          setSelectedReasoningEffortState((effort) => {
            const resolvedModel =
              codexOptions.models.find((item) => item.id === resolvedModelId) || codexOptions.models[0];

            if (!resolvedModel) {
              return effort;
            }

            return resolvedModel.reasoningOptions.some((item) => item.effort === effort)
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
            error: getUserFacingError(error, "当前无法读取 Codex 状态。"),
            loginStatus: "missing",
            loginMethod: "chatgpt",
          });
        }
      }
    }

    void hydrateSnapshot();
    void hydrateCodexMeta();

    return () => {
      active = false;
    };
  }, [applySnapshot]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((current) => ({ ...current, [folderId]: !current[folderId] }));
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

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
        const result = await updateSettingsResource({
          defaultModel: model,
          defaultReasoningEffort: nextReasoningEffort,
        });
        applySnapshot(result.snapshot);
      } catch (error) {
        setErrorMessage(getUserFacingError(error, "保存设置失败，请稍后再试。"));
      }
    },
    [applySnapshot, codexModels, selectedReasoningEffort],
  );

  const setSelectedReasoningEffort = useCallback(
    async (effort: CodexReasoningEffort) => {
      setSelectedReasoningEffortState(effort);

      try {
        const result = await updateSettingsResource({
          defaultModel: selectedModel,
          defaultReasoningEffort: effort,
        });
        applySnapshot(result.snapshot);
      } catch (error) {
        setErrorMessage(getUserFacingError(error, "保存设置失败，请稍后再试。"));
      }
    },
    [applySnapshot, selectedModel],
  );

  const setSelectedSandboxMode = useCallback(
    async (mode: CodexSandboxMode) => {
      setSelectedSandboxModeState(mode);

      try {
        const result = await updateSettingsResource({
          defaultModel: selectedModel,
          defaultReasoningEffort: selectedReasoningEffort,
          defaultSandboxMode: mode,
        });
        applySnapshot(result.snapshot);
      } catch (error) {
        setErrorMessage(getUserFacingError(error, "保存设置失败，请稍后再试。"));
      }
    },
    [applySnapshot, selectedModel, selectedReasoningEffort],
  );

  const setSelectedBrowserConnectionMode = useCallback(
    async (mode: BrowserConnectionMode) => {
      setSelectedBrowserConnectionModeState(mode);

      try {
        const result = await updateSettingsResource({
          defaultModel: selectedModel,
          defaultReasoningEffort: selectedReasoningEffort,
          defaultSandboxMode: selectedSandboxMode,
          browserConnectionMode: mode,
        });
        applySnapshot(result.snapshot);
        const nextStatus = await warmCodexBrowserSessionResource();
        setBrowserSessionStatus(nextStatus);
      } catch (error) {
        setErrorMessage(getUserFacingError(error, "保存设置失败，请稍后再试。"));
      }
    },
    [applySnapshot, selectedModel, selectedReasoningEffort, selectedSandboxMode],
  );

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
        const result = await updateConversation(conversationId, { title: trimmedTitle });
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
    async (input?: { title?: string; folderId?: string | null }) => {
      return runMutation(async () => {
        const result = await createConversationResource(input);
        applySnapshot(result.snapshot);
        return result.conversationId;
      });
    },
    [applySnapshot, runMutation],
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
        ? Array.from(activeStreamsRef.current.values()).find((item) => item.conversationId === conversationId)
        : Array.from(activeStreamsRef.current.values())[0];

      if (!activeStream) {
        return;
      }

      activeStream.controller.abort();
      patchMessage(activeStream.conversationId, activeStream.assistantMessageId, (message) => ({
        ...message,
        content: message.content.trim() || "已停止当前回复。",
        meta: `已停止 · ${activeStream.model}`,
        status: "stopped",
      }));
      clearStreamState(activeStream.key);
    },
    [clearStreamState, patchMessage],
  );

  const isConversationStreaming = useCallback((conversationId?: string | null) => {
    if (!conversationId) {
      return false;
    }

    return Array.from(activeStreamsRef.current.values()).some((item) => item.conversationId === conversationId);
  }, []);

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

        if (!conversationId || !conversations.some((item) => item.id === conversationId)) {
          const titleSource = content || attachments[0]?.name || "带附件的新对话";
          conversationId = await createConversation({ title: buildConversationTitle(titleSource) });
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
              setErrorMessage(getUserFacingError(event.error, "消息发送失败，请稍后再试。"));
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
          setErrorMessage(getUserFacingError(error, "消息发送失败，请稍后再试。"));
          clearStreamState(streamKey);
        });

        return conversationId;
      } catch (error) {
        setErrorMessage(getUserFacingError(error, "消息发送失败，请稍后再试。"));
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
      codexModels,
      codexStatus,
      browserSessionStatus,
      selectedBrowserConnectionMode,
      selectedModel,
      selectedReasoningEffort,
      selectedSandboxMode,
      expandedFolders,
      isHydrated,
      isMutating,
      isSendingMessage,
      isUploadingAttachments,
      activeStreamingConversationId,
      activeStreamingConversationIds,
      errorMessage,
      clearError,
      isConversationStreaming,
      setSelectedModel,
      setSelectedReasoningEffort,
      setSelectedSandboxMode,
      setSelectedBrowserConnectionMode,
      toggleFolder,
      createFolder,
      renameFolder,
      deleteFolder,
      renameConversation,
      deleteConversation,
      moveConversation,
      createConversation,
      uploadAttachments,
      sendMessage,
      stopMessage,
    }),
    [
      folders,
      conversations,
      conversationMessages,
      codexModels,
      codexStatus,
      browserSessionStatus,
      selectedBrowserConnectionMode,
      selectedModel,
      selectedReasoningEffort,
      selectedSandboxMode,
      expandedFolders,
      isHydrated,
      isMutating,
      isSendingMessage,
      isUploadingAttachments,
      activeStreamingConversationId,
      activeStreamingConversationIds,
      errorMessage,
      clearError,
      isConversationStreaming,
      setSelectedModel,
      setSelectedReasoningEffort,
      setSelectedSandboxMode,
      setSelectedBrowserConnectionMode,
      toggleFolder,
      createFolder,
      renameFolder,
      deleteFolder,
      renameConversation,
      deleteConversation,
      moveConversation,
      createConversation,
      uploadAttachments,
      sendMessage,
      stopMessage,
    ],
  );

  return <OpenCrabContext.Provider value={value}>{children}</OpenCrabContext.Provider>;
}

export function useOpenCrabApp() {
  const context = useContext(OpenCrabContext);

  if (!context) {
    throw new Error("useOpenCrabApp must be used within OpenCrabProvider");
  }

  return context;
}
