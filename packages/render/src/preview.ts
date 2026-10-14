// Low-resolution PNG of page 1 (MCP-19/MCP-11 `includePreviewImage`): Typst SVG rasterized by sharp.
import sharp from 'sharp';
import type { Projection } from '@cv/core';
import { compileSvg } from './compile.js';

export async function renderPreviewPng(projection: Projection, photo: Uint8Array | null, width = 600): Promise<Buffer> {
  const svg = compileSvg(projection, photo);
  return sharp(Buffer.from(svg)).resize({ width }).png().toBuffer();
}
