import { runConversationTurn } from "@/lib/conversations/run-conversation-turn";
import { syncBoundConversationHistory } from "@/lib/channels/bound-conversation-sync";

export type ConversationTurnExecutor = typeof runConversationTurn;

type ConversationTurnServiceDependencies = {
  executeTurn?: ConversationTurnExecutor;
};

export function createConversationTurnService(
  dependencies: ConversationTurnServiceDependencies = {},
) {
  const executeTurn = dependencies.executeTurn ?? runConversationTurn;

  return {
    async reply(input: Parameters<ConversationTurnExecutor>[0]) {
      const result = await executeTurn(input);
      const syncResult = await syncBoundConversationHistory(input.conversationId);

      return {
        ...result,
        snapshot: syncResult.snapshot,
      };
    },
  };
}

export const conversationTurnService = createConversationTurnService();
