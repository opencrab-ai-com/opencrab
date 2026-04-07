# Workflow Engine Design

**Date:** 2026-04-07

**Goal:** Introduce `Workflow` as a first-class OpenCrab product object for flexible work orchestration. V1 should ship a canvas-based workflow builder with a small node vocabulary, explicit runtime semantics, review-thread-based human intervention, and a first validation scenario in content production.

## Context

OpenCrab already has several adjacent concepts:

- conversations as context and result surfaces
- channels as delivery surfaces
- teams as ownership and governance surfaces
- scheduled tasks as background execution

But the product does not yet have a single object that expresses:

- a reusable work definition
- a graph of execution steps
- runtime records per execution
- human intervention points during execution
- explicit result delivery at the end of a run

The user goal for this design is not a fixed content template system. It is a **flexible workflow orchestration capability** with these product principles:

1. The builder must feel flexible rather than template-locked.
2. Node types should remain intentionally small in V1.
3. Work that can be solved with scripts should avoid model cost at runtime.
4. Configuration should feel natural-language friendly without hiding execution semantics.
5. Human intervention should feel like OpenCrab review collaboration, not a traditional automation control panel.

## Decision

Introduce `Workflow` as a new first-class object in the product.

`Workflow` is not:

- a `Task`
- a `Conversation`
- a `Channel`
- a `Team`

It is the reusable definition of **how work should run**.

In V1, workflow authoring is canvas-first and flexible, but the node vocabulary is intentionally constrained:

- `Start`
- `Script`
- `Agent`
- `End`

Control flow is supported through edges and graph topology rather than more node types.

## Product Positioning

### Workflow

A workflow defines:

- how execution starts
- which nodes run
- how nodes connect
- where conditional branches split
- where parallel branches fan out and merge
- how a run ends
- where final results are delivered

### Conversations and Channels

Conversations and channels are result surfaces and delivery destinations. They are not the workflow definition itself.

### Teams

Teams can own workflows and govern how they are reviewed and operated, but the workflow remains its own object.

### Tasks

`Task` is intentionally out of the V1 core model.

This design does not require workflow runs to create, depend on, or synchronize with tasks. If product-production workflows later need a separate work-item abstraction, that can be designed independently rather than forced into V1.

## V1 Scope

V1 includes:

- `Workflow` as a first-class object
- workflow ownership by person or team
- creation from blank canvas
- creation from AI-generated draft
- versioned workflow definitions
- manual and scheduled start triggers
- graph execution with:
  - conditional branching
  - parallel fan-out
  - parallel merge
- hybrid node configuration UI
- human intervention via `Review Center`
- final delivery via `End` node
- a unified review-item model with a content-specific `Pending Publish` view

V1 explicitly excludes:

- event-triggered starts
- webhook / external triggers
- loops
- automatic retry
- automatic publish
- additional node types beyond the initial four
- task integration as part of the core runtime model

## Object Model

### Workflow

A workflow is the top-level owned object.

Suggested core fields:

- `id`
- `name`
- `description`
- `ownerType` (`person` | `team`)
- `ownerId`
- `status` (`draft` | `active` | `paused` | `archived`)
- `activeVersionId`
- `createdAt`
- `updatedAt`

### Workflow Version

Workflow definitions are versioned. A workflow version stores the executable graph.

Suggested core fields:

- `id`
- `workflowId`
- `versionNumber`
- `status` (`draft` | `published`)
- `graph`
- `createdAt`
- `updatedAt`
- `publishedAt`

`graph` contains:

- nodes
- edges
- layout metadata
- workflow-level defaults

### Workflow Node

Each node must have:

- `id`
- `type`
- `name`
- `config`
- `uiPosition`

V1 node types:

#### Start Node

Defines how a run begins.

V1 supported triggers:

- manual
- schedule

#### Script Node

Executes a generated script at runtime without model token cost.

Important product behavior:

- users do not need to write scripts manually
- scripts are generated and refined through AI conversation
- script assets are inspectable
- script assets are versioned
- scripts can be tested and rolled back

