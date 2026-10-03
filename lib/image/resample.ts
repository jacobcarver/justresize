/**
 * Lanczos3 resampling on raw RGBA, with an optional light sharpen. Pure typed
 * array math: no canvas, no DOM, so it is unit tested and gives byte-identical
 * output in every browser (canvas scaling does not).
 *
 * The image is streamed. Source rows are pulled in bands through `read`,
 * filtered horizontally once each, held in a ring buffer just long enough for
 * the vertical filter, and finished rows are pushed in bands through `write`.
 * Peak memory is a few bands, whatever the image size.
 */
import type { Rect, Size } from "@/types";

const LOBES = 3;
/** Pixels per band when the caller does not say (16 MB of RGBA). */
const DEFAULT_BAND_PIXELS = 4_000_000;

function lanczos(x: number): number {
  if (x === 0) return 1;
  if (x <= -LOBES || x >= LOBES) return 0;
  const px = Math.PI * x;
  return (LOBES * Math.sin(px) * Math.sin(px / LOBES)) / (px * px);
}

/** For each output pixel along one axis: which source pixels it reads, and their weights. */
interface AxisKernel {
  starts: Int32Array;
  counts: Int32Array;
  /** `taps` weights per output pixel; only the first `counts[i]` are used. */
  weights: Float32Array;
  taps: number;
  /** Source range [first, end) touched by any output pixel. */
  first: number;
  end: number;
}

function buildKernel(sourceSize: number, regionStart: number, regionSize: number, targetSize: number): AxisKernel {
  const scale = regionSize / targetSize;
  // Shrinking widens the filter so it averages every source pixel under an
  // output pixel; enlarging keeps it at its natural width.
  const filterScale = Math.max(1, scale);
  const support = LOBES * filterScale;
  const taps = Math.ceil(support * 2) + 2;

  const starts = new Int32Array(targetSize);
  const counts = new Int32Array(targetSize);
  const weights = new Float32Array(targetSize * taps);
  let first = sourceSize;
  let end = 0;

  for (let i = 0; i < targetSize; i++) {
    const center = regionStart + (i + 0.5) * scale;
    // The window is clipped to the image, not to the region: a crop still
    // filters across its own edge using the real neighbouring pixels.
    let lo = Math.max(0, Math.floor(center - support));
    let hi = Math.min(sourceSize, Math.ceil(center + support));
    if (hi <= lo) {
      lo = Math.min(sourceSize - 1, Math.max(0, Math.floor(center)));
      hi = lo + 1;
    }

    let sum = 0;
    for (let k = lo; k < hi; k++) {
      const weight = lanczos((k + 0.5 - center) / filterScale);
      weights[i * taps + (k - lo)] = weight;
      sum += weight;
    }
    if (Math.abs(sum) < 1e-6) {
      weights.fill(0, i * taps, (i + 1) * taps);
      weights[i * taps + Math.min(hi - lo - 1, Math.max(0, Math.floor(center) - lo))] = 1;
    } else {
      for (let k = 0; k < hi - lo; k++) weights[i * taps + k] /= sum;
    }

    starts[i] = lo;
    counts[i] = hi - lo;
    first = Math.min(first, lo);
    end = Math.max(end, hi);
  }
  return { starts, counts, weights, taps, first, end };
}

/**
 * Filtering straight-alpha colour lets the (meaningless) colour of transparent
 * pixels bleed into visible edges. Premultiplied, a transparent pixel weighs nothing.
 */
function premultiply(pixels: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha === 255) continue;
    pixels[i] = (pixels[i] * alpha) / 255;
    pixels[i + 1] = (pixels[i + 1] * alpha) / 255;
    pixels[i + 2] = (pixels[i + 2] * alpha) / 255;
  }
}

/** Premultiplied float row → straight-alpha bytes. Clamping absorbs filter overshoot. */
function writeStraight(row: Float32Array, out: Uint8ClampedArray, offset: number): void {
  for (let i = 0; i < row.length; i += 4) {
    const alpha = row[i + 3];
    const o = offset + i;
    if (alpha >= 254.5) {
      out[o] = row[i];
      out[o + 1] = row[i + 1];
      out[o + 2] = row[i + 2];
      out[o + 3] = 255;
    } else if (alpha < 0.5) {
      out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
    } else {
      const unmultiply = 255 / alpha;
      out[o] = row[i] * unmultiply;
      out[o + 1] = row[i + 1] * unmultiply;
      out[o + 2] = row[i + 2] * unmultiply;
      out[o + 3] = alpha;
    }
  }
}

/**
 * Unsharp mask against a 3×3 binomial blur: `out = row + amount × (row − blur)`.
 * `above` and `below` are the neighbouring rows (the row itself at the image edge).
 */
