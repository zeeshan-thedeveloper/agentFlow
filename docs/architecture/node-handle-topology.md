# Node Handle Topology — Typed Connection System

> Written: 2026-05-20
> Updated: 2026-05-20 — Database node split into connection-config-only + Query Runner executor
> Updated: 2026-05-20 — Database node gets Read/Write output handles; Schema/Query Runner get db-in; Trigger gets trigger-out
> Status: Approved — ready for implementation

---

## Core Design Principle

**One node, one job.** Each node does exactly one thing. Connection config, schema introspection, query execution, and LLM reasoning are all separate nodes wired together on the canvas.

| Node | Job | Has data-flow handles? |
|---|---|---|
| **Database node** | Connection config — stores which DB to connect to. Outputs a connection reference (integrationId) via Read/Write handles | Yes — `read-out` + `write-out` |
| **Schema node** | Introspects the DB and outputs schema text as agent context | Yes — `trigger-in` + `db-in` + `schema-out` |
| **Query Runner node** | Executes SQL against a named DB connection | Yes — `trigger-in` + `query-in` + `db-in` + `data-out` |
| **Agent node** | LLM reasoning — optionally uses schema context to generate SQL | Yes — `trigger-in` + `data-in` + `schema-in` + `data-out` |
| **Trigger node** | Starts the workflow, optionally carries a SQL string | Yes — `trigger-out` + `data-out` + optional `query-out` |
| **Output node** | Receives final result | Yes — `data-in` |

---

## Handle Type System

```typescript
type HandleType =
  | 'trigger'     // execution signal — Trigger trigger-out → any node's trigger-in
  | 'data'        // generic data payload
  | 'query'       // SQL string — Trigger/Agent → Query Runner
  | 'schema'      // schema description string — Schema node → Agent node
  | 'connection'  // DB connection reference (integrationId) — Database → Schema / Query Runner
```

Connection rules enforced by `isValidConnection`:
- Same handle type connects to same handle type
- `trigger` → `trigger` only (execution signal)
- `connection` → `connection` only (DB reference)
- Schema's `db-in` accepts **only** Database's `read-out` (not `write-out`) — enforced by sourceHandle check
- Query Runner's `db-in` accepts both `read-out` and `write-out`
- Mismatched types are rejected visually on drag

---

## Per-Node Handle Topology

### Trigger Node

```
●── trigger-out  (left)          — execution signal to any trigger-in
┌─────────────────────┐
│  TRIGGER            ├──● data-out    (right-top)    — generic data payload
│  Manual · Input     ├──● query-out  (right-bottom)  — SQL only, conditional
└─────────────────────┘
```

| Handle | Side | Type | Purpose |
|---|---|---|---|
| `trigger-out` | left | `trigger` | Always visible — sends execution signal to any `trigger-in` |
| `data-out` | right-top | `data` | Visible when `triggerInputMode === 'input'` and `inputType !== 'sql'` (text payload) |
| `query-out` | right-bottom | `query` | Visible when `inputType === 'sql'` |

| Trigger config | Visible handles |
|---|---|
| No input (`triggerInputMode === 'none'`) | `trigger-out` only |
| Text input | `trigger-out` + `data-out` |
| SQL input (`inputType === 'sql'`) | `trigger-out` + `query-out` |

Hidden handles keep existing edges on the canvas (wires are not removed when config changes).

---

### Database Node

```
┌─────────────────────┬──● read-out   (right-top)    — connection ref, read-only
│  DATABASE           │
│  database:pg        ├──● write-out  (right-bottom) — connection ref, read-write
└─────────────────────┘
```

| Handle | Side | Type | Purpose |
|---|---|---|---|
| `read-out` | right-top | `connection` | Passes integrationId to Schema node or Query Runner (read-only semantics) |
| `write-out` | right-bottom | `connection` | Passes integrationId to Query Runner (read-write semantics) |

The Database node has **no input handles**. It does not receive data from other nodes. At runtime its handler simply returns its `integrationId` string, which flows downstream via the connection edge.

Config panel: connection string / individual fields, test connection, name the connection.

**Color:** green (`#10B981`)

---

### Schema Node