#### Agent Node

Uses an AI execution step that consumes tokens at runtime.

Important product behavior:

- the node can be defined inline
- or it can bind to an existing OpenCrab agent

#### End Node

The end node is not just a stop marker. It is responsible for:

- declaring run completion
- defining final delivery behavior

### Workflow Edge

Edges connect nodes and express runtime routing.

Suggested core fields:

- `id`
- `sourceNodeId`
- `targetNodeId`
- `condition`
- `label`

Edges do not introduce a separate condition-node type in V1.

Conditional logic is attached to edges.

### Condition Model

Condition authoring is hybrid:

1. User describes the rule in natural language.
2. System extracts an explicit structured rule.
3. User confirms the structured rule before execution.

This preserves natural configuration while keeping execution deterministic.

## Graph Semantics

### Conditional Branching

V1 supports `if / else` style branching by attaching conditions to outgoing edges.

Examples:

- `score > 80`
- `platform includes xhs`
- `topicCategory == "agent-product"`

### Parallel Fan-out

A node may send output to multiple downstream nodes.

This is a first-class V1 capability because one input may need to generate multiple downstream artifacts, such as:

- X output
- Xiaohongshu output

### Parallel Merge

When a node has multiple upstream dependencies, V1 merge behavior is:

- wait for **all** upstream nodes to complete
- then execute

V1 does not support configurable "any upstream is enough" merge semantics.

## Data Passing Model

Data passing uses a hybrid approach:

- default: shared context package
- advanced: explicit input mapping

This means users do not need to map every field in normal cases, but more advanced workflows can pin a node to specific upstream outputs.

## Ownership Model

Workflow ownership must be explicit at creation time:

- `person`
- `team`

Ownership may be changed later.

This keeps the model flexible enough for both:

- personal content workflows
- team-owned operational workflows

## Creation Model

Workflow creation supports two entry paths:

1. blank canvas
2. AI-generated draft

AI-generated workflows are always drafts first.

Users return to the canvas to:

- inspect nodes
- inspect edges
- adjust configuration
- publish intentionally

This prevents natural-language generation from becoming invisible runtime magic.

## Builder Interaction Model

### Canvas First

The main authoring surface is a workflow canvas.

The canvas is responsible for:

- node placement
- edge creation
- branch visibility
- merge visibility
- path readability

### Hybrid Inspector

Node configuration uses a hybrid interaction model:

- visible structured configuration
- AI-assisted conversation for generation and change

The product should not choose between "all forms" and "all chat."

Instead:

- structure remains inspectable
- AI helps author, revise, explain, and test configuration

### Start Node Configuration

Start node configuration behaves like trigger setup.

V1 supports:

- manual run
- schedule definition

### Script Node Configuration

Script nodes are the strongest case for hybrid interaction.

Default experience:

- configure in natural language
- let AI generate or revise the script

Optional advanced experience:

- expand to inspect script contents
- test node execution
- review script versions
- roll back script versions

The script is not the primary configuration object, but it must be auditable.

### Agent Node Configuration

Agent nodes also use hybrid configuration.

Supported modes:

- define node behavior inline
- bind execution to an existing agent

The node should make the following visible:

- purpose
- expected input
- expected output
- token-using execution mode

### Edge Configuration

Condition edges are configured by selecting the edge.

The system should not add a separate "condition node" in V1.

## Runtime Model

### Workflow Run

Each execution creates a run object.

Suggested core fields:

- `id`
- `workflowId`
- `workflowVersionId`
- `status`
- `startedAt`
- `completedAt`
- `initiatedBy`

Runs bind to the workflow version active at start time.

If a new workflow version is later published:

- in-progress or paused runs continue on their original version
- new runs use the newly published version

### Node Run

Each node execution should also be recorded independently.

Suggested fields:

- `id`
- `runId`
- `nodeId`
- `status`
- `attemptCount`
- `inputSnapshot`
- `outputSnapshot`
- `startedAt`
- `completedAt`

