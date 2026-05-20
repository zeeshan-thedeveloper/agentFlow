import type { NodeHandler } from './base.handler';
import { isNodeInput } from '../runs/node-input';
import { CredentialResolver } from '../integrations/credential.resolver';
import type { SchemaConfig } from '../integrations/integration.interfaces';
import { getClient } from '../integrations/providers/database/database.connection';
import { guardQuerySql } from '../integrations/providers/database/database.sanitizer';
import { enforceSchemaPolicy } from '../integrations/schema.enforcer';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ROWS = 1000;

export class QueryRunnerHandler implements NodeHandler {
  constructor(
    private readonly credentialResolver: CredentialResolver,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    const nodeInput = isNodeInput(input) ? input : { data: input };
    const integrationId = String(nodeInput.connection ?? params.integrationId ?? '');
    const userId = String(params.userId ?? params.workflowOwnerId ?? '');

    if (!integrationId) throw new Error('Query Runner: integrationId is required.');
    if (!userId) throw new Error('Query Runner: userId was not injected into node params.');

    const actionParams =
      params.actionParams && typeof params.actionParams === 'object' && !Array.isArray(params.actionParams)
        ? (params.actionParams as Record<string, unknown>)
        : {};

    const staticSql = typeof actionParams.sql === 'string' ? actionParams.sql.trim() : '';

    const sql =
      (nodeInput.query ? String(nodeInput.query).trim() : '') ||
      (typeof nodeInput.data === 'string' ? nodeInput.data.trim() : '') ||
      staticSql;

    if (!sql) throw new Error('Query Runner: no SQL received on query-in or data-in handle.');

    guardQuerySql(sql);

    const schemaConfigRow = await this.prisma.databaseSchemaConfig.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });
    const schemaConfig = schemaConfigRow
      ? (schemaConfigRow.config as unknown as SchemaConfig)
      : null;

    enforceSchemaPolicy('query', { sql }, schemaConfig);

    const credentials = await this.credentialResolver.resolve(userId, integrationId);
    const connectionString = credentials.connectionString;
    if (typeof connectionString !== 'string' || !connectionString) {
      throw new Error('Query Runner: no database connection string found.');
    }

    const limit = Math.min(MAX_ROWS, 100);
    const sqlWithLimit = /\blimit\s+\d+/i.test(sql) ? sql : `${sql} LIMIT ${limit}`;

    const client = await getClient(connectionString);
    try {
      const result = await client.query(sqlWithLimit);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields.map(field => ({ name: field.name, dataTypeID: field.dataTypeID })),
      };
    } finally {
      client.release();
    }
  }
}
