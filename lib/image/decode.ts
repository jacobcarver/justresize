/**
 * File → upright pixels. All browser decoding quirks stay in this file.
 */
import type { SourceFormat } from "@/types";
import { type AnyCanvas, canvasToBlob, createCanvas, getContext2D, releaseCanvas } from "./canvas";
import { ImageError, throwIfAborted } from "./errors";
import { orientationSwapsDimensions, orientationTransform, withExifOrientation } from "./metadata";

export interface DecodedImage {
  /** Upright pixels, ready for drawImage. */
  source: ImageBitmap | HTMLImageElement | AnyCanvas;
  width: number;
  height: number;
  /** Releases decoded memory. Must be called exactly once when done. */
  close(): void;
}

export interface DecodeOptions {
  format?: SourceFormat;
  /** EXIF orientation read from the file, if known. */
  orientation?: number;
  signal?: AbortSignal;
}

function decodeFailure(format: SourceFormat | undefined, detail: unknown): ImageError {
  const text = detail instanceof Error ? `${detail.name}: ${detail.message}` : String(detail);
  if (format === "heic") {
    return new ImageError(
      "unsupported_format",
      "HEIC photos can't be opened in this browser yet. Safari can open them, or convert the photo to JPEG first.",
      text,
    );
  }
  if (format === "avif") {
    return new ImageError("unsupported_format", "This browser can't open AVIF images.", text);
  }
  return new ImageError("decode_failed", "This file couldn't be read as an image. It may be damaged.", text);
}

let orientationProbe: Promise<boolean> | undefined;

/**
 * Does createImageBitmap rotate according to EXIF on its own? Current
 * browsers do, older Safari and Chrome did not. Instead of sniffing versions
 * we decode a tiny generated JPEG tagged "rotate 90°" and look at the result.
 */
export function bitmapAppliesOrientation(): Promise<boolean> {
  orientationProbe ??= (async () => {
    try {
      const canvas = createCanvas(2, 1);
      const context = getContext2D(canvas);
      context.fillStyle = "#808080";
      context.fillRect(0, 0, 2, 1);
      const jpeg = new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.5)).arrayBuffer());
      const rotated = new Blob([withExifOrientation(jpeg, 6) as BlobPart], { type: "image/jpeg" });
      const bitmap = await createImageBitmap(rotated, { imageOrientation: "from-image" });
      const applied = bitmap.width === 1 && bitmap.height === 2;
      bitmap.close();
      return applied;
    } catch {
      // If the probe itself cannot run, assume modern behaviour.
      return true;
    }
  })();
  return orientationProbe;
}

/** Bakes an EXIF rotation into pixels for browsers that do not do it themselves. */
function applyOrientation(bitmap: ImageBitmap, orientation: number): DecodedImage {
  const swap = orientationSwapsDimensions(orientation);
  const width = swap ? bitmap.height : bitmap.width;
  const height = swap ? bitmap.width : bitmap.height;
  const canvas = createCanvas(width, height);
  try {
    const context = getContext2D(canvas);
    context.setTransform(...orientationTransform(orientation, bitmap.width, bitmap.height));
    context.drawImage(bitmap, 0, 0);
  } catch (error) {
    releaseCanvas(canvas);
    throw error;
  } finally {
    bitmap.close();
  }
  return { source: canvas, width, height, close: () => releaseCanvas(canvas) };
}

async function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image element failed to load"));
      image.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  if (!image.naturalWidth || !image.naturalHeight) {
    URL.revokeObjectURL(url);
    throw new Error("Image element decoded to zero size");
  }
  // <img> has applied EXIF orientation by default in every engine since 2020.
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => {
      URL.revokeObjectURL(url);
      image.src = "";
    },
  };
}

export async function decodeImage(file: Blob, options: DecodeOptions = {}): Promise<DecodedImage> {
  throwIfAborted(options.signal);

  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (error) {
      // Some Safari versions reject files here that an <img> opens fine.
      if (typeof Image === "undefined") throw decodeFailure(options.format, error);
    }

    if (bitmap) {
      if (options.signal?.aborted) {
        bitmap.close();
        throwIfAborted(options.signal);
      }
      const orientation = options.orientation ?? 1;
      if (orientation > 1 && !(await bitmapAppliesOrientation())) {
        return applyOrientation(bitmap, orientation);
      }
      const decoded = bitmap;
      return { source: decoded, width: decoded.width, height: decoded.height, close: () => decoded.close() };
    }
  }

  if (typeof Image === "undefined") {
    throw decodeFailure(options.format, "No decoder available in this context");
  }
  try {
    const decoded = await decodeWithImageElement(file);
    if (options.signal?.aborted) {
      decoded.close();
      throwIfAborted(options.signal);
    }
    return decoded;
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw decodeFailure(options.format, error);
  }
}
