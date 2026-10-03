/**
 * Pure resize/crop math. No canvas, no DOM — everything here is unit tested
 * and shared by the export engine and the live preview so the two can never
 * disagree about what ends up in the output.
 */
import { LIMITS } from "@/lib/config/limits";
import { clamp, isPositiveFinite, roundPx } from "@/lib/utils/math";
import type { CropSettings, Point, Rect, ResizeFit, Size, TransformConfig } from "@/types";
import { ImageError } from "./errors";

export const DEFAULT_CROP: CropSettings = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_ZOOM = 8;

/** The subset of TransformConfig that determines geometry. */
export type GeometryConfig = Pick<
  TransformConfig,
  "resizeMode" | "width" | "height" | "percentage" | "maintainAspectRatio" | "aspectRatio" | "fit" | "crop"
>;

export interface RenderPlan {
  /** Output dimensions. */
  canvas: Size;
  /** Region of the source that is sampled (source pixels, may be fractional). */
  src: Rect;
  /** Where that region lands on the canvas (whole pixels). */
  dst: Rect;
  /** True when the image does not cover the whole canvas, so background shows. */
  padded: boolean;
  /** True when source pixels are being enlarged. */
  upscaled: boolean;
}

/**
 * A clean { width, height } copy. Callers often pass richer objects (a
 * decoded image, an asset); spreading those would smuggle bitmaps and
 * functions into values that later cross the worker boundary.
 */
export function sizeOf(size: Size): Size {
  return { width: size.width, height: size.height };
}

export function calculateAspectRatio(size: Size): number {
  return size.width / size.height;
}

export function calculateDimensionsFromWidth(source: Size, width: number): Size {
  return { width: roundPx(width), height: roundPx((width * source.height) / source.width) };
}

export function calculateDimensionsFromHeight(source: Size, height: number): Size {
  return { width: roundPx((height * source.width) / source.height), height: roundPx(height) };
}

export function calculatePercentage(source: Size, percentage: number): Size {
  return {
    width: roundPx((source.width * percentage) / 100),
    height: roundPx((source.height * percentage) / 100),
  };
}

/**
 * Scales `source` to fit inside a box without changing its ratio and without
 * adding canvas. Either side of the box may be omitted (unconstrained).
 */
export function calculateInside(
  source: Size,
  box: { width?: number; height?: number },
  options: { allowUpscale: boolean },
): Size {
  let scale = Infinity;
  if (isPositiveFinite(box.width)) scale = Math.min(scale, box.width / source.width);
  if (isPositiveFinite(box.height)) scale = Math.min(scale, box.height / source.height);
  if (!Number.isFinite(scale)) return sizeOf(source);
  if (!options.allowUpscale) scale = Math.min(1, scale);
  if (scale === 1) return sizeOf(source);
  return { width: roundPx(source.width * scale), height: roundPx(source.height * scale) };
}

/**
 * Contain: the whole source, scaled to fit the canvas and centred.
 * Returns the destination rectangle on the canvas.
 */
export function calculateContain(source: Size, canvas: Size): Rect {
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
  const width = Math.min(canvas.width, roundPx(source.width * scale));
  const height = Math.min(canvas.height, roundPx(source.height * scale));
  return {
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
  };
}

/**
 * Cover: the region of the source that fills the output completely once
 * scaled. The crop window is centred on the focal point and clamped so it
 * never leaves the image. A smart-crop detector only has to supply `focalPoint`.
 */
export function calculateCropRegion(input: {
  sourceDimensions: Size;
  outputDimensions: Size;
  focalPoint?: Point;
  zoom?: number;
}): Rect {
  const { sourceDimensions: source, outputDimensions: output } = input;
  const focal = input.focalPoint ?? DEFAULT_CROP;
  const zoom = clamp(input.zoom ?? 1, 1, MAX_ZOOM);

  const sourceRatio = source.width / source.height;
  const outputRatio = output.width / output.height;

  let width: number;
  let height: number;
  if (sourceRatio > outputRatio) {
    height = source.height;
    width = height * outputRatio;
  } else {
    width = source.width;
    height = width / outputRatio;
  }
  width /= zoom;
  height /= zoom;

  const x = clamp(clamp(focal.x, 0, 1) * source.width - width / 2, 0, source.width - width);
  const y = clamp(clamp(focal.y, 0, 1) * source.height - height / 2, 0, source.height - height);
  return { x, y, width, height };
}