```
●── trigger-in  (left-top)
●── db-in       (left-bottom, connection type)
┌─────────────────────┬──● schema-out  (right)
│  SCHEMA             │
│  database:pg        │
└─────────────────────┘
```

| Handle | Side | Type | Purpose |
|---|---|---|---|
| `trigger-in` | left-top | `trigger` | Receives execution signal from Trigger or any upstream node |
| `db-in` | left-bottom | `connection` | Receives DB connection reference from Database's `read-out` **only** |
| `schema-out` | right | `schema` | Emits compact schema text → connects to Agent `schema-in` only |

- `db-in` accepts only `read-out` from a Database node (validated by `isValidConnection`: `sourceHandle !== 'read-out'` → reject)
- If `db-in` is wired, `nodeInput.connection` is used as `integrationId` at runtime (overrides config-panel dropdown)
- If `db-in` is not wired, falls back to `params.integrationId` (config-panel dropdown) for backward compat

At runtime: calls `introspect` on the resolved `integrationId`, filters through `DatabaseSchemaConfig` permissions, emits:
```
Tables: users(id int, email text), orders(id int, user_id int, total int, status text)
```

Config panel: named connection dropdown (fallback when `db-in` not wired) + "Configure permissions ⚙" button.

**Color:** violet (`#8B5CF6`)

---

### Query Runner Node (node type: `query-runner`)

```
●── query-in   (left-top)
●── db-in      (left-bottom, connection type)
┌─────────────────────┬──● data-out  (right)
│  QUERY RUNNER       │
│  database:pg        │
└─────────────────────┘
```

| Handle | Side | Type | Purpose |
|---|---|---|---|
| `query-in` | left-top | `query` | Receives SQL string — from Trigger `query-out` or Agent `data-out` |
| `db-in` | left-bottom | `connection` | Receives DB connection reference from Database's `read-out` or `write-out` |
| `data-out` | right | `data` | Returns query result `{ rows: [...], rowCount: N }` |

- `db-in` accepts both `read-out` and `write-out` from a Database node
- If `db-in` is wired, `nodeInput.connection` is used as `integrationId` at runtime
- If `db-in` is not wired, falls back to `params.integrationId` (config-panel dropdown) for backward compat

At runtime:
1. Takes SQL from `nodeInput.query` (from `query-in`) OR falls back to `nodeInput.data` if connected via a generic data edge
2. Runs it through `guardSql()` and `SchemaEnforcer`
3. Executes against the resolved connection (`integrationId`)
4. Returns `{ rows, rowCount }`

Config panel: named connection dropdown (fallback). No action selector — Query Runner always runs a query. Optional: static fallback SQL field for testing without an Agent.

**Color:** cyan (`#06B6D4`)

---

### Agent Node

```
●── trigger-in  (left-top)
●── data-in     (left-middle)
●── schema-in   (left-bottom, violet)
┌─────────────────────┬──● data-out  (right)
│  AGENT              │
│  GPT-4o Mini        │
│  [HTTP] [SCRAPE]    │
└─────────────────────┘
```

| Handle | Side | Type | Purpose |
|---|---|---|---|
| `trigger-in` | left-top | `trigger` | Receives execution signal |
| `data-in` | left-middle | `data` | User question / prior node output |
| `schema-in` | left-bottom | `schema` | Schema context from Schema node — optional |
| `data-out` | right | `data` | Agent output (SQL string, answer, etc.) |

When `schema-in` is connected, executor prepends schema to the system prompt before LLM call — implemented in `agent.handler.ts:74`.

---

### Output Node

```
●── data-in  (left)
┌─────────────────────┐
│  OUTPUT             │
└─────────────────────┘
```

No changes.

---

## Canonical Workflow Topologies

### 1. Full text-to-SQL (agentic)

```
[Trigger]
    │ trigger-out → trigger-in         │ trigger-out → trigger-in
    ▼                                  ▼
[Agent] ◀── schema-in ── [Schema] ◀── db-in ── [Database: read-out]
    │ data-out (SQL)
    ▼
[Query Runner] ◀── db-in ── [Database: read-out or write-out]
    │ data-out (rows)
    ▼
[Output]
```

### 2. Direct SQL (no AI)

