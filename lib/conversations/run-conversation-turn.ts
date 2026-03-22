import { getAgentProfile } from "@/lib/agents/agent-store";
import { generateCodexReply, streamCodexReply } from "@/lib/codex/sdk";
import { formatMessageTime } from "@/lib/conversations/utils";
import { buildUserMessagePreview } from "@/lib/opencrab/messages";
import {
  addMessage,
  findConversation,
  updateConversation,
} from "@/lib/resources/local-store";
import {
  getUploadsByIds,
  registerOutputAttachmentsFromText,
} from "@/lib/resources/upload-store";
import type {
  CodexReasoningEffort,
  CodexSandboxMode,
} from "@/lib/resources/opencrab-api-types";
import type { ConversationSource } from "@/lib/seed-data";

export class ConversationTurnError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ConversationTurnError";
    this.statusCode = statusCode;
  }
}

type ConversationTurnInput = {
  conversationId: string;
  content?: string;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
  sandboxMode?: CodexSandboxMode;
  attachmentIds?: string[];
  userMessageId?: string;
  assistantMessageId?: string;
  userMessageSource?: ConversationSource | null;
  remoteUserMessageId?: string | null;
  onThreadReady?: (threadId: string | null) => void;
  onThinking?: (entries: string[]) => void;
  onAssistantText?: (text: string) => void;
};

type PreparedConversationTurn = {
  conversationId: string;
  conversation: NonNullable<ReturnType<typeof findConversation>>;
  content: string | undefined;
  attachments: ReturnType<typeof getUploadsByIds>;
  imagePaths: string[];
  textAttachments: Array<{ name: string; storedPath: string }>;
  userMessageId: string;
  assistantMessageId: string;
};

export function prepareConversationTurn(input: ConversationTurnInput): PreparedConversationTurn {
  const content = input.content?.trim();
  const attachmentIds = Array.isArray(input.attachmentIds) ? input.attachmentIds : [];
  const attachments = getUploadsByIds(attachmentIds);

  if (!content && attachments.length === 0) {
    throw new ConversationTurnError("缺少消息内容或附件。", 400);
  }

  const conversation = findConversation(input.conversationId);

  if (!conversation) {
    throw new ConversationTurnError("找不到对应对话。", 404);
  }

  const userMessageId = input.userMessageId || `message-${crypto.randomUUID()}`;
  const assistantMessageId = input.assistantMessageId || `message-${crypto.randomUUID()}`;

  addMessage(input.conversationId, {
    id: userMessageId,
    role: "user",
    content: buildUserMessagePreview(content, attachments.map((attachment) => attachment.name)),
    source: input.userMessageSource ?? "local",
    remoteMessageId: input.remoteUserMessageId ?? null,
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      size: attachment.size,
      mimeType: attachment.mimeType,
      wasUsedInReply: true,
    })),
    meta: formatMessageTime(new Date()),
    status: "done",
  });

  return {
    conversationId: input.conversationId,
    conversation,
    content: buildCodexInputContent(content, attachments.map((attachment) => ({
      name: attachment.name,
      kind: attachment.kind,
    }))),
    attachments,
    imagePaths: attachments
      .filter((attachment) => attachment.kind === "image")
      .map((attachment) => attachment.storedPath),
    textAttachments: attachments
      .filter((attachment) => attachment.kind === "text")
      .map((attachment) => ({
        name: attachment.name,
        storedPath: attachment.promptPath || attachment.storedPath,
      })),
    userMessageId,
    assistantMessageId,
  };
}

export function finalizeConversationTurn(
  prepared: PreparedConversationTurn,
  result: {
    text: string;
    model: string;
    threadId: string | null;
    usage: {
      input_tokens: number;
      cached_input_tokens: number;
      output_tokens: number;
    } | null;
    thinking?: string[];
  },
) {
  updateConversation(prepared.conversationId, {
    codexThreadId: result.threadId,
    lastAssistantModel: result.model,
  });

  const outputAttachments = registerOutputAttachmentsFromText(result.text);

  const assistantMessageResult = addMessage(prepared.conversationId, {
    id: prepared.assistantMessageId,
    role: "assistant",
    content: result.text,
    attachments: outputAttachments.map((attachment) => ({
      ...attachment,
      wasUsedInReply: false,
    })),
    thinking: result.thinking,
    usedAttachmentNames: prepared.attachments.map((attachment) => attachment.name),
    meta:
      prepared.attachments.length > 0
        ? `生成完成 · ${result.model} · 已使用 ${prepared.attachments.length} 个附件`
        : `生成完成 · ${result.model}`,
    status: "done",
  });

  return assistantMessageResult;
}

