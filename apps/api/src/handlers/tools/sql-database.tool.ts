import type { PoolClient, QueryConfig } from 'pg';
import type { Tool, ToolDefinition } from './base.tool';
import { getClient } from '../../integrations/providers/database/database.connection';
import { MAX_SQL_LENGTH } from '../../integrations/providers/database/database.sanitizer';
import type { SchemaConfig } from '../../integrations/integration.interfaces';

export const MAX_RESULT_ROWS = 100;
const STATEMENT_TIMEOUT_MS = 10_000;
const MAX_RESULT_CHARS = 20_000;

/** A database wired into an agent node, ready to be queried. */
export interface AgentDatabase {
  /** Name the model uses to pick a database. */
  name: string;
  integrationId: string;
  connectionString: string;
  /** Lower-cased tables the agent may read; null means every table in the public schema. */
  readableTables: Set<string> | null;
}

export function readableTablesFrom(config: SchemaConfig | null): Set<string> | null {
  if (!config) return null;
  return new Set(
    Object.entries(config.tables)
      .filter(([, permissions]) => permissions.read)
      .map(([table]) => table.toLowerCase()),
  );
}

/**
 * Runs `work` inside a READ ONLY transaction that is always rolled back, so
 * Postgres itself rejects any write the model attempts.
 */
async function withReadOnlyClient<T>(
  connectionString: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getClient(connectionString);
  let broken = false;
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    return await work(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {
      broken = true;
    });
    // A connection that could not roll back is discarded instead of reused.
    client.release(broken);
  }
}

/** Compact "table(column type, ...)" lines for the tables the agent may read. */
export async function describeDatabase(database: AgentDatabase): Promise<string> {
  const rows = await withReadOnlyClient(database.connectionString, async client => {
    const result = await client.query<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT table_name, column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position`,
    );
    return result.rows;
  });

  const tables = new Map<string, string[]>();
  for (const row of rows) {
    if (database.readableTables && !database.readableTables.has(row.table_name.toLowerCase())) continue;
    const columns = tables.get(row.table_name) ?? [];
    columns.push(`${row.column_name} ${row.data_type}`);
    tables.set(row.table_name, columns);
  }

  if (tables.size === 0) return '(no readable tables)';
  return [...tables].map(([table, columns]) => `${table}(${columns.join(', ')})`).join('\n');
}

const TABLE_REFERENCE = /\b(?:from|join)\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)/gi;

function referencedTables(sql: string): string[] {
  const tables: string[] = [];
  for (const match of sql.matchAll(TABLE_REFERENCE)) {
    const name = match[1].split('.').pop() ?? match[1];
    tables.push(name.trim().replace(/^"|"$/g, '').toLowerCase());
  }
  return tables;
}

// Row-returning statements are wrapped so Postgres stops after the cap instead of
// sending back an entire table.
function withRowCap(sql: string): string {
  return /^\s*(select|with|values|table)\b/i.test(sql)
    ? `SELECT * FROM (\n${sql}\n) AS agent_query LIMIT ${MAX_RESULT_ROWS + 1}`
    : sql;
}

export async function runReadOnlyQuery(database: AgentDatabase, rawSql: string): Promise<string> {
  const sql = rawSql.trim().replace(/;+\s*$/, '');
  if (!sql) throw new Error('SQL is empty.');
  if (sql.length > MAX_SQL_LENGTH) throw new Error(`SQL is too long (max ${MAX_SQL_LENGTH} characters).`);
  // Clearer than Postgres' syntax error; the extended protocol below enforces it regardless.
  if (sql.replace(/'(?:[^']|'')*'/g, "''").includes(';')) {
    throw new Error('Send one SQL statement per run_sql call.');
  }

  if (database.readableTables) {
    const blocked = referencedTables(sql).filter(table => !database.readableTables!.has(table));
    if (blocked.length > 0) {
      throw new Error(`Table "${blocked[0]}" is not available. Use only the tables listed in the schema.`);
    }
  }

  let result;
  try {
    result = await withReadOnlyClient(database.connectionString, client =>
      // The extended protocol accepts exactly one statement, so "...; COMMIT; DELETE ..." is rejected.
      client.query({ text: withRowCap(sql), queryMode: 'extended' } as QueryConfig & { queryMode: 'extended' }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      /read-only transaction|data-modifying/.test(message)
        ? 'This database is read-only for agents; only SELECT queries are allowed.'
        : message,
    );
  }

  const truncated = result.rows.length > MAX_RESULT_ROWS;
  let payload = JSON.stringify({
    rowCount: truncated ? `more than ${MAX_RESULT_ROWS}` : result.rows.length,
    rows: result.rows.slice(0, MAX_RESULT_ROWS),
    ...(truncated ? { note: `Only the first ${MAX_RESULT_ROWS} rows are shown; filter or aggregate in SQL.` } : {}),
  });
  if (payload.length > MAX_RESULT_CHARS) {
    payload = `${payload.slice(0, MAX_RESULT_CHARS)}... (output truncated; select fewer columns or rows)`;
  }
  return payload;
}

export function createSqlTool(databases: AgentDatabase[]): Tool {
  const byName = new Map(databases.map(database => [database.name, database]));
  const several = databases.length > 1;

  const definition: ToolDefinition = {
    name: 'run_sql',
    description:
      `Run one read-only PostgreSQL query against ${several ? 'a connected database' : 'the connected database'} ` +
      `and get the rows back as JSON. Use only the tables and columns listed in the system prompt. ` +
      `At most ${MAX_RESULT_ROWS} rows come back, so filter or aggregate in SQL. If a query fails, read the error and fix the query.`,
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'A single SELECT (or WITH ... SELECT) statement.' },
        ...(several
          ? { database: { type: 'string', enum: [...byName.keys()], description: 'Which database to query.' } }
          : {}),
      },
      required: several ? ['sql', 'database'] : ['sql'],
    },
  };

  return {
    definition,
    async run(args) {
      const database = several ? byName.get(String(args.database ?? '')) : databases[0];
      if (!database) throw new Error(`Unknown database. Choose one of: ${[...byName.keys()].join(', ')}.`);
      if (typeof args.sql !== 'string') throw new Error('The "sql" argument must be a string.');
      return runReadOnlyQuery(database, args.sql);
    },
  };
}