```
[Trigger: raw SQL string]
    │ query-out → query-in
    ▼
[Query Runner] ◀── db-in ── [Database: read-out]
    │ data-out (rows)
    ▼
[Output]
```

### 3. Schema inspection only

```
[Trigger] → trigger-in [Schema] ◀── db-in ── [Database: read-out]
                │ schema-out
                ▼
            [Output]
```

### 4. Agent with schema context (no DB execution)

```
[Trigger] → trigger-in [Agent] ◀── schema-in ── [Schema] ◀── db-in ── [Database: read-out]
                │ data-out
                ▼
            [Output]
```

---

## Backend — NodeInput Changes

`apps/api/src/runs/node-input.ts`:

```typescript
export interface NodeInput {
  data?: unknown;
  schema?: string;
  query?: string;
  connection?: string;  // integrationId carried via db-in handle
}
```

`getTargetHandleType` mapping:

| targetHandle | returns |
|---|---|
| `schema-in` | `'schema'` |
| `query-in`, `agent-in` | `'query'` |
| `db-in` | `'connection'` |
| `trigger-in` | `'data'` (trigger carries no payload — edge exists for ordering only) |
| anything else | `'data'` |

`handlerPayload` passes full `NodeInput` to `agent`, `integration`, and `query-runner` node types.

---

## Backend — Database Node Handler

New file: `apps/api/src/handlers/database.handler.ts`

```typescript
export class DatabaseHandler implements NodeHandler {
  async execute(params: Record<string, unknown>): Promise<unknown> {
    return String(params.integrationId ?? '');
  }
}
```

Register as `'database'` in `registry.ts`. The Database node now participates in the executor topology (it executes before Schema and Query Runner nodes that depend on it).

---

## Backend — Query Runner Handler

File: `apps/api/src/handlers/query-runner.handler.ts`

```typescript
export class QueryRunnerHandler implements NodeHandler {
  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    const nodeInput = isNodeInput(input) ? input : { data: input };
    // prefer wired connection (db-in handle) over config-panel param
    const integrationId = String(nodeInput.connection ?? params.integrationId ?? '');
    const userId = String(params.userId ?? params.workflowOwnerId ?? '');

    const sql = nodeInput.query ?? (typeof nodeInput.data === 'string' ? nodeInput.data : null);
    if (!sql) throw new Error('Query Runner: no SQL received on query-in or data-in handle.');

    guardSql(sql);

    const credentials = await credentialResolver.resolve(userId, integrationId);
    const client = await getClient(credentials.connectionString as string);
    try {
      const schemaConfig = await loadSchemaConfig(userId, integrationId);
      enforceSchemaPolicy('query', { sql }, schemaConfig);
      const result = await client.query(sql);
      return { rows: result.rows, rowCount: result.rowCount };
    } finally {
      client.release();
    }
  }
}
```

Register in `apps/api/src/handlers/registry.ts` as `'query-runner'`.

---

## Frontend — Handle Constants (`constants.tsx`)

