/**
 * Safety limits and tuning constants. Everything that guards against
 * pathological input or trades quality for speed lives here so it can be
 * tuned in one place.
 */

const MEGAPIXEL = 1_000_000;

export const LIMITS = {
  /** Longest side we will try to decode. Chrome/Firefox cap canvases at 32,767 px. */
  maxSourceDimension: 32_767,
  /** Decoded RGBA at 120 MP is ~480 MB; beyond that tabs die on most machines. */
  maxSourcePixels: 120 * MEGAPIXEL,
  /**
   * No cap on a file's size in bytes or on how many images are open at once:
   * the site says "Unlimited images. No file size limit.", and these two
   * values are what make that true. What protects the tab is the pixel
   * limits around them, since memory is spent on decoded pixels, not on
   * bytes on disk. Set a number here to bring a cap back, and change the
   * copy that promises there is none (the homepage, the tool pages' FAQ,
   * /terms) at the same time.
   */
  maxFileBytes: Number.POSITIVE_INFINITY,
  maxBatchFiles: Number.POSITIVE_INFINITY,

  maxOutputDimension: 32_767,
  maxOutputPixels: 100 * MEGAPIXEL,

  /** Longest edge of list thumbnails and of the interactive preview bitmap. */
  thumbnailMaxEdge: 320,
  previewMaxEdge: 1600,
} as const;

export const RESIZE_TUNING = {
  /**
   * Canvas scaling (thumbnails, previews, enlarging): browsers other than
   * Chrome downscale with plain bilinear filtering, which aliases badly past
   * 2×. Above this reduction factor we halve repeatedly and finish with one
   * last sub-2× step.
   */
  progressiveThreshold: 2,
  /**
   * Exports that shrink the image by more than this factor on either axis use
   * the Lanczos resampler. At or below it (same size, or enlarging) the canvas
   * draws the image, which keeps a plain format conversion pixel-exact.
   */
  resampleAbove: 1.001,
  /**
   * Unsharp amount applied after a reduction of 2× or more, fading to zero as
   * the reduction approaches 1×. Restores the edge contrast that averaging
   * pixels takes away; 0 turns sharpening off.
   */
  sharpenAmount: 0.4,
  /** Pixels read or written per band while resampling (4 MP is 16 MB of RGBA). */
  bandPixels: 4_000_000,
} as const;

export interface TargetSizeTuning {
  minQuality: number;
  smartMinQuality: number;
  maxQuality: number;
  tolerance: number;
  maxQualityIterations: number;
  maxDimensionAttempts: number;
  shrinkSafety: number;
  minEdge: number;
  maxColors: number;
  smartMinColors: number;
  minColors: number;
}

export const TARGET_SIZE_TUNING: TargetSizeTuning = {
  /** Lowest quality the quality-only strategy will go to. */
  minQuality: 0.3,
  /**
   * "Smart" prefers a smaller, cleaner image over a full-size one full of
   * artifacts: below this quality it shrinks dimensions instead.
   */
  smartMinQuality: 0.6,
  /** Quality ceiling when the user has not chosen a quality (quick "make smaller than" mode). */
  maxQuality: 0.92,
  /** Stop searching once the best result is within this fraction below the target. */
  tolerance: 0.05,
  maxQualityIterations: 6,
  maxDimensionAttempts: 8,
  /** Conservative multiplier on sqrt(target/current) so shrinking converges instead of overshooting. */
  shrinkSafety: 0.95,
  /** Never shrink the shortest edge below this while chasing a target. */
  minEdge: 16,
  /** PNG: the most colours a palette can hold, and where the colour search starts. */
  maxColors: 256,
  /**
   * PNG "smart": below this many colours it shrinks dimensions instead. Kept
   * low because text and interface screenshots survive a small palette far
   * better than they survive being scaled down.
   */
  smartMinColors: 32,
  /** PNG: fewest colours the compress-only strategy will go to. */
  minColors: 8,
};

export const PALETTE_TUNING = {
  /**
   * Error-diffusion strength (0–1) when a PNG is reduced to a palette. Enough
   * to stop smooth gradients banding without adding much noise for the
   * compressor to pay for.
   */
  dither: 0.5,
} as const;

export const CONCURRENCY = {
  maxWorkers: 4,
  /** Sources above this many pixels count as two slots. */
  heavyPixels: 40 * MEGAPIXEL,
  /** How long a worker gets to acknowledge a cancel before it is terminated. */
  cancelGraceMs: 1500,
} as const;

export const QUALITY_DEFAULT = 0.82;
