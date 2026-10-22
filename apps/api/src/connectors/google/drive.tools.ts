import type { Tool } from '../../handlers/tools/base.tool';
import { DRIVE_READ_SCOPE, googleError, type GoogleSession } from './google.client';

const API = 'https://www.googleapis.com/drive/v3/files';
const MAX_SEARCH_RESULTS = 20;
const MAX_CONTENT_CHARS = 20_000;

/** Google's own formats have no file to download; they are exported to text instead. */
const EXPORT_AS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-yaml|yaml|javascript))/;

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string };

/** A Drive query string literal: backslashes and single quotes escaped. */
function literal(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function createDriveTools(session: GoogleSession): Tool[] {
  if (!session.hasScope(DRIVE_READ_SCOPE)) {
    throw new Error(
      'Reading Google Drive isn\'t enabled for this Google connection. Reconnect Google with "Also let agents read email and Drive" ticked (test users only for now).',
    );
  }

  const search: Tool = {
    definition: {
      name: 'drive_search',
      description:
        `Search Google Drive (${session.email}) for files whose name or content matches the text. ` +
        'Returns file ids, names, types and links. Access is read-only.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Words to look for in file names and contents.' },
          max_results: { type: 'number', description: `Up to ${MAX_SEARCH_RESULTS}. Default 10.` },
        },
        required: ['text'],
      },
    },
    async run(args) {
      const text = String(args.text ?? '').trim();
      const max = Math.min(Math.max(Number(args.max_results) || 10, 1), MAX_SEARCH_RESULTS);
      const q = text
        ? `(name contains ${literal(text)} or fullText contains ${literal(text)}) and trashed = false`
        : 'trashed = false';
      const result = await session.json<{ files?: DriveFile[] }>(
        `${API}?${new URLSearchParams({
          q,
          pageSize: String(max),
          fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
          // Drive can't sort full-text matches, so only a plain listing is ordered.
          ...(text ? {} : { orderBy: 'modifiedTime desc' }),
        })}`,
      );
      if (!result.files?.length) return 'No files match that search.';
      return JSON.stringify(result.files, null, 2);
    },
  };

  const read: Tool = {
    definition: {
      name: 'drive_read',
      description: 'Read the text of a Drive file by id: Google Docs, Sheets (as CSV), Slides, and plain text files.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The file id from drive_search.' } },
        required: ['id'],
      },
    },
    async run(args) {
      const id = encodeURIComponent(String(args.id ?? ''));
      const file = await session.json<DriveFile>(`${API}/${id}?fields=id,name,mimeType`);
      const exportType = EXPORT_AS[file.mimeType];

      let url: string;
      if (exportType) url = `${API}/${id}/export?mimeType=${encodeURIComponent(exportType)}`;
      else if (TEXT_TYPES.test(file.mimeType)) url = `${API}/${id}?alt=media`;
      else return `"${file.name}" is a ${file.mimeType} file, which can't be read as text yet.`;

      const response = await session.fetch(url);
      if (!response.ok) throw new Error(await googleError(response));
      let content = await response.text();
      if (content.length > MAX_CONTENT_CHARS) content = `${content.slice(0, MAX_CONTENT_CHARS)}\n...[truncated]`;
      return `# ${file.name}\n\n${content}`;
    },
  };

  return [search, read];
}
