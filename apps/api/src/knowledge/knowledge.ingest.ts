import type OpenAI from 'openai';
import { saveDocument } from './knowledge.store';
import { chunkText, embed } from './knowledge.text';

export const MAX_DOCUMENT_CHARS = 500_000;
const MAX_TITLE_CHARS = 200;

export function requireDocumentTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : '';
  if (!title) throw new Error('Give the document a name.');
  if (title.length > MAX_TITLE_CHARS) throw new Error(`Document names are at most ${MAX_TITLE_CHARS} characters.`);
  return title;
}

/**
 * Splits a document into chunks, embeds them and stores them, replacing a
 * document of the same name. Used by the canvas and by agents allowed to write.
 */
export async function ingestDocument(
  client: OpenAI,
  connectionString: string,
  knowledgeBase: string,
  title: string,
  text: string,
  maxChars = MAX_DOCUMENT_CHARS,
): Promise<number> {
  if (text.length > maxChars) {
    throw new Error(`A document can be at most ${maxChars.toLocaleString('en-US')} characters; split it into parts.`);
  }
  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error('The document has no text.');
  const embeddings = await embed(client, chunks);
  await saveDocument(connectionString, knowledgeBase, title, chunks, embeddings, text);
  return chunks.length;
}
