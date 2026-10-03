/**
 * Writes palette (indexed-colour) PNG files. The browser's own PNG encoder
 * only writes full-colour images, so this is what turns a quantized image
 * into a small file. Pure: bytes in, bytes out.
 */
import { zlibSync } from "fflate";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable: Uint32Array | undefined;

function crc32(bytes: Uint8Array, start: number, end: number): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value >>> 24;
  target[offset + 1] = (value >>> 16) & 255;
  target[offset + 2] = (value >>> 8) & 255;
  target[offset + 3] = value & 255;
}

/** length · type · data · CRC(type + data) */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeUint32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  writeUint32(out, 8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

export interface IndexedImage {
  width: number;
  height: number;
  /** Straight-alpha RGBA, four bytes per colour, at most 256 colours. */
  palette: Uint8Array;
  /** One palette index per pixel, row-major. */
  indices: Uint8Array;
  /** How many leading palette entries are not fully opaque (they get an alpha table). */
  translucentColors: number;
}

export function encodeIndexedPng(image: IndexedImage): Uint8Array<ArrayBuffer> {
  const { width, height, palette, indices } = image;
  const colors = palette.length / 4;
  // Few colours need fewer bits per pixel, which shrinks the data before compression even starts.
  const bitDepth = colors <= 2 ? 1 : colors <= 4 ? 2 : colors <= 16 ? 4 : 8;
  const rowBytes = Math.ceil((width * bitDepth) / 8);

  // Each row: a filter byte (0 = none, the right choice for palette images), then the packed indices.
  const raw = new Uint8Array(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1) + 1;
    const source = y * width;
    if (bitDepth === 8) {
      raw.set(indices.subarray(source, source + width), rowStart);
    } else {
      for (let x = 0; x < width; x++) {
        const bit = x * bitDepth;
        raw[rowStart + (bit >> 3)] |= indices[source + x] << (8 - bitDepth - (bit & 7));
      }
    }
  }

  const header = new Uint8Array(13);
  writeUint32(header, 0, width);
  writeUint32(header, 4, height);
  header[8] = bitDepth;
  header[9] = 3; // colour type: palette
  // compression, filter and interlace methods stay 0

  const plte = new Uint8Array(colors * 3);
  for (let k = 0; k < colors; k++) plte.set(palette.subarray(k * 4, k * 4 + 3), k * 3);

  const parts = [Uint8Array.from(SIGNATURE), chunk("IHDR", header), chunk("PLTE", plte)];
  if (image.translucentColors > 0) {
    const alphas = new Uint8Array(image.translucentColors);
    for (let k = 0; k < alphas.length; k++) alphas[k] = palette[k * 4 + 3];
    parts.push(chunk("tRNS", alphas));
  }
  parts.push(chunk("IDAT", zlibSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0)));

  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
