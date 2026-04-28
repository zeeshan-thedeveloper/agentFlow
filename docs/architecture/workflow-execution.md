# Workflow Execution Architecture

How node configs on the canvas translate into real code execution.

---

## The Problem

The canvas editor lets users build workflows visually — nodes with types, params, edges connecting them. That's all just JSON stored in `canvasJson` on the `Workflow` model. The question is: **how does that JSON become running code?**

---

## The Approach: Handler Registry (Code-First)

We follow the same pattern used by n8n, Temporal, and AWS Step Functions.

Each node type maps to a dedicated **handler class** in the backend. The executor reads the node's `type` field and dispatches to the right handler, passing the node's params as arguments.

```
canvasJson (stored in DB)
        ↓
POST /api/runs  ← user clicks "Run"
        ↓
Executor parses the graph (nodes + edges)
        ↓
Topological sort → ordered execution list
        ↓
For each node:
  handler = registry[node.type]
  output  = await handler.execute(node.params, previousOutput)
        ↓
Store result in AgentStep, stream status to frontend
```

---

## Node Types → Handlers

| Canvas Node Type | Handler Class        | What it does at runtime                            |
|------------------|----------------------|----------------------------------------------------|
| `trigger`        | `TriggerHandler`     | Validates start condition (manual or cron gate)    |
| `agent`          | `AgentHandler`       | Calls LLM API (OpenAI/Claude) with node's prompt   |
| `output`         | `OutputHandler`      | Formats result, writes to AgentStep output         |
| `condition`      | `ConditionHandler`   | Evaluates expression against prior output          |
| `tool`           | `ToolHandler`        | HTTP call, DB query, or function invocation        |

Each handler implements a single interface:

```ts
interface NodeHandler {
  execute(params: Record<string, unknown>, input: unknown): Promise<unknown>
}
```

The registry is just a plain map:

```ts
const registry: Record<string, NodeHandler> = {
  trigger:   new TriggerHandler(),
  agent:     new AgentHandler(),
  output:    new OutputHandler(),
}
```

---

## Execution Flow in Our Stack

```
Frontend (Next.js)
  └─ POST /api/workflows/:id/run
        ↓
NestJS API (apps/api)
  └─ RunsController → RunsService
        ├─ Create AgentRun (status: PENDING)
        ├─ Parse canvasJson → nodes + edges
        ├─ Topological sort nodes
        └─ For each node:
             ├─ Create AgentStep (status: RUNNING)
             ├─ registry[node.type].execute(params, input)
             ├─ Update AgentStep (output, status: COMPLETED/FAILED)
             └─ Pass output to next node
  └─ Update AgentRun (status: COMPLETED/FAILED)
        ↓
Frontend polls GET /api/runs/:id/steps → streams status updates
```

---

## What Lives Where

```
apps/api/src/
  runs/
    runs.controller.ts       ← POST /workflows/:id/run, GET /runs/:id/steps
    runs.service.ts          ← orchestrates execution loop
    executor.ts              ← topological sort + dispatch loop
  handlers/
    registry.ts              ← maps node type → handler instance
    trigger.handler.ts
    agent.handler.ts         ← calls OpenAI/Claude, uses encrypted API key
    output.handler.ts
```

Credentials (already encrypted in `UserApiKey`) are fetched by `AgentHandler` at execution time using the workflow owner's userId.

---

## Key Design Decisions

**Code-first, not eval-first.** Handlers are hardcoded TypeScript classes — no `eval()` of user-supplied code. This keeps execution predictable and secure. A `code` node type can be added later as an opt-in escape hatch with sandboxing.

**Params are inert until execution.** The canvas config is pure data. It has no side effects until the executor runs it. This means workflows can be saved, edited, and versioned freely.

**Each step is persisted.** Every `AgentStep` record stores input + output JSON. This gives us free replay, debugging, and audit history without extra work.

**Sequential for now, parallel later.** The executor runs nodes in topological order, one at a time. Nodes with no dependency on each other (parallel branches) can be `Promise.all`'d later without changing the handler interface.

---

## Current State vs Target

| Layer          | Current State                     | Target                              |
|----------------|-----------------------------------|-------------------------------------|
| Canvas         | Full visual editor, saves to DB   | Done                                |
| Run trigger    | Frontend mock (setTimeout)        | POST /runs → NestJS executor        |
| Execution      | Not implemented                   | Handler registry in NestJS          |
| Status updates | Simulated                         | Poll or SSE from AgentStep records  |
| Agent calls    | Not implemented                   | AgentHandler → OpenAI/Claude API    |
