import PDFDocument from 'pdfkit';

const MAX_CONTENT_CHARS = 200_000;

// The built-in PDF fonts only cover Latin-1; swap common typography for ASCII
// and drop the rest rather than printing garbage.
function printable(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●]/g, '-')
    .replace(/[^\n\t -~ -ÿ]/g, '');
}

const stripInline = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1');

/**
 * Renders a title and simple Markdown (# headings, - or 1. lists, paragraphs)
 * into a PDF. Agents write reports in Markdown already, so this is the format
 * the create_pdf tool asks for.
 */
export function renderPdf(title: string, content: string): Promise<Buffer> {
  if (content.length > MAX_CONTENT_CHARS) throw new Error(`PDF content can be at most ${MAX_CONTENT_CHARS} characters.`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: printable(title), Creator: 'AgentFlow' } });
    const parts: Buffer[] = [];
    doc.on('data', (part: Buffer) => parts.push(part));
    doc.on('end', () => resolve(Buffer.concat(parts)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(20).text(printable(title));
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(`Created by an AgentFlow agent on ${new Date().toUTCString()}`);
    doc.fillColor('#000000').moveDown(1);

    for (const block of printable(content).replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
      const lines = block.split('\n').filter(line => line.trim());
      if (lines.length === 0) continue;

      const heading = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
      if (heading && lines.length === 1) {
        const size = heading[1].length === 1 ? 16 : heading[1].length === 2 ? 14 : 12;
        doc.moveDown(0.4).font('Helvetica-Bold').fontSize(size).text(stripInline(heading[2]));
        doc.moveDown(0.3);
        continue;
      }

      if (lines.every(line => /^\s*([-*+]|\d+[.)])\s+/.test(line))) {
        doc.font('Helvetica').fontSize(11);
        for (const line of lines) {
          const marker = /^\s*(\d+[.)])/.exec(line)?.[1] ?? '-';
          doc.text(`${marker}  ${stripInline(line.replace(/^\s*([-*+]|\d+[.)])\s+/, ''))}`, { indent: 12 });
        }
        doc.moveDown(0.6);
        continue;
      }

      for (const line of lines) {
        const inlineHeading = /^(#{1,3})\s+(.*)$/.exec(line);
        if (inlineHeading) doc.font('Helvetica-Bold').fontSize(13).text(stripInline(inlineHeading[2]));
        else doc.font('Helvetica').fontSize(11).text(stripInline(line), { align: 'left' });
      }
      doc.moveDown(0.6);
    }

    doc.end();
  });
}
