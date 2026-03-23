import { describe, expect, it } from "vitest";
import {
  buildManagerArtifactCatalogLines,
  buildWorkerArtifactInputLines,
  normalizeDelegationArtifactTitles,
  resolveArtifactIdsByTitles,
} from "@/lib/projects/project-artifact-runtime";
import type { ProjectArtifactRecord } from "@/lib/projects/types";

function createArtifact(overrides: Partial<ProjectArtifactRecord> = {}): ProjectArtifactRecord {
  return {
    id: "artifact-1",
    projectId: "project-1",
    title: "阶段总结",
    typeLabel: "Checkpoint",
    summary: "团队已经整理完这一轮阶段结果。",
    status: "ready",
    sourceTaskId: null,
    sourceTaskTitle: null,
    ownerAgentId: null,
    ownerAgentName: null,
    reviewStatus: null,
    reviewerAgentId: null,
    reviewerAgentName: null,
    dependsOnArtifactIds: [],
    consumedByTaskIds: [],
    updatedAt: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("projectArtifactRuntime", () => {
  it("resolves requested artifact ids from exact titles and removes duplicates", () => {
    const artifacts = [
      createArtifact({ id: "artifact-1", title: "阶段总结" }),
      createArtifact({ id: "artifact-2", title: "页面实现结果" }),
    ];

    expect(resolveArtifactIdsByTitles(artifacts, ["页面实现结果", "阶段总结", "页面实现结果", "未知"])).toEqual([
      "artifact-2",
      "artifact-1",
    ]);
  });

  it("builds artifact catalog and worker input lines from runtime artifacts", () => {
    const draftArtifact = createArtifact({
      id: "artifact-draft",
      title: "待补充事项",
      typeLabel: "Input",
      status: "draft",
      summary: "还需要用户明确补充验收边界和风险判断。",
      updatedAt: "2026-03-23T01:00:00.000Z",
    });
    const readyArtifact = createArtifact({
      id: "artifact-ready",
      title: "页面实现结果",
      typeLabel: "Task Result",
      summary: "首页 Hero、价值陈述和 CTA 结构已经整理成第一版实现建议。",
      updatedAt: "2026-03-23T02:00:00.000Z",
    });

    expect(buildManagerArtifactCatalogLines([draftArtifact, readyArtifact])).toContain(
      "页面实现结果 (Task Result / 已可用)",
    );
    expect(
      buildWorkerArtifactInputLines(
        ["artifact-ready", "artifact-draft"],
        new Map([
          [readyArtifact.id, readyArtifact],
          [draftArtifact.id, draftArtifact],
        ]),
      ),
    ).toContain("待补充事项 (Input / 草稿)");
  });

  it("normalizes planner artifact title arrays", () => {
    expect(
      normalizeDelegationArtifactTitles(["阶段总结", " 页面实现结果 ", "", 1, "阶段总结"]),
    ).toEqual(["阶段总结", "页面实现结果"]);
  });
});
