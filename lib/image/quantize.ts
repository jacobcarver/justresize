/**
 * Colour quantization: RGBA pixels → a palette of at most N colours plus one
 * index per pixel. This is what lets a PNG get much smaller without changing
 * its dimensions (the same idea as pngquant / TinyPNG). Pure typed-array math,
 * no canvas, so it is unit tested.
 *
 *  1. If the image already has few enough colours, keep them exactly (lossless).
 *  2. Otherwise build a histogram, split it by median cut (always splitting the
 *     box with the most error), and polish the palette with a few k-means rounds.
 *  3. Map every pixel to its palette colour, optionally with error diffusion so
 *     smooth gradients do not band.
 *
 * All colour maths is on premultiplied values, so the invisible colour of
 * transparent pixels never influences the palette. The palette is built
 * separately for fully transparent, partly transparent and opaque pixels, so
 * an opaque pixel always gets an opaque colour and a fully transparent one
 * stays clear. Partly transparent pixels may take any colour, which lets a
 * soft shadow fade all the way out.
 */

export interface QuantizedImage {
  /** Straight-alpha RGBA, four bytes per colour. Colours that are not fully opaque come first. */
  palette: Uint8Array;
  /** One palette index per pixel, row-major. */
  indices: Uint8Array;
  /** How many leading palette entries are not fully opaque. */
  translucentColors: number;
  /** True when every pixel kept its exact colour. */
  lossless: boolean;
}

export interface QuantizeOptions {
  /** Error-diffusion strength, 0 (off) to 1. Ignored when the result is lossless. */
  dither?: number;
}

/**
 * Histogram bins, by key:
 *   0                      every fully transparent pixel
 *   1 … 2^21               partly transparent: 6 bits of alpha, 5 per colour channel
 *   OPAQUE_BASE and up     opaque: 6 bits per colour channel
 * Keys ascend with opacity, and opaque and fully transparent pixels have bins
 * of their own, so they are never averaged with anything else.
 */
const CHANNEL_SHIFT = 2;
const OPAQUE_BINS = 1 << 18;
const OPAQUE_BASE = 3 << 20;
const TABLE_SIZE = 1 << 22;

/** Histogram bin of a premultiplied colour. */
function binOf(r: number, g: number, b: number, alpha: number): number {
  if (alpha >= 255) {
    return OPAQUE_BASE | ((r >> CHANNEL_SHIFT) << 12) | ((g >> CHANNEL_SHIFT) << 6) | (b >> CHANNEL_SHIFT);
  }
  if (alpha <= 0) return 0;
  return 1 + (((alpha >> 2) << 15) | ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
}

function binOfPixel(pixels: Uint8ClampedArray, offset: number): number {
  const alpha = pixels[offset + 3];
  if (alpha === 255) return binOf(pixels[offset], pixels[offset + 1], pixels[offset + 2], 255);
  if (alpha === 0) return 0;
  const scale = alpha / 255;
  return binOf(pixels[offset] * scale, pixels[offset + 1] * scale, pixels[offset + 2] * scale, alpha);
}

/** Puts translucent colours first (PNG stores alpha only for a leading run of the palette) and remaps the pixels. */
function finish(palette: Uint8Array, indices: Uint8Array, lossless: boolean): QuantizedImage {
  const colors = palette.length / 4;
  const order = Array.from({ length: colors }, (_, index) => index).sort(
    (a, b) => palette[a * 4 + 3] - palette[b * 4 + 3] || a - b,
  );
  const sorted = new Uint8Array(palette.length);
  const remap = new Uint8Array(colors);
  let translucentColors = 0;
  order.forEach((from, to) => {
    sorted.set(palette.subarray(from * 4, from * 4 + 4), to * 4);
    remap[from] = to;
    if (palette[from * 4 + 3] < 255) translucentColors += 1;
  });
  for (let i = 0; i < indices.length; i++) indices[i] = remap[indices[i]];
  return { palette: sorted, indices, translucentColors, lossless };
}

/** The image's own colours, when there are at most `maxColors` of them. */
function exactPalette(pixels: Uint8ClampedArray, count: number, maxColors: number): QuantizedImage | null {
  const ids = new Map<number, number>();
  const indices = new Uint8Array(count);
  let lastKey = -1;
  let lastId = 0;
  for (let i = 0, o = 0; i < count; i++, o += 4) {
    const alpha = pixels[o + 3];
    // Every fully transparent pixel is the same colour, whatever its hidden RGB.
    const key = alpha === 0 ? 0 : (pixels[o] | (pixels[o + 1] << 8) | (pixels[o + 2] << 16) | (alpha << 24)) >>> 0;
    if (key !== lastKey) {
      let id = ids.get(key);
      if (id === undefined) {
        if (ids.size === maxColors) return null;
        id = ids.size;
        ids.set(key, id);
      }
      lastKey = key;
      lastId = id;
    }
    indices[i] = lastId;
  }
  const palette = new Uint8Array(ids.size * 4);
  for (const [key, id] of ids) {
    palette[id * 4] = key & 255;
    palette[id * 4 + 1] = (key >>> 8) & 255;
    palette[id * 4 + 2] = (key >>> 16) & 255;
    palette[id * 4 + 3] = key >>> 24;
  }
  return finish(palette, indices, true);
}

/** Opacity group of a histogram bin: 0 fully transparent, 1 partly transparent, 2 opaque. */
function opacityGroup(key: number): number {
  return key === 0 ? 0 : key >= OPAQUE_BASE ? 2 : 1;
}

/**
 * Index of the palette colour closest to a premultiplied colour, among the
 * colours of one opacity group (or all of them when `groups` is null).
 */
function nearest(
  palette: Float32Array,
  groups: Uint8Array | null,
  group: number,
  r: number,
  g: number,
  b: number,
  a: number,
): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let k = 0, p = 0; p < palette.length; k++, p += 4) {
    if (groups && groups[k] !== group) continue;
    const dr = palette[p] - r;
    const dg = palette[p + 1] - g;
    const db = palette[p + 2] - b;
    const da = palette[p + 3] - a;
    const distance = dr * dr + dg * dg + db * db + da * da;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = k;
    }
  }
  return Math.max(0, best);
}

