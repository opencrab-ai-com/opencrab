import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";

type ConversationTurnReply = string | Error;

type ConversationTurnInput = {
  content?: string;
  onThreadReady?: (threadId: string | null) => void;
  onThinking?: (entries: string[]) => void;
  onAssistantText?: (text: string) => void;
};

type ConversationTurnMock = {
  mockImplementation: (
    implementation: (input: ConversationTurnInput) => Promise<{
      assistant: {
        text: string;
      };
    }>,
  ) => unknown;
  mockReset: () => void;
};

export function queueConversationReplies(
  runConversationTurnMock: ConversationTurnMock,
  replies: ConversationTurnReply[],
  input: {
    threadPrefix: string;
    thinkingPrefix: string;
  },
) {
  let index = 0;

  runConversationTurnMock.mockImplementation(async (turnInput) => {
    const nextReply = replies[index++];

    turnInput.onThreadReady?.(`${input.threadPrefix}-${index}`);
    turnInput.onThinking?.([`${input.thinkingPrefix}-${index}`]);

    if (nextReply instanceof Error) {
      throw nextReply;
    }

    turnInput.onAssistantText?.(nextReply);

    return {
      assistant: {
        text: nextReply,
      },
    };
  });
}

export function clearProjectRuntimeQueues() {
  delete (globalThis as typeof globalThis & {
    __opencrabProjectRuntimeQueues?: Map<string, Promise<void>>;
  }).__opencrabProjectRuntimeQueues;
}

export async function loadProjectStore() {
  vi.resetModules();
  return import("@/lib/projects/project-store");
}

export async function loadLocalStore() {
  return import("@/lib/resources/local-store");
}

export async function waitForProjectRuntime(projectId: string) {
  const queues = (globalThis as typeof globalThis & {
    __opencrabProjectRuntimeQueues?: Map<string, Promise<void>>;
  }).__opencrabProjectRuntimeQueues;

  await (queues?.get(projectId) ?? Promise.resolve());
}

function createProjectStoreTestHomeSetup(runConversationTurnMock: { mockReset: () => void }) {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    runConversationTurnMock.mockReset();
    clearProjectRuntimeQueues();
    tempHomes.length = 0;
  });

  afterEach(() => {
    clearProjectRuntimeQueues();
    runConversationTurnMock.mockReset();

    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempHomes.forEach((homePath) => {
      rmSync(homePath, { recursive: true, force: true });
    });
  });

  return {
    createTempHome(prefix: string) {
      const tempHome = mkdtempSync(path.join(os.tmpdir(), prefix));
      const workspaceDir = path.join(tempHome, "workspace");

      tempHomes.push(tempHome);
      process.env.OPENCRAB_HOME = tempHome;

      return { tempHome, workspaceDir };
    },
  };
}

export function setupProjectStoreTestHome(runConversationTurnMock: { mockReset: () => void }) {
  return createProjectStoreTestHomeSetup(runConversationTurnMock);
}

export function useProjectStoreTestHome(runConversationTurnMock: { mockReset: () => void }) {
  return createProjectStoreTestHomeSetup(runConversationTurnMock);
}
