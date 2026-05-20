import type { SchemaConfig } from './integration.interfaces';

type OperationType = 'read' | 'insert' | 'update' | 'delete';

const ACTION_TO_OPERATION: Record<string, OperationType> = {
  query: 'read',
  insert: 'insert',
  update: 'update',
  delete: 'delete',
  find: 'read',
  insertOne: 'insert',
  updateOne: 'update',
  deleteOne: 'delete',
};

function extractTableName(actionId: string, params: Record<string, unknown>): string | null {
  const sqlActions = new Set(['query', 'insert', 'update', 'delete']);

  if (sqlActions.has(actionId)) {
    const sql = typeof params.sql === 'string' ? params.sql.trim() : '';
    const match = sql.match(/(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+["']?(\w+)["']?/i);
    return match ? match[1].toLowerCase() : null;
  }

  const collection = params.collection ?? params.table;
  return typeof collection === 'string' ? collection : null;
}

export function enforceSchemaPolicy(
  actionId: string,
  params: Record<string, unknown>,
  config: SchemaConfig | null,
): void {
  if (!config) return;

  const operation = ACTION_TO_OPERATION[actionId];
  if (!operation) return;

  const tableName = extractTableName(actionId, params);
  if (!tableName) {
    throw new Error(
      `Schema enforcement: could not determine target table for action "${actionId}". ` +
        `Ensure your SQL includes a FROM/INTO/UPDATE clause or set params.collection.`,
    );
  }

  const tableConfig = config.tables[tableName];
  if (!tableConfig) {
    throw new Error(
      `Schema enforcement: table "${tableName}" is not in the allowed list for this connection. ` +
        `Open "Configure Schema" on this connection to add it.`,
    );
  }

  if (!tableConfig[operation]) {
    throw new Error(
      `Schema enforcement: operation "${operation}" is not permitted on table "${tableName}". ` +
        `Open "Configure Schema" to enable it.`,
    );
  }
}