interface Box {
  start: number;
  end: number;
  /** Total squared error if the whole box became one colour. */
  error: number;
  /** Channel contributing most of that error. */
  axis: number;
}

/**
 * Median cut over histogram bins, then k-means. Returns the premultiplied
 * palette and, for every bin, the palette colour it belongs to.
 */
function buildPalette(
  means: Float32Array,
  weights: Float64Array,
  /** Opacity group of each bin. Bins must be sorted by group. */
  binGroups: Uint8Array,
  maxColors: number,
): { palette: Float32Array; groups: Uint8Array | null; owner: Uint8Array } {
  const bins = weights.length;
  const order = new Int32Array(bins);
  for (let i = 0; i < bins; i++) order[i] = i;

  const measure = (start: number, end: number): Box => {
    let weight = 0;
    const sum = [0, 0, 0, 0];
    const squares = [0, 0, 0, 0];
    for (let i = start; i < end; i++) {
      const bin = order[i];
      const w = weights[bin];
      weight += w;
      for (let c = 0; c < 4; c++) {
        const value = means[bin * 4 + c];
        sum[c] += w * value;
        squares[c] += w * value * value;
      }
    }
    let error = 0;
    let axis = 0;
    let worst = -1;
    for (let c = 0; c < 4; c++) {
      const channelError = squares[c] - (sum[c] * sum[c]) / weight;
      error += channelError;
      if (channelError > worst) {
        worst = channelError;
        axis = c;
      }
    }
    return { start, end, error: end - start > 1 ? Math.max(0, error) : 0, axis };
  };

  // One starting box per opacity group, so no colour ever spans two of them.
  // (With fewer colours than groups that cannot hold, and the groups are merged.)
  const groupStarts = [0];
  for (let bin = 1; bin < bins; bin++) if (binGroups[bin] !== binGroups[bin - 1]) groupStarts.push(bin);
  const separate = groupStarts.length <= maxColors;
  const boxes: Box[] = separate
    ? groupStarts.map((start, i) => measure(start, groupStarts[i + 1] ?? bins))
    : [measure(0, bins)];
  while (boxes.length < maxColors) {
    let target = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].error > 0 && (target < 0 || boxes[i].error > boxes[target].error)) target = i;
    }
    if (target < 0) break;
    const { start, end, axis } = boxes[target];

    order.subarray(start, end).sort((a, b) => means[a * 4 + axis] - means[b * 4 + axis]);

    // Cut where the two halves are tightest along the axis, not at the median:
    // a small cluster of a distinct colour is split off instead of being diluted.
    let totalWeight = 0;
    let totalSum = 0;
    for (let i = start; i < end; i++) {
      const w = weights[order[i]];
      totalWeight += w;
      totalSum += w * means[order[i] * 4 + axis];
    }
    let leftWeight = 0;
    let leftSum = 0;
    let cut = start + 1;
    let bestGain = -1;
    for (let i = start; i < end - 1; i++) {
      const w = weights[order[i]];
      leftWeight += w;
      leftSum += w * means[order[i] * 4 + axis];
      const rightWeight = totalWeight - leftWeight;
      const rightSum = totalSum - leftSum;
      // Maximising this is the same as minimising the summed squared error of both halves.
      const gain = (leftSum * leftSum) / leftWeight + (rightSum * rightSum) / rightWeight;
      if (gain > bestGain) {
        bestGain = gain;
        cut = i + 1;
      }
    }
    boxes[target] = measure(start, cut);
    boxes.push(measure(cut, end));
  }

  const colors = boxes.length;
  const palette = new Float32Array(colors * 4);
  const groups = separate ? new Uint8Array(colors) : null;
  const owner = new Uint8Array(bins);
  const sums = new Float64Array(colors * 4);
  const totals = new Float64Array(colors);

  const recenter = (): void => {
    sums.fill(0);
    totals.fill(0);
    for (let bin = 0; bin < bins; bin++) {
      const k = owner[bin];
      const w = weights[bin];
      totals[k] += w;
      for (let c = 0; c < 4; c++) sums[k * 4 + c] += w * means[bin * 4 + c];
    }
    for (let k = 0; k < colors; k++) {
      // A colour that lost all its bins keeps its place rather than collapsing to black.
      if (totals[k] === 0) continue;
      for (let c = 0; c < 4; c++) palette[k * 4 + c] = sums[k * 4 + c] / totals[k];
    }
  };
  const assign = (): void => {
    for (let bin = 0, p = 0; bin < bins; bin++, p += 4) {
      owner[bin] = nearest(palette, groups, binGroups[bin], means[p], means[p + 1], means[p + 2], means[p + 3]);
    }
  };

  boxes.forEach((box, k) => {
    if (groups) groups[k] = binGroups[order[box.start]];
    for (let i = box.start; i < box.end; i++) owner[order[i]] = k;
  });
  recenter();

  // k-means costs bins × colours per round; photos have too many bins for more than a round or two.
  const work = bins * colors;
  const rounds = work <= 4_000_000 ? 3 : work <= 16_000_000 ? 2 : work <= 40_000_000 ? 1 : 0;
  for (let round = 0; round < rounds; round++) {
    assign();
    recenter();
  }
  assign();
  return { palette, groups, owner };
}

