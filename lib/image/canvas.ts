/**
 * Canvas helpers that work identically in a worker (OffscreenCanvas) and on
 * the main thread (HTMLCanvasElement fallback for browsers without
 * OffscreenCanvas). Nothing outside this file should care which one it has.
 */
import { ImageError } from "./errors";

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
export type AnyContext2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** Canvases above this area get an explicit "did the browser really allocate it" check. */
const VERIFY_ABOVE_PIXELS = 16_000_000;

let offscreenUsable: boolean | undefined;

function canUseOffscreenCanvas(): boolean {
  if (offscreenUsable === undefined) {
    try {
      offscreenUsable = typeof OffscreenCanvas !== "undefined" && !!new OffscreenCanvas(1, 1).getContext("2d");
    } catch {
      offscreenUsable = false;
    }
  }
  return offscreenUsable;
}

export function createCanvas(width: number, height: number): AnyCanvas {
  if (canUseOffscreenCanvas()) return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new ImageError("unknown", "This browser can't process images here.", "No canvas implementation available");
}

export function getContext2D(canvas: AnyCanvas, options?: CanvasRenderingContext2DSettings): AnyContext2D {
  const context = canvas.getContext("2d", options) as AnyContext2D | null;
  if (!context) {
    throw new ImageError(
      "memory_limit",
      "The browser ran out of memory for this image.",
      `getContext("2d") returned null for ${canvas.width}×${canvas.height}`,
    );
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

/**
 * Browsers fail silently when a canvas exceeds their size limit (notably iOS
 * Safari at ~16.7 MP): drawing does nothing and the export is blank. Writing
 * one pixel in the far corner and reading it back exposes that before we
 * hand the user an empty image.
 */
export function assertCanvasUsable(canvas: AnyCanvas, context: AnyContext2D): void {
  if (canvas.width * canvas.height < VERIFY_ABOVE_PIXELS) return;
  const x = canvas.width - 1;
  const y = canvas.height - 1;
  context.save();
  context.fillStyle = "#000";
  context.fillRect(x, y, 1, 1);
  const alpha = context.getImageData(x, y, 1, 1).data[3];
  context.clearRect(x, y, 1, 1);
  context.restore();
  if (alpha === 0) {
    throw new ImageError(
      "output_too_large",
      `${canvas.width} × ${canvas.height} is larger than this browser can process. Try a smaller size.`,
      "Canvas allocation probe failed",
    );
  }
}

/** Frees the backing store immediately instead of waiting for garbage collection. */
export function releaseCanvas(canvas: AnyCanvas | null | undefined): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

export async function canvasToBlob(canvas: AnyCanvas, mimeType: string, quality?: number): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageError("encoder_failed", "The browser couldn't create the output file.", "toBlob returned null"));
      },
      mimeType,
      quality,
    );
  });
}
