import type {
  Integration,
  IntegrationActionDef,
  ResolvedCredentials,
  SchemaConfig,
} from '../../integration.interfaces';
import { getClient } from './database.connection';
import {
  guardQuerySql,
  MAX_ROWS,
  MAX_SQL_LENGTH,
  parseQueryParams,
} from './database.sanitizer';

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
        placeholder: "DELETE FROM temp_jobs WHERE created_at < NOW() - INTERVAL '7 days'",
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
  {
    id: 'introspect',
    name: 'Get Schema',
    description: 'Introspect the database and return a compact schema description for use as agent context.',
    paramSchema: [],
  },
];

export class DatabaseIntegration implements Integration {
  id = 'database';
  name = 'Database';
  description = 'Query or write to a PostgreSQL database';
  authType = 'connection_string' as const;
  credentialLabel = 'Connection String';
  actions = ACTIONS;

  constructor(
    private readonly schemaConfigLoader: (
      userId: string,
      integrationId: string,
    ) => Promise<SchemaConfig | null>,
  ) {}

  async execute(
    actionId: string,
    params: Record<string, unknown>,
    _input: unknown,
    credentials: ResolvedCredentials,
  ): Promise<unknown> {
    const userId = String(params._userId ?? '');
    const integrationId = String(params._integrationId ?? '');
    const { connectionString } = credentials;
    if (!connectionString) {
      throw new Error('No database connection string found. Connect a database first.');
    }

    switch (actionId) {
      case 'query':
        return this.runQuery(connectionString, params);
      case 'insert':
        return this.runInsert(connectionString, params);
      case 'update':
        return this.runUpdate(connectionString, params);
      case 'execute':
        return this.runExecute(connectionString, params);
      case 'introspect':
        return this.runIntrospect(connectionString, userId, integrationId);
      default:
        throw new Error(`Unknown action: ${actionId}`);
    }
  }

  private async runIntrospect(
    connectionString: string,
    userId: string,
    integrationId: string,
  ): Promise<unknown> {
    const client = await getClient(connectionString);
    let rows: { table_name: string; column_name: string; data_type: string }[];
    try {
      const result = await client.query<{
        table_name: string;
        column_name: string;
        data_type: string;
      }>(
        `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
      );
      rows = result.rows;
    } finally {
      client.release();
    }

    const tableMap = new Map<string, string[]>();
    for (const row of rows) {
      if (!tableMap.has(row.table_name)) tableMap.set(row.table_name, []);
      tableMap.get(row.table_name)!.push(`${row.column_name} ${row.data_type}`);
    }

    const schemaConfig = await this.schemaConfigLoader(userId, integrationId);
    const allowedTables = schemaConfig
      ? Object.keys(schemaConfig.tables).filter((t) => tableMap.has(t))
      : [...tableMap.keys()];

    const description = allowedTables
      .map((t) => `${t}(${(tableMap.get(t) ?? []).join(', ')})`)
      .join(', ');

    return {
      schema: `Tables: ${description}`,
      tableCount: allowedTables.length,
    };
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

  private async runInsert(
    connectionString: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const table = String(params.table ?? '').trim();
    if (!table) throw new Error('Table name is required.');

    let data: Record<string, unknown>;
    try {
      data =
        typeof params.data === 'string'
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
      setData =
        typeof params.set === 'string'
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
    // No guardQuerySql here - execute is the unrestricted escape hatch.
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
}
