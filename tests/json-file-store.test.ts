import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSyncJsonFileStore } from "@/lib/server/json-file-store";

describe("createSyncJsonFileStore", () => {
  it("seeds and persists normalized state", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "opencrab-json-store-"));
    const filePath = path.join(tempDir, "state.json");
    const store = createSyncJsonFileStore({
      filePath,
      seed: () => ({ count: 1, label: "seed" }),
      normalize: (value: Partial<{ count: number; label: string }>) => ({
        count: typeof value.count === "number" ? value.count : 0,
        label: value.label || "normalized",
      }),
    });

    expect(store.read()).toEqual({ count: 1, label: "seed" });

    store.write({ count: 3, label: "written" });
    expect(store.read()).toEqual({ count: 3, label: "written" });
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({
      count: 3,
      label: "written",
    });

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("backs up corrupt files before reseeding", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "opencrab-json-store-"));
    const filePath = path.join(tempDir, "state.json");

    writeFileSync(filePath, "{broken", "utf8");

    const store = createSyncJsonFileStore({
      filePath,
      seed: () => ({ count: 0 }),
    });

    expect(store.read()).toEqual({ count: 0 });

    const files = readdirSync(tempDir);
    expect(files.some((name) => /^state\.corrupt\.\d+\.json$/.test(name))).toBe(true);
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({ count: 0 });

    rmSync(tempDir, { recursive: true, force: true });
  });
});
