/**
 * Minimal EXIF handling. We only ever need one tag — orientation — because
 * outputs are re-encoded from pixels and carry no metadata at all. The pixels
 * therefore have to be rotated upright before encoding.
 */

const ORIENTATION_TAG = 0x0112;

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Reads the EXIF orientation (1–8) from the head of a JPEG. Returns 1 when absent or unreadable. */
export function readExifOrientation(bytes: Uint8Array): number {
  if (!isJpeg(bytes)) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1;
    const marker = view.getUint8(offset + 1);
    // Start of scan / end of image: no more metadata segments follow.
    if (marker === 0xda || marker === 0xd9) return 1;
    const length = view.getUint16(offset + 2);
    if (length < 2) return 1;

    if (marker === 0xe1 && offset + 4 + 6 <= view.byteLength) {
      const isExif =
        view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0x0000; // "Exif\0\0"
      if (isExif) {
        return parseTiffOrientation(view, offset + 10, Math.min(view.byteLength, offset + 2 + length));
      }
    }
    offset += 2 + length;
  }
  return 1;
}

function parseTiffOrientation(view: DataView, tiffStart: number, end: number): number {
  if (tiffStart + 8 > end) return 1;
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949;
  if (!littleEndian && byteOrder !== 0x4d4d) return 1;

  const ifdOffset = tiffStart + view.getUint32(tiffStart + 4, littleEndian);
  if (ifdOffset + 2 > end) return 1;
  const entryCount = view.getUint16(ifdOffset, littleEndian);

  for (let i = 0; i < entryCount; i++) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > end) return 1;
    if (view.getUint16(entry, littleEndian) === ORIENTATION_TAG) {
      const value = view.getUint16(entry + 8, littleEndian);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/**
 * Returns a copy of a JPEG with a minimal EXIF segment declaring the given
 * orientation, inserted directly after the SOI marker. Used to build the
 * orientation capability probe and test fixtures.
 */
export function withExifOrientation(jpeg: Uint8Array, orientation: number): Uint8Array {
  if (!isJpeg(jpeg)) throw new Error("Not a JPEG");
  // prettier-ignore
  const segment = new Uint8Array([
    0xff, 0xe1, 0x00, 0x22,                   // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,       // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a,                   // big-endian TIFF
    0x00, 0x00, 0x00, 0x08,                   // IFD0 at offset 8
    0x00, 0x01,                               // one entry
    0x01, 0x12, 0x00, 0x03,                   // orientation, SHORT
    0x00, 0x00, 0x00, 0x01,                   // count 1
    0x00, orientation & 0xff, 0x00, 0x00,     // value
    0x00, 0x00, 0x00, 0x00,                   // no next IFD
  ]);
  const out = new Uint8Array(jpeg.length + segment.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(segment, 2);
  out.set(jpeg.subarray(2), 2 + segment.length);
  return out;
}

/** Orientations 5–8 swap width and height once applied. */
export function orientationSwapsDimensions(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

/**
 * The canvas transform (a, b, c, d, e, f) that draws an un-rotated image
 * upright, given its stored (pre-rotation) width and height.
 */
export function orientationTransform(
  orientation: number,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, width, 0];
    case 3:
      return [-1, 0, 0, -1, width, height];
    case 4:
      return [1, 0, 0, -1, 0, height];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, height, 0];
    case 7:
      return [0, -1, -1, 0, height, width];
    case 8:
      return [0, -1, 1, 0, 0, width];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}
