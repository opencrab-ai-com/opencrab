import { describe, expect, it } from "vitest";

describe("projects pages runtime mode", () => {
  it("forces the projects overview page to stay dynamic", async () => {
    const pageModule = await import("@/app/(app)/projects/page");

    expect(pageModule.dynamic).toBe("force-dynamic");
  });

  it("forces the project room page to stay dynamic", async () => {
    const pageModule = await import("@/app/(app)/projects/[projectId]/page");

    expect(pageModule.dynamic).toBe("force-dynamic");
  });
});
