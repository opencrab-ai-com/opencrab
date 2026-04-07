# System Agent Shadow Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit built-in system agents from the product UI, persist those edits under `~/.opencrab/agents/system/<agentId>/`, and rebind the 10 core agents to the new superpowers skills.

**Architecture:** Extend the agent store so built-in system agents can be shadowed by user-owned runtime profiles without changing bundled sources. Then expose the new editable fields through the API/provider/UI, and let runtime continue consuming the agent store as the single effective source of truth.

**Tech Stack:** Next.js App Router, React client components, local JSON/file persistence, Vitest

---

### Task 1: Add failing agent-store tests for system shadow profiles

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/tests/agent-store.test.ts`
- Inspect: `/Users/sky/SkyProjects/opencrab/lib/agents/agent-store.ts`
- Inspect: `/Users/sky/SkyProjects/opencrab/lib/resources/runtime-paths.ts`

- [ ] **Step 1: Add a failing read-path test for a shadowed system agent**

```ts
it("prefers a persisted shadow profile for a built-in system agent", async () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
  tempHomes.push(tempHome);
  process.env.OPENCRAB_HOME = tempHome;

  const systemDir = path.join(tempHome, "agents", "system", "frontend-engineer");
  mkdirSync(systemDir, { recursive: true });
  writeFileSync(
    path.join(systemDir, "profile.json"),
    JSON.stringify({
      id: "frontend-engineer",
      source: "system",
      name: "前端开发",
      summary: "shadow",
      roleLabel: "FE",
      description: "shadow",
      availability: "both",
      teamRole: "specialist",
      familyId: "engineering",
      familyLabel: "工程",
      familyDescription: "工程岗位",
      familyOrder: 30,
      promoted: true,
      defaultModel: "gpt-5.4",
      defaultReasoningEffort: "high",
      defaultSandboxMode: "workspace-write",
      starterPrompts: ["shadow"],
      defaultSkillIds: ["test-driven-development"],
      optionalSkillIds: ["playwright"],
      ownedOutcomes: [],
      outOfScope: [],
      deliverables: [],
      qualityGates: [],
      handoffTargets: [],
      createdAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T00:00:00.000Z",
      files: {
        identity: "# Identity\\nshadow",
        contract: "# Contract\\nshadow",
        execution: "# Execution\\nshadow",
        quality: "# Quality\\nshadow",
        handoff: "# Handoff\\nshadow",
      },
    }, null, 2),
    "utf8",
  );

  const agentStore = await loadAgentStore();
  const detail = agentStore.getAgentProfile("frontend-engineer");

  expect(detail?.source).toBe("system");
  expect(detail?.defaultSkillIds).toEqual(["test-driven-development"]);
  expect(detail?.optionalSkillIds).toEqual(["playwright"]);
  expect(detail?.starterPrompts).toEqual(["shadow"]);
});
```

- [ ] **Step 2: Add a failing write-path test for updating a system agent**

```ts
it("persists system-agent edits into the system shadow directory", async () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
  tempHomes.push(tempHome);
  process.env.OPENCRAB_HOME = tempHome;

  const agentStore = await loadAgentStore();
  const updated = agentStore.updateAgentProfile("product-manager", {
    defaultSkillIds: ["brainstorming", "writing-plans"],
    optionalSkillIds: ["pdf"],
  });

  expect(updated.source).toBe("system");
  expect(updated.defaultSkillIds).toEqual(["brainstorming", "writing-plans"]);

  const shadowProfilePath = path.join(
    tempHome,
    "agents",
    "system",
    "product-manager",
    "profile.json",
  );
  expect(existsSync(shadowProfilePath)).toBe(true);
});
```

- [ ] **Step 3: Add a failing reset-path test**

```ts
it("can reset a system agent back to bundled defaults", async () => {
  const tempHome = mkdtempSync(path.join(os.tmpdir(), "opencrab-agent-store-"));
  tempHomes.push(tempHome);
  process.env.OPENCRAB_HOME = tempHome;

  const agentStore = await loadAgentStore();
  agentStore.updateAgentProfile("project-manager", {
    defaultSkillIds: ["brainstorming"],
  });

  agentStore.resetSystemAgentProfile("project-manager");

  const detail = agentStore.getAgentProfile("project-manager");
  expect(detail?.defaultSkillIds).not.toEqual(["brainstorming"]);
  expect(
    existsSync(path.join(tempHome, "agents", "system", "project-manager")),
  ).toBe(false);
});
```

- [ ] **Step 4: Run the targeted agent-store tests and verify they fail for the missing behavior**

Run: `npm run test -- tests/agent-store.test.ts`

Expected: FAIL with missing system shadow support and missing reset API.

- [ ] **Step 5: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/tests/agent-store.test.ts
git commit -m "test: cover system agent shadow profiles"
```

### Task 2: Implement system shadow profile persistence in the agent store

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/lib/agents/agent-store.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/modules/agents/agent-service.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/agents/types.ts`
- Test: `/Users/sky/SkyProjects/opencrab/tests/agent-store.test.ts`
- Test: `/Users/sky/SkyProjects/opencrab/tests/agent-service.test.ts`

- [ ] **Step 1: Introduce system-shadow directory helpers**

```ts
function getSystemAgentShadowDir(agentId: string) {
  return path.join(OPENCRAB_AGENTS_DIR, "system", agentId);
}

