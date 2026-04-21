import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  expandHomeDirectory,
  joinFileSystemPath,
  resolveFileSystemPath,
} from "@/lib/shared/filesystem-paths";

describe("filesystem path helpers", () => {
  it("joins a root path with relative segments", () => {
    expect(joinFileSystemPath("/tmp/opencrab", "skills", "system", "index.json")).toBe(
      path.normalize("/tmp/opencrab/skills/system/index.json"),
    );
  });

  it("expands home-prefixed paths against the provided home directory", () => {
    expect(expandHomeDirectory("~/workspace/opencrab", "/Users/sky")).toBe(
      path.normalize("/Users/sky/workspace/opencrab"),
    );
  });

  it("resolves relative paths against the provided base directory", () => {
    expect(resolveFileSystemPath("../shared/opencrab", "/tmp/projects/app")).toBe(
      path.normalize("/tmp/projects/shared/opencrab"),
    );
  });

  it("keeps absolute paths rooted where they already are", () => {
    expect(resolveFileSystemPath("/var/tmp/opencrab", "/tmp/projects/app")).toBe(
      path.normalize("/var/tmp/opencrab"),
    );
  });
});
