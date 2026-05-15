# Database Integration — Architecture

> Written: 2026-05-15  
> Status: Planning  
> References: `docs/integration-framework.md`, `docs/architecture/workflow-execution.md`

---

## What This Is

A **Database integration node** lets users connect an external PostgreSQL database (or other supported engines) as a canvas step. It is **not** the internal Prisma database that stores workflows and runs — it is a user-owned external database that the workflow can query, insert into, or update as part of execution.

Use cases:
- Fetch a row from a CRM database to enrich an agent's context
- Write AI-generated results back to a customer database
- Run a report query and pass results to an output node
- Cross-reference internal data during a multi-step agent workflow

---

## How It Fits the Integration Framework

Database follows the exact pattern defined in `docs/integration-framework.md`:

```
Canvas (DatabaseNode)
  └── ConfigPanel
        ├── Integration = 'database'
        ├── Action picker (query / insert / update / delete)
        ├── Dynamic param form (driven by action.paramSchema)
        └── Credential status badge → "Connect" button → CredentialDialog
              └── Connection string or individual fields (host/port/db/user/pass)

Backend
  └── IntegrationHandler
        └── IntegrationRegistry.get('database')
              └── DatabaseIntegration.execute(actionId, params, input, credentials)
                    └── pg.Client (ephemeral connection, pooled per run)
```

`DatabaseIntegration` is registered in the same `IntegrationRegistry` as Slack and GitHub — no special-casing in the executor.

---

## Supported Engines (initial scope)

| Engine | Driver | Status |
|---|---|---|
| PostgreSQL | `pg` (node-postgres) | Phase 1 |
| MySQL / MariaDB | `mysql2` | Future |
| SQLite | `better-sqlite3` | Future (local dev only) |

PostgreSQL covers the primary use case. MySQL can be added later with no framework changes — just a new driver behind the same interface.

---

## Credential Model

### What gets stored

```typescript
// Encrypted JSON blob stored in UserIntegrationCredential.encryptedData
// integrationId = 'database'
// authType = 'connection_string'
{
  connectionString: "postgresql://user:pass@host:5432/dbname?sslmode=require"
}
```

Or alternatively as structured fields (both are supported, internally normalized to a connection string):

```typescript
{
  host: "db.example.com",
  port: 5432,
  database: "mydb",
  user: "readonly_user",
  password: "...",
  ssl: true
}
```

The `CredentialDialog` offers two tabs: **Connection String** and **Individual Fields**. Both normalize to a single encrypted connection string on save.

### Masked hint

After storing, the hint shown in the UI strips credentials:
```
postgresql://readonly_user:****@db.example.com:5432/mydb
```

### Multiple databases per user

The `UserIntegrationCredential` table uses `@@unique([userId, integrationId])`. For multiple databases, we extend `integrationId` with a suffix:

```
database          ← default (first connected DB)
database:prod     ← named connection
database:staging  ← named connection
```

The credential dialog lets users name the connection. The ConfigPanel shows a "Select database" dropdown listing all stored connections for the current user.

---

## Canvas Node — Actions & Param Schemas

### Action: `query` (SELECT)

```typescript
{
  id: 'query',
  name: 'Run Query',
  description: 'Execute a SELECT query and return rows',
  paramSchema: [
    { name: 'sql',    label: 'SQL Query',     type: 'text',    required: true,
      placeholder: 'SELECT * FROM users WHERE id = $1' },
    { name: 'params', label: 'Query Params',  type: 'text',    required: false,
      placeholder: '["{{input.userId}}"]',
      description: 'JSON array. Use $1, $2, ... in the query for parameterized values.' },
    { name: 'limit',  label: 'Row Limit',     type: 'number',  required: false,
      placeholder: '100' },
  ]
}
```

### Action: `insert`

```typescript
{
  id: 'insert',
  name: 'Insert Row',
  description: 'Insert one row and return the inserted record',
  paramSchema: [
    { name: 'table',  label: 'Table Name',    type: 'string',  required: true },
    { name: 'data',   label: 'Row Data (JSON)', type: 'text',  required: true,
      placeholder: '{"name": "{{input.name}}", "email": "{{input.email}}"}' },
    { name: 'returning', label: 'RETURNING columns', type: 'string', required: false,
      placeholder: 'id, created_at' },
  ]
}
```

### Action: `update`

```typescript
{
  id: 'update',
  name: 'Update Rows',
  description: 'Update rows matching a WHERE clause',
  paramSchema: [
    { name: 'table',  label: 'Table Name',    type: 'string',  required: true },
    { name: 'set',    label: 'SET values (JSON)', type: 'text', required: true,
      placeholder: '{"status": "processed"}' },
    { name: 'where',  label: 'WHERE clause',  type: 'string',  required: true,
      placeholder: 'id = $1' },
    { name: 'params', label: 'WHERE params',  type: 'text',    required: false,
      placeholder: '["{{input.id}}"]' },
  ]
}
```

