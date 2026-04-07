import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSkillStore() {
  vi.resetModules();
  return import("@/lib/skills/skill-store");
}

describe("skill store isolation", () => {
  const originalHome = process.env.HOME;
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.resetModules();

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempDirs.forEach((dirPath) => {
      rmSync(dirPath, { recursive: true, force: true });
    });
    tempDirs.length = 0;
  });

  it("does not import skills from the user's ~/.codex directory", async () => {
    const systemHome = createTempDir("opencrab-system-home-");
    const opencrabHome = createTempDir("opencrab-runtime-home-");
    process.env.HOME = systemHome;
    process.env.OPENCRAB_HOME = opencrabHome;

    const externalSkillDir = path.join(systemHome, ".codex", "skills", "external-only");
    mkdirSync(externalSkillDir, { recursive: true });
    writeFileSync(
      path.join(externalSkillDir, "SKILL.md"),
      "---\nname: external-only\ndescription: should stay outside OpenCrab\n---\n",
      "utf8",
    );

    const { listSkills } = await loadSkillStore();
    const skills = listSkills();

    expect(skills.some((skill) => skill.id === "external-only")).toBe(false);
    expect(
      skills.some(
        (skill) =>
          skill.sourcePath === path.join(opencrabHome, "skills", "playwright", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      skills.some(
        (skill) =>
          skill.id === "brainstorming" &&
          skill.sourcePath === path.join(opencrabHome, "skills", "brainstorming", "SKILL.md"),
      ),
    ).toBe(true);
    expect(skills.some((skill) => skill.id === "writing-plans")).toBe(true);
    expect(skills.some((skill) => skill.id === "systematic-debugging")).toBe(true);
  });

  function createTempDir(prefix: string) {
    const dirPath = mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dirPath);
    return dirPath;
  }
});
