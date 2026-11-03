import type { PoolClient } from 'pg';
import type { CredentialResolver } from '../integrations/credential.resolver';
import { postgresConnectionString, withPostgresClient } from '../integrations/postgres-connection';

// Files live in the user's own PostgreSQL database, in one table; a folder is
// just a name that groups files, like a knowledge base groups documents.
export const FILES_TABLE = 'agentflow_files';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FOLDER_NAME = /^[\w .-]{1,64}$/;
const FILE_NAME = /^[^/\\\u0000-\u001f]{1,200}$/;

export interface StoredFileInfo {
  id: string;
  folder: string;
  name: string;
  contentType: string;
  size: number;
  /** 'agent' when an agent created it, 'upload' when added from the canvas. */
  source: string;
  createdAt: string;
}

export interface StoredFile extends StoredFileInfo {
  data: Buffer;
}

/** A folder name: letters, digits, spaces, dots, dashes and underscores. */
export function requireFolderName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!FOLDER_NAME.test(name)) {
    throw new Error('Name the folder with up to 64 letters, digits, spaces, dots, dashes or underscores.');
  }
  return name;
}

export function requireFileName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!FILE_NAME.test(name)) throw new Error('File names are 1-200 characters and cannot contain slashes.');
  return name;
}

/** The connection string of the PostgreSQL connection a Files node points at. */
export function filesConnectionString(resolver: CredentialResolver, userId: string, integrationId: unknown): Promise<string> {
  return postgresConnectionString(resolver, userId, integrationId, 'Files');
}

async function tableExists(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${FILES_TABLE}`]);
  return result.rows[0]?.exists === true;
}

type FileRow = { id: string; folder: string; name: string; content_type: string; size: number; source: string; created_at: Date };

const toInfo = (row: FileRow): StoredFileInfo => ({
  id: String(row.id),
  folder: row.folder,
  name: row.name,
  contentType: row.content_type,
  size: Number(row.size),
  source: row.source,
  createdAt: row.created_at.toISOString(),
});

/** Stores a file, replacing any file of the same name in that folder. */
export async function saveFile(
  connectionString: string,
  file: { folder: string; name: string; contentType: string; data: Buffer; source: 'agent' | 'upload' },
): Promise<StoredFileInfo> {
  if (file.data.length > MAX_FILE_BYTES) throw new Error(`Files can be at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  return withPostgresClient(connectionString, async client => {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${FILES_TABLE} (
        id bigserial PRIMARY KEY,
        folder text NOT NULL,
        name text NOT NULL,
        content_type text NOT NULL,
        size integer NOT NULL,
        data bytea NOT NULL,
        source text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (folder, name)
      )`);
    const result = await client.query<FileRow>(
      `INSERT INTO ${FILES_TABLE} (folder, name, content_type, size, data, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (folder, name) DO UPDATE
         SET content_type = EXCLUDED.content_type, size = EXCLUDED.size, data = EXCLUDED.data,
             source = EXCLUDED.source, created_at = now()
       RETURNING id, folder, name, content_type, size, source, created_at`,
      [file.folder, file.name, file.contentType, file.data.length, file.data, file.source],
    );
    await client.query('COMMIT');
    return toInfo(result.rows[0]);
  });
}

export async function listFiles(connectionString: string, folder: string): Promise<StoredFileInfo[]> {
  return withPostgresClient(connectionString, async client => {
    if (!(await tableExists(client))) return [];
    const result = await client.query<FileRow>(
      `SELECT id, folder, name, content_type, size, source, created_at FROM ${FILES_TABLE}
        WHERE folder = $1 ORDER BY created_at DESC LIMIT 200`,
      [folder],
    );
    return result.rows.map(toInfo);
  });
}

export async function getFile(connectionString: string, id: string): Promise<StoredFile | null> {
  if (!/^\d+$/.test(id)) return null;
  return withPostgresClient(connectionString, async client => {
    if (!(await tableExists(client))) return null;
    const result = await client.query<FileRow & { data: Buffer }>(
      `SELECT id, folder, name, content_type, size, source, created_at, data FROM ${FILES_TABLE} WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? { ...toInfo(row), data: row.data } : null;
  });
}

export async function deleteFile(connectionString: string, id: string): Promise<void> {
  if (!/^\d+$/.test(id)) return;
  await withPostgresClient(connectionString, async client => {
    if (!(await tableExists(client))) return;
    await client.query(`DELETE FROM ${FILES_TABLE} WHERE id = $1`, [id]);
  });
}
