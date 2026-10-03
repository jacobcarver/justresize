/**
 * WebP via libwebp compiled to WASM (jSquash). Only loaded in browsers whose
 * canvas cannot encode WebP natively — in practice, Safari.
 */
import encode from "@jsquash/webp/encode";
import { getContext2D } from "../canvas";
import type { ImageEncoder } from "../encode";

export const wasmWebpEncoder: ImageEncoder = {
  id: "wasm-webp",
  async encode(canvas, options) {
    const pixels = getContext2D(canvas).getImageData(0, 0, canvas.width, canvas.height);
    const buffer = await encode(pixels, { quality: Math.round((options.quality ?? 0.82) * 100) });
    return new Blob([buffer], { type: "image/webp" });
  },
};
