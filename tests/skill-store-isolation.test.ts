import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    vi.restoreAllMocks();

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

  it("rewrites legacy .codex skill-root paths inside already managed skills", async () => {
    const systemHome = createTempDir("opencrab-system-home-");
    const opencrabHome = createTempDir("opencrab-runtime-home-");
    process.env.HOME = systemHome;
    process.env.OPENCRAB_HOME = opencrabHome;

    const skillRoot = path.join(opencrabHome, "skills", "planning-with-files");
    mkdirSync(path.join(skillRoot, "scripts"), { recursive: true });
    writeFileSync(
      path.join(skillRoot, "SKILL.md"),
      [
        "---",
        "name: planning-with-files",
        "description: legacy paths",
        "---",
        'Run `$(command -v python3 || command -v python) ~/.codex/skills/planning-with-files/scripts/session-catchup.py "$(pwd)"`',
        'Stop hook: SD="${CODEX_SKILL_ROOT:-$HOME/.codex/skills/planning-with-files}/scripts"',
        'Windows: python "$env:USERPROFILE\\.codex\\skills\\planning-with-files\\scripts\\session-catchup.py" (Get-Location)',
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(skillRoot, "scripts", "helper.sh"),
      'cat ~/.codex/skills/planning-with-files/templates/progress.md\ncat /Users/demo/.codex/skills/planning-with-files/templates/task_plan.md\n',
      "utf8",
    );

    const { listSkills } = await loadSkillStore();
    listSkills();

    const normalizedSkillMarkdown = readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
    const normalizedHelper = readFileSync(path.join(skillRoot, "scripts", "helper.sh"), "utf8");

    expect(normalizedSkillMarkdown).not.toContain("~/.codex/skills/planning-with-files");
    expect(normalizedSkillMarkdown).not.toContain("$HOME/.codex/skills/planning-with-files");
    expect(normalizedSkillMarkdown).not.toContain("$env:USERPROFILE\\.codex\\skills\\planning-with-files");
    expect(normalizedSkillMarkdown).toContain("$CODEX_HOME/skills/planning-with-files/scripts/session-catchup.py");
    expect(normalizedSkillMarkdown).toContain('SD="${CODEX_SKILL_ROOT:-$CODEX_HOME/skills/planning-with-files}/scripts"');
    expect(normalizedSkillMarkdown).toContain('$env:CODEX_HOME\\skills\\planning-with-files\\scripts\\session-catchup.py');
    expect(normalizedHelper).not.toContain(".codex/skills/planning-with-files");
    expect(normalizedHelper).toContain("$CODEX_HOME/skills/planning-with-files/templates/progress.md");
    expect(normalizedHelper).toContain("$CODEX_HOME/skills/planning-with-files/templates/task_plan.md");
  });

  it("normalizes legacy .codex skill-root paths when installing a recommended skill", async () => {
    const systemHome = createTempDir("opencrab-system-home-");
    const opencrabHome = createTempDir("opencrab-runtime-home-");
    process.env.HOME = systemHome;
    process.env.OPENCRAB_HOME = opencrabHome;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);

        if (url.includes("/repos/OthmanAdi/planning-with-files/contents/.codex/skills/planning-with-files?ref=master")) {
          return new Response(
            JSON.stringify([
              {
                type: "file",
                name: "SKILL.md",
                path: ".codex/skills/planning-with-files/SKILL.md",
                download_url: "https://example.test/planning-with-files/SKILL.md",
              },
              {
                type: "dir",
                name: "scripts",
                path: ".codex/skills/planning-with-files/scripts",
              },
            ]),
            { status: 200 },
          );
        }

        if (url.includes("/repos/OthmanAdi/planning-with-files/contents/.codex/skills/planning-with-files/scripts?ref=master")) {
          return new Response(
            JSON.stringify([
              {
                type: "file",
                name: "helper.sh",
                path: ".codex/skills/planning-with-files/scripts/helper.sh",
                download_url: "https://example.test/planning-with-files/helper.sh",
              },
            ]),
            { status: 200 },
          );
        }

        if (url === "https://example.test/planning-with-files/SKILL.md") {
          return new Response(
            [
              "---",
              "name: planning-with-files",
              "description: legacy install",
              "---",
              "Use ~/.codex/skills/planning-with-files/templates/task_plan.md as reference",
            ].join("\n"),
            { status: 200 },
          );
        }

        if (url === "https://example.test/planning-with-files/helper.sh") {
          return new Response(
            'cat "$HOME/.codex/skills/planning-with-files/templates/progress.md"\n',
            { status: 200 },
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { mutateSkill } = await loadSkillStore();
    await mutateSkill("planning-with-files", "install");

    const skillRoot = path.join(opencrabHome, "skills", "planning-with-files");
    const installedSkillMarkdown = readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
    const installedHelper = readFileSync(path.join(skillRoot, "scripts", "helper.sh"), "utf8");

    expect(installedSkillMarkdown).toContain("$CODEX_HOME/skills/planning-with-files/templates/task_plan.md");
    expect(installedSkillMarkdown).not.toContain("~/.codex/skills/planning-with-files");
    expect(installedHelper).toContain('$CODEX_HOME/skills/planning-with-files/templates/progress.md');
    expect(installedHelper).not.toContain("$HOME/.codex/skills/planning-with-files");
  });

  function createTempDir(prefix: string) {
    const dirPath = mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dirPath);
    return dirPath;
  }
});
