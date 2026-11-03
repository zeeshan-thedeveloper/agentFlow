export interface StoredFile {
  id: string;
  folder: string;
  name: string;
  contentType: string;
  size: number;
  /** 'agent' when an agent created it, 'upload' when added from the canvas. */
  source: string;
  createdAt: string;
}

interface FilesTarget {
  integrationId: string;
  folder: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/files${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string | string[]; error?: string };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? body.error;
    throw new Error(message || 'Request failed');
  }
  return body;
}

const query = (params: Record<string, string>) => `?${new URLSearchParams(params)}`;

export const listFiles = ({ integrationId, folder }: FilesTarget) =>
  request<{ files: StoredFile[] }>(query({ integrationId, folder })).then(body => body.files);

export function fileDownloadUrl(integrationId: string, id: string) {
  return `/api/files/download${query({ integrationId, id })}`;
}

export const deleteFile = (integrationId: string, id: string) =>
  request<{ ok: boolean }>(query({ integrationId, id }), { method: 'DELETE' });

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Adds a file to the folder; the node's Slack and Telegram notifications go out for it too. */
export async function uploadFile(
  target: FilesTarget & { notifySlackChannel?: string; notifyTelegramChatId?: string },
  file: File,
) {
  return request<{ file: StoredFile; notifications: string[] }>('', {
    method: 'POST',
    body: JSON.stringify({
      ...target,
      name: file.name,
      contentType: file.type || 'application/octet-stream',
      contentBase64: await toBase64(file),
    }),
  });
}
