# TASK-003 — SQL Sanitizer and Query Guards

**Phase:** 1  
**Status:** Done  
**Depends on:** —  
**Blocks:** TASK-004

---

## Context

Users write SQL directly in the canvas node config. We need two layers of protection:
1. **Block dangerous statements** on the `query` action (DDL, privilege grants) — accidental `DROP TABLE` in a workflow is catastrophic.
2. **Cap row count** so a `SELECT * FROM large_table` doesn't bring the API process to its knees.

The `execute` action (TASK-010) intentionally bypasses the DDL guard — it is a power-user escape hatch for intentional DML like `DELETE`, `TRUNCATE`. The guard only applies to `query`.

---

## What To Do

### 1. Create `database.sanitizer.ts`

Create `apps/api/src/integrations/providers/database/database.sanitizer.ts`:

```typescript
export const MAX_ROWS = 1_000;
export const MAX_SQL_LENGTH = 10_000;

// Statements blocked on the 'query' action.
// The 'execute' action skips this guard (by design).
const BLOCKED_PATTERN =
  /^\s*(drop|truncate|alter|create\s+(?:table|index|view|schema|database)|grant|revoke)\b/i;

export function guardQuerySql(sql: string): void {
  if (sql.length > MAX_SQL_LENGTH) {
    throw new Error(`Query too long. Maximum allowed: ${MAX_SQL_LENGTH} characters.`);
  }
  if (BLOCKED_PATTERN.test(sql.trim())) {
    throw new Error(
      'Blocked statement. The "query" action only allows SELECT and read-only statements. ' +
        'Use the "execute" action for DML.',
    );
  }
}

// Parse and validate the params JSON array (e.g. '["value1", 42]').
// Returns the parsed array, or throws a descriptive error.
export function parseQueryParams(raw: unknown): unknown[] {
  if (raw === undefined || raw === null || raw === '') return [];

  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error(
      'Query params must be a valid JSON array. Example: ["value1", 42]',
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Query params must be a JSON array, not an object or primitive.');
  }

  return parsed;
}

// Build a masked version of the connection string for display (strips password).
// postgresql://user:secret@host:5432/db  →  postgresql://user:****@host:5432/db
export function maskConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = '****';
    }
    return url.toString();
  } catch {
    // If it's not a valid URL, redact everything after the last @ as a best-effort
    const atIndex = connectionString.lastIndexOf('@');
    if (atIndex === -1) return connectionString;
    return connectionString.slice(0, connectionString.indexOf(':') + 1) + '****' + connectionString.slice(atIndex);
  }
}
```

### 2. Export from an index if one exists

If `apps/api/src/integrations/providers/database/` gets an `index.ts` barrel file later, include the sanitizer there. For now just the standalone file is fine.

---

## Acceptance Criteria

- [ ] `guardQuerySql` throws for: `DROP TABLE`, `TRUNCATE`, `ALTER TABLE`, `CREATE TABLE`, `GRANT`, `REVOKE` (case-insensitive, leading whitespace tolerated)
- [ ] `guardQuerySql` does NOT throw for: `SELECT`, `WITH ... SELECT`, `EXPLAIN SELECT`
- [ ] `guardQuerySql` throws if SQL length > 10,000 chars
- [ ] `parseQueryParams('["a", 1]')` returns `['a', 1]`
- [ ] `parseQueryParams(undefined)` returns `[]`
- [ ] `parseQueryParams('not json')` throws with a descriptive message
- [ ] `maskConnectionString('postgresql://user:secret@host:5432/db')` returns `'postgresql://user:****@host:5432/db'`
- [ ] TypeScript compiles with no errors
