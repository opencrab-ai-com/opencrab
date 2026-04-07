import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AgentStoreModule = Awaited<typeof import("@/lib/agents/agent-store")>;

async function loadAgentStore(): Promise<AgentStoreModule> {
  vi.resetModules();
  return import("@/lib/agents/agent-store");
}

describe("agent store system defaults", () => {
  const originalOpencrabHome = process.env.OPENCRAB_HOME;
  const tempHomes: string[] = [];

  beforeEach(() => {
    tempHomes.length = 0;
  });

  afterEach(() => {
    if (originalOpencrabHome === undefined) {
      delete process.env.OPENCRAB_HOME;
    } else {
      process.env.OPENCRAB_HOME = originalOpencrabHome;
    }

    tempHomes.forEach((homePath) => {
      rmSync(homePath, { recursive: true, force: true });
    });
  });

  it("uses workspace-write as the default sandbox for all system agents", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const agentStore = await loadAgentStore();
    const { listBuiltInSystemAgents } = await import("@/lib/agents/system-agent-catalog");
    const systemAgents = agentStore.listAgentProfiles().filter((agent) => agent.source === "system");
    const builtInSystemAgents = listBuiltInSystemAgents();

    expect(systemAgents).toHaveLength(builtInSystemAgents.length);
    expect(systemAgents.every((agent) => agent.defaultSandboxMode === "workspace-write")).toBe(true);

    const systemTeamRoles = new Map(systemAgents.map((agent) => [agent.id, agent.teamRole] as const));
    const expectedTeamRoles = new Map(
      builtInSystemAgents.map((agent) => [agent.id, agent.teamRole] as const),
    );

    expect(systemTeamRoles).toEqual(expectedTeamRoles);
  });

  it("removes deprecated system agents from local storage during startup", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
    const agentDir = path.join(tempHome, "agents", "product-strategist");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    mkdirSync(agentDir, { recursive: true });
    writeFileSync(
      path.join(agentDir, "profile.json"),
      JSON.stringify(
        {
          id: "product-strategist",
          name: "产品策略师",
          summary: "旧数据",
          roleLabel: "Strategy",
          description: "旧数据",
          source: "system",
          availability: "both",
          teamRole: "lead",
          defaultModel: null,
          defaultReasoningEffort: null,
          defaultSandboxMode: null,
          starterPrompts: [],
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          files: {
            identity: "",
            contract: "",
            execution: "",
            quality: "",
            handoff: "",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const agentStore = await loadAgentStore();
    const strategist = agentStore.getAgentProfile("product-strategist");

    expect(strategist).toBeNull();
    expect(agentStore.listAgentProfiles().some((agent) => agent.id === "product-strategist")).toBe(false);
  });

  it("normalizes legacy built-in agent profiles to the enforced team role and sandbox", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
    const uiDesignerDir = path.join(tempHome, "agents", "ui-designer");
    const { listBuiltInSystemAgents } = await import("@/lib/agents/system-agent-catalog");
    const promotedSystemAgent = listBuiltInSystemAgents().find((agent) => agent.promoted);

    if (!promotedSystemAgent) {
      throw new Error("需要至少一个 promoted 系统智能体来覆盖兼容测试。");
    }

    const promotedAgentDir = path.join(
      tempHome,
      "agents",
      promotedSystemAgent.id,
    );
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    mkdirSync(uiDesignerDir, { recursive: true });
    writeFileSync(
      path.join(uiDesignerDir, "profile.json"),
      JSON.stringify(
        {
          id: "ui-designer",
          name: "UI设计",
          summary: "旧数据",
          roleLabel: "UI",
          description: "旧数据",
          source: "system",
          availability: "both",
          teamRole: "lead",
          defaultModel: "gpt-5.4",
          defaultReasoningEffort: "high",
          defaultSandboxMode: "read-only",
          starterPrompts: [],
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          files: {
            identity: "",
            contract: "",
            execution: "",
            quality: "",
            handoff: "",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    mkdirSync(promotedAgentDir, { recursive: true });
    writeFileSync(
      path.join(promotedAgentDir, "profile.json"),
      JSON.stringify(
        {
          id: promotedSystemAgent.id,
          name: "旧系统智能体",
          summary: "旧数据",
          roleLabel: "Expert",
          description: "旧数据",
          source: "custom",
          availability: "both",
          teamRole: "lead",
          defaultModel: "gpt-5.4",
          defaultReasoningEffort: "high",
          defaultSandboxMode: "danger-full-access",
          starterPrompts: [],
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          files: {
            identity: "",
            contract: "",
            execution: "",
            quality: "",
            handoff: "",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const agentStore = await loadAgentStore();
    const designer = agentStore.getAgentProfile("ui-designer");
    const promoted = agentStore.getAgentProfile(promotedSystemAgent.id);

    expect(designer?.source).toBe("system");
    expect(designer?.teamRole).toBe("specialist");
    expect(designer?.defaultModel).toBeNull();
    expect(designer?.defaultReasoningEffort).toBeNull();
    expect(designer?.defaultSandboxMode).toBe("workspace-write");

    expect(promoted?.source).toBe("system");
    expect(promoted?.teamRole).toBe(promotedSystemAgent.teamRole);
    expect(promoted?.defaultModel).toBeNull();
    expect(promoted?.defaultReasoningEffort).toBeNull();
    expect(promoted?.defaultSandboxMode).toBe(promotedSystemAgent.defaultSandboxMode ?? "workspace-write");
  });

  it("sorts agents by source, family order, promoted, then name", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
    const alphaDir = path.join(tempHome, "agents", "alpha-agent");
    const zuluDir = path.join(tempHome, "agents", "zulu-agent");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    mkdirSync(alphaDir, { recursive: true });
    writeFileSync(
      path.join(alphaDir, "profile.json"),
      JSON.stringify(
        {
          id: "alpha-agent",
          name: "Alpha Agent",
          summary: "旧排序下会因为名称靠前而提前。",
          roleLabel: "Ops",
          description: "Alpha Agent",
          source: "custom",
          availability: "both",
          teamRole: "specialist",
          familyId: "late-family",
          familyLabel: "较晚家族",
          familyDescription: "应该排在后面。",
          familyOrder: 30,
          promoted: false,
          defaultModel: null,
          defaultReasoningEffort: null,
          defaultSandboxMode: null,
          starterPrompts: [],
          createdAt: "2026-04-07T00:00:00.000Z",
          updatedAt: "2026-04-07T00:00:00.000Z",
          files: {
            identity: "",
            contract: "",
            execution: "",
            quality: "",
            handoff: "",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    mkdirSync(zuluDir, { recursive: true });
    writeFileSync(
      path.join(zuluDir, "profile.json"),
      JSON.stringify(
        {
          id: "zulu-agent",
          name: "Zulu Agent",
          summary: "虽然名字靠后，但家族优先级更高。",
          roleLabel: "Ops",
          description: "Zulu Agent",
          source: "custom",
          availability: "both",
          teamRole: "specialist",
          familyId: "early-family",
          familyLabel: "较早家族",
          familyDescription: "应该排在前面。",
          familyOrder: 10,
          promoted: false,
          defaultModel: null,
          defaultReasoningEffort: null,
          defaultSandboxMode: null,
          starterPrompts: [],
          createdAt: "2026-04-07T00:00:00.000Z",
          updatedAt: "2026-04-07T00:00:00.000Z",
          files: {
            identity: "",
            contract: "",
            execution: "",
            quality: "",
            handoff: "",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const agentStore = await loadAgentStore();
    const customAgentIds = agentStore
      .listAgentProfiles()
      .filter((agent) => agent.source === "custom")
      .map((agent) => agent.id);

    expect(customAgentIds).toEqual(["zulu-agent", "alpha-agent"]);
  });

  it("creates custom agents with the v2 contract file set", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const agentStore = await loadAgentStore();
    const created = agentStore.createAgentProfile({
      name: "流程经理",
      summary: "负责把模糊流程整理成清楚交付。",
    });
    const agentDir = path.join(tempHome, "agents", created.id);
    const fileNames = readdirSync(agentDir).sort();

    expect(created.files.identity).toContain("# Identity");
    expect(created.files.contract).toContain("# Contract");
    expect(created.files.execution).toContain("# Execution");
    expect(created.files.quality).toContain("# Quality");
    expect(created.files.handoff).toContain("# Handoff");
    expect(fileNames).toEqual([
      "contract.md",
      "execution.md",
      "handoff.md",
      "identity.md",
      "profile.json",
      "quality.md",
    ]);
    expect(existsSync(path.join(agentDir, "soul.md"))).toBe(false);
    expect(existsSync(path.join(agentDir, "responsibility.md"))).toBe(false);
    expect(existsSync(path.join(agentDir, "tools.md"))).toBe(false);
    expect(existsSync(path.join(agentDir, "user.md"))).toBe(false);
    expect(existsSync(path.join(agentDir, "knowledge.md"))).toBe(false);
  });

  it("prefers a persisted shadow profile for a built-in system agent", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
    const shadowDir = path.join(tempHome, "agents", "system", "frontend-engineer");
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    mkdirSync(shadowDir, { recursive: true });
    writeFileSync(
      path.join(shadowDir, "profile.json"),
      JSON.stringify(
        {
          id: "frontend-engineer",
          name: "前端开发",
          avatarDataUrl: null,
          summary: "用 shadow profile 覆盖默认技能绑定。",
          roleLabel: "FE",
          description: "用 shadow profile 覆盖默认技能绑定。",
          source: "system",
          availability: "both",
          teamRole: "specialist",
          familyId: "engineering",
          familyLabel: "工程",
          familyDescription: "工程岗位",
          familyOrder: 30,
          promoted: true,
          defaultModel: null,
          defaultReasoningEffort: null,
          defaultSandboxMode: "workspace-write",
          starterPrompts: ["shadow prompt"],
          ownedOutcomes: [],
          outOfScope: [],
          deliverables: [],
          defaultSkillIds: ["test-driven-development"],
          optionalSkillIds: ["playwright"],
          qualityGates: [],
          handoffTargets: [],
          createdAt: "2026-04-07T00:00:00.000Z",
          updatedAt: "2026-04-07T00:00:00.000Z",
          files: {
            identity: "# Identity\nshadow",
            contract: "# Contract\nshadow",
            execution: "# Execution\nshadow",
            quality: "# Quality\nshadow",
            handoff: "# Handoff\nshadow",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const agentStore = await loadAgentStore();
    const detail = agentStore.getAgentProfile("frontend-engineer");

    expect(detail?.source).toBe("system");
    expect(detail?.defaultSkillIds).toEqual(["test-driven-development"]);
    expect(detail?.optionalSkillIds).toEqual(["playwright"]);
    expect(detail?.starterPrompts).toEqual(["shadow prompt"]);
    expect(detail?.files.identity).toContain("shadow");
  });

  it("persists system-agent updates into the system shadow directory", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const agentStore = await loadAgentStore();
    const updated = agentStore.updateAgentProfile("product-manager", {
      defaultSkillIds: ["brainstorming", "writing-plans"],
      optionalSkillIds: ["pdf"],
    });

    const shadowProfilePath = path.join(
      tempHome,
      "agents",
      "system",
      "product-manager",
      "profile.json",
    );

    expect(updated.source).toBe("system");
    expect(updated.defaultSkillIds).toEqual(["brainstorming", "writing-plans"]);
    expect(updated.optionalSkillIds).toEqual(["pdf"]);
    expect(existsSync(shadowProfilePath)).toBe(true);
    expect(JSON.parse(readFileSync(shadowProfilePath, "utf8")).defaultSkillIds).toEqual([
      "brainstorming",
      "writing-plans",
    ]);
  });

  it("restores built-in defaults after deleting a system shadow profile", async () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
    tempHomes.push(tempHome);
    process.env.OPENCRAB_HOME = tempHome;

    const agentStore = await loadAgentStore();
    const original = agentStore.getAgentProfile("project-manager");

    agentStore.updateAgentProfile("project-manager", {
      defaultSkillIds: ["brainstorming"],
      optionalSkillIds: ["pdf"],
    });

    const reset = agentStore.resetSystemAgentProfile("project-manager");

    expect(reset?.defaultSkillIds).toEqual(original?.defaultSkillIds);
    expect(reset?.optionalSkillIds).toEqual(original?.optionalSkillIds);
    expect(
      existsSync(path.join(tempHome, "agents", "system", "project-manager")),
    ).toBe(false);
  });
});
