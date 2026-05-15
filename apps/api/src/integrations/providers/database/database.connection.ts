import { createHash } from 'crypto';
import { Pool, PoolClient } from 'pg';

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

// Used by the test-connection endpoint - tries to connect, returns server version or throws.
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