### Action: `execute` (raw, no result)

```typescript
{
  id: 'execute',
  name: 'Execute Statement',
  description: 'Run DDL or DML with no result (CREATE, DELETE, TRUNCATE, etc.)',
  paramSchema: [
    { name: 'sql',    label: 'SQL',           type: 'text',    required: true },
    { name: 'params', label: 'Params',        type: 'text',    required: false },
  ]
}
```

---

## Template Variable Interpolation

Params support `{{input.fieldName}}` syntax to reference the previous node's output before the query runs. This is resolved by the `IntegrationHandler` before calling `execute()`:

```typescript
// In IntegrationHandler.execute()
const resolvedParams = interpolateTemplates(params, input);
return integration.execute(actionId, resolvedParams, input, credentials);
```

`interpolateTemplates` is a simple string replace — it does **not** interpolate directly into SQL strings (which would be injection). It only replaces values inside the `params` array, which are then passed as parameterized query values via `pg`'s `$1, $2` mechanism.

---

## Backend Implementation

### File layout

```
apps/api/src/integrations/providers/
  database/
    database.integration.ts      DatabaseIntegration class
    database.connection.ts       Connection pool manager
    database.sanitizer.ts        Input validation, query guards
```

### `DatabaseIntegration` class

```typescript
export class DatabaseIntegration implements Integration {
  id = 'database';
  name = 'Database';
  description = 'Query or write to a PostgreSQL database';
  authType = 'connection_string' as const;
  credentialLabel = 'Connection String';
  actions = [query, insert, update, execute]; // ActionDef objects

  async execute(
    actionId: string,
    params: Record<string, unknown>,
    input: unknown,
    credentials: ResolvedCredentials,
  ): Promise<unknown> {
    const client = await getClient(credentials.connectionString);
    try {
      switch (actionId) {
        case 'query':   return await runQuery(client, params);
        case 'insert':  return await runInsert(client, params);
        case 'update':  return await runUpdate(client, params);
        case 'execute': return await runExecute(client, params);
        default: throw new Error(`Unknown action: ${actionId}`);
      }
    } finally {
      client.release(); // always return to pool
    }
  }
}
```

### Connection pooling

Ephemeral per-connection-string pool, not a global pool:

```typescript
// database.connection.ts
const pools = new Map<string, Pool>(); // keyed by connection string hash

export async function getClient(connectionString: string): Promise<PoolClient> {
  const key = hashConnectionString(connectionString); // SHA-256, not the raw string
  if (!pools.has(key)) {
    pools.set(key, new Pool({
      connectionString,
      max: 5,             // per unique DB connection
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: true } : false,
    }));
  }
  return pools.get(key)!.connect();
}
```

Pools are process-scoped (in-memory). In a multi-replica deployment, each replica manages its own pools — acceptable for this scale.

### Query guards (security)

```typescript
// database.sanitizer.ts

// Enforced on all query/execute actions:
const BLOCKED_STATEMENTS = /^\s*(drop|truncate|alter|create|grant|revoke)\s/i;

export function guardSql(sql: string): void {
  if (BLOCKED_STATEMENTS.test(sql)) {
    throw new Error('Blocked: DDL and privilege statements are not allowed via integration nodes. Use the "execute" action only for DML.');
  }
  // Max query length guard
  if (sql.length > 10_000) throw new Error('Query too long (max 10,000 chars)');
}

// Row limit cap — even if user doesn't specify one
const MAX_ROWS = 1_000;
```

Note: the `execute` action intentionally allows broader statements (DELETE, UPDATE without WHERE) — it is a power-user escape hatch. The user must explicitly choose it.

### Row limit enforcement

```typescript
async function runQuery(client: PoolClient, params: Record<string, unknown>) {
  const limit = Math.min(Number(params.limit) || 100, MAX_ROWS);
  const sql = `${params.sql} LIMIT ${limit}`;
  const result = await client.query(sql, parseParams(params.params));
  return { rows: result.rows, rowCount: result.rowCount };
}
```

---

## Frontend — CredentialDialog for Database

Two tabs:

### Tab 1: Connection String
```
[ postgresql://user:pass@host:5432/dbname?sslmode=require ]
[ Connection Name (optional): "Production DB"            ]
[ Test Connection ]  [ Save ]
```

