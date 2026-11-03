import type OpenAI from 'openai';
import type { Tool } from '../handlers/tools/base.tool';
import type { ConnectorStore } from '../connectors/connector.store';
import { notifyFileAdded, type FileNotifySettings } from './file-notify';
import { readFileAsText } from './file-read';
import { getFile, listFiles, requireFileName, saveFile, type StorageCredential } from './files.store';
import { renderPdf } from './pdf';

/** A Files node wired into an agent: where its PDFs go and who hears about them. */
export interface AgentFileStore {
  storage: StorageCredential;
  folder: string;
  notify: FileNotifySettings;
}

function pdfName(value: unknown): string {
  const base = requireFileName(String(value ?? '').replace(/\.pdf$/i, ''));
  return `${base}.pdf`;
}

export function createFileTools(store: ConnectorStore, userId: string, files: AgentFileStore, client: OpenAI): Tool[] {
  const createPdf: Tool = {
    definition: {
      name: 'create_pdf',
      description:
        `Create a PDF document and save it to the "${files.folder}" folder of the connected storage. ` +
        'Write the content in simple Markdown: # headings, - bullet lists and paragraphs separated by blank lines. ' +
        'A file with the same name is replaced.' +
        (files.notify.slackChannel || files.notify.telegramChatId ? ' The user is notified when the file is saved.' : ''),
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'File name, e.g. "weekly-report" (".pdf" is added).' },
          title: { type: 'string', description: 'Title printed at the top of the first page.' },
          content: { type: 'string', description: 'The document body in simple Markdown.' },
        },
        required: ['filename', 'title', 'content'],
      },
    },
    async run(args) {
      if (typeof args.content !== 'string' || !args.content.trim()) throw new Error('The "content" argument must be non-empty text.');
      const name = pdfName(args.filename);
      const title = typeof args.title === 'string' && args.title.trim() ? args.title.trim() : name.replace(/\.pdf$/, '');
      const data = await renderPdf(title, args.content);
      const saved = await saveFile(files.storage, { folder: files.folder, name, contentType: 'application/pdf', data, source: 'agent' });
      const notes = await notifyFileAdded(store, userId, files.notify, saved, data, 'agent');
      return JSON.stringify({ saved: { name: saved.name, folder: saved.folder, size: saved.size }, notifications: notes });
    },
  };

  const list: Tool = {
    definition: {
      name: 'list_files',
      description: `List the files in the "${files.folder}" folder of the connected storage, newest first.`,
      parameters: { type: 'object', properties: {} },
    },
    async run() {
      const stored = await listFiles(files.storage, files.folder);
      return JSON.stringify(stored.map(file => ({ name: file.name, size: file.size, createdAt: file.createdAt })));
    },
  };

  const read: Tool = {
    definition: {
      name: 'read_file',
      description:
        `Read a file from the "${files.folder}" folder of the connected storage: the text of a PDF or text file, ` +
        'or a transcription of an image (a photo or screenshot of a ticket, receipt, document...). ' +
        'Use list_files first to find the exact name.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'The file name exactly as list_files shows it.' } },
        required: ['name'],
      },
    },
    async run(args) {
      const name = requireFileName(args.name);
      const file = await getFile(files.storage, `${files.folder}/${name}`);
      if (!file) throw new Error(`There is no file "${name}" in "${files.folder}". Call list_files to see the names.`);
      return readFileAsText(client, file);
    },
  };

  return [createPdf, list, read];
}
