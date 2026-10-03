/**
 * The optimizer: finds the best-looking encode that is at or under a byte
 * target. It knows nothing about canvases or codecs — it only calls the
 * `encode(scale, quality)` function it is given — so the search logic can be
 * unit tested with a fake encoder and improved without touching the engine.
 *
 * Guarantees:
 *  - the returned result is never larger than `targetBytes`;
 *  - every loop is bounded, so it cannot run forever;
 *  - the same (dimensions, quality) pair is never encoded twice.
 */
import { TARGET_SIZE_TUNING, type TargetSizeTuning } from "@/lib/config/limits";
import { roundPx } from "@/lib/utils/math";
import type { Size, TargetSizeStrategy } from "@/types";
import { throwIfAborted } from "./errors";

export interface TargetEncodeOutput<T> {
  size: number;
  payload: T;
}

export interface CompressToTargetOptions<T> {
  targetBytes: number;
  strategy: TargetSizeStrategy;
  /** False for PNG: there is no quality setting to search. */
  lossy: boolean;
  /**
   * True when a lossless format can still get smaller at the same dimensions
   * by using fewer colours (palette PNG). Colours are then reduced before
   * dimensions, the way quality is for lossy formats.
   */
  reducibleColors?: boolean;
  /** Requested output dimensions at scale 1. */
  dimensions: Size;
  /** Quality ceiling for the search, and the fixed quality for the "dimensions" strategy. */
  maxQuality: number;
  /**
   * Encodes the image at `dimensions × scale`. `quality` is undefined for
   * lossless formats; `colors` is set when the palette should be limited.
   */
  encode(scale: number, quality: number | undefined, colors?: number): Promise<TargetEncodeOutput<T>>;
  signal?: AbortSignal;
  tuning?: Partial<TargetSizeTuning>;
}

export interface CompressToTargetResult<T> {
  payload: T;
  size: number;
  qualityUsed?: number;
  /** Palette limit of the chosen encode, when colours were reduced. */
  colorsUsed?: number;
  width: number;
  height: number;
  scale: number;
  /** Number of encodes performed. */
  iterations: number;
  resizedForTarget: boolean;
}

export class TargetUnreachableError extends Error {
  constructor(
    readonly targetBytes: number,
    /** Smallest size any attempt produced. */
    readonly smallestBytes: number,
    readonly iterations: number,
  ) {
    super(`Could not reach ${targetBytes} bytes (smallest attempt: ${smallestBytes})`);
    this.name = "TargetUnreachableError";
  }
}

interface Attempt<T> extends Size {
  scale: number;
  quality: number | undefined;
  colors: number | undefined;
  size: number;
  fits: boolean;
  /** Only kept for attempts that fit; oversized blobs are dropped immediately. */
  payload?: T;
}

