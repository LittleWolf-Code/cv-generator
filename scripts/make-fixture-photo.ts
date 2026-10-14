// Generates the fictitious photo of the "courte" persona (§5.2, ADR 0012): an abstract pattern (no
// person, real or generated), passed through the import pipeline (processPhoto: 3:4, 600 × 800 at
// most, JPEG quality 85, 300 KB at most, no metadata). Run once: `npx tsx scripts/make-fixture-photo.ts`;
// the result is versioned in fixtures/personas/courte/assets/photo.jpg.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { inspectPhoto, processPhoto } from '@cv/render';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'fixtures', 'personas', 'courte', 'assets', 'photo.jpg');

// A landscape source on purpose: the pipeline crops it to 3:4.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f4e79"/>
      <stop offset="1" stop-color="#7fb3d5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="18">
    <circle cx="600" cy="450" r="120"/>
    <circle cx="600" cy="450" r="220"/>
    <circle cx="600" cy="450" r="320"/>
  </g>
  <g fill="#f2c14e" fill-opacity="0.8">
    <rect x="420" y="560" width="360" height="40" transform="rotate(-20 600 580)"/>
    <polygon points="600,250 660,370 540,370"/>
  </g>
</svg>`;

async function main(): Promise<void> {
  const source = await sharp(Buffer.from(svg)).png().toBuffer();
  const photo = await processPhoto(new Uint8Array(source));
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, photo.jpeg);
  const info = await inspectPhoto(photo.jpeg);
  process.stdout.write(
    `${path.relative(ROOT, OUT)} : ${info.width} × ${info.height}, ${Math.round(info.bytes / 1024)} Ko, qualité ${photo.quality}, EXIF ${info.exif ? 'oui' : 'non'}\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`${(err as Error).message}\n`);
  process.exit(1);
});