/** Alias kept for readability at call sites that think in terms of "cover". */
export const calculateCover = calculateCropRegion;

/**
 * The focal point that reproduces a given crop window. Used by the preview so
 * a drag that hits the image edge does not accumulate "dead" travel.
 */
export function focalPointFromCrop(source: Size, crop: Rect): Point {
  return {
    x: clamp((crop.x + crop.width / 2) / source.width, 0, 1),
    y: clamp((crop.y + crop.height / 2) / source.height, 0, 1),
  };
}

/** True when the config pins both output dimensions, so `fit` decides how the image maps onto them. */
export function isBoxed(config: GeometryConfig): boolean {
  if (config.resizeMode !== "dimensions") return false;
  const hasWidth = isPositiveFinite(config.width);
  const hasHeight = isPositiveFinite(config.height);
  if (hasWidth && hasHeight) return true;
  return config.maintainAspectRatio && hasValidRatio(config);
}

function hasValidRatio(config: GeometryConfig): boolean {
  return !!config.aspectRatio && isPositiveFinite(config.aspectRatio.w) && isPositiveFinite(config.aspectRatio.h);
}

/** The box (before `fit`) that a "dimensions" config asks for. */
function resolveDimensionsBox(source: Size, config: GeometryConfig): Size {
  const hasWidth = isPositiveFinite(config.width);
  const hasHeight = isPositiveFinite(config.height);

  if (hasWidth && hasHeight) {
    return { width: roundPx(config.width!), height: roundPx(config.height!) };
  }

  if (config.maintainAspectRatio && hasValidRatio(config)) {
    const ratio = config.aspectRatio!.w / config.aspectRatio!.h;
    if (hasWidth) return { width: roundPx(config.width!), height: roundPx(config.width! / ratio) };
    if (hasHeight) return { width: roundPx(config.height! * ratio), height: roundPx(config.height!) };

    // Ratio only, no size: change shape without resampling more than necessary.
    // Cover trims to the largest box of that ratio; contain pads out to the smallest.
    const sourceRatio = source.width / source.height;
    const trimToFit = config.fit !== "contain";
    if (sourceRatio > ratio === trimToFit) {
      return { width: roundPx(source.height * ratio), height: source.height };
    }
    return { width: source.width, height: roundPx(source.width / ratio) };
  }

  if (hasWidth) return calculateDimensionsFromWidth(source, config.width!);
  if (hasHeight) return calculateDimensionsFromHeight(source, config.height!);
  return sizeOf(source);
}

/** Final output dimensions for one source under one config. */
export function resolveOutputSize(source: Size, config: GeometryConfig): Size {
  switch (config.resizeMode) {
    case "percentage":
      return isPositiveFinite(config.percentage)
        ? calculatePercentage(source, config.percentage)
        : sizeOf(source);
    case "max-dimensions":
      // A maximum never enlarges: images already inside the box pass through.
      return calculateInside(source, { width: config.width, height: config.height }, { allowUpscale: false });
    case "target-filesize":
      return sizeOf(source);
    case "dimensions": {
      const box = resolveDimensionsBox(source, config);
      if (config.fit === "inside" && isBoxed(config)) {
        return calculateInside(source, box, { allowUpscale: true });
      }
      return box;
    }
  }
}

function fitForPlan(config: GeometryConfig): ResizeFit {
  return isBoxed(config) ? config.fit : "stretch";
}

/**
 * Everything the renderer needs: output size, which source pixels to sample
 * and where they go.
 */
