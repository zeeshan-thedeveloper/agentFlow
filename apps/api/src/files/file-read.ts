import type OpenAI from 'openai';
// The legacy build runs in Node without a DOM or a worker file.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import type { StoredFile } from './files.store';

const MAX_TEXT_CHARS = 20_000;
const VISION_MODEL = 'gpt-4o-mini';

const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml', 'yaml', 'yml', 'log']);

const MAX_PDF_PAGES = 50;

async function pdfText(data: Buffer): Promise<{ text: string; pages: number }> {
  const doc = await getDocument({ data: new Uint8Array(data), isEvalSupported: false, useSystemFonts: false }).promise;
  try {
    const pages: string[] = [];
    for (let number = 1; number <= Math.min(doc.numPages, MAX_PDF_PAGES); number++) {
      const content = await (await doc.getPage(number)).getTextContent();
      pages.push(content.items.map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '')).join(''));
    }
    return { text: pages.join('\n\n'), pages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

const extension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

function truncate(text: string): string {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n... (truncated; the file has ${text.length} characters)` : text;
}

/** Turns a stored file into text an agent can read: PDF text, plain text, or a vision model's reading of an image. */
export async function readFileAsText(client: OpenAI, file: StoredFile): Promise<string> {
  const ext = extension(file.name);
  const type = file.contentType.toLowerCase();

  if (type === 'application/pdf' || ext === 'pdf') {
    const { text, pages } = await pdfText(file.data);
    const clean = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!clean) return `"${file.name}" is a ${pages}-page PDF with no text layer (probably a scan), so its text can't be read.`;
    return truncate(clean);
  }

  const imageType = type.startsWith('image/') ? type : IMAGE_TYPES[ext];
  if (imageType) {
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe all text in this image exactly, then briefly describe anything else in it that matters (tables, stamps, codes).' },
          { type: 'image_url', image_url: { url: `data:${imageType};base64,${file.data.toString('base64')}` } },
        ],
      }],
    });
    return truncate(response.choices[0]?.message.content?.trim() || '(no text found in the image)');
  }

  if (type.startsWith('text/') || type === 'application/json' || TEXT_EXTENSIONS.has(ext)) {
    return truncate(file.data.toString('utf8'));
  }

  return `"${file.name}" (${type || 'unknown type'}) isn't a file AgentFlow can read; PDFs, images and text files are supported.`;
}
