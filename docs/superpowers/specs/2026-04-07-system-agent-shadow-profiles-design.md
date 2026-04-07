# System Agent Shadow Profiles Design

**Date:** 2026-04-07

**Goal:** Let users edit built-in system agents from the product UI without exposing source files, and persist those edits under `~/.opencrab` as user-owned shadow profiles. The first shipped editing surface must include skill bindings and rebinding for the current 10 core agents.

## Context

OpenCrab currently treats the 10 core system agents as read-only built-ins loaded from [agents-src/system](/Users/sky/SkyProjects/opencrab/agents-src/system). Their profile metadata, prompt files, and default skill bindings come from the app bundle and are shown in the UI, but they are not editable from the product. Custom agents already persist to `~/.opencrab/agents/<agentId>/`, so the runtime has a user-data home and a profile persistence model, but that model only applies to `source: "custom"` agents.

This creates two product problems:

1. Users can see a system agent's bound skills but cannot change them in the UI.
2. Any system-agent customization would currently require editing bundled source files, which is not acceptable for a user-facing desktop product.

## Decision

Introduce **system agent shadow profiles** stored inside the OpenCrab runtime home. Built-in system agents remain the immutable defaults shipped with the app, but any user edit creates or updates a shadow copy under `~/.opencrab`. Reads merge the built-in definition with the shadow copy. Writes only touch the shadow copy.

This is intentionally broader than a skill-only override layer. We want one user-owned persistence model for system-agent customization so future editable fields do not need a second migration.

## Storage Model

### Runtime Paths

System-agent shadow profiles live under:

```text
~/.opencrab/agents/system/<agentId>/
  profile.json
  identity.md
  contract.md
  execution.md
  quality.md
  handoff.md
```

Custom agents continue to live under:

```text
~/.opencrab/agents/<agentId>/
```

This keeps system overrides clearly separated from custom agents while reusing the same file conventions.

### Shadow Profile Semantics

Each system-agent shadow profile stores a normalized full profile snapshot in the same V2 shape used by custom agents:

- profile metadata
- family metadata
- deliverables
- default and optional skill bindings
- quality gates
- handoff targets
- starter prompts
- the five contract files

The shadow profile is treated as the user's current effective version of that built-in agent. We do not store partial field patches in v1 of this design because:

- full snapshots simplify reads
- deletes and reset-to-default become easier
- API and UI code can operate on one consistent shape
- future editable fields do not require schema branching

## Read and Write Flow

### Read Path

When reading an agent:

1. Load the built-in system agent from the bundled catalog.
2. Check whether `~/.opencrab/agents/system/<agentId>/profile.json` exists.
3. If not, return the built-in agent unchanged.
4. If yes, load the shadow profile, normalize it, and return it as the effective agent detail.

Important behavior:

- The agent still has `source: "system"`.
- The user is editing a system role, not converting it into a custom role.
- Built-in defaults still exist as the reset target.

### Write Path

When updating a system agent from the product:

1. Read the effective current system agent.
2. Apply the requested patch.
3. Normalize the result into a complete V2 profile.
4. Persist it to `~/.opencrab/agents/system/<agentId>/`.
5. Return the normalized effective detail.

For custom agents, existing update behavior remains the same.

### Reset Path

System agents gain a new product action:

- `Restore Built-In Defaults`

This deletes `~/.opencrab/agents/system/<agentId>/` and causes the next read to fall back to the bundled definition.

This reset must clear:

- skill bindings
- editable metadata
- starter prompts
- the five contract files

## Product Scope

### What Becomes Editable Now

The product must support editing system-agent skill bindings immediately.

The same shadow-profile pipeline should also support the fields already present in the system-agent detail form so the UI is internally consistent:

- default model
- reasoning effort
- sandbox mode
- starter prompts
- the five contract files

The first visible product enhancement in this task is the skill-binding editor, but the persistence model should not special-case it.

### Skill Editing UX

On the agent detail page:

- Replace the display-only skill list with editable controls.
- Show available installed skills from the OpenCrab skill catalog.
- Let users assign skills into two buckets:
  - default skills
  - optional skills
- Prevent duplicates across buckets.
- Allow empty states.
- Show a clear distinction between:
  - bundled recommendation
  - current effective binding

For system agents, also show:

- `Restore Built-In Defaults`

This is the product equivalent of "discard my local shadow copy".

## Agent-Store Architecture Changes

The current store has two hard branches:

- system agents read from bundled catalog only
- custom agents read from `~/.opencrab/agents/<agentId>/`

The new architecture should become:

- bundled system catalog
- system shadow profile directory
- custom profile directory

