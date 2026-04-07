# Core Agents Product V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sprawling system agent catalog with 10 high-quality, deliverable-oriented core agents and update the runtime plus product UI so each agent behaves like a role owner, not a generic persona.

**Architecture:** System agents move to a V2 contract model: a structured `agent.yaml` declares owned outcomes, deliverables, quality gates, handoff targets, and default skills, while five focused markdown files drive runtime behavior. The Agents product surface is simplified to only the 10 core roles, and Codex runtime changes from globally injected skills to agent-first skill mounting plus role-specific completion checks.

**Tech Stack:** Next.js 16, React 19, TypeScript, local file-backed stores, Codex SDK, Vitest

---

## Assumptions

- Only **system agents** are migrated in this project. Custom agents remain supported, but keep the current authoring/editing flow in this phase.
- All legacy system agents except the 10 approved core roles will be deleted from `agents-src/system/`; git history is the only rollback path.
- Team Mode stays conceptually separate. This plan only updates the current Agents product and the runtime behavior that powers agent conversations.

## Target Core Agents

- `project-manager`
- `product-manager`
- `ui-designer`
- `frontend-engineer`
- `backend-engineer`
- `ios-engineer`
- `content-operator`
- `growth-operator`
- `hr-manager`
- `support-specialist`

## Planned File Structure

### New/changed system agent source structure

```text
agents-src/system/<slug>/
  agent.yaml
  identity.md
  contract.md
  execution.md
  quality.md
  handoff.md
```

### Primary code areas

- Modify: `scripts/system_agent_authoring.mjs`
- Modify: `docs/engineering/system-agent-authoring.md`
- Modify: `lib/agents/types.ts`
- Modify: `lib/agents/system-agent-catalog.ts`
- Modify: `lib/agents/agent-store.ts`
- Modify: `lib/agents/system-agent-metadata.ts`
- Modify: `lib/agents/display.ts`
- Modify: `lib/codex/sdk.ts`
- Modify: `lib/skills/skill-store.ts`
- Modify: `components/agents/agents-screen.tsx`
- Modify: `components/agents/agent-detail-screen.tsx`
- Modify: `lib/modules/projects/project-planning-service.ts`
- Modify: `lib/projects/project-store.ts`
- Modify: tests that reference removed system agent ids
- Create: `docs/superpowers/plans/2026-04-07-core-agents-product-v2.md`

---

### Task 1: Introduce the V2 system-agent schema and parser

**Files:**
- Modify: `lib/agents/types.ts`
- Modify: `scripts/system_agent_authoring.mjs`
- Modify: `lib/agents/system-agent-catalog.ts`
- Modify: `docs/engineering/system-agent-authoring.md`
- Test: `tests/system-agent-authoring.test.ts`
- Test: `tests/agent-store.test.ts`

- [ ] **Step 1: Add the V2 metadata shape to agent types**

Define the new structured contract fields for system agents in `lib/agents/types.ts`, including:
- `familyId`, `familyLabel`, `familyOrder`
- `ownedOutcomes`
- `outOfScope`
- `deliverables`
- `defaultSkillIds`
- `optionalSkillIds`
- `qualityGates`
- `handoffTargets`

Keep custom agent compatibility by making the new contract fields available on records/details while allowing legacy custom-agent data to omit them.

- [ ] **Step 2: Replace the fixed section schema in authoring utilities**

Update `scripts/system_agent_authoring.mjs` so system agents are compiled from:
- `identity.md`
- `contract.md`
- `execution.md`
- `quality.md`
- `handoff.md`

Also update validation so missing or empty files throw clear authoring errors.

- [ ] **Step 3: Update runtime compilation for V2 metadata**

Modify `lib/agents/system-agent-catalog.ts` to:
- parse the new metadata fields
- expose family-level display data
- build runtime file content from the five new section files
- stop depending on `collectionId` / `groupId` semantics as the primary product model

- [ ] **Step 4: Update docs for the new source-of-truth format**

Rewrite `docs/engineering/system-agent-authoring.md` so it documents:
- the 10-role core model
- the new file structure
- the new `agent.yaml` fields
- the removal of the imported Agency Agents catalog

- [ ] **Step 5: Write failing parser tests**