### Human Intervention

Human intervention is not represented by another node type.

Instead, any node can be configured or transition into:

- `waiting_for_human`

This preserves a small node vocabulary while allowing meaningful operational pauses.

### Failure Behavior

V1 failure behavior is intentionally explicit:

- node failure immediately enters `Review Center`
- the system does not auto-retry

In `Review Center`, the user decides whether to:

- retry
- edit the current run input
- inspect outputs
- change only this run
- propose a workflow-definition change

### Retry Behavior

If the user edits inputs and retries:

- only the current node reruns by default

The runtime does **not** automatically rerun downstream nodes.

Instead, previously completed downstream results that may now be invalid are marked:

- `stale`

This keeps retry interaction lightweight while still protecting correctness.

## Review Model

### Review Center

`Review Center` is the default surface for human intervention.

It should not behave like a cold approval queue.

It should behave like a **review thread**, where the user can:

- see why the run paused
- inspect the current node output
- inspect relevant upstream context
- talk with AI about what to do next
- retry or revise

### Review Item

At the data-model level, V1 should use one unified review-item concept.

This model supports:

- paused workflow nodes
- pending publish items
- future reviewable workflow outputs

### Pending Publish

`Pending Publish` should not be implemented as a separate bottom-layer object.

Instead:

- `Pending Publish` is a specialized view over the unified review-item model
- content-oriented outputs get a dedicated presentation surface

This gives content workflows a stronger product entry point without fragmenting the core model.

In product terms:

- `Review Center` is the general operational review surface
- `Pending Publish` is the content-specific surface over the same review-item foundation

### Change Scope in Review

Any change made from a review thread must explicitly distinguish between:

- change this run only
- update the workflow definition

If the change targets the workflow definition:

- it becomes a new draft version
- it does not silently mutate the published version

## Draft and Publish Model

Workflow-definition changes must be version-safe.

Rules:

- changes to workflow structure or definition create/update a draft version
- draft versions do not affect active runs
- a draft only becomes live after explicit publish

This applies especially to:

- script changes intended to persist
- agent-node definition changes intended to persist
- edge-condition changes intended to persist
- topology changes intended to persist

## End Node and Delivery Model

The end node defines both:

- run completion
- result delivery

V1 delivery should use:

- one primary destination
- optional mirrored destinations

Examples:

- primary: `Pending Publish`
- mirror: `Conversation`

Possible delivery destinations include:

- `Review Center`
- `Pending Publish`
- `Conversation`
- `Channel`

This model keeps delivery understandable while still allowing lightweight synchronization into familiar OpenCrab surfaces.

The destinations are not flat peers in the interaction model:

- the primary destination is the source of truth for post-run handling
- mirrored destinations are synchronized surfaces, not co-equal control surfaces

## First Validation Scenario

The first validation scenario for the engine is content production, especially:

- hot-topic tracking
- information collection
- signal processing
- opinion generation
- X / Xiaohongshu draft preparation
- human review before publishing

This scenario is intentionally used to validate the engine, not to reduce the engine into a content-only feature.

The long-term engine must also support product-production workflows, but that is not required for V1 scope.

## Why This Design Fits OpenCrab

This design keeps the product aligned with OpenCrab's broader philosophy:

- flexible, but not raw infrastructure exposure
- AI-native, but not AI-only
- background-capable, but still reviewable
- structured enough to execute reliably
- conversational enough to stay humane

The most important product tradeoff in this design is:

- flexibility comes from graph composition
- simplicity comes from a very small node vocabulary

That combination is what keeps V1 usable without collapsing into either:

- a rigid template engine
- or an expert-only orchestration console

## Implementation Notes for Planning

The next implementation plan should likely split into these tracks:

1. workflow object and version model
2. canvas and inspector authoring UI
3. runtime graph execution model
4. review-item and pending-publish model
5. first content-workflow validation path

That plan should be written separately after spec review.
