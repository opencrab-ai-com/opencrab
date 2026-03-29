import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveNodeRuntimeExecutablePath } from "@/lib/runtime/resource-paths";

describe("node runtime executable resolver", () => {
  it("prefers the Electron Helper binary for macOS app bundle executables", () => {
    const electronExecPath = path.join(
      process.cwd(),
      "node_modules",
      "electron",
      "dist",
      "Electron.app",
      "Contents",
      "MacOS",
      "Electron",
    );

    expect(resolveNodeRuntimeExecutablePath(electronExecPath)).toBe(
      path.join(
        process.cwd(),
        "node_modules",
        "electron",
        "dist",
        "Electron.app",
        "Contents",
        "Frameworks",
        "Electron Helper.app",
        "Contents",
        "MacOS",
        "Electron Helper",
      ),
    );
  });

  it("falls back to the provided executable when no helper sibling exists", () => {
    expect(resolveNodeRuntimeExecutablePath("/usr/bin/node")).toBe("/usr/bin/node");
  });
});
