"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ConversationItem, ConversationMessage, FolderItem } from "@/lib/mock-data";
import { buildConversationTitle } from "@/lib/conversations/utils";
import {
  createConversation as createConversationResource,
  createFolder as createFolderResource,
  deleteConversation as deleteConversationResource,
  deleteFolder as deleteFolderResource,
  getCodexOptions as getCodexOptionsResource,
  getAppSnapshot,
  replyToConversation,
  updateSettings as updateSettingsResource,
  uploadAttachments as uploadAttachmentsResource,
  updateFolder as updateFolderResource,
  updateConversation,
} from "@/lib/resources/opencrab-api";
import type {
  AppSnapshot,
  CodexModelOption,
  CodexReasoningEffort,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";

type OpenCrabContextValue = {
  folders: FolderItem[];
  conversations: ConversationItem[];
  conversationMessages: Record<string, ConversationMessage[]>;
  codexModels: CodexModelOption[];
  selectedModel: string;
  selectedReasoningEffort: CodexReasoningEffort;
  expandedFolders: Record<string, boolean>;
  isHydrated: boolean;
  isMutating: boolean;
  isSendingMessage: boolean;
  isUploadingAttachments: boolean;
  errorMessage: string | null;
  clearError: () => void;
  setSelectedModel: (model: string) => Promise<void>;
  setSelectedReasoningEffort: (effort: CodexReasoningEffort) => Promise<void>;
  toggleFolder: (folderId: string) => void;
  createFolder: (name: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  moveConversation: (conversationId: string, folderId: string | null) => Promise<void>;
  createConversation: (input?: { title?: string; folderId?: string | null }) => Promise<string>;
  uploadAttachments: (files: File[]) => Promise<UploadedAttachment[]>;
  sendMessage: (input: {
    conversationId?: string;
    content?: string;
    attachmentIds?: string[];
  }) => Promise<string | null>;
};

const OpenCrabContext = createContext<OpenCrabContextValue | null>(null);

type OpenCrabProviderProps = {
  children: React.ReactNode;
};

export function OpenCrabProvider({ children }: OpenCrabProviderProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationMessages, setConversationMessages] = useState<
    Record<string, ConversationMessage[]>
  >({});
  const [codexModels, setCodexModels] = useState<CodexModelOption[]>([]);
  const [selectedModel, setSelectedModelState] = useState("");
  const [selectedReasoningEffort, setSelectedReasoningEffortState] =
    useState<CodexReasoningEffort>("medium");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const [snapshot, codexOptions] = await Promise.all([
          getAppSnapshot(),
          getCodexOptionsResource(),
        ]);

        if (!active) {
          return;
        }

        applySnapshot(snapshot);
        setCodexModels(codexOptions.models);
        const nextModel = snapshot.settings.defaultModel || codexOptions.defaultModel;
        setSelectedModelState(nextModel);
        const defaultModelOption =
          codexOptions.models.find((item) => item.id === nextModel) ||
          codexOptions.models[0];

        if (defaultModelOption) {
          setSelectedReasoningEffortState(
            defaultModelOption.reasoningOptions.some(
              (item) => item.effort === snapshot.settings.defaultReasoningEffort,
            )
              ? snapshot.settings.defaultReasoningEffort
              : defaultModelOption.defaultReasoningEffort,
          );
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "初始化失败，请刷新后重试。");
        }
      } finally {
        if (active) {
          setIsHydrated(true);
        }
      }
    }

    void hydrate();

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
        setErrorMessage(error instanceof Error ? error.message : "保存设置失败，请稍后再试。");
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
        setErrorMessage(error instanceof Error ? error.message : "保存设置失败，请稍后再试。");
      }
    },
    [applySnapshot, selectedModel],
  );

  const runMutation = useCallback(async <T,>(action: () => Promise<T>) => {
    setIsMutating(true);
    setErrorMessage(null);

    try {
      return await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "操作失败，请稍后再试。");
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
      setErrorMessage(error instanceof Error ? error.message : "上传附件失败，请稍后再试。");
      return [];
    } finally {
      setIsUploadingAttachments(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (input: { conversationId?: string; content?: string; attachmentIds?: string[] }) => {
      const content = input.content?.trim() || "";
      const attachmentIds = input.attachmentIds || [];

      if (!content && attachmentIds.length === 0) {
        return null;
      }

      setIsSendingMessage(true);
      setErrorMessage(null);

      try {
        let conversationId = input.conversationId;

        if (!conversationId || !conversations.some((item) => item.id === conversationId)) {
          const titleSource = content || "带附件的新对话";
          conversationId = await createConversation({ title: buildConversationTitle(titleSource) });
        }

        const result = await replyToConversation(conversationId, {
          content: content || undefined,
          attachmentIds,
          model: selectedModel,
          reasoningEffort: selectedReasoningEffort,
        });
        applySnapshot(result.snapshot);

        return conversationId;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "消息发送失败，请稍后再试。");
        return null;
      } finally {
        setIsSendingMessage(false);
      }
    },
    [applySnapshot, conversations, createConversation, selectedModel, selectedReasoningEffort],
  );

  const value = useMemo<OpenCrabContextValue>(
    () => ({
      folders,
      conversations,
      conversationMessages,
      codexModels,
      selectedModel,
      selectedReasoningEffort,
      expandedFolders,
      isHydrated,
      isMutating,
      isSendingMessage,
      isUploadingAttachments,
      errorMessage,
      clearError,
      setSelectedModel,
      setSelectedReasoningEffort,
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
    }),
    [
      folders,
      conversations,
      conversationMessages,
      codexModels,
      selectedModel,
      selectedReasoningEffort,
      expandedFolders,
      isHydrated,
      isMutating,
      isSendingMessage,
      isUploadingAttachments,
      errorMessage,
      clearError,
      setSelectedModel,
      setSelectedReasoningEffort,
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