export async function compressToTarget<T>(options: CompressToTargetOptions<T>): Promise<CompressToTargetResult<T>> {
  const tuning = { ...TARGET_SIZE_TUNING, ...options.tuning };
  const { targetBytes, dimensions, strategy, lossy, signal } = options;
  const maxQuality = options.maxQuality;

  let iterations = 0;
  let smallest = Infinity;
  const cache = new Map<string, Attempt<T>>();

  const sizeAt = (scale: number): Size => ({
    width: roundPx(dimensions.width * scale),
    height: roundPx(dimensions.height * scale),
  });
  const sameSize = (a: Size, b: Size) => a.width === b.width && a.height === b.height;
  const canShrinkTo = (scale: number) => {
    const size = sizeAt(scale);
    return Math.min(size.width, size.height) >= tuning.minEdge;
  };
  const closeEnough = (size: number, tolerance = tuning.tolerance) => size >= targetBytes * (1 - tolerance);

  /**
   * Pixel count — and so, roughly, byte count — scales with the square of the
   * linear scale. The safety factor undershoots a little so that one step
   * usually lands under the target instead of just above it.
   */
  const shrinkFactor = (currentBytes: number) =>
    Math.min(tuning.shrinkSafety, Math.sqrt(targetBytes / currentBytes) * tuning.shrinkSafety);

  const attempt = async (scale: number, quality: number | undefined, colors?: number): Promise<Attempt<T>> => {
    throwIfAborted(signal);
    const size = sizeAt(scale);
    const roundedQuality = quality === undefined ? undefined : Math.round(quality * 100) / 100;
    const key = `${size.width}x${size.height}@${roundedQuality ?? "lossless"}${colors ? `/${colors}` : ""}`;
    const cached = cache.get(key);
    if (cached) return cached;

    iterations += 1;
    const encoded = await options.encode(scale, roundedQuality, colors);
    const fits = encoded.size <= targetBytes;
    const result: Attempt<T> = {
      ...size,
      scale,
      quality: roundedQuality,
      colors,
      size: encoded.size,
      fits,
      payload: fits ? encoded.payload : undefined,
    };
    smallest = Math.min(smallest, encoded.size);
    cache.set(key, result);
    return result;
  };

  const finish = (best: Attempt<T>): CompressToTargetResult<T> => ({
    payload: best.payload as T,
    size: best.size,
    qualityUsed: best.quality,
    colorsUsed: best.colors,
    width: best.width,
    height: best.height,
    scale: best.scale,
    iterations,
    resizedForTarget: !sameSize(best, dimensions),
  });

  const unreachable = () => new TargetUnreachableError(targetBytes, smallest, iterations);

  /**
   * Binary search for the highest quality in [low, high] that fits.
   * Returns `best` when something fits, otherwise the size at the floor so
   * the caller can decide how far to shrink.
   */
  const searchQuality = async (
    scale: number,
    low: number,
    high: number,
    assumeTopFails: boolean,
  ): Promise<{ best?: Attempt<T>; floorSize: number }> => {
    if (!assumeTopFails) {
      const top = await attempt(scale, high);
      if (top.fits) return { best: top, floorSize: top.size };
      if (high - low < 0.01) return { floorSize: top.size };
    }

    const floor = await attempt(scale, low);
    if (!floor.fits) return { floorSize: floor.size };

    let best = floor;
    let lo = low;
    let hi = high;
    for (let i = 0; i < tuning.maxQualityIterations; i++) {
      if (closeEnough(best.size) || hi - lo <= 0.02) break;
      const mid = Math.round(((lo + hi) / 2) * 100) / 100;
      if (mid <= lo || mid >= hi) break;
      const result = await attempt(scale, mid);
      if (result.fits) {
        best = result;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return { best, floorSize: floor.size };
  };

  /**
   * The colour-count counterpart of `searchQuality`: the largest palette in
   * [low, high] that fits. Bisects geometrically, because file size follows
   * the number of bits per pixel rather than the number of colours.
   */
  const searchColors = async (
    scale: number,
    low: number,
    high: number,
    assumeTopFails: boolean,
  ): Promise<{ best?: Attempt<T>; floorSize: number }> => {
    if (!assumeTopFails) {
      const top = await attempt(scale, undefined, high);
      if (top.fits) return { best: top, floorSize: top.size };
      if (high <= low) return { floorSize: top.size };
    }

    const floor = await attempt(scale, undefined, low);
    if (!floor.fits) return { floorSize: floor.size };

    let best = floor;
    let lo = low;
    let hi = high;
    for (let i = 0; i < tuning.maxQualityIterations; i++) {
      if (closeEnough(best.size) || hi / lo < 1.2) break;
      const mid = Math.round(Math.sqrt(lo * hi));
      if (mid <= lo || mid >= hi) break;
      const result = await attempt(scale, undefined, mid);
      if (result.fits) {
        best = result;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return { best, floorSize: floor.size };
  };

  /**
   * Fixed quality, shrinking dimensions. First walks down using the
   * pixels-vs-bytes estimate until something fits, then bisects back up
   * towards the last size that did not, to avoid giving away resolution.
   */
  const searchDimensions = async (quality: number | undefined): Promise<Attempt<T>> => {
    const full = await attempt(1, quality);
    if (full.fits) return full;

    let best: Attempt<T> | undefined;
    let tooBig = full;
    for (let i = 0; i < tuning.maxDimensionAttempts; i++) {
      let next: number;
      if (!best) {
        next = tooBig.scale * shrinkFactor(tooBig.size);
      } else {
        if (closeEnough(best.size, tuning.tolerance * 2)) break;
        next = (best.scale + tooBig.scale) / 2;
      }
      if (!canShrinkTo(next)) break;
      const nextSize = sizeAt(next);
      if (sameSize(nextSize, tooBig) || (best && sameSize(nextSize, best))) break;

      const result = await attempt(next, quality);
      if (result.fits) best = result;
      else tooBig = result;
    }
    if (!best) throw unreachable();
    return best;
  };

  if (!lossy) {
    // "Resize only" keeps every colour, like it keeps the quality setting for lossy formats.
    if (!options.reducibleColors || strategy === "dimensions") {
      if (strategy === "quality-only") {
        const only = await attempt(1, undefined);
        if (only.fits) return finish(only);
        throw unreachable();
      }
      return finish(await searchDimensions(undefined));
    }

    // Untouched first: if the lossless file already fits, nothing is given up.
    const full = await attempt(1, undefined);
    if (full.fits) return finish(full);

    const maxColors = tuning.maxColors;
    if (strategy === "quality-only") {
      const { best } = await searchColors(1, Math.min(tuning.minColors, maxColors), maxColors, false);
      if (best) return finish(best);
      throw unreachable();
    }

    // Smart: fewer colours first, then dimensions once the palette would get too small.
    const floorColors = Math.min(tuning.smartMinColors, maxColors);
    let scale = 1;
    for (let round = 0; round <= tuning.maxDimensionAttempts; round++) {
      const { best, floorSize } = await searchColors(scale, floorColors, maxColors, scale < 1);
      if (best) return finish(best);

      const next = scale * shrinkFactor(floorSize);
      if (!canShrinkTo(next) || sameSize(sizeAt(next), sizeAt(scale))) break;
      scale = next;
    }
    throw unreachable();
  }

  if (strategy === "dimensions") {
    return finish(await searchDimensions(maxQuality));
  }

  if (strategy === "quality-only") {
    const { best } = await searchQuality(1, Math.min(tuning.minQuality, maxQuality), maxQuality, false);
    if (best) return finish(best);
    throw unreachable();
  }

  // Smart: quality first, then dimensions once quality alone would look bad.
  const floorQuality = Math.min(tuning.smartMinQuality, maxQuality);
  let scale = 1;
  for (let round = 0; round <= tuning.maxDimensionAttempts; round++) {
    // After shrinking, the size was chosen so the floor quality just fits;
    // the ceiling is known not to, so skip that encode.
    const { best, floorSize } = await searchQuality(scale, floorQuality, maxQuality, scale < 1);
    if (best) return finish(best);

    const next = scale * shrinkFactor(floorSize);
    if (!canShrinkTo(next) || sameSize(sizeAt(next), sizeAt(scale))) break;
    scale = next;
  }
  throw unreachable();
}
