import { describe, expect, it } from "vitest";
import { shouldShowConversationSidebar } from "@/lib/app-shell/sidebar-visibility";

describe("conversation sidebar visibility", () => {
  it("shows the shared sidebar on conversation-oriented routes", () => {
    expect(shouldShowConversationSidebar("/conversations")).toBe(true);
    expect(shouldShowConversationSidebar("/conversations/conversation-123")).toBe(true);
    expect(shouldShowConversationSidebar("/agents")).toBe(true);
    expect(shouldShowConversationSidebar("/agents/product-manager")).toBe(true);
    expect(shouldShowConversationSidebar("/projects")).toBe(true);
    expect(shouldShowConversationSidebar("/projects/project-123")).toBe(true);
    expect(shouldShowConversationSidebar("/channels")).toBe(true);
    expect(shouldShowConversationSidebar("/channels/feishu")).toBe(true);
  });

  it("hides the shared sidebar on non-conversation pages", () => {
    expect(shouldShowConversationSidebar(null)).toBe(false);
    expect(shouldShowConversationSidebar("/")).toBe(false);
    expect(shouldShowConversationSidebar("/tasks")).toBe(false);
    expect(shouldShowConversationSidebar("/tasks/task-123")).toBe(false);
    expect(shouldShowConversationSidebar("/skills")).toBe(false);
    expect(shouldShowConversationSidebar("/skills/ui-ux-pro-max")).toBe(false);
    expect(shouldShowConversationSidebar("/settings")).toBe(false);
    expect(shouldShowConversationSidebar("/about")).toBe(false);
  });
});