### Tab 2: Individual Fields
```
Host:     [ db.example.com   ]   Port: [ 5432 ]
Database: [ mydb             ]
User:     [ readonly_user    ]
Password: [ ••••••••••••••   ]
SSL:      [x] Require SSL
[ Connection Name (optional): "Production DB" ]
[ Test Connection ]  [ Save ]
```

"Test Connection" hits a new endpoint:

```
POST /integrations/database/credentials/test
Body: { connectionString: "..." }
Response: { ok: true, serverVersion: "16.2" } | { ok: false, error: "..." }
```

This does **not** store the credential — it just validates connectivity before the user commits.

---

## REST Endpoints (additions to integration-framework.md)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/integrations/database/credentials/test` | Validate connection before saving |
| `GET` | `/integrations/database/credentials` | List all named database connections for the user |
| `POST` | `/integrations/database/credentials` | Store named connection (body: `{ name, connectionString }`) |
| `DELETE` | `/integrations/database/credentials/:name` | Remove a named connection |

The named-connection support requires a schema change (see below).

---

## Schema Changes

### Option A — extend `UserIntegrationCredential` with a `name` field

```prisma
model UserIntegrationCredential {
  id            String   @id @default(cuid())
  userId        String
  integrationId String   // 'database', 'database:prod', 'database:staging'
  name          String?  // human label: "Production DB"
  authType      String
  encryptedData String   @db.Text
  maskedHint    String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, integrationId])
  @@index([userId])
  @@map("user_integration_credentials")
}
```

`integrationId` = `'database:prod'`, `'database:staging'` etc. disambiguates multiple connections for the same user. `name` is just the display label.

### No other schema changes needed

Workflow `canvasJson` stores `integrationId: 'database:prod'` on the node — the executor resolves credentials from that ID.

---

## Security Considerations

| Risk | Mitigation |
|---|---|
| Credential exposure | Connection strings encrypted with AES-256-GCM before storage — same key as OpenAI keys |
| SQL injection via params | All user-supplied values go through `pg` parameterized queries (`$1, $2`) — never string-concatenated into SQL |
| Unrestricted queries | `guardSql()` blocks DDL; row limit cap prevents runaway SELECTs |
| Connecting to internal networks | No restriction by default. Future: connection string allowlist/blocklist per deployment |
| Credential leakage in logs | Connection string is never logged; `maskedHint` strips the password before storage |
| Long-running queries | `pg` pool has `connectionTimeoutMillis: 5_000`. Statement timeout can be set on the DB side via `SET statement_timeout` — not enforced by the app yet |

---

## Implementation Phases

### Phase 1 — PostgreSQL read path
1. `DatabaseIntegration` class with `query` action only
2. Connection pool manager (`pg` driver)
3. `guardSql()` + row limit cap
4. `POST /integrations/database/credentials/test` endpoint
5. `CredentialDialog` (connection string tab only)
6. ConfigPanel renders `query` action form
7. End-to-end test: canvas node → SELECT → result in AgentStep output

**Checkpoint:** Users can query an external PostgreSQL database from a canvas workflow.

### Phase 2 — Write actions
1. `insert`, `update`, `execute` actions
2. Individual-fields tab in `CredentialDialog`
3. Template variable interpolation (`{{input.x}}` in params)

### Phase 3 — Named connections
1. Schema migration to support `integrationId` suffix pattern
2. "Select database" dropdown in ConfigPanel
3. `GET /integrations/database/credentials` list endpoint
4. `DELETE /integrations/database/credentials/:name`

### Phase 4 — Additional engines (future)
1. `mysql2` driver behind the same `DatabaseIntegration.execute()` switch
2. Engine field in `CredentialDialog` (PostgreSQL / MySQL)
3. Engine-specific `guardSql()` and query adjustments

---

## Key Decisions

| Decision | Rationale |
|---|---|
| `pg` (node-postgres), not an ORM | Workflows execute arbitrary user SQL — an ORM adds no value here and constrains query flexibility |
| Parameterized queries only for user values | Eliminates SQL injection at the framework level; SQL text itself comes from the node config (user-authored, not user-runtime-input) |
| Per-connection-string pool, not global | Each user's database gets its own pool. No cross-user connection sharing. Pools are small (max: 5) to avoid exhausting connection limits on user-owned databases |
| Named connections via `integrationId` suffix | Avoids a schema redesign — the unique constraint stays on `(userId, integrationId)`, and multiple databases are just multiple rows with different suffixes |
| `query` action first, writes in Phase 2 | Read-only path proves the framework; write actions add risk and deserve separate validation |
| DDL blocked on `query` action | Accidental `DROP TABLE` in a workflow is catastrophic. Explicit `execute` action is the escape hatch for power users who need it |
