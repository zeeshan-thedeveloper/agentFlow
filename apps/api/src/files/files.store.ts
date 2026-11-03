import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { assertPublicHost } from '../common/network-guard';
import type { CredentialResolver } from '../integrations/credential.resolver';

// Files live in the user's own S3-compatible object storage (Neon storage,
// Cloudflare R2, AWS S3, ...). A folder is a key prefix: "<folder>/<name>".
export const STORAGE_PREFIX = 'storage:s3';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_LISTED = 200;

const FOLDER_NAME = /^[\w .-]{1,64}$/;
const FILE_NAME = /^[^/\\\u0000-\u001f]{1,200}$/;

/** What a Storage connection holds, encrypted in user_integration_credentials. */
export interface StorageCredential {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StoredFileInfo {
  /** The object key, "<folder>/<name>". */
  id: string;
  folder: string;
  name: string;
  contentType: string;
  size: number;
  /** 'agent' when an agent created it, 'upload' when added from the canvas; empty in listings. */
  source: string;
  createdAt: string;
}

export interface StoredFile extends StoredFileInfo {
  data: Buffer;
}

/** A folder name: letters, digits, spaces, dots, dashes and underscores. */
export function requireFolderName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!FOLDER_NAME.test(name) || /^\.+$/.test(name)) {
    throw new Error('Name the folder with up to 64 letters, digits, spaces, dots, dashes or underscores.');
  }
  return name;
}

export function requireFileName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!FILE_NAME.test(name) || /^\.+$/.test(name)) {
    throw new Error('File names are 1-200 characters and cannot contain slashes.');
  }
  return name;
}

/** Splits an object key into its folder and file name, refusing keys a Files node could not have written. */
function parseKey(key: string): { folder: string; name: string } {
  const slash = key.indexOf('/');
  if (slash < 0) throw new Error('Unknown file.');
  return { folder: requireFolderName(key.slice(0, slash)), name: requireFileName(key.slice(slash + 1)) };
}

/** Checks the fields of a new Storage connection. */
export function requireStorageCredential(body: Partial<Record<keyof StorageCredential, unknown>>): StorageCredential {
  const field = (name: keyof StorageCredential, label: string) => {
    const value = typeof body[name] === 'string' ? (body[name] as string).trim() : '';
    if (!value) throw new Error(`${label} is required.`);
    return value;
  };
  const endpoint = field('endpoint', 'Endpoint URL').replace(/\/+$/, '');
  if (!/^https:\/\/[^/?#\s]+$/.test(endpoint)) throw new Error('The endpoint is an https:// URL without a path, e.g. https://xyz.storage.aws.neon.tech.');
  const bucket = field('bucket', 'Bucket');
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Bucket names are 3-63 lower-case letters, digits, dots or dashes.');
  return {
    endpoint,
    region: field('region', 'Region'),
    bucket,
    accessKeyId: field('accessKeyId', 'Access key ID'),
    secretAccessKey: field('secretAccessKey', 'Secret access key'),
  };
}

/** The Storage connection a Files node points at. */
export async function storageCredential(resolver: CredentialResolver, userId: string, integrationId: unknown): Promise<StorageCredential> {
  if (typeof integrationId !== 'string' || !integrationId.startsWith(`${STORAGE_PREFIX}:`)) {
    throw new Error('The Files node has no storage selected. Add or pick an S3-compatible storage in its settings.');
  }
  return (await resolver.resolve(userId, integrationId)) as unknown as StorageCredential;
}

async function clientFor(storage: StorageCredential): Promise<S3Client> {
  // The endpoint is user-chosen, so it must not point at the server or a private network.
  await assertPublicHost(new URL(storage.endpoint).hostname);
  return new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
    // S3-compatible services don't all support bucket subdomains or the newer default checksums.
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

function storageError(error: unknown): Error {
  const err = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const status = err.$metadata?.httpStatusCode;
  if (err.name === 'NoSuchBucket') return new Error('That bucket does not exist in this storage. Create it first, or check its name.');
  if (status === 403 || err.name === 'InvalidAccessKeyId' || err.name === 'SignatureDoesNotMatch') {
    return new Error('The storage refused the access key. Check the key ID, secret and region.');
  }
  return new Error(`Storage error: ${err.message ?? String(error)}`);
}

async function withStorage<T>(storage: StorageCredential, work: (client: S3Client) => Promise<T>): Promise<T> {
  const client = await clientFor(storage);
  try {
    return await work(client);
  } catch (error) {
    throw storageError(error);
  } finally {
    client.destroy();
  }
}

/** Proves the credentials can list the bucket. */
export function testStorage(storage: StorageCredential): Promise<void> {
  return withStorage(storage, async client => {
    await client.send(new ListObjectsV2Command({ Bucket: storage.bucket, MaxKeys: 1 }));
  });
}

/** Stores a file at "<folder>/<name>", replacing one of the same name. */
export async function saveFile(
  storage: StorageCredential,
  file: { folder: string; name: string; contentType: string; data: Buffer; source: 'agent' | 'upload' },
): Promise<StoredFileInfo> {
  if (file.data.length > MAX_FILE_BYTES) throw new Error(`Files can be at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  const key = `${file.folder}/${file.name}`;
  await withStorage(storage, client =>
    client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: file.data,
      ContentType: file.contentType,
      Metadata: { source: file.source },
    })),
  );
  return {
    id: key,
    folder: file.folder,
    name: file.name,
    contentType: file.contentType,
    size: file.data.length,
    source: file.source,
    createdAt: new Date().toISOString(),
  };
}

export async function listFiles(storage: StorageCredential, folder: string): Promise<StoredFileInfo[]> {
  const prefix = `${folder}/`;
  const result = await withStorage(storage, client =>
    client.send(new ListObjectsV2Command({ Bucket: storage.bucket, Prefix: prefix, MaxKeys: MAX_LISTED })),
  );
  return (result.Contents ?? [])
    .filter(object => object.Key && object.Key.length > prefix.length && !object.Key.slice(prefix.length).includes('/'))
    .map(object => ({
      id: object.Key!,
      folder,
      name: object.Key!.slice(prefix.length),
      contentType: '',
      size: object.Size ?? 0,
      source: '',
      createdAt: (object.LastModified ?? new Date(0)).toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getFile(storage: StorageCredential, key: string): Promise<StoredFile | null> {
  const { folder, name } = parseKey(key);
  return withStorage(storage, async client => {
    try {
      const object = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
      const data = Buffer.from(await object.Body!.transformToByteArray());
      return {
        id: key,
        folder,
        name,
        contentType: object.ContentType ?? 'application/octet-stream',
        size: data.length,
        source: object.Metadata?.source ?? '',
        createdAt: (object.LastModified ?? new Date()).toISOString(),
        data,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') return null;
      throw error;
    }
  });
}

export async function deleteFile(storage: StorageCredential, key: string): Promise<void> {
  parseKey(key);
  await withStorage(storage, client => client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key })));
}