Conceptually:

```text
effective system agent = built-in system agent + optional shadow profile
effective custom agent = persisted custom profile
```

This requires:

1. a dedicated system-shadow directory helper
2. read helpers for shadow profiles
3. write helpers for system shadow profiles
4. reset helpers that remove a shadow profile
5. update logic that no longer rejects `source: "system"`

## API Changes

The agent mutation API must expose all fields needed for effective system-agent editing.

At minimum:

- `defaultSkillIds`
- `optionalSkillIds`

And because we are using full shadow profiles, the shared mutation input should remain valid for:

- starter prompts
- model settings
- files

The API does not need a second system-only endpoint. The existing create/update detail endpoints are enough if the server-side store handles system profiles correctly.

One new endpoint behavior is needed:

- system-agent reset action, either via
  - a dedicated endpoint, or
  - an explicit mutation action

The simpler product/API shape is a dedicated reset endpoint or an explicit `POST /reset` action because reset is not a normal patch.

## Runtime Behavior

Codex runtime already reads `defaultSkillIds` and `optionalSkillIds` from the selected agent profile. Once the effective system agent comes from the merged shadow profile, runtime behavior updates automatically.

No second runtime-specific override layer should be added. The agent store remains the single source of truth for effective bindings.

## Skill Rebinding Strategy

The current system-agent defaults are still conservative and do not fully reflect the newly installed superpowers workflow skills. This task should ship with a rebinding pass for the 10 core roles.

Recommended direction:

### Project Manager

- default: `brainstorming`, `writing-plans`, `verification-before-completion`
- optional: `dispatching-parallel-agents`, `subagent-driven-development`, `pdf`

### Product Manager

- default: `brainstorming`, `writing-plans`, `verification-before-completion`
- optional: `pdf`, `design-critique`, `screenshot`

### UI Designer

- default: `design-critique`, `frontend-design-polish`, `landing-page-composition`
- optional: `brainstorming`, `screenshot`, `verification-before-completion`

### Frontend Engineer

- default: `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `playwright`
- optional: `requesting-code-review`, `receiving-code-review`, `frontend-design-polish`, `screenshot`

### Backend Engineer

- default: `test-driven-development`, `systematic-debugging`, `verification-before-completion`
- optional: `requesting-code-review`, `receiving-code-review`, `pdf`

### iOS Engineer

- default: `test-driven-development`, `systematic-debugging`, `verification-before-completion`
- optional: `requesting-code-review`, `receiving-code-review`, `screenshot`, `design-critique`

### Content Operator

- default: `brainstorming`, `writing-plans`, `speech`
- optional: `pdf`, `verification-before-completion`, `screenshot`

### Growth Operator

- default: `brainstorming`, `writing-plans`, `verification-before-completion`
- optional: `pdf`, `screenshot`, `dispatching-parallel-agents`

### HR Manager

- default: `brainstorming`, `writing-plans`, `verification-before-completion`
- optional: `pdf`, `speech`

### Support Specialist

- default: `brainstorming`, `verification-before-completion`, `speech`
- optional: `writing-plans`, `pdf`

These defaults should remain bundled defaults. User changes then layer on top through the new shadow-profile system.

## Testing

The change needs coverage in four places:

1. **Agent store**
   - reads built-in system agent with no shadow profile
   - reads built-in system agent with shadow profile
   - updates a system agent and persists a shadow profile under `~/.opencrab`
   - resets a system agent and restores bundled defaults

2. **API/service layer**
   - accepts `defaultSkillIds` and `optionalSkillIds`
   - updates system agents instead of rejecting them

3. **UI**
   - system-agent detail form can edit and save skill bindings
   - reset button appears for system agents

4. **Runtime**
   - Codex prompt uses rebound system-agent skills after a shadow-profile update

## Migration and Safety

- Existing bundled system agents remain the fallback source of truth.
- Existing custom agents remain untouched.
- Existing read-only system-agent experience continues to work if no shadow profile exists.
- A malformed shadow profile should fail closed: ignore it, log the issue if practical, and fall back to the bundled system agent rather than breaking the agent list.

## Non-Goals

This task does not include:

- exposing bundled source files to end users
- introducing a separate system-agent marketplace format
- making every field in the agent detail UI editable if the form does not already support it
- changing the 10-core-agent product model

## Open Questions Resolved

- **Where should system-agent edits live?** Under `~/.opencrab`, not in bundled source directories.
- **Should this be skill-only or full-profile?** Full-profile shadow copies.
- **Should system agents stay system agents after editing?** Yes.
- **What is the first product-visible capability?** Skill rebinding from the agent detail page.