export function quantize(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors: number,
  options: QuantizeOptions = {},
): QuantizedImage {
  const count = width * height;
  const limit = Math.max(1, Math.min(256, Math.floor(maxColors)));

  const exact = exactPalette(pixels, count, limit);
  if (exact) return exact;

  // Histogram. `table` first counts pixels per bin, then holds each bin's compact index + 1.
  const table = new Uint32Array(TABLE_SIZE);
  for (let i = 0, o = 0; i < count; i++, o += 4) table[binOfPixel(pixels, o)] += 1;
  let bins = 0;
  for (let key = 0; key < TABLE_SIZE; key++) if (table[key] > 0) bins += 1;
  // Keys ascend with opacity, so the compact bins come out sorted by opacity group.
  const weights = new Float64Array(bins);
  const binGroups = new Uint8Array(bins);
  for (let key = 0, bin = 0; key < TABLE_SIZE; key++) {
    if (table[key] === 0) continue;
    weights[bin] = table[key];
    binGroups[bin] = opacityGroup(key);
    table[key] = ++bin;
  }

  const sums = new Float64Array(bins * 4);
  for (let i = 0, o = 0; i < count; i++, o += 4) {
    const alpha = pixels[o + 3];
    if (alpha === 0) continue;
    const s = (table[binOfPixel(pixels, o)] - 1) * 4;
    const scale = alpha / 255;
    sums[s] += pixels[o] * scale;
    sums[s + 1] += pixels[o + 1] * scale;
    sums[s + 2] += pixels[o + 2] * scale;
    sums[s + 3] += alpha;
  }
  const means = new Float32Array(bins * 4);
  for (let bin = 0; bin < bins; bin++) {
    for (let c = 0; c < 4; c++) means[bin * 4 + c] = sums[bin * 4 + c] / weights[bin];
  }

  const { palette, groups, owner } = buildPalette(means, weights, binGroups, limit);
  const colors = palette.length / 4;

  const indices = new Uint8Array(count);
  const dither = Math.min(1, Math.max(0, options.dither ?? 0));
  if (dither === 0) {
    // The palette was built with partly transparent bins kept to themselves; for
    // the final picture they may use any colour, including fully transparent.
    for (let bin = 0, p = 0; bin < bins; bin++, p += 4) {
      if (binGroups[bin] === 1) owner[bin] = nearest(palette, null, 1, means[p], means[p + 1], means[p + 2], means[p + 3]);
    }
    for (let i = 0, o = 0; i < count; i++, o += 4) indices[i] = owner[table[binOfPixel(pixels, o)] - 1];
  } else {
    diffuse(pixels, width, height, palette, groups, dither, indices);
  }

  const bytes = new Uint8Array(colors * 4);
  for (let k = 0; k < colors; k++) {
    const alpha = Math.round(palette[k * 4 + 3]);
    if (alpha <= 0) continue;
    const unmultiply = 255 / palette[k * 4 + 3];
    bytes[k * 4] = Math.min(255, Math.round(palette[k * 4] * unmultiply));
    bytes[k * 4 + 1] = Math.min(255, Math.round(palette[k * 4 + 1] * unmultiply));
    bytes[k * 4 + 2] = Math.min(255, Math.round(palette[k * 4 + 2] * unmultiply));
    bytes[k * 4 + 3] = Math.min(255, alpha);
  }
  return finish(bytes, indices, false);
}

