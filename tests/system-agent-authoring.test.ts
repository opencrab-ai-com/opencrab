import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileOpenCrabAuthoringAgent,
  convertAgencyMarkdownToOpenCrabSource,
  convertRuntimeConfigToAuthoringSource,
  readOpenCrabAuthoringAgent,
  writeOpenCrabAuthoringAgent,
} from "../scripts/system_agent_authoring.mjs";

type AuthoringSourceAgent = {
  metadata: Record<string, string | boolean | string[] | null>;
  sections: Record<string, string>;
};

describe("system agent authoring", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.splice(0).forEach((dirPath) => {
      rmSync(dirPath, { recursive: true, force: true });
    });
  });

  it("reads directory-based source into runtime agent config", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "opencrab-system-agent-"));
    tempDirs.push(tempDir);

    writeFileSync(
      path.join(tempDir, "agent.yaml"),
      `id: "project-manager"
name: "PM-小马哥"
summary: "抓目标和节奏"
roleLabel: "PM"
description: "负责收束方向"
groupId: "opencrab-core"
availability: "team"
teamRole: "lead"
defaultSandboxMode: "workspace-write"
promoted: false
starterPrompts:
  - "先帮我收束目标"
`,
      "utf8",
    );
    writeFileSync(path.join(tempDir, "soul.md"), "### Identity\n你是 PM-小马哥。\n", "utf8");
    writeFileSync(path.join(tempDir, "responsibility.md"), "### Mission\n对齐目标和推进路径。\n", "utf8");
    writeFileSync(path.join(tempDir, "tools.md"), "### Tooling Philosophy\n先判断，再决定谁做。\n", "utf8");
    writeFileSync(path.join(tempDir, "user.md"), "### Communication Preferences\n- 直接\n", "utf8");
    writeFileSync(path.join(tempDir, "knowledge.md"), "### Reusable Heuristics\n- 先抓关键杠杆\n", "utf8");

    const source = readOpenCrabAuthoringAgent(tempDir) as unknown as AuthoringSourceAgent;
    const runtime = compileOpenCrabAuthoringAgent(source, {
      groupRegistry: {
        groups: new Map([
          [
            "opencrab-core",
            {
              id: "opencrab-core",
              label: "OpenCrab 核心",
              description: "默认内置的 6 个核心角色。",
              order: 10,
              collection: {
                id: "opencrab-core",
                label: "OpenCrab Core",
                description: "OpenCrab 自己定义的核心系统角色。",
                order: 10,
              },
            },
          ],
        ]),
      },
    });

    expect(runtime.id).toBe("project-manager");
    expect(runtime.defaultSandboxMode).toBe("workspace-write");
    expect(runtime.files.soul).toContain('agent: "PM-小马哥"');
    expect(runtime.files.soul).toContain("# Soul");
    expect(runtime.files.soul).toContain("### Identity");
    expect(runtime.files.user).toContain("### Communication Preferences");
  });

  it("can round-trip runtime config back into directory source files", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "opencrab-system-agent-"));
    tempDirs.push(tempDir);

    const sourceAgent = convertRuntimeConfigToAuthoringSource({
      id: "user-researcher",
      name: "UX-寡姐",
      summary: "替真实用户发声",
      roleLabel: "UX Research",
      description: "识别体验摩擦",
      availability: "both",
      teamRole: "research",
      defaultModel: null,
      defaultReasoningEffort: null,
      defaultSandboxMode: "workspace-write",
      avatarFileName: "user-researcher.png",
      promoted: true,
      starterPrompts: ["先帮我看用户会卡在哪"],
      files: {
        soul: `---
agent: "UX-寡姐"
role: "UX Research"
file: "soul.md"
purpose: "替真实用户发声"
---

# Soul

### Identity
你是 UX-寡姐。`,
        responsibility: `---
agent: "UX-寡姐"
role: "UX Research"
file: "responsibility.md"
purpose: "替真实用户发声"
---

# Responsibility

### Mission
指出摩擦和流失风险。`,
        tools: `---
agent: "UX-寡姐"
role: "UX Research"
file: "tools.md"
purpose: "替真实用户发声"
---

# Tools

### Tooling Philosophy
先看真实场景。`,
        user: `---
agent: "UX-寡姐"
role: "UX Research"
file: "user.md"
purpose: "替真实用户发声"
---

# User

### Communication Preferences
- 冷静、具体`,
        knowledge: `---
agent: "UX-寡姐"
role: "UX Research"
file: "knowledge.md"
purpose: "替真实用户发声"
---

# Knowledge

### Reusable Heuristics
- 体验问题往往是连续小摩擦累积`,
      },
    });

    writeOpenCrabAuthoringAgent(sourceAgent, tempDir, { overwrite: true });
    const saved = readOpenCrabAuthoringAgent(tempDir) as unknown as AuthoringSourceAgent;

    expect(saved.metadata.id).toBe("user-researcher");
    expect(saved.metadata.avatarFileName).toBe("user-researcher.png");
    expect(saved.sections.soul).toContain("### Identity");
    expect(saved.sections.soul).not.toContain('file: "soul.md"');
    expect(saved.sections.knowledge).toContain("### Reusable Heuristics");
  });

  it("maps agency-agents markdown into OpenCrab authoring sections", () => {
    const imported = convertAgencyMarkdownToOpenCrabSource(
      `---
name: Frontend Developer
description: Expert frontend developer for modern web apps
vibe: Builds responsive, accessible web apps with pixel-perfect precision.
services:
  - name: Vercel
    url: https://vercel.com
    tier: freemium
---

# Frontend Developer Agent Personality

## 🧠 Your Identity & Memory
- **Role**: UI implementation specialist

## 🎯 Your Core Mission
- Build modern web applications

## 🚨 Critical Rules You Must Follow
- Follow accessibility guidelines

## 📋 Your Technical Deliverables
- Component examples

## 🔄 Your Workflow Process
1. Discovery
2. Implementation

## 💭 Your Communication Style
- Be precise

## 🔄 Learning & Memory
- Remember successful UI patterns

## 🎯 Your Success Metrics
- Lighthouse > 90

## 🚀 Advanced Capabilities
- Progressive Web Apps
`,
      {
        slug: "frontend-developer",
        sourceUrl:
          "https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-frontend-developer.md",
      },
    ) as unknown as AuthoringSourceAgent;

    expect(imported.metadata.id).toBe("frontend-developer");
    expect(imported.metadata.groupId).toBe("engineering");
    expect(imported.metadata.teamRole).toBe("specialist");
    expect(imported.metadata.upstreamLicense).toBe("MIT");
    expect(imported.sections.soul).toContain("### Your Identity & Memory");
    expect(imported.sections.soul).toContain("### Your Critical Rules You Must Follow");
    expect(imported.sections.tools).toContain("### External Services");
    expect(imported.sections.user).toContain("### Your Communication Style");
    expect(imported.sections.knowledge).toContain("### Your Advanced Capabilities");
  });
});
