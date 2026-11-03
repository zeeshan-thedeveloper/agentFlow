import type { PoolClient } from 'pg';
import type { CredentialResolver } from './credential.resolver';
import { getClient } from './providers/database/database.connection';

const STATEMENT_TIMEOUT_MS = 15_000;

/** The connection string of the PostgreSQL connection a storage node (Knowledge, Files) points at. */
export async function postgresConnectionString(
  resolver: CredentialResolver,
  userId: string,
  integrationId: unknown,
  nodeName: string,
): Promise<string> {
  if (typeof integrationId !== 'string' || !integrationId || integrationId === 'database') {
    throw new Error(`The ${nodeName} node has no database selected. Pick a PostgreSQL connection in its settings.`);
  }
  if (!integrationId.startsWith('database:pg')) {
    throw new Error(`The ${nodeName} node needs a PostgreSQL database, such as a free Neon database.`);
  }
  const { connectionString } = await resolver.resolve(userId, integrationId);
  if (!connectionString || connectionString.startsWith('mongodb')) {
    throw new Error(`Database "${integrationId}" has no PostgreSQL connection string.`);
  }
  return connectionString;
}

/** Runs `work` on a pooled connection; an open transaction is rolled back if it throws. */
export async function withPostgresClient<T>(connectionString: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient(connectionString);
  let broken = false;
  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    return await work(client);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {
      broken = true;
    });
    throw error;
  } finally {
    client.release(broken);
  }
}