```typescript
export const NODE_HANDLES: Record<NodeType | 'database', HandleDef[]> = {
  trigger: [
    { id: 'trigger-out', type: 'source', handleType: 'trigger', position: 'left',         label: 'Trigger' },
    { id: 'data-out',    type: 'source', handleType: 'data',    position: 'right-top',    label: 'Data',  conditional: "inputType === 'text' || triggerInputMode === 'input'" },
    { id: 'query-out',   type: 'source', handleType: 'query',   position: 'right-bottom', label: 'SQL',   conditional: "inputType === 'sql'" },
  ],
  database: [
    { id: 'read-out',  type: 'source', handleType: 'connection', position: 'right-top',    label: 'Read' },
    { id: 'write-out', type: 'source', handleType: 'connection', position: 'right-bottom', label: 'Write' },
  ],
  schema: [
    { id: 'trigger-in', type: 'target', handleType: 'trigger',    position: 'left-top',    label: 'Trigger' },
    { id: 'db-in',      type: 'target', handleType: 'connection', position: 'left-bottom', label: 'DB' },
    { id: 'schema-out', type: 'source', handleType: 'schema',     position: 'right',       label: 'Schema' },
  ],
  agent: [
    { id: 'trigger-in', type: 'target', handleType: 'trigger', position: 'left-top',    label: 'Trigger' },
    { id: 'data-in',    type: 'target', handleType: 'data',    position: 'left-middle', label: 'Data' },
    { id: 'schema-in',  type: 'target', handleType: 'schema',  position: 'left-bottom', label: 'Schema' },
    { id: 'data-out',   type: 'source', handleType: 'data',    position: 'right',       label: 'Data' },
  ],
  'query-runner': [
    { id: 'query-in', type: 'target', handleType: 'query',      position: 'left-top',    label: 'SQL' },
    { id: 'db-in',    type: 'target', handleType: 'connection', position: 'left-bottom', label: 'DB' },
    { id: 'data-out', type: 'source', handleType: 'data',       position: 'right',       label: 'Rows' },
  ],
  output: [
    { id: 'data-in', type: 'target', handleType: 'data', position: 'left', label: 'Data' },
  ],
  integration: [
    // preserved for backward compat with saved workflows — do not change
    { id: 'trigger-in', type: 'target', handleType: 'trigger', position: 'left-top',    label: 'Trigger' },
    { id: 'agent-in',   type: 'target', handleType: 'query',   position: 'left',        label: 'Agent' },
    { id: 'schema-out', type: 'source', handleType: 'schema',  position: 'right-top',   label: 'Schema' },
    { id: 'data-out',   type: 'source', handleType: 'data',    position: 'right-bottom',label: 'Data' },
  ],
};
```

---

## Frontend — Connection Validation (`isValidConnection`)

```typescript
function isValidConnection(params, nodes, edges): boolean {
  const { source, sourceHandle, target, targetHandle } = params;
  const sourceNode = nodes.find(n => n.id === source);
  const targetNode = nodes.find(n => n.id === target);

  const srcHandles = NODE_HANDLES[sourceNode.type] ?? [];
  const tgtHandles = NODE_HANDLES[targetNode.type] ?? [];
  const srcHandleType = srcHandles.find(h => h.id === sourceHandle)?.handleType;
  const tgtHandleType = tgtHandles.find(h => h.id === targetHandle)?.handleType;

  // types must match
  if (srcHandleType !== tgtHandleType) return false;

  // Schema's db-in accepts read-out only (not write-out)
  if (targetHandle === 'db-in' && targetNode?.type === 'schema' && sourceHandle !== 'read-out') {
    return false;
  }

  return true;
}
```

---

## Executor Changes (`executor.ts`)

```typescript
function resolveHandlerType(node: FlowNode): string {
  if (node.type === 'schema') return 'integration';
  if (node.type === 'query-runner') return 'query-runner';
  if (node.type === 'database') return 'database';
  return node.type;
}
```

`buildNodeParams` additions:
```typescript
if (node.type === 'query-runner' || node.type === 'database') {
  return { integrationId: node.integrationId, ...context };
}
```

The topological sort already uses all edges — Database nodes will correctly sort before Schema/Query Runner nodes that have a `db-in` edge to them.

---

## Migration — Existing Saved Workflows

Old `integration` nodes in saved `canvasJson` continue to work via `IntegrationHandler`. Do not migrate existing workflows. New workflows use `database` + `query-runner` nodes.

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Database node has Read and Write output handles | Semantic distinction: Schema should only read (safe), Query Runner may write. Enforced at canvas connection time. |
| Schema's `db-in` accepts only `read-out` | Introspection is always read-only. Prevents user accidentally wiring a write connection to Schema. |
| Query Runner's `db-in` accepts both | Query Runner may need to INSERT/UPDATE, so write connection must be allowed. |
| Trigger node has `trigger-out` on the left | Trigger-type handles are execution signals, not data. Keeping them on the left (same side as trigger-in on other nodes) makes signal vs. data flow visually obvious: signals flow left-to-left, data flows right-to-left. |
| `connection` handle type carries integrationId string | The Database node handler returns its integrationId as its output. Downstream nodes read `nodeInput.connection` and use it as their integrationId. Config-panel dropdown remains as fallback if no wire is present. |
| Old `integration` node type preserved | Existing saved workflows reference `type: 'integration'`. Don't break them. |
