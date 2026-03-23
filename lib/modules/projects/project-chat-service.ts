import { replyToProjectConversation } from "@/lib/projects/project-store";

export type ProjectChatExecutor = typeof replyToProjectConversation;

type ProjectChatServiceDependencies = {
  reply?: ProjectChatExecutor;
};

export function createProjectChatService(
  dependencies: ProjectChatServiceDependencies = {},
) {
  const reply = dependencies.reply ?? replyToProjectConversation;

  return {
    reply,
  };
}

export const projectChatService = createProjectChatService();