/** Largest error, per channel, that one pixel may pass on. Keeps hard edges from spraying speckles. */
const MAX_DIFFUSED_ERROR = 16;

/**
 * Floyd–Steinberg error diffusion, alternating direction each row so the
 * pattern does not drift sideways.
 */
function diffuse(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Float32Array,
  groups: Uint8Array | null,
  strength: number,
  indices: Uint8Array,
): void {
  // Nearest palette colour for a colour region, filled in as regions are met.
  // Opaque pixels are looked up by histogram bin.
  const opaqueCache = new Int16Array(OPAQUE_BINS).fill(-1);
  const lookupOpaque = (r: number, g: number, b: number): number => {
    const key = ((r >> CHANNEL_SHIFT) << 12) | ((g >> CHANNEL_SHIFT) << 6) | (b >> CHANNEL_SHIFT);
    let index = opaqueCache[key];
    if (index < 0) {
      const half = (1 << CHANNEL_SHIFT) / 2;
      index = nearest(
        palette,
        groups,
        2,
        ((key >> 12) << CHANNEL_SHIFT) + half,
        (((key >> 6) & 63) << CHANNEL_SHIFT) + half,
        ((key & 63) << CHANNEL_SHIFT) + half,
        255,
      );
      opaqueCache[key] = index;
    }
    return index;
  };
  // Partly transparent pixels need fine alpha steps, or the diffused error could
  // never tip a soft shadow from one alpha to the next: 7 bits of alpha, 5 per colour.
  let softCache: Int16Array | undefined;
  const lookupSoft = (r: number, g: number, b: number, a: number): number => {
    softCache ??= new Int16Array(1 << 22).fill(-1);
    const key = ((a >> 1) << 15) | ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let index = softCache[key];
    if (index < 0) {
      index = nearest(
        palette,
        null,
        1,
        (((key >> 10) & 31) << 3) + 4,
        (((key >> 5) & 31) << 3) + 4,
        ((key & 31) << 3) + 4,
        ((key >> 15) << 1) + 1,
      );
      softCache[key] = index;
    }
    return index;
  };
  const transparentIndex = nearest(palette, groups, 0, 0, 0, 0, 0);
  const clampByte = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : value);
  const limitError = (value: number): number =>
    (value < -MAX_DIFFUSED_ERROR ? -MAX_DIFFUSED_ERROR : value > MAX_DIFFUSED_ERROR ? MAX_DIFFUSED_ERROR : value) * strength;

  // One spare pixel either side so the edges need no special cases.
  let current = new Float32Array((width + 2) * 4);
  let next = new Float32Array((width + 2) * 4);

  for (let y = 0; y < height; y++) {
    const step = y % 2 === 0 ? 1 : -1;
    next.fill(0);
    for (let n = 0; n < width; n++) {
      const x = step === 1 ? n : width - 1 - n;
      const o = (y * width + x) * 4;
      const alpha = pixels[o + 3];
      if (alpha === 0) {
        indices[y * width + x] = transparentIndex;
        continue;
      }
      const e = (x + 1) * 4;
      const scale = alpha / 255;
      const r = clampByte(pixels[o] * scale + current[e]);
      const g = clampByte(pixels[o + 1] * scale + current[e + 1]);
      const b = clampByte(pixels[o + 2] * scale + current[e + 2]);
      // Opaque pixels stay opaque: alpha error is never diffused into them.
      const a = alpha === 255 ? 255 : clampByte(alpha + current[e + 3]);

      const index = alpha === 255 ? lookupOpaque(r, g, b) : lookupSoft(r, g, b, a);
      indices[y * width + x] = index;

      const p = index * 4;
      const ahead = e + step * 4;
      const behind = e - step * 4;
      for (let c = 0; c < 4; c++) {
        const value = c === 0 ? r : c === 1 ? g : c === 2 ? b : a;
        const error = limitError(value - palette[p + c]);
        current[ahead + c] += error * (7 / 16);
        next[behind + c] += error * (3 / 16);
        next[e + c] += error * (5 / 16);
        next[ahead + c] += error * (1 / 16);
      }
    }
    const swap = current;
    current = next;
    next = swap;
  }
}