Add tests that fail until the new V2 schema works:
- system agent with full V2 contract compiles successfully
- missing `contract.md`/`quality.md`/etc. fails
- empty arrays normalize safely
- removed collection/group assumptions are not required for V2 system agents

Run: `npm run test -- tests/system-agent-authoring.test.ts tests/agent-store.test.ts`

Expected: initial failures for missing parser/type support, then pass after implementation.

- [ ] **Step 6: Commit**

```bash
git add lib/agents/types.ts scripts/system_agent_authoring.mjs lib/agents/system-agent-catalog.ts docs/engineering/system-agent-authoring.md tests/system-agent-authoring.test.ts tests/agent-store.test.ts
git commit -m "refactor: add core agent v2 schema"
```

### Task 2: Replace the system source tree with the 10 approved core agents

**Files:**
- Modify: `agents-src/system-groups.json`
- Delete: every legacy directory under `agents-src/system/` except the 10 target slugs
- Create: `agents-src/system/project-manager/*`
- Create: `agents-src/system/product-manager/*`
- Create: `agents-src/system/ui-designer/*`
- Create: `agents-src/system/frontend-engineer/*`
- Create: `agents-src/system/backend-engineer/*`
- Create: `agents-src/system/ios-engineer/*`
- Create: `agents-src/system/content-operator/*`
- Create: `agents-src/system/growth-operator/*`
- Create: `agents-src/system/hr-manager/*`
- Create: `agents-src/system/support-specialist/*`
- Test: `npm run check:system-agents`

- [ ] **Step 1: Reduce the family registry**

Rewrite `agents-src/system-groups.json` into a minimal family registry for:
- `strategy-delivery`
- `design`
- `engineering`
- `growth-operations`
- `people-support`

Remove `agency-agents`, all imported group definitions, and all catalog language that implies a large extension library.

- [ ] **Step 2: Author the 10 new manifests**

For each retained core agent, write `agent.yaml` with:
- approved id and name
- one-line summary focused on owned outcomes
- family id
- team role and availability
- deliverables
- quality gates
- default skills
- handoff targets
- promoted flag set for product-facing roles as needed

- [ ] **Step 3: Author the five role docs per agent**

For each core agent, create:
- `identity.md`
- `contract.md`
- `execution.md`
- `quality.md`
- `handoff.md`

The content must explicitly encode:
- what the role owns
- what it refuses
- what “deliverable-ready” means
- when it should transfer work to another core agent

- [ ] **Step 4: Delete all legacy system-agent directories**

After the 10 target directories compile, delete every other directory in `agents-src/system/`.

Run: `find agents-src/system -maxdepth 1 -mindepth 1 -type d | sort`

Expected: only the 10 target slugs remain.

- [ ] **Step 5: Verify the new source tree compiles**

Run: `npm run check:system-agents`

Expected: all 10 system agents compile cleanly with no missing section or metadata errors.

- [ ] **Step 6: Commit**

```bash
git add agents-src/system agents-src/system-groups.json
git commit -m "refactor: replace legacy system agents with core v2 roles"
```

### Task 3: Update agent-store records and cleanup logic for the reduced catalog

**Files:**
- Modify: `lib/agents/agent-store.ts`
- Modify: `lib/agents/system-agent-metadata.ts`
- Modify: `lib/agents/display.ts`
- Test: `tests/agent-store.test.ts`

- [ ] **Step 1: Update record normalization for new system fields**

Make sure `listAgentProfiles()` and `getAgentProfile()` expose the V2 contract fields on system-agent records/details while leaving custom-agent persistence intact.

- [ ] **Step 2: Replace collection/group-centric sorting and display assumptions**

Update agent sorting and display helpers so the product surface sorts by:
- source (`system` first)
- family order
- promoted
- name

Remove display assumptions that rely on `collectionId === "opencrab-core"` or `agency-agents`.

- [ ] **Step 3: Expand startup cleanup for removed system ids**

Adjust cleanup logic so local mirrored copies of deleted legacy system agents are removed automatically and do not survive after the catalog reduction.

- [ ] **Step 4: Update unit tests for the 10-agent world**

Rewrite expectations in `tests/agent-store.test.ts` so they assert:
- only the new system agents exist
- deleted ids no longer load
- sandbox/team-role defaults still normalize correctly

Run: `npm run test -- tests/agent-store.test.ts`

Expected: pass with no references to removed legacy ids.

