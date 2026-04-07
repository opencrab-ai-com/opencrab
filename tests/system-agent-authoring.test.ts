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
familyId: "strategy-delivery"
availability: "team"
teamRole: "lead"
defaultSandboxMode: "workspace-write"
promoted: false
ownedOutcomes:
  - "推进方案"
deliverables:
  - "推进方案"
qualityGates:
  - "阶段目标明确"
handoffTargets:
  - "product-manager"
starterPrompts:
  - "先帮我收束目标"
`,
      "utf8",
    );
    writeFileSync(path.join(tempDir, "identity.md"), "### Identity\n你是 PM-小马哥。\n", "utf8");
    writeFileSync(path.join(tempDir, "contract.md"), "### Mission\n对齐目标和推进路径。\n", "utf8");
    writeFileSync(path.join(tempDir, "execution.md"), "### Tooling Philosophy\n先判断，再决定谁做。\n", "utf8");
    writeFileSync(path.join(tempDir, "quality.md"), "### Quality Gates\n- 直接\n", "utf8");
    writeFileSync(path.join(tempDir, "handoff.md"), "### Handoff Rules\n- 先抓关键杠杆\n", "utf8");

    const source = readOpenCrabAuthoringAgent(tempDir) as unknown as AuthoringSourceAgent;
    const runtime = compileOpenCrabAuthoringAgent(source, {
      familyRegistry: {
        families: new Map([
          [
            "strategy-delivery",
            {
              id: "strategy-delivery",
              label: "策略与交付",
              description: "负责目标收束和阶段推进。",
              order: 10,
            },
          ],
        ]),
      },
    });

    expect(runtime.id).toBe("project-manager");
    expect(runtime.defaultSandboxMode).toBe("workspace-write");
    expect(runtime.files.identity).toContain('agent: "PM-小马哥"');
    expect(runtime.files.identity).toContain("# Identity");
    expect(runtime.files.identity).toContain("### Identity");
    expect(runtime.files.quality).toContain("### Quality Gates");
    expect(runtime.familyId).toBe("strategy-delivery");
    expect("groupId" in runtime).toBe(false);
    expect("collectionId" in runtime).toBe(false);
  });

  it("can round-trip runtime config back into directory source files", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "opencrab-system-agent-"));
    tempDirs.push(tempDir);

    const sourceAgent = convertRuntimeConfigToAuthoringSource({
      id: "ui-designer",
      name: "UI设计",
      summary: "交付可落地的界面结构和说明",
      roleLabel: "UI",
      description: "负责页面结构和设计说明",
      familyId: "design",
      availability: "both",
      teamRole: "specialist",
      defaultModel: null,
      defaultReasoningEffort: null,
      defaultSandboxMode: "workspace-write",
      avatarFileName: "ui-designer.png",
      promoted: true,
      ownedOutcomes: ["页面结构方案"],
      deliverables: [{ id: "ui-spec", label: "界面说明", required: true }],
      qualityGates: ["结构完整"],
      handoffTargets: ["frontend-engineer"],
      starterPrompts: ["先把这个页面结构整理清楚"],
      files: {
        identity: `---
agent: "UI设计"
role: "UI"
file: "identity.md"
purpose: "交付可落地的界面结构和说明"
---

# Identity

### Identity
你是 UI 设计岗位。`,
        contract: `---
agent: "UI设计"
role: "UI"
file: "contract.md"
purpose: "交付可落地的界面结构和说明"
---

# Contract

### Mission
整理页面结构与设计说明。`,
        execution: `---
agent: "UI设计"
role: "UI"
file: "execution.md"
purpose: "交付可落地的界面结构和说明"
---

# Execution

### Tooling Philosophy
先理解目标，再整理结构。`,
        quality: `---
agent: "UI设计"
role: "UI"
file: "quality.md"
purpose: "交付可落地的界面结构和说明"
---

# Quality

### Communication Preferences
- 冷静、具体`,
        handoff: `---
agent: "UI设计"
role: "UI"
file: "handoff.md"
purpose: "交付可落地的界面结构和说明"
---

# Handoff

### Reusable Heuristics
- 先交结构，再交接实现`,
      },
    });

    writeOpenCrabAuthoringAgent(sourceAgent, tempDir, { overwrite: true });
    const saved = readOpenCrabAuthoringAgent(tempDir) as unknown as AuthoringSourceAgent;

    expect(saved.metadata.id).toBe("ui-designer");
    expect(saved.metadata.avatarFileName).toBe("ui-designer.png");
    expect(saved.sections.identity).toContain("### Identity");
    expect(saved.sections.identity).not.toContain('file: "identity.md"');
    expect(saved.sections.handoff).toContain("### Reusable Heuristics");
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
    expect(imported.metadata.familyId).toBe("engineering");
    expect(imported.metadata.teamRole).toBe("specialist");
    expect("groupId" in imported.metadata).toBe(false);
    expect("upstreamLicense" in imported.metadata).toBe(false);
    expect(imported.sections.identity).toContain("### Your Identity & Memory");
    expect(imported.sections.identity).toContain("### Your Critical Rules You Must Follow");
    expect(imported.sections.execution).toContain("### External Services");
    expect(imported.sections.quality).toContain("### Your Communication Style");
    expect(imported.sections.handoff).toContain("### Your Advanced Capabilities");
  });
});
