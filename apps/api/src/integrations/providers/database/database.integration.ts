import type {
  Integration,
  IntegrationActionDef,
  ResolvedCredentials,
} from '../../integration.interfaces';
import { getClient } from './database.connection';
import { guardQuerySql, MAX_ROWS, parseQueryParams } from './database.sanitizer';

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
