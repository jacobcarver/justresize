/**
 * The renderer: decoded pixels + a RenderPlan → a canvas holding the output
 * pixels. All resampling decisions are made here so they can be tuned without
 * touching anything else.
 *
 * Exports that shrink the image go through the Lanczos resampler in
 * resample.ts. Canvas scaling is kept for thumbnails and previews, where speed
 * matters more than the last bit of sharpness, and for enlarging.
 */
import { RESIZE_TUNING } from "@/lib/config/limits";
import type { Rect, Size } from "@/types";
import {
  type AnyCanvas,
  type AnyContext2D,
  assertCanvasUsable,
  createCanvas,
  getContext2D,
  releaseCanvas,
} from "./canvas";
import type { RenderPlan } from "./geometry";
import { resample } from "./resample";

export type Drawable = ImageBitmap | HTMLImageElement | AnyCanvas;

function drawableSize(source: Drawable): Size {
  if ("naturalWidth" in source) return { width: source.naturalWidth, height: source.naturalHeight };
  return { width: source.width, height: source.height };
}

/**
 * The intermediate sizes used to get from `from` to `to`. Empty when a single
 * draw is good enough.
 *
 * Canvas downscaling is only guaranteed to be bilinear, which samples four
 * source pixels per output pixel. Past a 2× reduction it starts skipping
 * pixels and the result shimmers and aliases. Halving repeatedly keeps every
 * step inside the range where bilinear behaves like a box filter.
 */
export function downscaleSteps(
  from: { width: number; height: number },
  to: { width: number; height: number },
  threshold: number = RESIZE_TUNING.progressiveThreshold,
): { width: number; height: number }[] {
  const steps: { width: number; height: number }[] = [];
  let width = from.width;
  let height = from.height;

  // Each axis is halved independently so stretch (non-uniform scale) still
  // gets clean steps on the axis that needs them.
  while (width / to.width > threshold || height / to.height > threshold) {
    const nextWidth = width / to.width > threshold ? Math.max(to.width, Math.ceil(width / 2)) : width;
    const nextHeight = height / to.height > threshold ? Math.max(to.height, Math.ceil(height / 2)) : height;
    if (nextWidth === width && nextHeight === height) break;
    width = nextWidth;
    height = nextHeight;
    steps.push({ width, height });
  }
  return steps;
}

/** How much the plan shrinks the source on its most reduced axis (1 = not at all). */
function reductionFactor(plan: RenderPlan): number {
  return Math.max(plan.src.width / plan.dst.width, plan.src.height / plan.dst.height);
}

/**
 * Resampling softens edges in proportion to how much detail is discarded, so
 * the sharpen fades in with the reduction and is at full strength from 2×.
 */
export function sharpenAmount(reduction: number, full: number = RESIZE_TUNING.sharpenAmount): number {
  return full * Math.min(1, Math.max(0, reduction - 1));
}

/** Canvas scaling, staged so that every step stays within what bilinear filtering handles well. */
function drawStaged(context: AnyContext2D, source: Drawable, plan: RenderPlan): void {
  let intermediate: AnyCanvas | null = null;
  try {
    let current: Drawable = source;
    let region: Rect = plan.src;

    for (const step of downscaleSteps(plan.src, plan.dst)) {
      const next = createCanvas(step.width, step.height);
      try {
        const stepContext = getContext2D(next);
        stepContext.drawImage(current, region.x, region.y, region.width, region.height, 0, 0, step.width, step.height);
      } catch (error) {
        releaseCanvas(next);
        throw error;
      }
      releaseCanvas(intermediate);
      intermediate = next;
      current = next;
      region = { x: 0, y: 0, width: step.width, height: step.height };
    }

    context.drawImage(
      current,
      region.x,
      region.y,
      region.width,
      region.height,
      plan.dst.x,
      plan.dst.y,
      plan.dst.width,
      plan.dst.height,
    );
  } finally {
    releaseCanvas(intermediate);
  }
}

/**
 * Lanczos resampling plus a light sharpen. Pixels are read from the source and
 * written to the output a band at a time through small scratch canvases, so
 * memory stays bounded for very large images.
 */
function drawResampled(context: AnyContext2D, source: Drawable, plan: RenderPlan): void {
  const { dst } = plan;
  let reader: AnyCanvas | null = null;
  let writer: AnyCanvas | null = null;
  let readContext: AnyContext2D | null = null;
  let writeContext: AnyContext2D | null = null;

  try {
    resample(
      {
        source: drawableSize(source),
        region: plan.src,
        target: { width: dst.width, height: dst.height },
        sharpen: sharpenAmount(reductionFactor(plan)),
        bandPixels: RESIZE_TUNING.bandPixels,
      },
      {
        read(x, y, width, height) {
          if (!reader || !readContext) {
            // Every band is at least as tall as the ones after it, so the first sets the size.
            reader = createCanvas(width, height);
            readContext = getContext2D(reader, { willReadFrequently: true });
            // Replace rather than blend, so one band's pixels never show through the next.
            readContext.globalCompositeOperation = "copy";
          }
          readContext.drawImage(source, x, y, width, height, 0, 0, width, height);
          return readContext.getImageData(0, 0, width, height).data;
        },
        write(y, height, pixels) {
          if (!writer || !writeContext) {
            writer = createCanvas(dst.width, height);
            writeContext = getContext2D(writer);
          }
          // putImageData replaces pixels outright; going through a canvas lets
          // transparent areas blend over the background already painted.
          writeContext.putImageData(new ImageData(pixels, dst.width, height), 0, 0);
          context.drawImage(writer, 0, 0, dst.width, height, dst.x, dst.y + y, dst.width, height);
        },
      },
    );
  } finally {
    releaseCanvas(reader);
    releaseCanvas(writer);
  }
}

export interface RenderOptions {
  /** CSS colour painted under the image, or null for a transparent canvas. */
  background: string | null;
  /**
   * "best" resamples reductions with Lanczos and sharpens lightly: the export.
   * "fast" leaves scaling to the canvas: thumbnails and previews.
   */
  quality: "fast" | "best";
}

export function renderPlan(source: Drawable, plan: RenderPlan, options: RenderOptions): AnyCanvas {
  const canvas = createCanvas(plan.canvas.width, plan.canvas.height);

  try {
    const context = getContext2D(canvas);
    assertCanvasUsable(canvas, context);

    if (options.background) {
      context.fillStyle = options.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (options.quality === "best" && reductionFactor(plan) > RESIZE_TUNING.resampleAbove) {
      drawResampled(context, source, plan);
    } else {
      drawStaged(context, source, plan);
    }
    return canvas;
  } catch (error) {
    releaseCanvas(canvas);
    throw error;
  }
}
