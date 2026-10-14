// Generates the fictitious import files of lot 6 (ADR 0015) from versioned sources:
// - fixtures/imports/Basic_LinkedInDataExport_fictif.zip: the CSV of fixtures/imports/linkedin/ at the
//   first level, plus an unexpected CSV at the root and a nested CSV (both must be ignored);
// - fixtures/imports/CV_Camille_Martin_fictif.pdf (text layer, pdf-lib standard font), .docx (docx) and
//   CV_Camille_Martin_fictif_scan.pdf (one image of grey bars, no text at all: a « scanned » PDF), from
//   fixtures/imports/cv-source.md.
// Run once after changing a source: `npx tsx scripts/make-fixture-imports.ts`; the results are versioned.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { zipSync, strToU8 } from 'fflate';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'fixtures', 'imports');
/** Fixed dates: the generated files do not change from one run to the next. */
const FIXED = new Date('2026-10-06T08:00:00Z');

async function linkedInZip(): Promise<void> {
  const files: Record<string, [Uint8Array, { mtime: Date }]> = {};
  const csvDir = path.join(DIR, 'linkedin');
  for (const name of (await readdir(csvDir)).filter((n) => n.endsWith('.csv')).sort()) {
    files[name] = [new Uint8Array(await readFile(path.join(csvDir, name))), { mtime: FIXED }];
  }
  // Not an expected file: skipped, and its content never read.
  files['Connections.csv'] = [
    strToU8('Notes:\n"Fichier fictif hors périmètre"\n\nFirst Name,Last Name,Company\nAlex,Exemple,Société Fictive\n'),
    { mtime: FIXED },
  ];
  // Nested: an expected name below the first level is ignored (F-IMP-02).
  files['Jobs/Positions.csv'] = [
    strToU8(
      'Company Name,Title,Description,Location,Started On,Finished On\nEntreprise Imbriquée Fictive,Ne doit pas être importé,,,Jan 2010,Dec 2010\n',
    ),
    { mtime: FIXED },
  ];
  const zip = zipSync(files, { level: 9 });
  await writeFile(path.join(DIR, 'Basic_LinkedInDataExport_fictif.zip'), zip);
  process.stdout.write(`Basic_LinkedInDataExport_fictif.zip : ${zip.length} octets\n`);
}

/** Lines of the CV source: headings in capitals, bullets starting with « • ». */
async function cvLines(): Promise<string[]> {
  return (await readFile(path.join(DIR, 'cv-source.md'), 'utf8')).replace(/\r\n/g, '\n').split('\n');
}

const isHeading = (line: string) => line.length > 3 && line === line.toLocaleUpperCase('fr') && /\p{L}/u.test(line);

async function cvPdf(lines: string[]): Promise<void> {
  const doc = await PDFDocument.create();
  doc.setTitle('CV – Camille Martin (fictif)');
  doc.setAuthor('Camille Martin');
  doc.setProducer('fixture');
  doc.setCreator('fixture');
  doc.setCreationDate(FIXED);
  doc.setModificationDate(FIXED);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595.28, 841.89]);
  const margin = 50;
  const width = 595.28 - 2 * margin;
  let y = 841.89 - margin;
  const draw = (text: string, font = regular, size = 10, indent = 0) => {
    const words = text.split(' ');
    let line = '';
    const flush = () => {
      if (y < margin + size) {
        page = doc.addPage([595.28, 841.89]);
        y = 841.89 - margin;
      }
      page.drawText(line, { x: margin + indent, y, size, font, color: rgb(0, 0, 0) });
      y -= size * 1.35;
      line = '';
    };
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width - indent && line) {
        flush();
        line = word;
      } else line = next;
    }
    if (line) flush();
  };
  lines.forEach((line, i) => {
    if (!line.trim()) {
      y -= 6;
      return;
    }
    if (i === 0) draw(line, bold, 18);
    else if (isHeading(line)) draw(line, bold, 12);
    else if (line.startsWith('• ')) draw(line, regular, 10, 10);
    else draw(line, i < 3 ? regular : bold, i === 1 ? 12 : 10);
  });
  const bytes = await doc.save({ useObjectStreams: false });
  await writeFile(path.join(DIR, 'CV_Camille_Martin_fictif.pdf'), bytes);
  process.stdout.write(`CV_Camille_Martin_fictif.pdf : ${bytes.length} octets\n`);
}

async function cvDocx(lines: string[]): Promise<void> {
  const doc = new Document({
    creator: 'Camille Martin',
    title: 'CV – Camille Martin (fictif)',
    sections: [
      {
        children: lines.map(
          (line, i) =>
            new Paragraph({
              children: [new TextRun({ text: line, bold: i === 0 || isHeading(line), size: i === 0 ? 36 : 20 })],
            }),
        ),
      },
    ],
  });
  const bytes = new Uint8Array(await Packer.toBuffer(doc));
  await writeFile(path.join(DIR, 'CV_Camille_Martin_fictif.docx'), bytes);
  process.stdout.write(`CV_Camille_Martin_fictif.docx : ${bytes.length} octets\n`);
}

/** A « scanned » CV: one image of grey bars imitating lines of text, and no text layer at all. */
async function cvScan(): Promise<void> {
  const bars: string[] = [];
  let y = 80;
  for (let i = 0; i < 38; i++) {
    const heading = i % 9 === 0;
    const w = heading ? 260 : 420 + ((i * 53) % 220);
    bars.push(`<rect x="70" y="${y}" width="${w}" height="${heading ? 16 : 10}" fill="${heading ? '#333' : '#777'}"/>`);
    y += heading ? 34 : 24;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="827" height="1169"><rect width="827" height="1169" fill="#f4f4f0"/>${bars.join('')}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const doc = await PDFDocument.create();
  doc.setProducer('fixture');
  doc.setCreator('fixture');
  doc.setCreationDate(FIXED);
  doc.setModificationDate(FIXED);
  const image = await doc.embedPng(png);
  const page = doc.addPage([595.28, 841.89]);
  page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  const bytes = await doc.save({ useObjectStreams: false });
  await writeFile(path.join(DIR, 'CV_Camille_Martin_fictif_scan.pdf'), bytes);
  process.stdout.write(`CV_Camille_Martin_fictif_scan.pdf : ${bytes.length} octets\n`);
}

async function main(): Promise<void> {
  await linkedInZip();
  const lines = await cvLines();
  await cvPdf(lines);
  await cvDocx(lines);
  await cvScan();
}

main().catch((err: unknown) => {
  process.stderr.write(`${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
