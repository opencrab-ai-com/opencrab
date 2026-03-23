import { runConversationTurn } from "@/lib/conversations/run-conversation-turn";

export type ConversationTurnExecutor = typeof runConversationTurn;

type ConversationTurnServiceDependencies = {
  executeTurn?: ConversationTurnExecutor;
};

export function createConversationTurnService(
  dependencies: ConversationTurnServiceDependencies = {},
) {
  const executeTurn = dependencies.executeTurn ?? runConversationTurn;

  return {
    reply: executeTurn,
  };
}

export const conversationTurnService = createConversationTurnService();
