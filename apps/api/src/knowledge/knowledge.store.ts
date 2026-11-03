import type { PoolClient } from 'pg';
import type { CredentialResolver } from '../integrations/credential.resolver';
import { postgresConnectionString, withPostgresClient } from '../integrations/postgres-connection';
import { EMBEDDING_DIMENSIONS } from './knowledge.text';

// Knowledge lives in the user's own PostgreSQL database (Neon, Supabase, ...),
// in one table with the pgvector extension. Each row is one chunk of a
// document; a knowledge base is just a name that groups documents.
export const KNOWLEDGE_TABLE = 'agentflow_knowledge';

export interface KnowledgeDocument {
  document: string;
  chunks: number;
  characters: number;
  addedAt: string;
}

export interface KnowledgeMatch {
  document: string;
  content: string;
  /** Cosine similarity, 1 is identical. */
  score: number;
}

const KNOWLEDGE_BASE_NAME = /^[\w .-]{1,64}$/;

/** A knowledge base name: letters, digits, spaces, dots, dashes and underscores. */
export function requireKnowledgeBaseName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!KNOWLEDGE_BASE_NAME.test(name)) {
    throw new Error('Name the knowledge base with up to 64 letters, digits, spaces, dots, dashes or underscores.');
  }
  return name;
}

/** The connection string of the PostgreSQL connection a Knowledge node points at. */
export function knowledgeConnectionString(resolver: CredentialResolver, userId: string, integrationId: unknown): Promise<string> {
  return postgresConnectionString(resolver, userId, integrationId, 'Knowledge');
}

const toVector = (embedding: number[]) => `[${embedding.join(',')}]`;

async function tableExists(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${KNOWLEDGE_TABLE}`]);
  return result.rows[0]?.exists === true;
}

/** Creates the pgvector extension and the knowledge table the first time a document is added. */
async function ensureTable(client: PoolClient): Promise<void> {
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (error) {
    throw new Error(
      `This database can't use the pgvector extension (${error instanceof Error ? error.message : String(error)}). ` +
        'Neon and Supabase include it; on your own server install pgvector first.',
    );
  }
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${KNOWLEDGE_TABLE} (
      id bigserial PRIMARY KEY,
      knowledge_base text NOT NULL,
      document text NOT NULL,
      chunk_index integer NOT NULL,
      content text NOT NULL,
      embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await client.query(
    `CREATE INDEX IF NOT EXISTS ${KNOWLEDGE_TABLE}_document_idx ON ${KNOWLEDGE_TABLE} (knowledge_base, document)`,
  );
  // HNSW needs pgvector 0.5+; without the index search still works, just scans the table.
  await client.query('SAVEPOINT hnsw');
  await client
    .query(`CREATE INDEX IF NOT EXISTS ${KNOWLEDGE_TABLE}_embedding_idx ON ${KNOWLEDGE_TABLE} USING hnsw (embedding vector_cosine_ops)`)
    .catch(() => client.query('ROLLBACK TO SAVEPOINT hnsw'));
}

/** Stores a document's chunks, replacing any document of the same name in that knowledge base. */
export async function saveDocument(
  connectionString: string,
  knowledgeBase: string,
  document: string,
  chunks: string[],
  embeddings: number[][],
): Promise<void> {
  await withPostgresClient(connectionString, async client => {
    await client.query('BEGIN');
    await ensureTable(client);
    await client.query(`DELETE FROM ${KNOWLEDGE_TABLE} WHERE knowledge_base = $1 AND document = $2`, [knowledgeBase, document]);
    for (let index = 0; index < chunks.length; index++) {
      await client.query(
        `INSERT INTO ${KNOWLEDGE_TABLE} (knowledge_base, document, chunk_index, content, embedding) VALUES ($1, $2, $3, $4, $5::vector)`,
        [knowledgeBase, document, index, chunks[index], toVector(embeddings[index])],
      );
    }
    await client.query('COMMIT');
  });
}

export async function listDocuments(connectionString: string, knowledgeBase: string): Promise<KnowledgeDocument[]> {
  return withPostgresClient(connectionString, async client => {
    if (!(await tableExists(client))) return [];
    const result = await client.query<{ document: string; chunks: string; characters: string; added_at: Date }>(
      `SELECT document, count(*) AS chunks, sum(length(content)) AS characters, max(created_at) AS added_at
         FROM ${KNOWLEDGE_TABLE}
        WHERE knowledge_base = $1
        GROUP BY document
        ORDER BY max(created_at) DESC`,
      [knowledgeBase],
    );
    return result.rows.map(row => ({
      document: row.document,
      chunks: Number(row.chunks),
      characters: Number(row.characters),
      addedAt: row.added_at.toISOString(),
    }));
  });
}

export async function deleteDocument(connectionString: string, knowledgeBase: string, document: string): Promise<void> {
  await withPostgresClient(connectionString, async client => {
    if (!(await tableExists(client))) return;
    await client.query(`DELETE FROM ${KNOWLEDGE_TABLE} WHERE knowledge_base = $1 AND document = $2`, [knowledgeBase, document]);
  });
}

/** The chunks closest in meaning to `embedding`. */
export async function searchKnowledge(
  connectionString: string,
  knowledgeBase: string,
  embedding: number[],
  limit: number,
): Promise<KnowledgeMatch[]> {
  return withPostgresClient(connectionString, async client => {
    if (!(await tableExists(client))) return [];
    const result = await client.query<{ document: string; content: string; score: number }>(
      `SELECT document, content, 1 - (embedding <=> $2::vector) AS score
         FROM ${KNOWLEDGE_TABLE}
        WHERE knowledge_base = $1
        ORDER BY embedding <=> $2::vector
        LIMIT $3`,
      [knowledgeBase, toVector(embedding), limit],
    );
    return result.rows.map(row => ({ ...row, score: Number(row.score) }));
  });
}