function sharpenRow(
  above: Float32Array,
  row: Float32Array,
  below: Float32Array,
  amount: number,
  scratch: Float32Array,
  out: Float32Array,
): void {
  const length = row.length;
  for (let i = 0; i < length; i++) scratch[i] = (above[i] + 2 * row[i] + below[i]) * 0.25;
  for (let i = 0; i < length; i++) {
    const left = i >= 4 ? i - 4 : i;
    const right = i + 4 < length ? i + 4 : i;
    const blur = (scratch[left] + 2 * scratch[i] + scratch[right]) * 0.25;
    out[i] = row[i] + amount * (row[i] - blur);
  }
}

export interface ResampleOptions {
  /** Full dimensions of the source image. */
  source: Size;
  /** Part of the source to sample, in source pixels. May be fractional. */
  region: Rect;
  /** Output dimensions (whole pixels). */
  target: Size;
  /** Unsharp amount applied after resampling. 0 or omitted for none. */
  sharpen?: number;
  /** Upper bound on the pixels held per band. */
  bandPixels?: number;
}

export interface ResampleIO {
  /** Straight-alpha RGBA of a source rectangle, row-major. The result may be modified. */
  read(x: number, y: number, width: number, height: number): Uint8ClampedArray;
  /**
   * Receives `height` finished rows (straight-alpha RGBA, target width) starting
   * at row `y`. Called top to bottom; `pixels` is reused after the call returns.
   */
  write(y: number, height: number, pixels: Uint8ClampedArray<ArrayBuffer>): void;
}

export function resample(options: ResampleOptions, io: ResampleIO): void {
  const { source, region, target } = options;
  const amount = options.sharpen ?? 0;
  const bandPixels = options.bandPixels ?? DEFAULT_BAND_PIXELS;
  const { width, height } = target;
  const stride = width * 4;

  const kx = buildKernel(source.width, region.x, region.width, width);
  const ky = buildKernel(source.height, region.y, region.height, height);
  const columns = kx.end - kx.first;
  const chunkRows = Math.max(1, Math.floor(bandPixels / columns));

  // Horizontally filtered source rows, indexed by source row modulo ky.taps.
  // Output rows are produced top to bottom and never need more than ky.taps
  // consecutive source rows, so older rows can be overwritten.
  const ring = new Float32Array(ky.taps * stride);
  let chunk: Uint8ClampedArray | null = null;
  let chunkStart = 0;
  let chunkEnd = 0;

  const filterSourceRow = (y: number): void => {
    if (!chunk || y >= chunkEnd) {
      const rows = Math.min(chunkRows, ky.end - y);
      chunk = io.read(kx.first, y, columns, rows);
      premultiply(chunk);
      chunkStart = y;
      chunkEnd = y + rows;
    }
    const rowBase = (y - chunkStart) * columns * 4;
    let out = (y % ky.taps) * stride;
    for (let i = 0; i < width; i++) {
      let p = rowBase + (kx.starts[i] - kx.first) * 4;
      let w = i * kx.taps;
      const wEnd = w + kx.counts[i];
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (; w < wEnd; w++, p += 4) {
        const weight = kx.weights[w];
        r += chunk[p] * weight;
        g += chunk[p + 1] * weight;
        b += chunk[p + 2] * weight;
        a += chunk[p + 3] * weight;
      }
      ring[out++] = r;
      ring[out++] = g;
      ring[out++] = b;
      ring[out++] = a;
    }
  };

  const bandRows = Math.min(height, Math.max(1, Math.floor(bandPixels / width)));
  const band = new Uint8ClampedArray(bandRows * stride);
  let bandStart = 0;
  let bandFill = 0;
  const scratch = new Float32Array(amount > 0 ? stride : 0);
  const sharpened = new Float32Array(amount > 0 ? stride : 0);

  const emit = (above: Float32Array, row: Float32Array, below: Float32Array): void => {
    if (amount > 0) {
      sharpenRow(above, row, below, amount, scratch, sharpened);
      writeStraight(sharpened, band, bandFill * stride);
    } else {
      writeStraight(row, band, bandFill * stride);
    }
    bandFill += 1;
    if (bandFill === bandRows || bandStart + bandFill === height) {
      io.write(bandStart, bandFill, bandFill === bandRows ? band : band.slice(0, bandFill * stride));
      bandStart += bandFill;
      bandFill = 0;
    }
  };

  // Sharpening needs the rows either side, so each row is emitted one step late.
  let above = new Float32Array(stride);
  let previous = new Float32Array(stride);
  let current = new Float32Array(stride);
  let nextSourceRow = ky.first;

  for (let j = 0; j < height; j++) {
    const start = ky.starts[j];
    const count = ky.counts[j];
    while (nextSourceRow < start + count) filterSourceRow(nextSourceRow++);

    current.fill(0);
    for (let k = 0; k < count; k++) {
      const weight = ky.weights[j * ky.taps + k];
      const rowBase = ((start + k) % ky.taps) * stride;
      for (let x = 0; x < stride; x++) current[x] += ring[rowBase + x] * weight;
    }

    if (j >= 1) emit(j >= 2 ? above : previous, previous, current);
    const recycled = above;
    above = previous;
    previous = current;
    current = recycled;
  }
  // The last row has no row below it.
  emit(height >= 2 ? above : previous, previous, previous);
}
