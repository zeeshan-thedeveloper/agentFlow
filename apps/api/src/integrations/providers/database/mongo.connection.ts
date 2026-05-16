import { createHash } from 'crypto';
import { MongoClient } from 'mongodb';

const clients = new Map<string, MongoClient>();

function hashUri(uri: string): string {
  return createHash('sha256').update(uri).digest('hex');
}

export async function getMongoClient(uri: string): Promise<MongoClient> {
  const key = hashUri(uri);
  if (!clients.has(key)) {
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 });
    await client.connect();
    clients.set(key, client);
  }
  return clients.get(key)!;
}

export async function testMongoConnection(uri: string): Promise<string> {
  const client = await getMongoClient(uri);
  const result = await client.db('admin').command({ buildInfo: 1 });
  return `MongoDB ${result.version}`;
}

export async function closeAllMongoClients(): Promise<void> {
  await Promise.all([...clients.values()].map((client) => client.close()));
  clients.clear();
}
