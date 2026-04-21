# Conversation Plan Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live checklist-style execution-plan rendering for conversation turns by preserving Codex `todo_list` updates as structured assistant message data.

**Architecture:** Extend the shared conversation stream contract with a plan event, persist the latest plan snapshot on `ConversationMessage`, and render it in the shared conversation message card so the web app and Electron desktop inherit the same behavior.

**Tech Stack:** Next.js App Router, React client components, Electron shell, Codex SDK, local JSON store, Vitest

---

## Planned File Structure

- Modify: `/Users/sky/SkyProjects/opencrab/lib/seed-data.ts` - Add shared conversation plan-step types.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api-types.ts` - Add structured plan stream events.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/codex/sdk.ts` - Emit structured plan updates from `todo_list` items.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/conversations/run-conversation-turn.ts` - Persist streamed and final plan snapshots.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/modules/conversations/conversation-stream-service.ts` - Forward plan events and preserve stopped-state plan snapshots.
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/local-store.ts` - Normalize and clone `planSteps`.
- Modify: `/Users/sky/SkyProjects/opencrab/components/app-shell/use-opencrab-message-controller.ts` - Patch optimistic assistant messages with live plan updates.
- Modify: `/Users/sky/SkyProjects/opencrab/components/app-shell/opencrab-provider.tsx` - Include `planSteps` in message equality checks.
- Modify: `/Users/sky/SkyProjects/opencrab/components/conversation/conversation-thread.tsx` - Render a plan checklist panel.
- Modify: `/Users/sky/SkyProjects/opencrab/tests/run-conversation-turn.test.ts` - Add failing persistence coverage for plan updates.
- Modify: `/Users/sky/SkyProjects/opencrab/tests/conversation-stream-service.test.ts` - Add failing forwarding coverage for plan events.

### Task 1: Add failing tests for live plan propagation

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/tests/run-conversation-turn.test.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/tests/conversation-stream-service.test.ts`

- [ ] **Step 1: Add a failing runConversationTurn test for streamed plan snapshots**
- [ ] **Step 2: Run the targeted runConversationTurn test and watch it fail**
- [ ] **Step 3: Add a failing conversation-stream-service test for forwarded `plan` events**
- [ ] **Step 4: Run the targeted stream-service test and watch it fail**

### Task 2: Implement shared structured plan data

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/lib/seed-data.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/opencrab-api-types.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/codex/sdk.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/conversations/run-conversation-turn.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/modules/conversations/conversation-stream-service.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/lib/resources/local-store.ts`

- [ ] **Step 1: Add the shared `ConversationPlanStep` type and message field**
- [ ] **Step 2: Extend stream event unions with the new structured `plan` event**
- [ ] **Step 3: Emit `plan` events from Codex `todo_list` updates**
- [ ] **Step 4: Persist the latest plan snapshot during streaming, completion, and stop paths**
- [ ] **Step 5: Re-run the targeted tests and get them green**

### Task 3: Render the plan panel in shared conversation UI

**Files:**
- Modify: `/Users/sky/SkyProjects/opencrab/components/app-shell/use-opencrab-message-controller.ts`
- Modify: `/Users/sky/SkyProjects/opencrab/components/app-shell/opencrab-provider.tsx`
- Modify: `/Users/sky/SkyProjects/opencrab/components/conversation/conversation-thread.tsx`

- [ ] **Step 1: Patch optimistic assistant messages with incoming `plan` updates**
- [ ] **Step 2: Include `planSteps` in snapshot equality checks**
- [ ] **Step 3: Add a checklist-style plan panel with struck-through completed items**
- [ ] **Step 4: Run the targeted test suite and typecheck**

