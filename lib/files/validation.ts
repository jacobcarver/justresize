/**
 * File validation. `precheckFile` is synchronous and runs the instant files
 * are added, so obviously wrong files (a PDF, a video, a 2 GB TIFF) are
 * rejected before any decoding is attempted. The byte-level checks that need
 * to read the file happen in the engine's inspect step.
 */
import { LIMITS } from "@/lib/config/limits";
import { ImageError } from "@/lib/image/errors";
import { sourceFormatFromExtension, sourceFormatFromMime } from "@/lib/image/formats";
import type { SniffResult } from "@/lib/image/sniff";
import { formatBytes } from "@/lib/utils/bytes";
import type { SourceFormat } from "@/types";
import { splitFilename } from "./naming";

const SUPPORTED_HINT = "JustResize works with JPEG, PNG and WebP images.";

/** Best guess at the format from the MIME type, falling back to the extension. */
export function hintedFormat(file: { name: string; type: string }): SourceFormat | undefined {
  return sourceFormatFromMime(file.type) ?? sourceFormatFromExtension(splitFilename(file.name).extension);
}

function describeUnsupported(file: { name: string; type: string }): string {
  const { extension } = splitFilename(file.name);
  const type = file.type.toLowerCase();
  if (type === "application/pdf" || extension === "pdf") return `PDF files aren't supported. ${SUPPORTED_HINT}`;
  if (type === "image/svg+xml" || extension === "svg") return `SVG files aren't supported yet. ${SUPPORTED_HINT}`;
  if (type.startsWith("video/")) return `Videos aren't supported. ${SUPPORTED_HINT}`;
  if (type === "image/tiff" || extension === "tif" || extension === "tiff") return `TIFF files aren't supported yet. ${SUPPORTED_HINT}`;
  if (type === "image/bmp" || extension === "bmp") return `BMP files aren't supported yet. ${SUPPORTED_HINT}`;
  if (extension) return `.${extension} files aren't supported. ${SUPPORTED_HINT}`;
  return `This file type isn't supported. ${SUPPORTED_HINT}`;
}

/** Instant checks that need nothing but the File's own properties. */
export function precheckFile(file: File): ImageError | null {
  if (file.size === 0) {
    return new ImageError("decode_failed", "This file is empty.");
  }
  if (!hintedFormat(file)) {
    return new ImageError("unsupported_format", describeUnsupported(file));
  }
  if (file.size > LIMITS.maxFileBytes) {
    return new ImageError(
      "memory_limit",
      `This file is ${formatBytes(file.size)}. The largest file the browser can safely process is ${formatBytes(LIMITS.maxFileBytes)}.`,
    );
  }
  return null;
}

/** Turns what the file's bytes revealed into a rejection, or null when it is a still image we can try to decode. */
export function checkSniffResult(sniff: SniffResult): ImageError | null {
  if (sniff.foreign) {
    const label = { pdf: "a PDF", svg: "an SVG", bmp: "a BMP", tiff: "a TIFF" }[sniff.foreign];
    return new ImageError("unsupported_format", `This file is actually ${label}, which isn't supported. ${SUPPORTED_HINT}`);
  }
  if (!sniff.format) {
    return new ImageError("decode_failed", "This file couldn't be read as an image. It may be damaged or mislabeled.");
  }
  if (sniff.animated) {
    const label = { gif: "GIFs", webp: "WebP images", png: "PNGs", avif: "AVIF images" }[sniff.format as string] ?? "images";
    return new ImageError(
      "unsupported_format",
      `Animated ${label} aren't supported yet. Resizing would keep only the first frame, so this file was skipped.`,
    );
  }
  return null;
}