function getSystemAgentShadowProfilePath(agentId: string) {
  return path.join(getSystemAgentShadowDir(agentId), PROFILE_FILE_NAME);
}
```

- [ ] **Step 2: Split custom-agent directory listing from the new system shadow tree**

```ts
function readCustomAgentDirectoryIds() {
  const builtInSystemAgentIds = new Set(listBuiltInSystemAgents().map((agent) => agent.id));
  return readAgentDirectoryIds().filter((agentId) => agentId !== "system" && !builtInSystemAgentIds.has(agentId));
}
```

- [ ] **Step 3: Read an effective system agent as built-in plus optional shadow profile**

```ts
function readAgentProfile(agentId: string): AgentProfileDetail | null {
  if (isBuiltInSystemAgentId(agentId)) {
    const systemSeed = listBuiltInSystemAgents().find((agent) => agent.id === agentId);
    if (!systemSeed) return null;

    const shadow = readStoredSystemAgentShadowProfile(agentId);
    return shadow ? mergeSystemAgentShadowProfile(systemSeed, shadow) : buildBuiltInSystemAgentDetail(systemSeed);
  }

  return readStoredCustomAgentProfile(agentId);
}
```

- [ ] **Step 4: Allow updating system agents by persisting a full normalized shadow profile**

```ts
if (existing.source === "system") {
  const detail = normalizeAgentDetail({
    ...existing,
    defaultSkillIds: input.defaultSkillIds ?? existing.defaultSkillIds,
    optionalSkillIds: input.optionalSkillIds ?? existing.optionalSkillIds,
    starterPrompts: input.starterPrompts === undefined
      ? existing.starterPrompts
      : normalizeStarterPrompts(input.starterPrompts),
    files: input.files
      ? { ...existing.files, ...buildAgentFiles(input.files, existing.files) }
      : existing.files,
    updatedAt: new Date().toISOString(),
  });

  persistSystemAgentShadowProfile(detail);
  return detail;
}
```

- [ ] **Step 5: Add a reset helper to remove the system shadow directory**

```ts
export function resetSystemAgentProfile(agentId: string) {
  ensureAgentsReady();
  if (!isBuiltInSystemAgentId(agentId)) {
    throw new Error("只有核心岗位支持恢复默认。");
  }

  rmSync(getSystemAgentShadowDir(agentId), { recursive: true, force: true });
  const builtIn = listBuiltInSystemAgents().find((agent) => agent.id === agentId);
  return builtIn ? buildBuiltInSystemAgentDetail(builtIn) : null;
}
```

- [ ] **Step 6: Extend agent-service input types with editable skill bindings**

```ts
export type AgentMutationInput = Partial<{
  // existing fields...
  defaultSkillIds: string[];
  optionalSkillIds: string[];
}>;
```

- [ ] **Step 7: Run targeted tests and verify they pass**

Run: `npm run test -- tests/agent-store.test.ts tests/agent-service.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/lib/agents/agent-store.ts /Users/sky/SkyProjects/opencrab/lib/modules/agents/agent-service.ts /Users/sky/SkyProjects/opencrab/lib/agents/types.ts /Users/sky/SkyProjects/opencrab/tests/agent-store.test.ts /Users/sky/SkyProjects/opencrab/tests/agent-service.test.ts
git commit -m "feat: persist system agent shadow profiles"
```

### Task 3: Expose system-agent editing through the API and provider

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/app/api/agents/route.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/app/api/agents/[agentId]/route.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/components/app-shell/opencrab-provider.tsx`
- Test: `/Users/sky/SkyProjects/opencrab/tests/agent-service.test.ts`

- [ ] **Step 1: Add skill-binding fields to create/update client payloads**

```ts
defaultSkillIds?: string[];
optionalSkillIds?: string[];
```

- [ ] **Step 2: Thread the new fields through the provider context**

```ts
updateAgent: (
  agentId: string,
  patch: Partial<{
    // existing fields...
    defaultSkillIds: string[];
    optionalSkillIds: string[];
  }>,
) => Promise<AgentProfileDetail | null>;
```

- [ ] **Step 3: Add a reset endpoint or explicit reset action for system agents**

```ts
export async function POST(
  _request: Request,
  context: RouteContext<{ agentId: string }>,
) {
  const { agentId } = await readRouteParams(context);
  const agent = agentService.reset(agentId);
  return noStoreJson({ agent });
}
```

- [ ] **Step 4: Run the API/provider-adjacent tests**

Run: `npm run test -- tests/agent-service.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/app/api/agents/route.ts /Users/sky/SkyProjects/opencrab/app/api/agents/[agentId]/route.ts /Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts /Users/sky/SkyProjects/opencrab/components/app-shell/opencrab-provider.tsx /Users/sky/SkyProjects/opencrab/tests/agent-service.test.ts
git commit -m "feat: expose system agent shadow profile editing"
```

