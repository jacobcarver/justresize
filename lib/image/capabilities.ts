/**
 * Feature detection — by testing what the browser does, never by reading the
 * user agent. Browser-only: call from client code after mount.
 */
import type { BrowserCapabilities } from "@/types";

let cached: BrowserCapabilities | undefined;

function canvasEncodes(mimeType: string): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    // Unsupported types silently come back as PNG.
    return canvas.toDataURL(mimeType).startsWith(`data:${mimeType}`);
  } catch {
    return false;
  }
}

function offscreenCanvasWorks(): boolean {
  try {
    return typeof OffscreenCanvas !== "undefined" && !!new OffscreenCanvas(1, 1).getContext("2d");
  } catch {
    return false;
  }
}

export function detectCapabilities(): BrowserCapabilities {
  cached ??= {
    offscreenCanvas: offscreenCanvasWorks(),
    webWorkers: typeof Worker !== "undefined",
    createImageBitmap: typeof createImageBitmap === "function",
    webpEncode: canvasEncodes("image/webp"),
    avifEncode: canvasEncodes("image/avif"),
  };
  return cached;
}

/** Workers are only worth using when the worker can also decode and draw. */
export function canProcessInWorker(capabilities: BrowserCapabilities): boolean {
  return capabilities.webWorkers && capabilities.offscreenCanvas && capabilities.createImageBitmap;
}
