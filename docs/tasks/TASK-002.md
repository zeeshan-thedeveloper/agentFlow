# TASK-002 — Install `pg` Driver + Connection Pool Manager

**Phase:** 1  
**Status:** Done  
**Depends on:** —  
**Blocks:** TASK-004

---

## Context

The `DatabaseIntegration` class needs to connect to user-owned external PostgreSQL databases at workflow runtime. We use `pg` (node-postgres) directly — no ORM, because workflows execute arbitrary user SQL. Connections are pooled per unique connection string to avoid exhausting the user's database connection limit.

The pool manager lives in `apps/api/src/integrations/providers/database/`.

---

## What To Do

### 1. Install the `pg` package

```bash
cd apps/api
pnpm add pg
pnpm add -D @types/pg
```

### 2. Create the directory structure

```
apps/api/src/integrations/
  providers/
    database/
      database.connection.ts     ← create this file (this ticket)
      database.sanitizer.ts      ← TASK-003
      database.integration.ts    ← TASK-004
```

Also create the parent directories if they don't exist:
```
apps/api/src/integrations/
apps/api/src/integrations/providers/
apps/api/src/integrations/providers/database/
```

### 3. Create `database.connection.ts`

Create `apps/api/src/integrations/providers/database/database.connection.ts`:

```typescript
import { Pool, PoolClient } from 'pg';
import { createHash } from 'crypto';

const pools = new Map<string, Pool>();

function hashConnectionString(connectionString: string): string {
  return createHash('sha256').update(connectionString).digest('hex');
}

function buildPool(connectionString: string): Pool {
  const requireSsl =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('sslmode=verify-full');

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: requireSsl ? { rejectUnauthorized: true } : false,
  });
}

export async function getClient(connectionString: string): Promise<PoolClient> {
  const key = hashConnectionString(connectionString);

  if (!pools.has(key)) {
    pools.set(key, buildPool(connectionString));
  }

  return pools.get(key)!.connect();
}

// Used by the test-connection endpoint — tries to connect, returns server version or throws.
export async function testConnection(connectionString: string): Promise<string> {
  const client = await getClient(connectionString);
  try {
    const result = await client.query('SELECT version()');
    return result.rows[0].version as string;
  } finally {
    client.release();
  }
}

// Called on app shutdown to drain all pools cleanly.
export async function closeAllPools(): Promise<void> {
  await Promise.all([...pools.values()].map((p) => p.end()));
  pools.clear();
}
```

### 4. Notes on design

- The map key is a SHA-256 hash of the connection string, not the raw string, so credentials never sit in memory as a map key.
- `max: 5` per unique database — conservative limit so the integration doesn't exhaust user DB connection limits.
- SSL is detected from the connection string. No SSL by default (many dev databases don't use it).
- `testConnection` is the utility for the `POST /integrations/database/credentials/test` endpoint (TASK-006).
- `closeAllPools` should be called in the NestJS app shutdown hook (can be wired in a later ticket if not done now).

---

## Acceptance Criteria

- [ ] `pg` and `@types/pg` are in `apps/api/package.json`
- [ ] `apps/api/src/integrations/providers/database/database.connection.ts` exists
- [ ] `getClient(connectionString)` returns a `PoolClient` from a pool (same pool reused on repeated calls with same string)
- [ ] `testConnection(connectionString)` returns the PostgreSQL server version string on success
- [ ] `testConnection` throws a meaningful error if the connection string is invalid or unreachable
- [ ] TypeScript compiles with no errors (`cd apps/api && npx tsc --noEmit`)