export async function runConversationTurn(input: ConversationTurnInput) {
  const shouldStreamInternally =
    typeof input.onThreadReady === "function" ||
    typeof input.onThinking === "function" ||
    typeof input.onAssistantText === "function";

  if (shouldStreamInternally) {
    const prepared = prepareConversationTurn(input);
    let latestText = "";
    let latestThinking: string[] = [];
    let latestThreadId = prepared.conversation.codexThreadId ?? null;
    let latestModel = input.model ?? prepared.conversation.lastAssistantModel ?? "OpenCrab";
    let latestUsage: {
      input_tokens: number;
      cached_input_tokens: number;
      output_tokens: number;
    } | null = null;

    for await (const event of streamCodexReply({
      conversationTitle: prepared.conversation.title,
      threadId: prepared.conversation.codexThreadId,
      content: prepared.content,
      agentProfile: prepared.conversation.agentProfileId
        ? getAgentProfile(prepared.conversation.agentProfileId)
        : null,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      sandboxMode: input.sandboxMode,
      imagePaths: prepared.imagePaths,
      textAttachments: prepared.textAttachments,
    })) {
      if (event.type === "thread") {
        latestThreadId = event.threadId;
        updateConversation(prepared.conversationId, {
          codexThreadId: event.threadId,
        });
        input.onThreadReady?.(event.threadId);
        continue;
      }

      if (event.type === "thinking") {
        latestThinking = event.entries;
        input.onThinking?.(event.entries);
        continue;
      }

      if (event.type === "assistant") {
        latestText = event.text;
        input.onAssistantText?.(event.text);
        continue;
      }

      latestText = event.text;
      latestThinking = event.thinking;
      latestThreadId = event.threadId;
      latestModel = event.model;
      latestUsage = event.usage;
    }

    const assistantMessageResult = finalizeConversationTurn(prepared, {
      text: latestText,
      model: latestModel,
      threadId: latestThreadId,
      usage: latestUsage,
      thinking: latestThinking,
    });

    return {
      snapshot: assistantMessageResult.snapshot,
      assistant: {
        text: latestText,
        attachments: assistantMessageResult.message.attachments ?? [],
        model: latestModel,
        threadId: latestThreadId,
        usage: latestUsage,
        thinking: latestThinking,
      },
    };
  }

  const prepared = prepareConversationTurn(input);
  const reply = await generateCodexReply({
    conversationTitle: prepared.conversation.title,
    threadId: prepared.conversation.codexThreadId,
    content: prepared.content,
    agentProfile: prepared.conversation.agentProfileId
      ? getAgentProfile(prepared.conversation.agentProfileId)
      : null,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    sandboxMode: input.sandboxMode,
    imagePaths: prepared.imagePaths,
    textAttachments: prepared.textAttachments,
    onThreadReady: (threadId) => {
      updateConversation(prepared.conversationId, {
        codexThreadId: threadId,
      });
      input.onThreadReady?.(threadId);
    },
  });
  const assistantMessageResult = finalizeConversationTurn(prepared, reply);

  return {
    snapshot: assistantMessageResult.snapshot,
    assistant: {
      text: reply.text,
      attachments: assistantMessageResult.message.attachments ?? [],
      model: reply.model,
      threadId: reply.threadId,
      usage: reply.usage,
      thinking: [] as string[],
    },
  };
}

function buildCodexInputContent(
  content: string | undefined,
  attachments: Array<{ name: string; kind: "image" | "text" | "file" }>,
) {
  const fileNames = attachments
    .filter((attachment) => attachment.kind === "file")
    .map((attachment) => attachment.name);

  if (fileNames.length === 0) {
    return content;
  }

  if (!content) {
    return `用户上传了这些文件：${fileNames.join("、")}。如果无法直接读取文件内容，请明确说明并引导用户补充说明。`;
  }

  return `${content}\n\n用户另外上传了这些文件：${fileNames.join("、")}。如果无法直接读取文件内容，请明确说明。`;
}
