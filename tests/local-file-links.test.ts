import { describe, expect, it } from "vitest";
import {
  buildLocalFileOpenRequestHref,
  parseLocalFileReference,
  resolveConversationMarkdownLink,
} from "@/lib/conversations/local-file-links";

describe("local file markdown links", () => {
  it("parses absolute local file paths with a line anchor", () => {
    expect(
      parseLocalFileReference("/Users/example/Desktop/Workspace/example.md#L13"),
    ).toEqual({
      absolutePath: "/Users/example/Desktop/Workspace/example.md",
      lineAnchor: "L13",
    });
  });

  it("parses hash-prefixed local file paths produced by broken links", () => {
    expect(
      parseLocalFileReference("#/Users/example/Desktop/Workspace/example.md#L13"),
    ).toEqual({
      absolutePath: "/Users/example/Desktop/Workspace/example.md",
      lineAnchor: "L13",
    });
  });

  it("keeps non-local links unchanged", () => {
    expect(resolveConversationMarkdownLink("https://example.com/docs")).toBe("https://example.com/docs");
  });

  it("maps local file links to the open-directory endpoint", () => {
    expect(
      resolveConversationMarkdownLink("/Users/example/Desktop/Workspace/example.md#L13"),
    ).toBe(
      buildLocalFileOpenRequestHref("/Users/example/Desktop/Workspace/example.md"),
    );
  });
});
