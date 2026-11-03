import type OpenAI from 'openai';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

const CHUNK_CHARS = 1200;
const OVERLAP_CHARS = 200;
const EMBED_BATCH = 96;

/**
 * Splits text into overlapping chunks of about CHUNK_CHARS, breaking at
 * paragraph, then sentence, then word boundaries where it can, so each chunk
 * reads on its own when an agent finds it.
 */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_CHARS, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const minBreak = CHUNK_CHARS / 2;
      const breakAt = [window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'), window.lastIndexOf(' ')]
        .find(index => index >= minBreak);
      if (breakAt !== undefined) end = start + breakAt + 1;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return chunks;
}

export async function embed(client: OpenAI, texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let index = 0; index < texts.length; index += EMBED_BATCH) {
    const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: texts.slice(index, index + EMBED_BATCH) });
    embeddings.push(...response.data.sort((a, b) => a.index - b.index).map(item => item.embedding));
  }
  return embeddings;
}