- [ ] **Step 5: Commit**

```bash
git add lib/agents/agent-store.ts lib/agents/system-agent-metadata.ts lib/agents/display.ts tests/agent-store.test.ts
git commit -m "refactor: align agent store with core v2 catalog"
```

### Task 4: Make runtime agent-first instead of global-skill-first

**Files:**
- Modify: `lib/codex/sdk.ts`
- Modify: `lib/skills/skill-store.ts`
- Test: `tests/agent-display.test.ts`
- Test: `tests/runtime-startup.test.ts`
- Test: add or extend a runtime prompt/unit test near `lib/codex/sdk.ts`

- [ ] **Step 1: Add agent-aware skill selection helpers**

Add helper logic that can derive:
- globally installed skills
- agent default skills
- agent optional skills
- disabled/unavailable skills

This can live in `lib/skills/skill-store.ts` or a small helper alongside `lib/codex/sdk.ts`, but keep the responsibility focused.

- [ ] **Step 2: Update prompt construction**

Change `buildPrompt()` in `lib/codex/sdk.ts` so when an `agentProfile` is present it:
- emphasizes the role contract and deliverable expectations
- only advertises the agent’s mounted skills, not the entire installed skill catalog
- tells the model to finish within role scope before handing off
- instructs it to treat quality gates as completion requirements

- [ ] **Step 3: Preserve fallback behavior for non-agent conversations**

Ensure ordinary non-agent conversations still work with current global skill behavior, so this refactor does not break the default assistant mode.

- [ ] **Step 4: Add verification tests**

Add or update tests that prove:
- agent-bound conversations receive agent-first instructions
- non-agent conversations still receive existing fallback behavior
- disabled skills are still excluded

Run: `npm run test -- tests/runtime-startup.test.ts tests/agent-display.test.ts`

Expected: pass after runtime prompt changes.

- [ ] **Step 5: Commit**

```bash
git add lib/codex/sdk.ts lib/skills/skill-store.ts tests/runtime-startup.test.ts tests/agent-display.test.ts
git commit -m "refactor: mount skills by core agent contract"
```

### Task 5: Redesign the Agents index page around 10 productized roles

**Files:**
- Modify: `components/agents/agents-screen.tsx`
- Modify: `components/agents/agent-avatar.tsx` (only if card treatment needs small support changes)
- Test: `tests/agent-display.test.ts`

- [ ] **Step 1: Remove catalog-size and imported-library language**

Rewrite the screen so it no longer talks about:
- total system count as a selling point
- OpenCrab core vs extension library
- collection/group browsing

- [ ] **Step 2: Present each core agent as a role card**

Each card should foreground:
- owned outcome
- default deliverables
- primary use cases
- clear “not for” boundary

Keep the CTA focused on handing work to the role, not “chatting with a persona.”

- [ ] **Step 3: Simplify filtering**

With only 10 system roles, remove the current collection/group directory logic. Keep:
- search
- system vs custom separation
- optional lightweight family filtering only if it improves scanning

- [ ] **Step 4: Update display tests**

Add assertions for:
- only the 10 system agents appear as default core roles
- no extension-library language remains
- system cards still support starting a conversation

Run: `npm run test -- tests/agent-display.test.ts`

Expected: pass with the new role-card presentation.

- [ ] **Step 5: Commit**

```bash
git add components/agents/agents-screen.tsx components/agents/agent-avatar.tsx tests/agent-display.test.ts
git commit -m "feat: redesign agents index around core roles"
```

### Task 6: Redesign the agent detail page into a role contract page

**Files:**
- Modify: `components/agents/agent-detail-screen.tsx`
- Modify: `lib/resources/opencrab-api-types.ts` (if API response typing needs the new fields surfaced)
- Modify: `lib/resources/opencrab-api.ts` (only if client typing needs touch-up)

- [ ] **Step 1: Replace legacy section framing**

For system agents, stop presenting the detail page as a legacy “five fixed context files” inspector. Instead, show:
- role positioning
- owned outcomes
- out-of-scope work
- default deliverables
- default workflow/skills
- quality gates
- handoff rules

- [ ] **Step 2: Keep custom-agent editing stable**

Custom agents can keep the editable legacy UI in this phase. If needed, branch the detail surface:
- system agent = productized contract display
- custom agent = editable legacy form

