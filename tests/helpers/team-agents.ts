import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const STRATEGY_AGENT_ID = "custom-strategy-specialist";
export const STRATEGY_AGENT_NAME = "策略执行师";
export const WRITER_AGENT_ID = "custom-writer-specialist";
export const WRITER_AGENT_NAME = "表达整理助手";

export function seedTestTeamAgents(opencrabHome: string) {
  writeCustomAgent(opencrabHome, {
    id: STRATEGY_AGENT_ID,
    name: STRATEGY_AGENT_NAME,
    roleLabel: "Strategy",
    summary: "负责把模糊目标收束成结构化判断、关键依赖和下一步建议。",
    description: "适合承担结构化判断、方案取舍和阶段推进建议。",
    teamRole: "specialist",
  });
  writeCustomAgent(opencrabHome, {
    id: WRITER_AGENT_ID,
    name: WRITER_AGENT_NAME,
    roleLabel: "Writer",
    summary: "负责把上游结果整理成可确认、可交付、可直接对外的表达。",
    description: "适合承担总结整理、阶段结论和对外表达收束。",
    teamRole: "writer",
  });
}

function writeCustomAgent(
  opencrabHome: string,
  input: {
    id: string;
    name: string;
    roleLabel: string;
    summary: string;
    description: string;
    teamRole: "specialist" | "writer";
  },
) {
  const agentDir = path.join(opencrabHome, "agents", input.id);
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    path.join(agentDir, "profile.json"),
    JSON.stringify(
      {
        id: input.id,
        name: input.name,
        avatarDataUrl: null,
        summary: input.summary,
        roleLabel: input.roleLabel,
        description: input.description,
        source: "custom",
        availability: "both",
        teamRole: input.teamRole,
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
}