export function computeRenderPlan(source: Size, config: GeometryConfig): RenderPlan {
  const canvas = resolveOutputSize(source, config);
  const full: Rect = { x: 0, y: 0, width: source.width, height: source.height };
  const whole: Rect = { x: 0, y: 0, width: canvas.width, height: canvas.height };

  let src = full;
  let dst = whole;

  switch (fitForPlan(config)) {
    case "cover":
      src = calculateCropRegion({
        sourceDimensions: source,
        outputDimensions: canvas,
        focalPoint: config.crop,
        zoom: config.crop.zoom,
      });
      break;
    case "contain":
      dst = calculateContain(source, canvas);
      break;
    case "stretch":
    case "inside":
      // Unboxed sizes and "inside" already have the source's ratio (to the
      // nearest pixel), so the full image maps onto the full canvas.
      break;
  }

  return {
    canvas,
    src,
    dst,
    padded: dst.width < canvas.width || dst.height < canvas.height,
    upscaled: dst.width / src.width > 1.001 || dst.height / src.height > 1.001,
  };
}

/** Shrinks (or grows) a plan uniformly. Used when a file-size target forces smaller dimensions. */
export function scaleRenderPlan(plan: RenderPlan, scale: number): RenderPlan {
  if (scale === 1) return plan;
  const canvas = { width: roundPx(plan.canvas.width * scale), height: roundPx(plan.canvas.height * scale) };
  let dst: Rect;
  if (plan.padded) {
    const width = Math.min(canvas.width, roundPx(plan.dst.width * scale));
    const height = Math.min(canvas.height, roundPx(plan.dst.height * scale));
    dst = {
      x: Math.round((canvas.width - width) / 2),
      y: Math.round((canvas.height - height) / 2),
      width,
      height,
    };
  } else {
    dst = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }
  return {
    canvas,
    src: plan.src,
    dst,
    padded: plan.padded,
    upscaled: dst.width / plan.src.width > 1.001 || dst.height / plan.src.height > 1.001,
  };
}

/** True when stretch will visibly distort this source. */
export function distortsAspectRatio(source: Size, config: GeometryConfig): boolean {
  if (!isBoxed(config) || config.fit !== "stretch") return false;
  const canvas = resolveOutputSize(source, config);
  const sourceRatio = source.width / source.height;
  const outputRatio = canvas.width / canvas.height;
  return Math.abs(sourceRatio - outputRatio) / sourceRatio > 0.01;
}

const numberFormat = new Intl.NumberFormat("en-US");

/** Returns an error when an output size cannot be produced safely, otherwise null. */
export function validateOutputSize(size: Size): ImageError | null {
  const { width, height } = size;
  if (![width, height].every((v) => Number.isFinite(v) && v >= 1)) {
    return new ImageError("invalid_config", "Output dimensions must be at least 1 × 1 pixel.");
  }
  if (width > LIMITS.maxOutputDimension || height > LIMITS.maxOutputDimension) {
    return new ImageError(
      "output_too_large",
      `${numberFormat.format(width)} × ${numberFormat.format(height)} is too large. The longest side can be at most ${numberFormat.format(LIMITS.maxOutputDimension)} px.`,
    );
  }
  if (width * height > LIMITS.maxOutputPixels) {
    return new ImageError(
      "output_too_large",
      `${numberFormat.format(width)} × ${numberFormat.format(height)} is too large. Outputs can be at most ${Math.round(LIMITS.maxOutputPixels / 1_000_000)} megapixels.`,
    );
  }
  return null;
}

/** Returns an error when a source image is too large to decode safely, otherwise null. */
export function validateSourceSize(size: Size): ImageError | null {
  const { width, height } = size;
  if (
    width > LIMITS.maxSourceDimension ||
    height > LIMITS.maxSourceDimension ||
    width * height > LIMITS.maxSourcePixels
  ) {
    return new ImageError(
      "memory_limit",
      `This image is ${numberFormat.format(width)} × ${numberFormat.format(height)} pixels and exceeds the current browser processing limit.`,
    );
  }
  return null;
}
