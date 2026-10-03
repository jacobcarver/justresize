/**
 * Encoder registry. The rest of the app asks for "an encoder for WebP" and
 * never learns whether that is the browser's own codec or a WASM module.
 *
 * To add a codec: write an adapter in ./encoders implementing ImageEncoder
 * and return it from `loadEncoder` below. Heavy adapters must be reached
 * through dynamic import() so they are only downloaded when first used.
 */
import { FEATURES } from "@/lib/config/features";
import type { OutputFormat } from "@/types";
import { type AnyCanvas, canvasToBlob, createCanvas, getContext2D, releaseCanvas } from "./canvas";
import { ImageError } from "./errors";
import type { PaletteEncodeResult } from "./encoders/palette-png";
import { OUTPUT_FORMATS } from "./formats";

export interface EncodeOptions {
  format: OutputFormat;
  /** Normalized 0–1. Ignored by lossless formats. */
  quality?: number;
}

/**
 * Common encoder interface. Encoders take the rendered canvas rather than
 * ImageData: native codecs need a canvas, and WASM codecs can read the
 * pixels out of one, so the canvas is the cheapest common denominator.
 */
export interface ImageEncoder {
  readonly id: string;
  encode(canvas: AnyCanvas, options: EncodeOptions): Promise<Blob>;
}

const nativeEncoder: ImageEncoder = {
  id: "native",
  async encode(canvas, options) {
    const info = OUTPUT_FORMATS[options.format];
    const blob = await canvasToBlob(canvas, info.mimeType, info.lossy ? options.quality : undefined);
    // Browsers silently fall back to PNG for types they cannot encode.
    if (blob.type !== info.mimeType) {
      throw new ImageError(
        "encoder_failed",
        `This browser can't create ${info.label} files.`,
        `Requested ${info.mimeType}, canvas produced ${blob.type || "nothing"}`,
      );
    }
    return blob;
  },
};

const nativeSupport = new Map<OutputFormat, Promise<boolean>>();

/** Whether the canvas can natively encode a format, tested once with a 1×1 canvas. */
export function supportsNativeEncode(format: OutputFormat): Promise<boolean> {
  let probe = nativeSupport.get(format);
  if (!probe) {
    probe = (async () => {
      if (format === "jpeg" || format === "png") return true;
      const canvas = createCanvas(1, 1);
      try {
        getContext2D(canvas).fillRect(0, 0, 1, 1);
        const blob = await canvasToBlob(canvas, OUTPUT_FORMATS[format].mimeType, 0.8);
        return blob.type === OUTPUT_FORMATS[format].mimeType;
      } catch {
        return false;
      } finally {
        releaseCanvas(canvas);
      }
    })();
    nativeSupport.set(format, probe);
  }
  return probe;
}

const encoders = new Map<OutputFormat, Promise<ImageEncoder>>();

async function loadEncoder(format: OutputFormat): Promise<ImageEncoder> {
  if (await supportsNativeEncode(format)) return nativeEncoder;

  if (format === "webp" && FEATURES.wasmWebp) {
    return (await import("./encoders/wasm-webp")).wasmWebpEncoder;
  }
  if (format === "avif" && FEATURES.avif) {
    return (await import("./encoders/wasm-avif")).wasmAvifEncoder;
  }
  throw new ImageError("encoder_failed", `This browser can't create ${OUTPUT_FORMATS[format].label} files.`);
}

export function getEncoder(format: OutputFormat): Promise<ImageEncoder> {
  let encoder = encoders.get(format);
  if (!encoder) {
    encoder = loadEncoder(format);
    // A failed codec download should be retried next time, not cached forever.
    encoder.catch(() => encoders.delete(format));
    encoders.set(format, encoder);
  }
  return encoder;
}

function encodeFailure(format: OutputFormat, encoderId: string, error: unknown): ImageError {
  if (error instanceof ImageError) return error;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new ImageError(
    /memory|allocation/i.test(detail) ? "memory_limit" : "encoder_failed",
    `Creating the ${OUTPUT_FORMATS[format].label} file failed.`,
    `${encoderId}: ${detail}`,
  );
}

/**
 * PNG with at most `maxColors` colours. Much smaller than a full-colour PNG at
 * the same dimensions; lossless only when the image has that few colours already.
 */
export async function encodePalettePng(canvas: AnyCanvas, maxColors: number): Promise<PaletteEncodeResult> {
  try {
    const { encodePalettePng: encode } = await import("./encoders/palette-png");
    return encode(canvas, maxColors);
  } catch (error) {
    throw encodeFailure("png", "palette-png", error);
  }
}

export async function encodeCanvas(canvas: AnyCanvas, options: EncodeOptions): Promise<Blob> {
  const encoder = await getEncoder(options.format);
  try {
    return await encoder.encode(canvas, options);
  } catch (error) {
    throw encodeFailure(options.format, encoder.id, error);
  }
}
