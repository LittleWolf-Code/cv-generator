// Photo of the identity (§5.2): import pipeline and the neutral placeholder of MCP renders.
// Import: EXIF orientation applied, 3:4 crop centred on the received image (the interface already sends
// the zone chosen by the user, so this crop only corrects a rounding), at most 600 × 800 px, JPEG
// quality 85 lowered by steps down to 60 to stay under 300 KB, metadata removed (sharp drops EXIF, GPS,
// XMP and ICC unless asked to keep them), alpha flattened on white, sRGB.
import sharp, { type Metadata } from 'sharp';

export const PHOTO_MAX = { width: 600, height: 800 } as const;
export const PHOTO_MIN = { width: 150, height: 200 } as const;
export const PHOTO_MAX_BYTES = 300 * 1024;
const QUALITIES = [85, 80, 75, 70, 65, 60] as const;
/** Decompression bomb guard: a 40-megapixel source is far beyond any camera photo cropped in the browser. */
const LIMIT_INPUT_PIXELS = 40_000_000;
const ACCEPTED = new Set(['jpeg', 'png', 'webp']);

export class PhotoError extends Error {
  readonly code = 'INVALID_PHOTO';
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
    this.name = 'PhotoError';
  }
}

export interface ProcessedPhoto {
  jpeg: Uint8Array;
  width: number;
  height: number;
  quality: number;
}

export async function processPhoto(input: Uint8Array, maxBytes = PHOTO_MAX_BYTES): Promise<ProcessedPhoto> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS }).metadata();
  } catch {
    throw new PhotoError('image illisible', 'importez une photo au format JPEG, PNG ou WebP');
  }
  if (!meta.format || !ACCEPTED.has(meta.format) || !meta.width || !meta.height) {
    throw new PhotoError(
      `format non pris en charge : ${meta.format ?? 'inconnu'}`,
      'importez un JPEG, un PNG ou un WebP',
    );
  }
  // Orientations 5 to 8 swap width and height once applied.
  const swap = (meta.orientation ?? 1) >= 5;
  const w = swap ? meta.height : meta.width;
  const h = swap ? meta.width : meta.height;
  const cropW = Math.min(w, Math.floor((h * 3) / 4));
  if (cropW < PHOTO_MIN.width) {
    throw new PhotoError(
      `photo trop petite (${w} × ${h} px)`,
      `il faut au moins ${PHOTO_MIN.width} × ${PHOTO_MIN.height} px une fois recadrée en 3:4`,
    );
  }
  const width = Math.min(PHOTO_MAX.width, cropW);
  const height = Math.round((width * 4) / 3);
  const pipeline = sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS })
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb');
  for (const quality of QUALITIES) {
    const jpeg = await pipeline.clone().jpeg({ quality, chromaSubsampling: '4:2:0' }).toBuffer();
    if (jpeg.byteLength <= maxBytes) return { jpeg: new Uint8Array(jpeg), width, height, quality };
  }
  throw new PhotoError(
    `photo trop lourde même en qualité ${QUALITIES[QUALITIES.length - 1]} (${Math.round(maxBytes / 1024)} Ko au plus)`,
    'choisissez une photo moins chargée en détails (fond uni)',
  );
}

export interface PhotoInfo {
  format: string | undefined;
  width: number | undefined;
  height: number | undefined;
  bytes: number;
  exif: boolean;
  icc: boolean;
  xmp: boolean;
}

/** What a stored photo contains (tests, fixture check). */
export async function inspectPhoto(jpeg: Uint8Array): Promise<PhotoInfo> {
  const m = await sharp(jpeg).metadata();
  return {
    format: m.format,
    width: m.width,
    height: m.height,
    bytes: jpeg.byteLength,
    exif: !!m.exif,
    icc: !!m.icc,
    xmp: !!m.xmp,
  };
}

let placeholder: Promise<Uint8Array> | null = null;

/**
 * Flat grey 3:4 image used instead of the real photo in every render made for the MCP server: the
 * layout is the same, and the photo never leaves the interface (§7.5).
 */
export function placeholderPhoto(): Promise<Uint8Array> {
  placeholder ??= sharp({
    create: { width: PHOTO_MAX.width, height: PHOTO_MAX.height, channels: 3, background: '#9aa5b1' },
  })
    .jpeg({ quality: 60 })
    .toBuffer()
    .then((b) => new Uint8Array(b));
  return placeholder;
}
