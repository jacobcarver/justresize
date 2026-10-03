/**
 * AVIF via libavif compiled to WASM (jSquash). ~3.5 MB, so it is only
 * downloaded the first time someone actually exports AVIF.
 *
 * This imports jSquash's single-threaded codec directly rather than its
 * `encode` entry point. That entry point also references a multi-threaded
 * build whose worker file imports the codec that spawned it; the cycle hangs
 * Turbopack's production build, and the threaded build could not run here
 * anyway — it needs SharedArrayBuffer, i.e. cross-origin isolation headers
 * this site does not send. Our own worker pool provides the parallelism.
 */
import createAvifEncoder, { type AVIFModule } from "@jsquash/avif/codec/enc/avif_enc.js";
import { defaultOptions } from "@jsquash/avif/meta.js";
import { getContext2D } from "../canvas";
import type { ImageEncoder } from "../encode";

let modulePromise: Promise<AVIFModule> | undefined;

function loadModule(): Promise<AVIFModule> {
  if (modulePromise) return modulePromise;
  const loading = createAvifEncoder({ noInitialRun: true });
  // A failed download should be retried on the next export.
  loading.catch(() => {
    if (modulePromise === loading) modulePromise = undefined;
  });
  modulePromise = loading;
  return loading;
}

/**
 * libavif's 0–100 scale is not JPEG's: 65 already looks like a JPEG in the
 * low 80s, and values above ~80 mostly add bytes. Map our normalized quality
 * so the default (0.82) lands at 65 and 1.0 still reaches the top.
 */
export function toAvifQuality(quality: number): number {
  const q = Math.min(1, Math.max(0, quality));
  const mapped = q <= 0.82 ? (q / 0.82) * 65 : 65 + ((q - 0.82) / 0.18) * 35;
  return Math.max(1, Math.round(mapped));
}

export const wasmAvifEncoder: ImageEncoder = {
  id: "wasm-avif",
  async encode(canvas, options) {
    const codec = await loadModule();
    const pixels = getContext2D(canvas).getImageData(0, 0, canvas.width, canvas.height);
    const output = codec.encode(new Uint8Array(pixels.data.buffer), pixels.width, pixels.height, {
      ...defaultOptions,
      quality: toAvifQuality(options.quality ?? 0.82),
      // Encoder effort: 10 is fastest. 8 keeps large photos to seconds
      // instead of minutes for a few percent more bytes.
      speed: 8,
    });
    if (!output) throw new Error("AVIF encoder returned no data");
    return new Blob([output as BlobPart], { type: "image/avif" });
  },
};
