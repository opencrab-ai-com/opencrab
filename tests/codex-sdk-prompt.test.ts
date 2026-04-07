import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentProfileDetail } from "@/lib/agents/types";

const listSkillsMock = vi.hoisted(() => vi.fn());
const getSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/skills/skill-store", () => ({
  listSkills: listSkillsMock,
}));

vi.mock("@/lib/resources/local-store", () => ({
  getSnapshot: getSnapshotMock,
}));

function createAgentProfile(overrides: Partial<AgentProfileDetail> = {}): AgentProfileDetail {
  return {
    id: "frontend-engineer",
    name: "前端开发",
    avatarDataUrl: null,
    summary: "负责把界面需求交付成可运行、可验证的前端实现。",
    roleLabel: "FE",
    description: "在职责范围内对页面实现、状态正确、交互可用、验证结果和风险说明负责。",
    source: "system",
    availability: "both",
    teamRole: "specialist",
    defaultModel: null,
    defaultReasoningEffort: null,
    defaultSandboxMode: "workspace-write",
    starterPrompts: [],
    familyId: "engineering",
    familyLabel: "工程",
    familyDescription: "负责把需求落实为可运行、可验证的软件交付的工程岗位。",
    familyOrder: 30,
    promoted: true,
    ownedOutcomes: ["前端页面与交互实现"],
    outOfScope: ["产品方向拍板"],
    deliverables: [{ id: "code-change", label: "代码改动", required: true }],
    defaultSkillIds: ["playwright"],
    optionalSkillIds: ["pdf"],
    qualityGates: ["关键路径已验证"],
    handoffTargets: ["product-manager"],
    fileCount: 5,
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    files: {
      identity: "你是前端开发岗位。",
      contract: "对前端实现负责。",
      execution: "优先使用浏览器与代码工具。",
      quality: "交付前先自查。",
      handoff: "超出边界时转交。",
    },
    ...overrides,
  };
}

describe("codex sdk prompt building", () => {
  beforeEach(() => {
    listSkillsMock.mockReset().mockReturnValue([
      {
        id: "playwright",
        summary: "浏览器自动化",
        status: "installed",
        sourcePath: "/skills/playwright/SKILL.md",
      },
      {
        id: "pdf",
        summary: "PDF 处理",
        status: "installed",
        sourcePath: "/skills/pdf/SKILL.md",
      },
      {
        id: "speech",
        summary: "语音输出",
        status: "installed",
        sourcePath: "/skills/speech/SKILL.md",
      },
      {
        id: "screenshot",
        summary: "截图能力",
        status: "disabled",
        sourcePath: "/skills/screenshot/SKILL.md",
      },
    ]);
    getSnapshotMock.mockReset().mockReturnValue({
      settings: {
        defaultLanguage: "zh-CN",
      },
    });
  });

  it("only advertises mounted skills for agent-bound conversations", async () => {
    const { buildCodexPromptForTesting } = await import("@/lib/codex/sdk");
    const prompt = buildCodexPromptForTesting({
      conversationTitle: "前端任务",
      content: "把这个页面做出来",
      agentProfile: createAgentProfile(),
      textAttachments: [],
    });

    expect(prompt).toContain("当前岗位默认挂载的可用 skills：");
    expect(prompt).toContain("- playwright: 浏览器自动化");
    expect(prompt).toContain("- pdf: PDF 处理");
    expect(prompt).not.toContain("- speech: 语音输出");
    expect(prompt).toContain("完成前必须通过的质量门：");
    expect(prompt).toContain("超出职责范围时优先交接给：");
  });

  it("falls back to global enabled skills for non-agent conversations", async () => {
    const { buildCodexPromptForTesting } = await import("@/lib/codex/sdk");
    const prompt = buildCodexPromptForTesting({
      conversationTitle: "普通对话",
      content: "告诉我现在有哪些能力",
      agentProfile: null,
      textAttachments: [],
    });

    expect(prompt).toContain("OpenCrab 当前已启用的 skills（只有这些算可用）：");
    expect(prompt).toContain("- playwright: 浏览器自动化");
    expect(prompt).toContain("- pdf: PDF 处理");
    expect(prompt).toContain("- speech: 语音输出");
    expect(prompt).not.toContain("当前岗位默认挂载的可用 skills：");
  });
});
