# Conversation Plan Progress Design

**Date:** 2026-04-08

**Goal:** Let OpenCrab conversations show Codex execution plans as a structured checklist that updates live and visually strikes through completed steps in both the web app and the desktop app.

## Context

OpenCrab already receives rich streamed conversation updates, but the current conversation experience only exposes:

- assistant text
- thinking text
- terminal completion or failure

The Codex stream can also surface `todo_list` items. Today OpenCrab collapses those items into one plain thinking string, which loses the structure needed for a dedicated execution-plan panel.

Because the desktop app renders the same Next.js conversation UI inside Electron, the right solution is a shared conversation feature rather than a desktop-only implementation.

## Decision

Add a structured conversation-plan data path that starts at Codex stream parsing and ends in a reusable conversation message panel.

The feature will:

- translate Codex `todo_list` updates into a structured stream event
- attach the latest plan snapshot to the assistant message being streamed
- persist the final plan snapshot in local conversation history
- render the plan as a checklist with completed items visually struck through

The feature will not:

- add user-editable plan steps
- change project-team task planning
- introduce a separate runtime store just for plan progress

## Architecture

### 1. Stream protocol

Both `lib/codex/sdk.ts` and `lib/resources/opencrab-api-types.ts` will gain a structured plan event that carries normalized step records.

Each step record should be stable enough for React list rendering during a single streamed turn. A derived id of `todo-list-item-id + item index` is sufficient for this feature.

### 2. Conversation message model

`ConversationMessage` will gain a `planSteps` field. The same field will be used for:

- optimistic in-memory updates during a streamed turn
- persisted messages in the local store
- hydrated snapshots used by both web and desktop shells

### 3. Rendering

The conversation thread will render a dedicated plan panel for assistant messages when `planSteps` exists.

The panel should:

- appear in the same message card as the streamed answer
- show pending and completed states clearly
- apply line-through styling to completed items
- remain visible after completion so users can review what happened

### 4. Compatibility

Web and desktop support come from using the existing shared conversation UI and shared local snapshot model. No separate desktop-only protocol is needed.

## Data Flow

1. Codex emits a `todo_list` item update.
2. OpenCrab normalizes it into a structured plan event.
3. The conversation stream forwards that event to the client.
4. The message controller patches the in-flight assistant message with `planSteps`.
5. Final message persistence stores the latest `planSteps` snapshot.
6. The conversation thread renders the checklist in both browser and Electron shells.

## Error Handling

- If no `todo_list` is emitted, conversations keep the current behavior.
- If the stream stops early, the stopped assistant draft should retain the latest known `planSteps`.
- If a snapshot comes from older stored data without `planSteps`, rendering should simply omit the panel.

## Testing

The implementation should be verified with targeted tests for:

- streamed todo-list persistence in `runConversationTurn`
- NDJSON forwarding of plan events in `conversation-stream-service`
- local-store persistence/normalization of `planSteps`

