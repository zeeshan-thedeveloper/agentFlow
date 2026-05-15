# TASK-010 — Backend: `insert`, `update`, `execute` Actions

**Phase:** 2  
**Status:** Done  
**Depends on:** TASK-004  
**Blocks:** —

---

## Context

Phase 1 ships the `query` (SELECT) action. Phase 2 adds write actions. All three new actions go into `DatabaseIntegration` in `apps/api/src/integrations/providers/database/database.integration.ts`.

The `execute` action is an intentional power-user escape hatch — it skips the DDL guard that `query` enforces. This is by design (see architecture doc).

---

## What To Do

### 1. Add action definitions to the `ACTIONS` array

Open `apps/api/src/integrations/providers/database/database.integration.ts`. Add to the `ACTIONS` array:

```typescript
{
  id: 'insert',
  name: 'Insert Row',
  description: 'Insert one row into a table and return the inserted record',
  paramSchema: [
    {
      name: 'table',
      label: 'Table Name',
      type: 'string',
      required: true,
      placeholder: 'users',
    },
    {
      name: 'data',
      label: 'Row Data (JSON)',
      type: 'text',
      required: true,
      placeholder: '{"name": "{{input.name}}", "email": "{{input.email}}"}',
      description: 'JSON object mapping column names to values.',
    },
    {
      name: 'returning',
      label: 'RETURNING columns',
      type: 'string',
      required: false,
      placeholder: 'id, created_at',
      description: 'Comma-separated column names to return. Leave blank to return all (*)',
    },
  ],
},
{
  id: 'update',
  name: 'Update Rows',
  description: 'Update rows matching a WHERE clause',
  paramSchema: [
    { name: 'table', label: 'Table Name', type: 'string', required: true },
    {
      name: 'set',
      label: 'SET Values (JSON)',
      type: 'text',
      required: true,
      placeholder: '{"status": "processed", "updatedAt": "{{input.timestamp}}"}',
      description: 'JSON object of columns to update.',
    },
    {
      name: 'where',
      label: 'WHERE clause',
      type: 'string',
      required: true,
      placeholder: 'id = $1',
      description: 'Use $1, $2, ... for parameterized values.',
    },
    {
      name: 'params',
      label: 'WHERE Params',
      type: 'text',
      required: false,
      placeholder: '["{{input.id}}"]',
      description: 'JSON array of values for the WHERE clause placeholders.',
    },
  ],
},
{
  id: 'execute',
  name: 'Execute Statement',
  description: 'Run any SQL statement (DDL/DML). No result returned. Use with care.',
  paramSchema: [
    {
      name: 'sql',
      label: 'SQL',
      type: 'text',
      required: true,
      placeholder: 'DELETE FROM temp_jobs WHERE created_at < NOW() - INTERVAL \'7 days\'',
    },
    {
      name: 'params',
      label: 'Params',
      type: 'text',
      required: false,
      placeholder: '[]',
    },
  ],
},
```

### 2. Add private methods to `DatabaseIntegration`

Add the following private methods inside the `DatabaseIntegration` class:

```typescript
private async runInsert(
  connectionString: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const table = String(params.table ?? '').trim();
  if (!table) throw new Error('Table name is required.');

  let data: Record<string, unknown>;
  try {
    data = typeof params.data === 'string'
      ? JSON.parse(params.data)
      : (params.data as Record<string, unknown>);
  } catch {
    throw new Error('Row data must be a valid JSON object.');
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Row data must be a JSON object, not an array or primitive.');
  }

  const columns = Object.keys(data);
  if (columns.length === 0) throw new Error('Row data must have at least one column.');

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const values = columns.map((col) => data[col]);
  const returning = String(params.returning ?? '').trim() || '*';
  const sql = `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING ${returning}`;

  const client = await getClient(connectionString);
  try {
    const result = await client.query(sql, values);
    return { row: result.rows[0], rowCount: result.rowCount };
  } finally {
    client.release();
  }
}

private async runUpdate(
  connectionString: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const table = String(params.table ?? '').trim();
  const where = String(params.where ?? '').trim();
  if (!table) throw new Error('Table name is required.');
  if (!where) throw new Error('WHERE clause is required. Refusing to update without a condition.');

  let setData: Record<string, unknown>;
  try {
    setData = typeof params.set === 'string'
      ? JSON.parse(params.set)
      : (params.set as Record<string, unknown>);
  } catch {
    throw new Error('SET values must be a valid JSON object.');
  }

  const setCols = Object.keys(setData);
  if (setCols.length === 0) throw new Error('SET values must have at least one column.');

  const whereParams = parseQueryParams(params.params);
  const setPlaceholders = setCols.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
  const whereOffset = setCols.length;
  // Shift $1, $2 in the WHERE clause by the number of SET params
  const shiftedWhere = where.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + whereOffset}`);
  const allValues = [...setCols.map((c) => setData[c]), ...whereParams];

  const sql = `UPDATE ${table} SET ${setPlaceholders} WHERE ${shiftedWhere}`;
  const client = await getClient(connectionString);
  try {
    const result = await client.query(sql, allValues);
    return { rowCount: result.rowCount };
  } finally {
    client.release();
  }
}

private async runExecute(
  connectionString: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const sql = String(params.sql ?? '').trim();
  if (!sql) throw new Error('SQL is required.');
  // No guardQuerySql here — execute is the unrestricted escape hatch.
  if (sql.length > MAX_SQL_LENGTH) throw new Error(`SQL too long (max ${MAX_SQL_LENGTH} chars).`);

  const queryParams = parseQueryParams(params.params);
  const client = await getClient(connectionString);
  try {
    const result = await client.query(sql, queryParams);
    return { rowCount: result.rowCount ?? null, command: result.command };
  } finally {
    client.release();
  }
}
```

### 3. Wire the new actions into `execute()`

Update the `switch` in `DatabaseIntegration.execute()`:

```typescript
switch (actionId) {
  case 'query':   return this.runQuery(connectionString, params);
  case 'insert':  return this.runInsert(connectionString, params);
  case 'update':  return this.runUpdate(connectionString, params);
  case 'execute': return this.runExecute(connectionString, params);
  default: throw new Error(`Unknown action: ${actionId}`);
}
```

---

## Acceptance Criteria

- [ ] `insert` action builds a parameterized `INSERT ... RETURNING` query — no string concatenation of values
- [ ] `insert` throws if `table` is empty or `data` is not a valid JSON object
- [ ] `update` throws if `where` is empty (refuses to update without a condition)
- [ ] `update` correctly shifts `$N` placeholders in the WHERE clause by the number of SET columns
- [ ] `execute` does NOT call `guardQuerySql` — it allows DROP, TRUNCATE, etc.
- [ ] `execute` still enforces the max SQL length guard
- [ ] All three new actions appear in `GET /integrations` response (they come from `ACTIONS` array)
- [ ] TypeScript compiles with no errors