### Task 4: Add the skill-binding editor and reset action to the agent detail page

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/components/agents/agent-detail-screen.tsx`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts`
- Test: `/Users/sky/SkyProjects/opencrab/tests/agent-display.test.ts`

- [ ] **Step 1: Load the skills catalog for agent editing**

```ts
const [skills, setSkills] = useState<SkillRecord[]>([]);

useEffect(() => {
  void getSkillsCatalog().then((response) => setSkills(response.skills));
}, []);
```

- [ ] **Step 2: Replace the display-only contract panel with editable multiselect controls**

```tsx
<SkillBindingEditor
  label="默认能力"
  value={agent.defaultSkillIds}
  excludedIds={new Set(agent.optionalSkillIds)}
  skills={skills}
  onChange={(nextIds) =>
    setAgent((current) => current ? { ...current, defaultSkillIds: nextIds } : current)
  }
/>
```

- [ ] **Step 3: Add a second editor for optional skills and prevent duplicates**

```ts
function normalizeSkillBindings(defaultIds: string[], optionalIds: string[]) {
  const nextDefault = uniqueIds(defaultIds);
  const nextOptional = uniqueIds(optionalIds).filter((id) => !nextDefault.includes(id));
  return { defaultSkillIds: nextDefault, optionalSkillIds: nextOptional };
}
```

- [ ] **Step 4: Save the bindings with the rest of the agent detail payload**

```ts
const next = await updateAgent(agent.id, {
  // existing fields...
  defaultSkillIds: agent.defaultSkillIds,
  optionalSkillIds: agent.optionalSkillIds,
});
```

- [ ] **Step 5: Add a reset button for system agents**

```tsx
{agent.source === "system" ? (
  <Button type="button" variant="secondary" onClick={() => void handleResetToDefaults()}>
    恢复内置默认
  </Button>
) : null}
```

- [ ] **Step 6: Add a UI test covering editable skills and reset visibility**

```ts
expect(screen.getByText("恢复内置默认")).toBeInTheDocument();
expect(screen.getByLabelText("默认能力")).toBeInTheDocument();
expect(screen.getByLabelText("可选能力")).toBeInTheDocument();
```

- [ ] **Step 7: Run the targeted UI tests**

Run: `npm run test -- tests/agent-display.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/components/agents/agent-detail-screen.tsx /Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api.ts /Users/sky/SkyProjects/opencrab/tests/agent-display.test.ts
git commit -m "feat: edit and reset agent skill bindings"
```

### Task 5: Rebind the bundled defaults for the 10 core system agents

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/project-manager/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/product-manager/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/ui-designer/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/frontend-engineer/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/backend-engineer/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/ios-engineer/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/content-operator/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/growth-operator/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/hr-manager/agent.yaml`
- Modify: `/Users/sky/SkyProjects/opencrab/agents-src/system/support-specialist/agent.yaml`
- Test: `/Users/sky/SkyProjects/opencrab/tests/codex-sdk-prompt.test.ts`
- Test: `/Users/sky/SkyProjects/opencrab/tests/system-agent-authoring.test.ts`

- [ ] **Step 1: Update project/product/operations bindings to the workflow skills**

```yaml
defaultSkillIds:
  - "brainstorming"
  - "writing-plans"
  - "verification-before-completion"
optionalSkillIds:
  - "pdf"
```

- [ ] **Step 2: Update engineering bindings to TDD/debug/review workflows**

```yaml
defaultSkillIds:
  - "test-driven-development"
  - "systematic-debugging"
  - "verification-before-completion"
optionalSkillIds:
  - "requesting-code-review"
  - "receiving-code-review"
```

- [ ] **Step 3: Keep design/content/support roles mapped to the most relevant installed skills**

```yaml
defaultSkillIds:
  - "design-critique"
  - "frontend-design-polish"
  - "landing-page-composition"
optionalSkillIds:
  - "brainstorming"
  - "screenshot"
```

- [ ] **Step 4: Run the authoring/runtime tests**

Run: `npm run test -- tests/system-agent-authoring.test.ts tests/codex-sdk-prompt.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add /Users/sky/SkyProjects/opencrab/agents-src/system/project-manager/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/product-manager/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/ui-designer/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/frontend-engineer/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/backend-engineer/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/ios-engineer/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/content-operator/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/growth-operator/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/hr-manager/agent.yaml /Users/sky/SkyProjects/opencrab/agents-src/system/support-specialist/agent.yaml /Users/sky/SkyProjects/opencrab/tests/system-agent-authoring.test.ts /Users/sky/SkyProjects/opencrab/tests/codex-sdk-prompt.test.ts
git commit -m "feat: rebind core agent default skills"
```

### Task 6: Verify the full stack and clean up

**Files:**
- Verify only

- [ ] **Step 1: Run the focused checks**

Run: `npm run check:system-agents`

Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`

Expected: PASS

- [ ] **Step 4: Inspect the effective behavior manually if needed**

Run: `git diff --stat`

Expected: changed files limited to agent store, API/provider, detail UI, tests, and the 10 agent manifests

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: support editable system agent shadow profiles"
```
