# TASK-004 — DatabaseIntegration Class (`query` action)

**Phase:** 1  
**Status:** Done  
**Depends on:** TASK-002, TASK-003  
**Blocks:** TASK-005

---

## Context

`DatabaseIntegration` is the class that the `IntegrationRegistry` will hold and that `IntegrationHandler` will call during workflow execution. It implements a shared `Integration` interface (defined in this ticket too, since the types package doesn't have it yet).

For Phase 1, implement only the `query` action (SELECT). Write actions come in TASK-010.

The class lives in `apps/api/src/integrations/providers/database/database.integration.ts`.

---

## What To Do

### 1. Define the shared Integration interfaces

Create `apps/api/src/integrations/integration.interfaces.ts`:

```typescript
// Credentials resolved from the encrypted DB record and passed to execute().
export interface ResolvedCredentials {
  connectionString?: string;   // database integrations
  apiKey?: string;             // Slack, GitHub, etc.
  accessToken?: string;        // OAuth2
  [key: string]: string | undefined;
}

// Definition of a single param in an action's config form.
export interface ActionParamDef {
  name: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'select';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
  secret?: boolean;
}

// A single action an integration can perform.
export interface IntegrationActionDef {
  id: string;
  name: string;
  description: string;
  paramSchema: ActionParamDef[];
}

// Public metadata — safe to return to the frontend via GET /integrations.
export interface IntegrationMeta {
  id: string;
  name: string;
  description: string;
  authType: 'api_key' | 'oauth2' | 'connection_string' | 'none';
  credentialLabel?: string;
  actions: IntegrationActionDef[];
}

// Full interface that every integration class must implement.
export interface Integration extends IntegrationMeta {
  execute(
    actionId: string,
    params: Record<string, unknown>,
    input: unknown,
    credentials: ResolvedCredentials,
  ): Promise<unknown>;
}
```

### 2. Create `database.integration.ts`

Create `apps/api/src/integrations/providers/database/database.integration.ts`:

```typescript
import type { Integration, IntegrationActionDef, ResolvedCredentials } from '../../integration.interfaces';
import { getClient } from './database.connection';
import { guardQuerySql, parseQueryParams, MAX_ROWS } from './database.sanitizer';

const ACTIONS: IntegrationActionDef[] = [
  {
    id: 'query',
    name: 'Run Query',
    description: 'Execute a SELECT query and return rows as JSON',
    paramSchema: [
      {
        name: 'sql',
        label: 'SQL Query',
        type: 'text',
        required: true,
        placeholder: 'SELECT * FROM users WHERE id = $1',
      },
      {
        name: 'params',
        label: 'Query Params',
        type: 'text',
        required: false,
        placeholder: '["{{input.userId}}"]',
        description:
          'JSON array of values. Reference $1, $2, ... in your SQL. Use {{input.field}} to inject previous node output.',
      },
      {
        name: 'limit',
        label: 'Row Limit',
        type: 'number',
        required: false,
        placeholder: '100',
        description: `Maximum rows returned. Hard cap: ${MAX_ROWS}.`,
      },
    ],
  },
];

export class DatabaseIntegration implements Integration {
  id = 'database';
  name = 'Database';
  description = 'Query or write to a PostgreSQL database';
  authType = 'connection_string' as const;
  credentialLabel = 'Connection String';
  actions = ACTIONS;

  async execute(
    actionId: string,
    params: Record<string, unknown>,
    _input: unknown,
    credentials: ResolvedCredentials,
  ): Promise<unknown> {
    const { connectionString } = credentials;
    if (!connectionString) {
      throw new Error('No database connection string found. Connect a database first.');
    }

    switch (actionId) {
      case 'query':
        return this.runQuery(connectionString, params);
      default:
        throw new Error(`Unknown action: ${actionId}`);
    }
  }

  private async runQuery(
    connectionString: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const sql = String(params.sql ?? '').trim();
    if (!sql) throw new Error('SQL query is required.');

    guardQuerySql(sql);

    const queryParams = parseQueryParams(params.params);
    const userLimit = params.limit != null ? Number(params.limit) : 100;
    const limit = Math.min(isNaN(userLimit) ? 100 : userLimit, MAX_ROWS);

    // Append LIMIT only if not already present to avoid syntax errors on CTEs etc.
    const sqlWithLimit = /\blimit\s+\d+/i.test(sql) ? sql : `${sql} LIMIT ${limit}`;

    const client = await getClient(connectionString);
    try {
      const result = await client.query(sqlWithLimit, queryParams);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      };
    } finally {
      client.release();
    }
  }
}
```

---

## Acceptance Criteria

- [ ] `integration.interfaces.ts` exists with all interfaces exported
- [ ] `DatabaseIntegration` implements `Integration`
- [ ] Calling `execute('query', { sql: 'SELECT 1' }, null, { connectionString: '...' })` returns `{ rows: [{ '?column?': 1 }], rowCount: 1, fields: [...] }` (requires a real PG connection — integration test only)
- [ ] Calling with an unknown `actionId` throws `"Unknown action: ..."`
- [ ] Calling with missing `connectionString` throws `"No database connection string found..."`
- [ ] `guardQuerySql` is called — `execute('query', { sql: 'DROP TABLE users' }, ...)` throws before touching the DB
- [ ] Row limit is capped at `MAX_ROWS` even if user passes a higher number
- [ ] TypeScript compiles with no errors
