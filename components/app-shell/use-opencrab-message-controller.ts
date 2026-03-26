"use client";

import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { buildConversationTitle } from "@/lib/conversations/utils";
import {
  replyToProjectConversation as replyToProjectConversationResource,
  streamReplyToConversation,
  uploadAttachments as uploadAttachmentsResource,
} from "@/lib/resources/opencrab-api";
import {
  buildUserMessagePreview,
  formatClientMessageTime,
  getUserFacingError,
} from "@/lib/opencrab/messages";
import type {
  AppSnapshot,
  CodexReasoningEffort,
  CodexSandboxMode,
  UploadedAttachment,
} from "@/lib/resources/opencrab-api-types";
import type { ConversationItem, ConversationMessage } from "@/lib/seed-data";

export type SendMessageInput = {
  conversationId?: string;
  content?: string;
  attachments?: UploadedAttachment[];
  workspaceDir?: string | null;
  sandboxMode?: CodexSandboxMode | null;
};

type ActiveStreamState = {
  key: string;
  conversationId: string;
  assistantMessageId: string;
  controller: AbortController;
  model: string;
};

type CreateConversationInput = {
  title?: string;
  folderId?: string | null;
  workspaceDir?: string | null;
  sandboxMode?: CodexSandboxMode | null;
  agentProfileId?: string | null;
};

type UseOpenCrabMessageControllerInput = {
  conversations: ConversationItem[];
  selectedModel: string;
  selectedReasoningEffort: CodexReasoningEffort;
  createConversation: (input?: CreateConversationInput) => Promise<string>;
  applySnapshot: (snapshot: AppSnapshot) => void;
  patchConversation: (
    conversationId: string,
    patch: Partial<ConversationItem>,
  ) => void;
  appendMessages: (
    conversationId: string,
    nextMessages: ConversationMessage[],
  ) => void;
  patchMessage: (
    conversationId: string,
    messageId: string,
    updater:
      | Partial<ConversationMessage>
      | ((message: ConversationMessage) => ConversationMessage),
  ) => void;
  onError: (message: string | null) => void;
};

export function useOpenCrabMessageController(
  input: UseOpenCrabMessageControllerInput,
) {
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [activeStreamingConversationId, setActiveStreamingConversationId] =
    useState<string | null>(null);
  const [activeStreamingConversationIds, setActiveStreamingConversationIds] =
    useState<string[]>([]);
  const activeStreamsRef = useRef<Map<string, ActiveStreamState>>(new Map());

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

  const hasActiveWork = useCallback(() => {
    return isSendingMessage || activeStreamsRef.current.size > 0;
  }, [isSendingMessage]);

  const uploadAttachments = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return [];
    }

    setIsUploadingAttachments(true);
    input.onError(null);

    try {
      const result = await uploadAttachmentsResource(files);
      return result.attachments;
    } catch (error) {
      input.onError(getUserFacingError(error, "上传附件失败，请稍后再试。"));
      return [];
    } finally {
      setIsUploadingAttachments(false);
    }
  }, [input]);

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
      input.patchMessage(
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
    [clearStreamState, input],
  );

  const isConversationStreaming = useCallback((conversationId?: string | null) => {
    if (!conversationId) {
      return false;
    }

    return Array.from(activeStreamsRef.current.values()).some(
      (item) => item.conversationId === conversationId,
    );
  }, []);

  const sendMessage = useCallback(
    async (messageInput: SendMessageInput) => {
      const content = messageInput.content?.trim() || "";
      const attachments = messageInput.attachments || [];

      if (!content && attachments.length === 0) {
        return null;
      }

      input.onError(null);

      try {
        let conversationId = messageInput.conversationId;
        let createdConversation = false;

        if (
          !conversationId ||
          !input.conversations.some((item) => item.id === conversationId)
        ) {
          const titleSource =
            content || attachments[0]?.name || "带附件的新对话";
          conversationId = await input.createConversation({
            title: buildConversationTitle(titleSource),
            workspaceDir: messageInput.workspaceDir ?? null,
            sandboxMode: messageInput.sandboxMode ?? null,
          });
          createdConversation = true;
        }

        const targetConversation =
          input.conversations.find((item) => item.id === conversationId) ?? null;

        if (targetConversation?.projectId) {
          const userMessageId = `message-${crypto.randomUUID()}`;
          const assistantMessageId = `message-${crypto.randomUUID()}`;
          const preview = buildUserMessagePreview(
            content,
            attachments.map((attachment) => attachment.name),
          );

          input.patchConversation(conversationId, {
            preview,
            timeLabel: "刚刚",
          });
          input.appendMessages(conversationId, [
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
            const result = await replyToProjectConversationResource(
              targetConversation.projectId,
              {
                conversationId,
                content,
              },
            );
            input.applySnapshot(result.snapshot);
            return conversationId;
          } catch (error) {
            input.patchMessage(conversationId, assistantMessageId, {
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
          model: input.selectedModel,
        });
        syncStreamingState();

        const preview = buildUserMessagePreview(
          content,
          attachments.map((attachment) => attachment.name),
        );
        const applyOptimisticMessageState = () => {
          input.patchConversation(conversationId, {
            preview,
            timeLabel: "刚刚",
          });
          input.appendMessages(conversationId, [
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
              meta: `OpenCrab 正在回复中... · ${input.selectedModel}`,
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
            model: input.selectedModel,
            reasoningEffort: input.selectedReasoningEffort,
            userMessageId,
            assistantMessageId,
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === "thread") {
                input.patchConversation(conversationId, {
                  codexThreadId: event.threadId,
                });
                return;
              }

              if (event.type === "thinking") {
                input.patchMessage(conversationId, assistantMessageId, {
                  thinking: event.entries,
                });
                return;
              }

              if (event.type === "assistant") {
                input.patchMessage(conversationId, assistantMessageId, {
                  content: event.text,
                  meta: `OpenCrab 正在回复中... · ${input.selectedModel}`,
                  status: "pending",
                });
                return;
              }

              if (event.type === "done") {
                input.applySnapshot(event.snapshot);
                clearStreamState(streamKey);
                return;
              }

              input.patchMessage(
                conversationId,
                assistantMessageId,
                (message) => ({
                  ...message,
                  content: message.content.trim() || "这次回复失败了，请重试。",
                  meta: `回复失败 · ${input.selectedModel}`,
                  status: "stopped",
                }),
              );
              input.onError(
                getUserFacingError(event.error, "消息发送失败，请稍后再试。"),
              );
              clearStreamState(streamKey);
            },
          },
        ).catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          input.patchMessage(conversationId, assistantMessageId, (message) => ({
            ...message,
            content: message.content.trim() || "这次回复失败了，请重试。",
            meta: `回复失败 · ${input.selectedModel}`,
            status: "stopped",
          }));
          input.onError(
            getUserFacingError(error, "消息发送失败，请稍后再试。"),
          );
          clearStreamState(streamKey);
        });

        return conversationId;
      } catch (error) {
        input.onError(getUserFacingError(error, "消息发送失败，请稍后再试。"));
        setIsSendingMessage(false);
        setActiveStreamingConversationId(null);
        activeStreamsRef.current.clear();
        syncStreamingState();
        return null;
      }
    },
    [clearStreamState, input, syncStreamingState],
  );

  return {
    activeStreamingConversationId,
    activeStreamingConversationIds,
    hasActiveWork,
    isConversationStreaming,
    isSendingMessage,
    isUploadingAttachments,
    sendMessage,
    stopMessage,
    uploadAttachments,
  };
}
