/**
 * Reads just enough of a file's bytes to learn what it really is — format,
 * dimensions, whether it is animated — before we spend memory decoding it.
 * MIME types and extensions are hints; the bytes are the truth.
 */
import type { SourceFormat } from "@/types";
import { orientationSwapsDimensions, readExifOrientation } from "./metadata";

export interface SniffResult {
  format?: SourceFormat;
  /** Oriented dimensions when the header exposes them. */
  width?: number;
  height?: number;
  animated?: boolean;
  /** EXIF orientation 1–8 (JPEG only). */
  orientation?: number;
  /** A recognisable non-image or unsupported type, for nicer messages. */
  foreign?: "pdf" | "svg" | "bmp" | "tiff";
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let text = "";
  for (let i = start; i < start + length && i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

/** How much of the file `sniffImage` needs. GIFs are scanned whole to count frames. */
export function sniffByteLength(file: { size: number; type: string; name: string }): number {
  const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);
  return isGif ? file.size : Math.min(file.size, 512 * 1024);
}

export function sniffImage(bytes: Uint8Array): SniffResult {
  if (bytes.length < 12) return {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return sniffJpeg(bytes, view);
  if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) return sniffPng(bytes, view);
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return sniffWebp(bytes, view);
  if (ascii(bytes, 0, 3) === "GIF") return sniffGif(bytes, view);
  if (ascii(bytes, 4, 4) === "ftyp") return sniffIsoBmff(bytes, view);

  if (ascii(bytes, 0, 5) === "%PDF-") return { foreign: "pdf" };
  if (ascii(bytes, 0, 2) === "BM") return { foreign: "bmp" };
  const tiffMagic = view.getUint32(0);
  if (tiffMagic === 0x49492a00 || tiffMagic === 0x4d4d002a) return { foreign: "tiff" };
  if (/<svg[\s>]/i.test(ascii(bytes, 0, 1024))) return { foreign: "svg" };
  return {};
}

function sniffJpeg(bytes: Uint8Array, view: DataView): SniffResult {
  const result: SniffResult = { format: "jpeg", orientation: readExifOrientation(bytes) };
  let offset = 2;
  while (offset + 9 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    // Fill bytes between segments.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // SOF0–SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) share the range but are not frames.
    const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);
      const swap = orientationSwapsDimensions(result.orientation ?? 1);
      result.width = swap ? height : width;
      result.height = swap ? width : height;
      break;
    }
    if (marker === 0xda || marker === 0xd9) break;
    offset += 2 + view.getUint16(offset + 2);
  }
  return result;
}

function sniffPng(bytes: Uint8Array, view: DataView): SniffResult {
  const result: SniffResult = { format: "png" };
  if (view.byteLength >= 24 && ascii(bytes, 12, 4) === "IHDR") {
    result.width = view.getUint32(16);
    result.height = view.getUint32(20);
  }
  // APNG declares itself with an acTL chunk that must precede the first IDAT.
  let offset = 8;
  while (offset + 8 <= view.byteLength) {
    const type = ascii(bytes, offset + 4, 4);
    if (type === "acTL") {
      result.animated = true;
      break;
    }
    if (type === "IDAT") break;
    offset += 12 + view.getUint32(offset);
  }
  return result;
}

function sniffWebp(bytes: Uint8Array, view: DataView): SniffResult {
  const result: SniffResult = { format: "webp" };
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && view.byteLength >= 30) {
    result.animated = (view.getUint8(20) & 0x02) !== 0;
    result.width = 1 + (view.getUint16(24, true) | (view.getUint8(26) << 16));
    result.height = 1 + (view.getUint16(27, true) | (view.getUint8(29) << 16));
  } else if (chunk === "VP8 " && view.byteLength >= 30) {
    result.width = view.getUint16(26, true) & 0x3fff;
    result.height = view.getUint16(28, true) & 0x3fff;
  } else if (chunk === "VP8L" && view.byteLength >= 25) {
    const bits = view.getUint32(21, true);
    result.width = (bits & 0x3fff) + 1;
    result.height = ((bits >>> 14) & 0x3fff) + 1;
  }
  return result;
}

function sniffGif(bytes: Uint8Array, view: DataView): SniffResult {
  const result: SniffResult = {
    format: "gif",
    width: view.getUint16(6, true),
    height: view.getUint16(8, true),
  };

  // Walk the block structure and count image descriptors.
  const colorTableSize = (packed: number) => ((packed & 0x80) !== 0 ? 3 * (1 << ((packed & 0x07) + 1)) : 0);
  const skipSubBlocks = (start: number) => {
    let at = start;
    while (at < bytes.length) {
      const size = bytes[at];
      at += 1;
      if (size === 0) break;
      at += size;
    }
    return at;
  };

  let offset = 13 + colorTableSize(bytes[10]);
  let frames = 0;
  while (offset < bytes.length) {
    const block = bytes[offset];
    if (block === 0x2c) {
      frames += 1;
      if (frames > 1) break;
      if (offset + 10 > bytes.length) break;
      offset += 10 + colorTableSize(bytes[offset + 9]);
      offset = skipSubBlocks(offset + 1); // +1 skips the LZW minimum code size
    } else if (block === 0x21) {
      offset = skipSubBlocks(offset + 2);
    } else {
      break; // 0x3b trailer, or data we do not understand
    }
  }
  result.animated = frames > 1;
  return result;
}

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);

function sniffIsoBmff(bytes: Uint8Array, view: DataView): SniffResult {
  const boxSize = Math.min(view.getUint32(0), bytes.length);
  const brands = [ascii(bytes, 8, 4)];
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) brands.push(ascii(bytes, offset, 4));

  if (brands.includes("avif") || brands.includes("avis")) {
    return { format: "avif", animated: brands[0] === "avis" };
  }
  if (brands.some((brand) => HEIC_BRANDS.has(brand)) || brands.includes("mif1") || brands.includes("msf1")) {
    return { format: "heic" };
  }
  return {};
}