- [ ] **Step 3: Make the CTA result-oriented**

Update labels and support copy so the detail page communicates:
- this role owns a result
- outputs are meant to be directly usable
- handoff happens only outside role scope

- [ ] **Step 4: Smoke-check the page manually**

Run: `npm run dev`

Open:
- `/agents`
- `/agents/project-manager`
- `/agents/frontend-engineer`

Expected: system agent detail reads like a role contract, not a prompt file browser.

- [ ] **Step 5: Commit**

```bash
git add components/agents/agent-detail-screen.tsx lib/resources/opencrab-api-types.ts lib/resources/opencrab-api.ts
git commit -m "feat: present system agents as role contracts"
```

### Task 7: Update Team defaults and project planning to the new core ids

**Files:**
- Modify: `lib/agents/agent-store.ts`
- Modify: `lib/modules/projects/project-planning-service.ts`
- Modify: `lib/projects/project-store.ts`
- Modify: project-related tests that hardcode removed ids
- Test: `tests/project-store-team-coordination.test.ts`
- Test: `tests/project-store-planning-create.test.ts`
- Test: `tests/project-store-runtime-operations.test.ts`

- [ ] **Step 1: Replace removed default team members**

Update any helper that currently recommends or injects removed ids like:
- `user-researcher`
- `aesthetic-designer`
- other deleted legacy roles

Use the new core set instead.

- [ ] **Step 2: Update planner copy and recommendation logic**

Ensure project planning prompts and fallbacks describe the new core roles, not the removed group/collection catalog.

- [ ] **Step 3: Update project-store assumptions**

Review `lib/projects/project-store.ts` for hardcoded references to removed ids or old core-team compositions. Replace them with the new core role assumptions while preserving PM ownership semantics.

- [ ] **Step 4: Rewrite affected tests**

Update project/team tests so they:
- use the new core ids
- stop expecting removed agent names
- still verify runtime propagation, mailbox coordination, and team setup behavior

Run: `npm run test -- tests/project-store-team-coordination.test.ts tests/project-store-planning-create.test.ts tests/project-store-runtime-operations.test.ts`

Expected: pass with the new core role set.

- [ ] **Step 5: Commit**

```bash
git add lib/agents/agent-store.ts lib/modules/projects/project-planning-service.ts lib/projects/project-store.ts tests/project-store-team-coordination.test.ts tests/project-store-planning-create.test.ts tests/project-store-runtime-operations.test.ts
git commit -m "refactor: align team planning with core role set"
```

### Task 8: Remove legacy references and finish repository-wide cleanup

**Files:**
- Modify: any remaining files matched by `rg` for removed agent ids
- Modify: docs that still mention extension system agents
- Test: targeted Vitest files from the search results

- [ ] **Step 1: Search for removed ids and old catalog wording**

Run:

```bash
rg -n "user-researcher|aesthetic-designer|agency-agents|扩展角色库|collectionId|groupId" app lib tests docs
```

Expected: collect the remaining cleanup list.

- [ ] **Step 2: Remove or rewrite every stale reference**

Update code, tests, and docs until the removed ids and old product model are gone everywhere that matters.

- [ ] **Step 3: Re-run system-agent verification and static checks**

Run:

```bash
npm run check:system-agents
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm run test
```

Expected: full test suite passes with only the 10 system agents remaining.

- [ ] **Step 5: Commit**

```bash
git add docs app lib tests
git commit -m "chore: remove legacy system agent references"
```

## Final Verification Checklist

- [ ] `agents-src/system/` contains only the 10 approved core roles
- [ ] `npm run check:system-agents` passes
- [ ] agent-bound conversations use role-specific contract + mounted skills
- [ ] Agents index page presents 10 role-owner cards, not a giant catalog
- [ ] system agent detail pages present deliverables, quality gates, and handoff rules
- [ ] Team planning defaults no longer rely on deleted legacy ids
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes

## Risks To Watch During Execution

- Custom-agent editing may accidentally inherit system-agent-only assumptions if shared types are changed carelessly.
- Team Mode currently references older role ids in multiple places; deleting the legacy catalog before updating those paths will break project creation and runtime flows.
- Prompt changes in `lib/codex/sdk.ts` must preserve the non-agent conversation path.
- UI copy can regress into “persona” language unless the new role-contract framing is enforced consistently.

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
